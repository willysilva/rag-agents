import { NextRequest, NextResponse } from 'next/server';
import Agent from '@/models/Agent';
import connectDB from '@/lib/mongodb';
import { Types } from 'mongoose';

interface RouteParams {
  params: {
    id: string; // Agent ID
    tokenId: string; // Token Subdocument ID
  };
}

/**
 * @route PUT /api/agents/:id/tokens/:tokenId
 * @description Atualizar um token de API específico (label, isActive/revogar).
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id: agentId, tokenId } = params;

  if (!Types.ObjectId.isValid(agentId) || !Types.ObjectId.isValid(tokenId)) {
    return NextResponse.json({ success: false, error: 'ID de agente ou token inválido' }, { status: 400 });
  }

  let updates: { label?: string; isActive?: boolean } = {};
  try {
    const body = await request.json();
    
    if (body.label !== undefined) {
        if (typeof body.label !== 'string' || body.label.trim().length === 0) {
             throw new Error('Se fornecido, o label deve ser uma string não vazia.');
        }
        updates.label = body.label.trim();
    }
    
    if (body.isActive !== undefined) {
        if (typeof body.isActive !== 'boolean') {
            throw new Error('Se fornecido, isActive deve ser um booleano.');
        }
        updates.isActive = body.isActive;
    }

    if (Object.keys(updates).length === 0) {
       throw new Error('Nenhum campo válido (label ou isActive) fornecido para atualização.');
    }

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Corpo da requisição inválido.' }, { status: 400 });
  }

  try {
    await connectDB();
    const agent = await Agent.findById(agentId).select('apiTokens');

    if (!agent) {
      return NextResponse.json({ success: false, error: 'Agente não encontrado' }, { status: 404 });
    }

    // Encontrar o subdocumento do token pelo _id
    const tokenDoc = agent.apiTokens.id(tokenId);

    if (!tokenDoc) {
      return NextResponse.json({ success: false, error: 'Token não encontrado neste agente' }, { status: 404 });
    }

    // Aplicar atualizações
    let wasRevoked = false;
    if (updates.label !== undefined) {
      tokenDoc.label = updates.label;
    }
    if (updates.isActive !== undefined && tokenDoc.isActive !== updates.isActive) {
      tokenDoc.isActive = updates.isActive;
      if (!updates.isActive) { // Se está sendo revogado agora
        tokenDoc.revokedAt = new Date();
        wasRevoked = true;
      } else {
         tokenDoc.revokedAt = undefined; // Reativando, limpar data de revogação
      }
    }
    
    await agent.save();

    // Retornar o estado atualizado do token (sem o valor do token)
    return NextResponse.json({
      success: true,
      message: wasRevoked ? 'Token revogado com sucesso.' : 'Token atualizado com sucesso.',
      data: {
          _id: tokenDoc._id,
          label: tokenDoc.label,
          isActive: tokenDoc.isActive,
          createdAt: tokenDoc.createdAt,
          lastUsedAt: tokenDoc.lastUsedAt,
          revokedAt: tokenDoc.revokedAt
      }
    });

  } catch (error: any) {
    console.error(`Erro ao atualizar token ${tokenId} do agente ${agentId}:`, error);
     if (error.name === 'ValidationError') {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao atualizar o token' }, { status: 500 });
  }
} 