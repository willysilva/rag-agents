import { NextRequest, NextResponse } from "next/server";
import { OpenAI, ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { AgentService } from '@/services/agentService';
import { AgentVectorStore } from '@/lib/agent-vector';
import Agent from '@/models/Agent';
import connectDB from '@/lib/mongodb';

// Função para logging
function logQuery(agentId: string | null, query: string, documents: any[] = []) {
  console.log(`[${new Date().toISOString()}] Processando query${agentId ? ` para agente ${agentId}` : ''}: "${query}"`);
  if (documents.length > 0) {
    console.log(`Documentos usados: ${documents.length}`);
    documents.forEach((doc, i) => {
      const snippet = doc.pageContent.substring(0, 150).replace(/\n/g, ' ') + '...';
      console.log(`Doc ${i + 1}: ${snippet}`);
    });
  } else {
    console.log('Nenhum documento relevante encontrado');
  }
}

// Template de prompt padrão
const DEFAULT_PROMPT_TEMPLATE = `Você é um assistente útil e amigável. Seu objetivo é fornecer respostas precisas baseadas nas informações disponíveis.

Contexto:
{context}

Pergunta do usuário: {question}

Ao fornecer sua resposta, considere o seguinte:
1. Responda usando apenas informações do contexto fornecido.
2. Se a informação no contexto não for suficiente, diga que você não tem informações suficientes.
3. Seja conciso e direto em suas respostas.
4. Não invente informações que não estejam no contexto.
5. Sua resposta deve ser completa, evitando truncamento.
6. IMPORTANTE: Cite as fontes de informação incluindo os números dos documentos entre colchetes [Doc X] ao final de cada afirmação relevante da sua resposta.

Resposta:`;

export async function POST(request: NextRequest) {
  try {
    const { query, agentId } = await request.json();
    
    if (!query || query.trim() === '') {
      return NextResponse.json(
        { error: 'A pergunta não pode estar vazia' },
        { status: 400 }
      );
    }
    
    let agent = null;
    let systemPrompt = DEFAULT_PROMPT_TEMPLATE;
    
    // Se um agentId foi fornecido, buscar o agente no banco de dados
    if (agentId) {
      try {
        await connectDB();
        agent = await Agent.findById(agentId);
        
        if (!agent) {
          return NextResponse.json(
            { error: 'Agente não encontrado' },
            { status: 404 }
          );
        }
        
        if (!agent.isActive) {
          return NextResponse.json(
            { error: 'Este agente está desativado' },
            { status: 400 }
          );
        }
        
        // Usar o prompt personalizado do agente, se disponível
        if (agent.systemPrompt) {
          systemPrompt = agent.systemPrompt;
        }
      } catch (error) {
        console.error(`Erro ao buscar agente ${agentId}:`, error);
        return NextResponse.json(
          { error: 'Erro ao buscar o agente' },
          { status: 500 }
        );
      }
    }
    
    // Buscar documentos relevantes
    let documents = [];
    try {
      if (agentId) {
        // Buscar documentos específicos do agente - aumentamos de 5 para 10 para incluir mais contexto
        documents = await AgentVectorStore.similaritySearch(agentId, query, 10);
      } else {
        // Se nenhum agente for especificado, retornar erro
        return NextResponse.json(
          { error: 'É necessário especificar um agente para a consulta' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Erro ao buscar documentos relevantes:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar documentos relevantes para a consulta' },
        { status: 500 }
      );
    }
    
    // Logging da query e documentos recuperados
    logQuery(agentId, query, documents);
    
    if (documents.length === 0) {
      return NextResponse.json({
        response: 'Não encontrei informações relevantes sobre essa pergunta nos documentos disponíveis.'
      });
    }
    
    // Preparar o contexto a partir dos documentos
    const context = documents.map((doc, index) => {
      const docId = `Documento ${index + 1}`;
      const title = doc.metadata?.title ? ` - ${doc.metadata.title}` : '';
      const source = doc.metadata?.source ? ` (Fonte: ${doc.metadata.source})` : '';
      
      return `[${docId}${title}${source}]: ${doc.pageContent}`;
    }).join('\n\n');
    
    // Configurar o modelo de linguagem com parâmetros ajustados para respostas mais completas
    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini', // Modelo com contexto maior para evitar truncamento
      temperature: 0.0,
      openAIApiKey: process.env.OPENAI_API_KEY,
      maxTokens: 2000, // Limite de tokens para respostas mais longas
    });
    
    // Criar o template de prompt
    const prompt = PromptTemplate.fromTemplate(systemPrompt);
    
    // Formatar o prompt com os valores de contexto e pergunta
    const formattedPrompt = await prompt.format({
      context,
      question: query,
    });
    
    // Gerar a resposta
    const response = await model.invoke(formattedPrompt);
    
    // Extrair o conteúdo da resposta do modelo ChatOpenAI
    let responseText = '';
    
    if (response && typeof response === 'object') {
      // Para ChatOpenAI que retorna um objeto AIMessage
      if ('content' in response) {
        responseText = String(response.content);
      } 
      // Extrair de uma maneira genérica para outros casos
      else {
        try {
          responseText = JSON.stringify(response);
        } catch (e) {
          responseText = 'Não foi possível processar a resposta do modelo.';
        }
      }
    } else if (typeof response === 'string') {
      // Para o caso do modelo retornar diretamente uma string
      responseText = response;
    } else {
      responseText = 'Resposta em formato desconhecido.';
    }
    
    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error('Erro ao processar a pergunta:', error);
    return NextResponse.json(
      { error: 'Erro ao processar a pergunta' },
      { status: 500 }
    );
  }
} 