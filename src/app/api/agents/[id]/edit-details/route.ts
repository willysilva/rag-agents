import { NextRequest, NextResponse } from 'next/server';
import Agent from '@/models/Agent';
import connectDB from '@/lib/mongodb';
import { Types } from 'mongoose';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * @route GET /api/agents/:id/edit-details
 * @description Obter detalhes completos de um agente para edição, incluindo campos sensíveis.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = params;

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, error: 'ID de agente inválido' },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    // Buscar agente por ID, selecionando explicitamente os campos ocultos
    const agent = await Agent.findById(id)
      .select('+apiKey +apiToken') // Seleciona os campos normalmente ocultos
      .exec();

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agente não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: agent });

  } catch (error: any) {
    console.error(`Erro ao buscar detalhes do agente ${id} para edição:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 