import { ChatOpenAI } from "@langchain/openai";
import { FAISSVectorStore } from "./faiss";
import { Document } from "langchain/document";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

// Inicializar o modelo OpenAI com configurações melhores
const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o-mini",
  temperature: 0.3, // Mais determinístico
  verbose: true, // Ajuda a depurar
});

// Definir um template de prompt melhorado para o RAG
const promptTemplate = PromptTemplate.fromTemplate(`
Você é um assistente de IA especializado que responde perguntas com base nos documentos fornecidos.
Sua resposta deve ser baseada APENAS nas informações contidas nos documentos abaixo.
Se a informação não estiver nos documentos, responda honestamente que não sabe a resposta.

Documentos:
----------------
{context}
----------------

Pergunta: {question}

Responda de forma completa, clara e informativa. Cite apenas informações que estão nos documentos.
`);

// Criar a sequência de execução do RAG
const createRagChain = () => {
  return RunnableSequence.from([
    {
      context: async (input: { question: string; similarityThreshold?: number }) => {
        console.log("RAG: Buscando documentos relevantes para:", input.question);
        
        // Verificar se há documentos disponíveis
        const allDocs = await FAISSVectorStore.getAllDocuments();
        console.log(`RAG: Total de ${allDocs.length} documentos disponíveis`);
        
        if (allDocs.length === 0) {
          return "Não há documentos disponíveis na base de conhecimento.";
        }
        
        // Recuperar documentos relevantes usando similaridade semântica
        const k = 5; // Número de documentos a recuperar
        const docs = await FAISSVectorStore.similaritySearch(input.question, k);
        
        console.log(`RAG: Encontrados ${docs.length} documentos relevantes`);
        
        if (docs.length === 0) {
          return "Não foram encontrados documentos relevantes para esta pergunta na base de conhecimento.";
        }
        
        // Formatar documentos para o contexto
        const formattedDocs = docs.map((doc, i) => 
          `[Documento ${i+1}]: ${doc.pageContent.trim()}`
        ).join("\n\n");
        
        console.log("RAG: Documentos selecionados:", docs.map(d => d.pageContent.substring(0, 50) + "..."));
        
        return formattedDocs;
      },
      question: (input: { question: string }) => input.question.trim(),
    },
    promptTemplate,
    llm,
    new StringOutputParser(),
  ]);
};

// Função principal para gerar resposta usando RAG
export async function generateRagResponse(question: string): Promise<string> {
  try {
    console.log("\n=== Nova consulta RAG ===");
    console.log(`Pergunta: "${question}"`);
    
    // Obter documentos totais para diagnóstico
    const allDocs = await FAISSVectorStore.getAllDocuments();
    console.log(`Total de documentos na base: ${allDocs.length}`);
    
    if (allDocs.length === 0) {
      return "Não há documentos na base de conhecimento. Por favor, adicione alguns documentos primeiro.";
    }
    
    // Criar e invocar a cadeia RAG
    const chain = createRagChain();
    const response = await chain.invoke({ question });
    
    console.log(`Resposta gerada com sucesso.\n`);
    return response;
  } catch (error) {
    console.error("Erro ao gerar resposta RAG:", error);
    return "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.";
  }
}

// Função para adicionar documentos ao vetor
export async function addDocumentsToVectorStore(texts: string[]): Promise<void> {
  if (!texts || texts.length === 0) {
    console.log("Nenhum documento a adicionar");
    return;
  }
  
  try {
    console.log(`Adicionando ${texts.length} documentos ao vetor...`);
    await FAISSVectorStore.addDocuments(texts);
    
    // Verificar se os documentos foram adicionados
    const allDocs = await FAISSVectorStore.getAllDocuments();
    console.log(`Total de documentos após adição: ${allDocs.length}`);
  } catch (error) {
    console.error("Erro ao adicionar documentos:", error);
    throw error;
  }
}

// Função para limpar todos os documentos
export async function clearVectorStore(): Promise<void> {
  try {
    await FAISSVectorStore.clearDocuments();
    console.log("Todos os documentos foram limpos do vetor");
  } catch (error) {
    console.error("Erro ao limpar documentos:", error);
    throw error;
  }
}

// Inicializar o sistema com documentos de exemplo
export { initializeVectorStore } from "./faiss"; 