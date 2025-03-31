import { NextRequest, NextResponse } from "next/server";
import { addDocumentsToVectorStore, initializeVectorStore } from "@/lib/rag";
import { FAISSVectorStore } from "@/lib/faiss";

// Garantir que o vetor está inicializado
let initialized = false;
async function ensureInitialized() {
  if (!initialized) {
    await initializeVectorStore();
    initialized = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Garantir que o vetor está inicializado
    await ensureInitialized();
    
    // Parse the request body
    const { documents } = await request.json();
    
    // Validate input
    if (!documents || !Array.isArray(documents)) {
      return NextResponse.json(
        { error: "Documents are required and must be an array" },
        { status: 400 }
      );
    }

    // Filtrar documentos vazios
    const validDocuments = documents.filter(doc => 
      typeof doc === 'string' && doc.trim().length > 0
    );

    if (validDocuments.length === 0) {
      return NextResponse.json(
        { error: "No valid documents provided" },
        { status: 400 }
      );
    }

    console.log(`POST /api/ingest: Recebido pedido para ingerir ${validDocuments.length} documentos`);

    // Add documents to the vector store
    await addDocumentsToVectorStore(validDocuments);
    
    // Obter todos os documentos para retornar ao cliente
    const allDocs = await FAISSVectorStore.getAllDocuments();
    console.log(`POST /api/ingest: Total de documentos após ingestão: ${allDocs.length}`);
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: `${validDocuments.length} documentos ingeridos com sucesso`,
      count: validDocuments.length,
      totalDocuments: allDocs.length
    });
  } catch (error) {
    console.error("Erro na API /api/ingest:", error);
    return NextResponse.json(
      { error: "Falha ao ingerir documentos" },
      { status: 500 }
    );
  }
} 