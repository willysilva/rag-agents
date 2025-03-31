import { NextRequest, NextResponse } from 'next/server';
import { AgentService } from '@/services/agentService';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * @route GET /api/agents/:id
 * @description Obter um agente pelo ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    
    const agent = await AgentService.getAgentById(id);
    
    return NextResponse.json({
      success: true,
      data: agent
    });
  } catch (error: any) {
    console.error(`Erro ao buscar agente ${params.id}:`, error);
    
    if (error.message.includes('não encontrado')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agente não encontrado'
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao buscar agente'
      },
      { status: 500 }
    );
  }
}

/**
 * @route PUT /api/agents/:id
 * @description Atualizar um agente
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    const body = await request.json();
    
    // Atualizar o agente
    const updatedAgent = await AgentService.updateAgent(id, {
      name: body.name,
      description: body.description,
      avatarUrl: body.avatarUrl,
      systemPrompt: body.systemPrompt,
      isActive: body.isActive
    });
    
    return NextResponse.json({
      success: true,
      data: updatedAgent
    });
  } catch (error: any) {
    console.error(`Erro ao atualizar agente ${params.id}:`, error);
    
    if (error.message.includes('não encontrado')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agente não encontrado'
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao atualizar agente'
      },
      { status: 500 }
    );
  }
}

/**
 * @route DELETE /api/agents/:id
 * @description Excluir um agente e seus documentos
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    
    await AgentService.deleteAgent(id);
    
    return NextResponse.json({
      success: true,
      message: 'Agente e seus documentos excluídos com sucesso'
    });
  } catch (error: any) {
    console.error(`Erro ao excluir agente ${params.id}:`, error);
    
    if (error.message.includes('não encontrado')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agente não encontrado'
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao excluir agente'
      },
      { status: 500 }
    );
  }
} 