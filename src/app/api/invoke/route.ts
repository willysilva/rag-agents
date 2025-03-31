import { NextRequest, NextResponse } from 'next/server';
import Agent, { IApiToken } from '@/models/Agent';
import connectDB from '@/lib/mongodb';
import { AgentService } from '@/services/agentService';
import { Ratelimit } from "@upstash/ratelimit";
import IORedis from "ioredis";
import type { Redis as RedisType } from 'ioredis';
import ApiUsageLog from '@/models/ApiUsageLog';
import { Types } from 'mongoose'; 

// --- Redis/Ratelimit Config (como antes) ---
let redis: RedisType | null = null;
try {
  if (process.env.REDIS_URL) {
      redis = new IORedis(process.env.REDIS_URL);
      console.log(`Cliente ioredis conectado em: ${process.env.REDIS_URL}`);
      redis.on('error', (error: Error) => { console.error("Erro no cliente ioredis:", error); });
      redis.on('connect', () => { console.log("Cliente ioredis reconectado."); });
  } else {
      console.warn("REDIS_URL não encontrada. Rate limiting desativado.");
  }
} catch (error: any) { 
    console.error("Erro ao inicializar ioredis:", error);
    redis = null; 
}
const ratelimiters = new Map<string, Ratelimit>();
function getRatelimiter(agentId: string, config: { requests: number, windowSeconds: number }): Ratelimit | null {
    if (!redis) return null; 
    if (ratelimiters.has(agentId)) return ratelimiters.get(agentId)!;
    const ratelimit = new Ratelimit({
        redis: redis as any, 
        limiter: Ratelimit.slidingWindow(config.requests, `${config.windowSeconds} s`), 
        analytics: true, prefix: `ratelimit_agent:${agentId}` });
    ratelimiters.set(agentId, ratelimit);
    return ratelimit;
}
// --- Fim Redis/Ratelimit Config ---

// --- Função Auxiliar getIpAddress (como antes) ---
function getIpAddress(req: NextRequest): string | undefined {
    let ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || undefined;
    if (ip) return ip;
    ip = req.headers.get('x-real-ip') || undefined;
    if (ip) return ip;
    return undefined;
}
// --- Fim getIpAddress ---

/**
 * @route POST /api/invoke
 * @description Endpoint para interagir com um agente via API usando Bearer Token.
 */
export async function POST(request: NextRequest) { // Remover { params }
  const startTime = Date.now();
  let agentId: string | undefined;
  let tokenId: string | undefined;
  let success = false;
  let errorMessage: string | undefined;
  let responseLength: number | undefined;
  let inputLength: number | undefined;
  let apiToken: string | undefined; // Variável para guardar o token extraído
  let apiTokenHint: string = 'Token não fornecido'; // Hint para logs

  const ipAddress = getIpAddress(request);

  // --- Extrair Token do Cabeçalho Authorization --- 
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      errorMessage = 'Cabeçalho Authorization ausente ou mal formatado (Esperado: Bearer <token>).';
      console.warn(`[ApiUsageLog] Tentativa sem Bearer token válido. IP: ${ipAddress}`);
      // Logar tentativa falha ANTES de retornar
      try { /* ... (código de log simplificado para falha) ... */ } catch {} 
      return NextResponse.json({ success: false, error: errorMessage }, { status: 401 }); // Unauthorized
  }
  apiToken = authHeader.substring(7); // Remover "Bearer "
  apiTokenHint = `...${apiToken.slice(-4)}`; // Atualizar hint
  // ---------------------------------------------

  if (!apiToken) { // Verificação extra caso substring falhe (improvável)
      errorMessage = 'Token não encontrado no cabeçalho Authorization.';
      // Logar tentativa falha
      try { /* ... (código de log simplificado para falha) ... */ } catch {} 
      return NextResponse.json({ success: false, error: errorMessage }, { status: 401 });
  }

  try {
    await connectDB();

    // Buscar Agente pelo Token (lógica como antes, usando a variável `apiToken`)
    const agent = await Agent.findOne({ 
        apiTokens: { $elemMatch: { token: apiToken, isActive: true } }
     })
      .select('+apiKey +temperature +systemPrompt +isActive +name +_id +rateLimit +apiTokens.token +apiTokens.label +apiTokens.isActive +apiTokens.lastUsedAt +apiTokens.revokedAt +apiTokens.createdAt +apiTokens._id') 
      .exec();

    if (!agent) {
      errorMessage = 'Agente não encontrado ou token inválido/inativo';
       console.warn(`[ApiUsageLog] Tentativa com token inválido/inativo: ${apiTokenHint}. IP: ${ipAddress}`);
      // Logar tentativa falha
      try { /* ... (código de log simplificado para falha) ... */ } catch {} 
      return NextResponse.json({ success: false, error: errorMessage }, { status: 404 }); // Not Found ou 401?
    }
    agentId = agent._id.toString();
    
    if (!agent.isActive) {
        errorMessage = 'Este agente está atualmente desativado.';
        // Logar tentativa falha
        try { /* ... (código de log simplificado para falha) ... */ } catch {} 
        return NextResponse.json({ success: false, error: errorMessage }, { status: 403 });
    }

    // Encontrar o subdocumento do token (lógica como antes, usando `apiToken`)
    const usedTokenDoc = agent.apiTokens.find((t: IApiToken) => t.token === apiToken && t.isActive);
    if (!usedTokenDoc) {
        errorMessage = 'Erro interno ao validar o token.';
        console.error(`[Invoke Error] Token ${apiTokenHint} encontrado no agente ${agentId}, mas não no subdocumento?`);
         // Logar tentativa falha
        try { /* ... (código de log simplificado para falha) ... */ } catch {} 
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
    tokenId = usedTokenDoc._id.toString(); 

    // Pegar inputLength (como antes)
    try {
       const requestBody = await request.clone().json(); 
       if (requestBody.message && typeof requestBody.message === 'string') {
           inputLength = requestBody.message.length;
       }
    } catch { /* Ignorar */ }

    // --- Rate Limiting (lógica como antes, usando `apiToken` como identifier) ---
    if (agentId && agent.rateLimit?.requests && agent.rateLimit?.windowSeconds && redis) {
      const ratelimiter = getRatelimiter(agentId, agent.rateLimit);
      if (ratelimiter) {
        const identifier = apiToken; 
        const result = await ratelimiter.limit(identifier);
        const headers = new Headers();
        headers.set('X-RateLimit-Limit', result.limit.toString());
        headers.set('X-RateLimit-Remaining', result.remaining.toString());
        headers.set('X-RateLimit-Reset', Math.ceil((result.reset - Date.now()) / 1000).toString());

        if (!result.success) {
          errorMessage = 'Limite de taxa excedido';
          console.log(`Rate limit excedido para agente ${agentId} (token: ${apiTokenHint})`);
           // Logar tentativa falha
          try { /* ... (código de log simplificado para falha) ... */ } catch {} 
          return NextResponse.json(
            { success: false, error: "Limite de taxa excedido. Tente novamente mais tarde." },
            { status: 429, headers: headers }
          );
        }
         console.log(`Rate limit OK para agente ${agentId} (token: ${apiTokenHint}). Restantes: ${result.remaining}/${result.limit}`);
      } else {
           console.warn(`Ratelimiter não pôde ser criado para agente ${agentId} (Redis indisponível?).`);
      }
    } else {
        if(redis && agentId) console.log(`Rate limit não configurado para agente ${agentId}.`);
    }
    // --- Fim Rate Limiting ---

    // Ler corpo da requisição (como antes)
    const { message } = await request.json();
    if (!message || typeof message !== 'string') { 
        errorMessage = 'Campo "message" inválido ou ausente.';
         // Logar tentativa falha
        try { /* ... (código de log simplificado para falha) ... */ } catch {} 
        return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }
    inputLength = message.length;

    // --- Lógica de Interação com o Agente (como antes) --- 
    const agentResponse = await AgentService.getAgentApiResponse(agent, message);
    success = true; 
    responseLength = agentResponse.length;
    
    // --- Atualizar lastUsedAt (como antes) --- 
    try {
        usedTokenDoc.lastUsedAt = new Date();
        await agent.save(); 
    } catch (saveError: any) {
        console.error(`Erro ao atualizar lastUsedAt para token ${tokenId}:`, saveError);
    }
    // ---------------------------------------------
        
    // Retornar sucesso (como antes)
    return NextResponse.json({
      success: true,
      response: agentResponse, 
      agentId: agent._id 
    });

  } catch (error: any) {
    console.error(`Erro ao invocar agente com token ${apiTokenHint}:`, error);
    success = false;
    errorMessage = error.message || 'Erro interno do servidor';
     // Logar falha ANTES de retornar
     try { /* ... (código de log simplificado para falha) ... */ } catch {} 
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  } finally {
    // --- Logging de Uso (como antes, mas usando apiTokenHint) --- 
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    
    try {
        await connectDB(); 
        const logEntry = new ApiUsageLog({
            agentId: agentId ? new Types.ObjectId(agentId) : null, 
            tokenId: tokenId ? new Types.ObjectId(tokenId) : null, 
            apiTokenHint: apiTokenHint, // Usar o hint definido
            timestamp: new Date(startTime),
            success,
            inputLength,
            outputLength: responseLength,
            durationMs,
            errorMessage,
            ipAddress
        });
        await logEntry.save();
        if(agentId && success) console.log(`[ApiUsageLog] Registro salvo para agente ${agentId} (Token: ${tokenId}, Sucesso: ${success})`);
      } catch (logError: any) {
        console.error(`Erro ao salvar log de uso da API (Token Hint: ${apiTokenHint}):`, logError);
      }
    // --- Fim do Logging --- 
  }
}

// Remover a rota GET que estava comentada, pois não é mais relevante neste endpoint estático. 