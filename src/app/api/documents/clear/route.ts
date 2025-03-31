import { NextResponse } from "next/server";
import { clearVectorStore } from "@/lib/rag";
import { FAISSVectorStore } from "@/lib/faiss";

export async function POST() {
  try {
    console.log("POST /api/documents/clear: Limpando todos os documentos");
    
    // Verificar quantos documentos existem antes de limpar
    const docsBeforeClear = await FAISSVectorStore.getAllDocuments();
    console.log(`POST /api/documents/clear: ${docsBeforeClear.length} documentos encontrados antes da limpeza`);
    
    // Limpar todos os documentos
    await clearVectorStore();
    
    // Verificar se a limpeza foi bem-sucedida
    const docsAfterClear = await FAISSVectorStore.getAllDocuments();
    console.log(`POST /api/documents/clear: ${docsAfterClear.length} documentos restantes após limpeza`);
    
    return NextResponse.json({ 
      success: true,
      message: "Todos os documentos foram removidos com sucesso",
      documentsRemoved: docsBeforeClear.length,
      documentsRemaining: docsAfterClear.length
    });
  } catch (error) {
    console.error("Erro ao limpar documentos:", error);
    return NextResponse.json(
      { error: "Falha ao limpar documentos" },
      { status: 500 }
    );
  }
} 