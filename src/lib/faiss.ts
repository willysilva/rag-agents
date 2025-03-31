import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
import fs from 'fs';
import path from 'path';

// Configurações para salvar em disco
const VECTOR_STORE_DIR = path.join(process.cwd(), 'vector-store');
const DOCUMENTS_FILE = path.join(VECTOR_STORE_DIR, 'documents.json');

// Garantir que o diretório exista
if (!fs.existsSync(VECTOR_STORE_DIR)) {
  fs.mkdirSync(VECTOR_STORE_DIR, { recursive: true });
}

// FAISS vector store for storing document embeddings
export class FAISSVectorStore {
  private static instance: FaissStore | null = null;
  private static embeddingModel = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-ada-002", // Especificar modelo de embedding
  });
  private static documents: Document[] = [];
  private static isInitialized = false;

  // Carregar documentos do disco
  private static async loadDocumentsFromDisk() {
    if (this.isInitialized) return;
    
    console.log("Carregando documentos do disco...");
    try {
      if (fs.existsSync(DOCUMENTS_FILE)) {
        const data = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
        const docs = JSON.parse(data);
        
        // Converter os objetos simples para objetos Document
        this.documents = docs.map((doc: any) => 
          new Document({
            pageContent: doc.pageContent,
            metadata: doc.metadata || {}
          })
        );
        
        console.log(`Carregados ${this.documents.length} documentos do disco.`);
      }
    } catch (error) {
      console.error("Erro ao carregar documentos do disco:", error);
      this.documents = [];
    }
    
    this.isInitialized = true;
  }

  // Salvar documentos em disco
  private static async saveDocumentsToDisk() {
    try {
      // Salvar lista de documentos em disco
      fs.writeFileSync(
        DOCUMENTS_FILE,
        JSON.stringify(this.documents, null, 2),
        'utf-8'
      );
      console.log(`Salvos ${this.documents.length} documentos em disco.`);
    } catch (error) {
      console.error("Erro ao salvar documentos em disco:", error);
    }
  }

  // Get the singleton instance of FAISS vector store
  static async getInstance(): Promise<FaissStore> {
    // Carregar documentos do disco se ainda não foi feito
    await this.loadDocumentsFromDisk();
    
    if (!this.instance) {
      // Verificar se existe um índice FAISS salvo em disco
      if (fs.existsSync(path.join(VECTOR_STORE_DIR, 'faiss.index'))) {
        console.log("Carregando índice FAISS do disco...");
        try {
          this.instance = await FaissStore.load(
            VECTOR_STORE_DIR,
            this.embeddingModel
          );
          console.log("Índice FAISS carregado com sucesso do disco.");
        } catch (error) {
          console.error("Erro ao carregar FAISS do disco:", error);
          // Se falhar ao carregar, criar um novo com documentos atuais
          this.instance = await FaissStore.fromDocuments(
            this.documents.length > 0 ? this.documents : [],
            this.embeddingModel
          );
        }
      } else {
        console.log("Criando novo índice FAISS...");
        // Se não existir índice salvo, criar um novo com documentos atuais
        this.instance = await FaissStore.fromDocuments(
          this.documents.length > 0 ? this.documents : [],
          this.embeddingModel
        );
      }
    }
    
    return this.instance;
  }

  // Add documents to the vector store
  static async addDocuments(texts: string[]): Promise<void> {
    // Garantir que os documentos foram carregados do disco
    await this.loadDocumentsFromDisk();
    
    console.log(`Adicionando ${texts.length} documentos ao vetor...`);
    
    // Criar novos objetos Document com metadados
    const documents = texts.map(
      (text, index) => new Document({ 
        pageContent: text,
        metadata: { id: `doc-${Date.now()}-${index}` }
      })
    );
    
    try {
      // IMPORTANTE: Primeiro adicionar documentos ao índice FAISS
      const vectorStore = await this.getInstance();
      await vectorStore.addDocuments(documents);
      
      // Depois atualizar a lista local de documentos
      this.documents.push(...documents);
      
      // Salvar o índice FAISS em disco
      await vectorStore.save(VECTOR_STORE_DIR);
      
      // Salvar documentos em disco
      await this.saveDocumentsToDisk();
      
      console.log(`${texts.length} documentos adicionados e salvos com sucesso.`);
    } catch (error) {
      console.error("Erro ao adicionar documentos:", error);
      throw error;
    }
  }

  // Get all documents stored in the vector store
  static async getAllDocuments(): Promise<Document[]> {
    // Garantir que os documentos foram carregados do disco
    await this.loadDocumentsFromDisk();
    return this.documents;
  }

  // Clear all documents from the vector store
  static async clearDocuments(): Promise<void> {
    console.log("Limpando todos os documentos...");
    
    try {
      // Reset documents array
      this.documents = [];
      
      // Salvar em disco (arquivo vazio)
      await this.saveDocumentsToDisk();
      
      // Remover arquivos do FAISS
      if (fs.existsSync(path.join(VECTOR_STORE_DIR, 'faiss.index'))) {
        fs.unlinkSync(path.join(VECTOR_STORE_DIR, 'faiss.index'));
      }
      if (fs.existsSync(path.join(VECTOR_STORE_DIR, 'docstore.json'))) {
        fs.unlinkSync(path.join(VECTOR_STORE_DIR, 'docstore.json'));
      }
      
      // Recreate the vector store instance
      this.instance = null;
      
      // Reinicializar com instância vazia
      await this.getInstance();
      
      console.log("Todos os documentos foram limpos com sucesso.");
    } catch (error) {
      console.error("Erro ao limpar documentos:", error);
      throw error;
    }
  }

  // Search for similar documents based on a query
  static async similaritySearch(query: string, k = 4): Promise<Document[]> {
    // Garantir que os documentos foram carregados do disco
    await this.loadDocumentsFromDisk();
    
    console.log(`Realizando busca por similaridade para: "${query}"`);
    
    if (this.documents.length === 0) {
      console.log("Nenhum documento disponível para busca.");
      return [];
    }
    
    try {
      const vectorStore = await this.getInstance();
      const results = await vectorStore.similaritySearch(query, k);
      console.log(`Encontrados ${results.length} documentos similares.`);
      return results;
    } catch (error) {
      console.error("Erro na busca por similaridade:", error);
      return [];
    }
  }
}

// Initialize with example documents
export async function initializeVectorStore(): Promise<void> {
  // Verificar se já existem documentos carregados
  const existingDocs = await FAISSVectorStore.getAllDocuments();
  
  // Só inicializar com exemplos se não houver documentos
  if (existingDocs.length === 0) {
    console.log("Inicializando com documentos de exemplo...");
    
    const exampleDocuments = [
      "Next.js é um framework React para construir aplicações web full-stack. Você usa componentes React para construir interfaces de usuário, e Next.js para recursos adicionais e otimizações.",
      "LangChain é um framework para desenvolvimento de aplicações potencializadas por modelos de linguagem. Fornece uma interface padrão para cadeias, integrações com outras ferramentas e cadeias end-to-end para aplicações comuns.",
      "Retrieval Augmented Generation (RAG) é uma técnica para aprimorar saídas de grandes modelos de linguagem usando uma base de conhecimento externa para fornecer contexto relevante ao modelo.",
      "FAISS (Facebook AI Similarity Search) é uma biblioteca para pesquisa eficiente de similaridade e agrupamento de vetores densos. Contém algoritmos que pesquisam em conjuntos de vetores de qualquer tamanho.",
    ];

    await FAISSVectorStore.addDocuments(exampleDocuments);
    console.log("Vector store initialized with example documents");
  } else {
    console.log(`Vector store já contém ${existingDocs.length} documentos.`);
  }
} 