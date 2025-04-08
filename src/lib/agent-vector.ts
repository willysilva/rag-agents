import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
import AgentDocument from '@/models/AgentDocument';
import mongoose from 'mongoose';
import connectDB from './mongodb';
import { GridFSBucket, Db } from 'mongodb';

// Classe para gerenciar o armazenamento de vetores específicos para cada agente
export class AgentVectorStore {
  private static instances: Map<string, FaissStore> = new Map();
  private static embeddingModel = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-ada-002",
  });
  
  // Obter o bucket GridFS para um agente específico
  private static async getGridFSBucket(agentId: string): Promise<GridFSBucket> {
    await connectDB();
    const db = mongoose.connection.db as Db;
    return new GridFSBucket(db, { bucketName: `agent_${agentId}_vectors` });
  }
  
  // Salvar vetor no GridFS
  private static async saveVectorToGridFS(agentId: string, vectorStore: FaissStore): Promise<void> {
    const bucket = await this.getGridFSBucket(agentId);
    
    // Salvar o índice FAISS
    const indexBuffer = Buffer.from(JSON.stringify(vectorStore));
    const indexStream = bucket.openUploadStream('faiss.index');
    indexStream.write(indexBuffer);
    await new Promise<void>((resolve, reject) => {
      indexStream.end(() => resolve());
      indexStream.on('error', reject);
    });
    
    // Salvar o docstore
    const docstoreBuffer = Buffer.from(JSON.stringify(vectorStore.docstore));
    const docstoreStream = bucket.openUploadStream('docstore.json');
    docstoreStream.write(docstoreBuffer);
    await new Promise<void>((resolve, reject) => {
      docstoreStream.end(() => resolve());
      docstoreStream.on('error', reject);
    });
  }
  
  // Carregar vetor do GridFS
  private static async loadVectorFromGridFS(agentId: string): Promise<FaissStore | null> {
    const bucket = await this.getGridFSBucket(agentId);
    
    try {
      // Verificar se existem arquivos
      const files = await bucket.find({}).toArray();
      if (files.length === 0) return null;
      
      // Carregar o índice FAISS
      const indexStream = bucket.openDownloadStreamByName('faiss.index');
      const indexBuffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        indexStream.on('data', chunk => chunks.push(chunk));
        indexStream.on('end', () => resolve(Buffer.concat(chunks)));
        indexStream.on('error', reject);
      });
      
      // Carregar o docstore
      const docstoreStream = bucket.openDownloadStreamByName('docstore.json');
      const docstoreBuffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        docstoreStream.on('data', chunk => chunks.push(chunk));
        docstoreStream.on('end', () => resolve(Buffer.concat(chunks)));
        docstoreStream.on('error', reject);
      });
      
      const docstore = JSON.parse(docstoreBuffer.toString());
      const vectorData = JSON.parse(indexBuffer.toString());
      
      // Criar o vetor
      const store = await FaissStore.fromDocuments([], this.embeddingModel);
      Object.assign(store, vectorData);
      store.docstore = docstore;
      
      return store;
    } catch (error) {
      console.error(`Erro ao carregar vetor do GridFS para o agente ${agentId}:`, error);
      return null;
    }
  }
  
  // Obter uma instância do vetor para um agente específico
  static async getInstance(agentId: string): Promise<FaissStore> {
    if (!agentId) {
      throw new Error('ID do agente é obrigatório');
    }
    
    // Verificar se já existe uma instância em memória
    if (this.instances.has(agentId)) {
      return this.instances.get(agentId)!;
    }
    
    // Tentar carregar do GridFS
    const storedVector = await this.loadVectorFromGridFS(agentId);
    if (storedVector) {
      this.instances.set(agentId, storedVector);
      return storedVector;
    }
    
    // Se não existir, criar um novo índice vazio
    console.log(`Criando novo índice FAISS para o agente ${agentId}...`);
    const store = await FaissStore.fromDocuments(
      [], // Começar com documentos vazios
      this.embeddingModel
    );
    
    this.instances.set(agentId, store);
    return store;
  }
  
  // Adicionar documentos ao vetor de um agente
  static async addDocuments(agentId: string, documents: Document[]): Promise<void> {
    const vectorStore = await this.getInstance(agentId);
    
    if (documents.length === 0) return;
    
    console.log(`Adicionando ${documents.length} documentos ao vetor do agente ${agentId}...`);
    
    // Adicionar documentos ao índice FAISS
    await vectorStore.addDocuments(documents);
    
    // Salvar no GridFS
    await this.saveVectorToGridFS(agentId, vectorStore);
    
    console.log(`${documents.length} documentos adicionados com sucesso ao agente ${agentId}.`);
  }
  
  // Buscar documentos relevantes
  static async similaritySearch(agentId: string, query: string, k = 10): Promise<Document[]> {
    try {
      const vectorStore = await this.getInstance(agentId);
      console.log(`Buscando documentos do agente ${agentId} para a query: "${query}"`);
      
      // Buscar todos os documentos disponíveis para diagnóstico
      const allDocuments = await AgentDocument.find({ agentId }).lean();
      console.log(`Total de documentos disponíveis para o agente ${agentId}: ${allDocuments.length}`);
      
      if (allDocuments.length === 0) {
        console.log(`Nenhum documento disponível para o agente ${agentId}.`);
        return [];
      }
      
      // Se não há instância com documentos, recriar a partir do banco
      if (!this.instances.has(agentId)) {
        // Converter os documentos do MongoDB para o formato LangChain Document
        const documents = allDocuments.map(doc => new Document({
          pageContent: doc.content,
          metadata: {
            id: doc._id?.toString() || 'unknown',
            title: doc.title || 'Sem título',
            ...(doc.metadata || {})
          }
        }));
        
        await this.addDocuments(agentId, documents);
      }
      
      // Executar a busca por similaridade
      const results = await vectorStore.similaritySearch(query, k);
      
      console.log(`Encontrados ${results.length} documentos similares para o agente ${agentId}.`);
      results.forEach((doc, i) => {
        console.log(`Documento ${i+1}: ID=${doc.metadata?.id || 'desconhecido'}, Início: ${doc.pageContent.substring(0, 50)}...`);
      });
      
      return results;
    } catch (error) {
      console.error(`Erro na busca por similaridade para o agente ${agentId}:`, error);
      return [];
    }
  }
  
  // Limpar documentos de um agente específico
  static async clearAgentDocuments(agentId: string): Promise<void> {
    const bucket = await this.getGridFSBucket(agentId);
    
    // Remover arquivos do GridFS
    await bucket.drop();
    
    // Remover a instância da memória
    this.instances.delete(agentId);
    
    // Criar um novo índice vazio
    await this.getInstance(agentId);
    
    console.log(`Documentos do agente ${agentId} removidos com sucesso.`);
  }
  
  // Carregar documentos do MongoDB para o vetor
  static async syncFromDatabase(agentId: string): Promise<void> {
    try {
      await connectDB();
      
      // Converter o ID para ObjectId se for uma string
      const objectId = typeof agentId === 'string' ? new mongoose.Types.ObjectId(agentId) : agentId;
      
      // Buscar documentos do agente no banco de dados
      const agentDocuments = await AgentDocument.find({ agentId: objectId });
      
      if (agentDocuments.length === 0) {
        console.log(`Nenhum documento encontrado para o agente ${agentId} no banco de dados.`);
        return;
      }
      
      console.log(`Sincronizando ${agentDocuments.length} documentos do banco para o vetor do agente ${agentId}...`);
      
      // Limpar vetor atual
      await this.clearAgentDocuments(agentId);
      
      // Converter para o formato do LangChain Document
      const documents = agentDocuments.map(doc => new Document({
        pageContent: doc.content,
        metadata: {
          id: doc._id.toString(),
          title: doc.title,
          ...doc.metadata
        }
      }));
      
      // Adicionar ao vetor
      await this.addDocuments(agentId, documents);
      
      console.log(`Sincronização concluída para o agente ${agentId}.`);
    } catch (error) {
      console.error(`Erro ao sincronizar documentos do agente ${agentId}:`, error);
      throw error;
    }
  }
} 