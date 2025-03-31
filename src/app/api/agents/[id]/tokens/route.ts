import { NextRequest, NextResponse } from 'next/server';
import Agent, { IAgent, IApiToken } from '@/models/Agent'; // Import IAgent and IApiToken
import connectDB from '@/lib/mongodb';
import { Types } from 'mongoose';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * @route GET /api/agents/:id/tokens
 * @description Listar tokens de API para um agente específico (sem expor o token real).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = params;

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'ID de agente inválido' }, { status: 400 });
  }

  try {
    await connectDB();
    const agent = await Agent.findById(id).select('apiTokens').exec();

    if (!agent) {
      return NextResponse.json({ success: false, error: 'Agente não encontrado' }, { status: 404 });
    }

    // Mapear para não expor o valor do token
    const tokensList = agent.apiTokens.map((t: IApiToken) => ({
      _id: t._id,
      label: t.label,
      isActive: t.isActive,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
      revokedAt: t.revokedAt
    }));

    return NextResponse.json({ success: true, data: tokensList });

  } catch (error: any) {
    console.error(`Erro ao listar tokens do agente ${id}:`, error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/**
 * @route POST /api/agents/:id/tokens
 * @description Gerar um novo token de API para um agente.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = params;

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'ID de agente inválido' }, { status: 400 });
  }

  let label: string;
  try {
    const body = await request.json();
    label = body.label;
    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      throw new Error('Label (nome) para o token é obrigatório.');
    }
    label = label.trim();
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Corpo da requisição inválido ou label ausente.' }, { status: 400 });
  }

  try {
    await connectDB();
    const agent = await Agent.findById(id).select('apiTokens'); // Selecionar apiTokens para modificar

    if (!agent) {
      return NextResponse.json({ success: false, error: 'Agente não encontrado' }, { status: 404 });
    }

    // Usar o método do schema para gerar e adicionar o token
    const newTokenDoc = agent.generateApiToken(label);

    await agent.save(); // Salvar o agente com o novo token adicionado

    // Retornar o token GERADO desta vez, pois o usuário precisa copiá-lo
    // Incluir também os outros detalhes do token recém-criado
    return NextResponse.json({
      success: true,
      message: 'Token gerado com sucesso!',
      data: {
        _id: newTokenDoc._id,
        label: newTokenDoc.label,
        token: newTokenDoc.token, // Expor o token aqui, apenas na criação
        isActive: newTokenDoc.isActive,
        createdAt: newTokenDoc.createdAt
        // lastUsedAt e revokedAt serão undefined inicialmente
      }
    }, { status: 201 }); // 201 Created

  } catch (error: any) {
    console.error(`Erro ao gerar token para o agente ${id}:`, error);
    // Verificar erro de validação (ex: label muito longo)
    if (error.name === 'ValidationError') {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao gerar o token' }, { status: 500 });
  }
} 