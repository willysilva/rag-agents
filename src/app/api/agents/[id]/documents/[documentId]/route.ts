import { NextRequest, NextResponse } from 'next/server';
import { AgentService } from '@/services/agentService';

interface RouteParams {
  params: {
    id: string;
    documentId: string;
  };
}

/**
 * @route DELETE /api/agents/:id/documents/:documentId
 * @description Excluir um documento específico de um agente
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id, documentId } = params;
    
    await AgentService.deleteAgentDocument(id, documentId);
    
    return NextResponse.json({
      success: true,
      message: 'Documento excluído com sucesso'
    });
  } catch (error: any) {
    console.error(`Erro ao excluir documento ${params.documentId} do agente ${params.id}:`, error);
    
    if (error.message.includes('não encontrado') || error.message.includes('não pertence')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao excluir documento'
      },
      { status: 500 }
    );
  }
} 