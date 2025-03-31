import { NextRequest, NextResponse } from 'next/server';
import { AgentService } from '@/services/agentService';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * @route GET /api/agents/:id/documents
 * @description Obter documentos de um agente
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    
    const documents = await AgentService.getAgentDocuments(id);
    
    return NextResponse.json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error: any) {
    console.error(`Erro ao buscar documentos do agente ${params.id}:`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao buscar documentos'
      },
      { status: 500 }
    );
  }
}

/**
 * @route POST /api/agents/:id/documents
 * @description Adicionar um documento a um agente
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    const body = await request.json();
    
    // Validar dados requeridos
    if (!body.title || !body.content) {
      return NextResponse.json(
        {
          success: false,
          error: 'Título e conteúdo são obrigatórios'
        },
        { status: 400 }
      );
    }
    
    // Adicionar documento ao agente
    const document = await AgentService.addDocumentToAgent(id, {
      title: body.title,
      content: body.content,
      metadata: body.metadata || {}
    });
    
    return NextResponse.json({
      success: true,
      data: document
    }, { status: 201 });
    
  } catch (error: any) {
    console.error(`Erro ao adicionar documento ao agente ${params.id}:`, error);
    
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
        error: error.message || 'Erro ao adicionar documento'
      },
      { status: 500 }
    );
  }
}

/**
 * @route DELETE /api/agents/:id/documents
 * @description Limpar todos os documentos de um agente
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    
    await AgentService.clearAgentDocuments(id);
    
    return NextResponse.json({
      success: true,
      message: 'Todos os documentos do agente foram excluídos'
    });
  } catch (error: any) {
    console.error(`Erro ao limpar documentos do agente ${params.id}:`, error);
    
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
        error: error.message || 'Erro ao limpar documentos'
      },
      { status: 500 }
    );
  }
} 