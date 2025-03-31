import { NextRequest, NextResponse } from 'next/server';
import { AgentService } from '@/services/agentService';

/**
 * @route GET /api/agents
 * @description Obter todos os agentes
 */
export async function GET(request: NextRequest) {
  try {
    // Obter parâmetro de query para exibir inativos
    const searchParams = request.nextUrl.searchParams;
    const showInactive = searchParams.get('showInactive') === 'true';
    
    const agents = await AgentService.getAllAgents(showInactive);
    
    return NextResponse.json({
      success: true,
      data: agents
    });
  } catch (error: any) {
    console.error('Erro ao buscar agentes:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao buscar agentes'
      },
      { status: 500 }
    );
  }
}

/**
 * @route POST /api/agents
 * @description Criar um novo agente
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar dados requeridos
    if (!body.name || !body.description) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nome e descrição são obrigatórios'
        },
        { status: 400 }
      );
    }
    
    // Criar o agente
    const newAgent = await AgentService.createAgent({
      name: body.name,
      description: body.description,
      avatarUrl: body.avatarUrl,
      systemPrompt: body.systemPrompt,
      isActive: body.isActive !== false // default para true
    });
    
    return NextResponse.json({
      success: true,
      data: newAgent
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Erro ao criar agente:', error);
    
    // Verificar se é erro de duplicação
    if (error.message.includes('Já existe um agente com este nome')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Já existe um agente com este nome'
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao criar agente'
      },
      { status: 500 }
    );
  }
} 