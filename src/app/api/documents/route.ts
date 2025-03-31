import { NextRequest, NextResponse } from "next/server";
import { FAISSVectorStore } from "@/lib/faiss";
import { Document } from "langchain/document";

export async function GET() {
  try {
    console.log("GET /api/documents: Buscando todos os documentos");
    
    // Obter todos os documentos do FAISS Vector Store
    const docs = await FAISSVectorStore.getAllDocuments();
    console.log(`GET /api/documents: Encontrados ${docs.length} documentos`);
    
    // Retornar a lista de documentos
    return NextResponse.json({
      documents: docs.map((doc: Document) => ({
        id: doc.metadata?.id || `doc-${Math.random().toString(36).substring(2, 9)}`,
        content: doc.pageContent,
      })),
    });
  } catch (error) {
    console.error("Erro na API /api/documents:", error);
    return NextResponse.json(
      { error: "Falha ao obter documentos" },
      { status: 500 }
    );
  }
} 