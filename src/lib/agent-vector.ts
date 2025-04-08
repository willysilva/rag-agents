import { MongoDBAtlasVectorSearch } from "@langchain/community/vectorstores/mongodb_atlas";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
import AgentDocument from '@/models/AgentDocument';
import mongoose from 'mongoose';
import connectDB from './mongodb';

// Classe para gerenciar o armazenamento de vetores específicos para cada agente
export class AgentVectorStore {
  private static instances: Map<string, MongoDBAtlasVectorSearch> = new Map();
  private static embeddingModel = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-ada-002",
  });
  
  // Obter uma instância do vetor para um agente específico
  static async getInstance(agentId: string): Promise<MongoDBAtlasVectorSearch> {
    if (!agentId) {
      throw new Error('ID do agente é obrigatório');
    }
    
    // Verificar se já existe uma instância em memória
    if (this.instances.has(agentId)) {
      return this.instances.get(agentId)!;
    }
    
    await connectDB();
    const db = mongoose.connection.db;
    
    // Criar um novo índice MongoDB
    console.log(`Criando novo índice MongoDB para o agente ${agentId}...`);
    const store = await MongoDBAtlasVectorSearch.fromExistingIndex(
      this.embeddingModel,
      {
        collection: db.collection(`agent_${agentId}_vectors`),
        indexName: `agent_${agentId}_index`,
      }
    );
    
    this.instances.set(agentId, store);
    return store;
  }
  
  // Adicionar documentos ao vetor de um agente
  static async addDocuments(agentId: string, documents: Document[]): Promise<void> {
    if (documents.length === 0) return;
    
    console.log(`Adicionando ${documents.length} documentos ao vetor do agente ${agentId}...`);
    
    await connectDB();
    const db = mongoose.connection.db;
    
    // Criar ou atualizar o índice MongoDB
    const store = await MongoDBAtlasVectorSearch.fromDocuments(
      documents,
      this.embeddingModel,
      {
        collection: db.collection(`agent_${agentId}_vectors`),
        indexName: `agent_${agentId}_index`,
      }
    );
    
    this.instances.set(agentId, store);
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
    await connectDB();
    const db = mongoose.connection.db;
    
    // Remover coleção de vetores
    await db.collection(`agent_${agentId}_vectors`).drop();
    
    // Remover a instância da memória
    this.instances.delete(agentId);
    
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