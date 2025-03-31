import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
import fs from 'fs';
import path from 'path';
import AgentDocument from '@/models/AgentDocument';
import mongoose from 'mongoose';
import connectDB from './mongodb';

// Configurações para salvar em disco
const VECTOR_STORE_DIR = path.join(process.cwd(), 'vector-store');

// Garantir que o diretório base exista
if (!fs.existsSync(VECTOR_STORE_DIR)) {
  fs.mkdirSync(VECTOR_STORE_DIR, { recursive: true });
}

// Classe para gerenciar o armazenamento de vetores específicos para cada agente
export class AgentVectorStore {
  private static instances: Map<string, FaissStore> = new Map();
  private static embeddingModel = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-ada-002",
  });
  
  // Obter o diretório específico para o agente
  private static getAgentDir(agentId: string): string {
    const agentDir = path.join(VECTOR_STORE_DIR, agentId);
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }
    return agentDir;
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
    
    const agentDir = this.getAgentDir(agentId);
    
    // Verificar se existe um índice FAISS salvo em disco para este agente
    if (fs.existsSync(path.join(agentDir, 'faiss.index'))) {
      try {
        console.log(`Carregando índice FAISS do agente ${agentId}...`);
        const store = await FaissStore.load(
          agentDir,
          this.embeddingModel
        );
        this.instances.set(agentId, store);
        return store;
      } catch (error) {
        console.error(`Erro ao carregar FAISS do agente ${agentId}:`, error);
      }
    }
    
    // Se não existir ou houver erro, criar um novo índice vazio
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
    
    // Salvar o índice FAISS em disco
    const agentDir = this.getAgentDir(agentId);
    await vectorStore.save(agentDir);
    
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
      
      console.log(`Encontrados ${results.length} documentos similares para o agente ${agentId} de um total de ${allDocuments.length}.`);
      results.forEach((doc, i) => {
        console.log(`Documento ${i+1}: ID=${doc.metadata?.id || 'desconhecido'}, Início: ${doc.pageContent.substring(0, 50)}...`);
      });
      
      // Se não encontrou resultados mas há documentos disponíveis, tente forçar a recuperação
      if (results.length === 0 && allDocuments.length > 0) {
        console.log(`Nenhum documento similar encontrado. Tentando forçar recuperação de todos os documentos disponíveis.`);
        
        // Converter os documentos do MongoDB para o formato LangChain Document
        const documents = allDocuments.map(doc => new Document({
          pageContent: doc.content,
          metadata: {
            id: doc._id?.toString() || 'unknown',
            title: doc.title || 'Sem título',
            ...(doc.metadata || {})
          }
        }));
        
        // Limitar à quantidade solicitada
        return documents.slice(0, k);
      }
      
      return results;
    } catch (error) {
      console.error(`Erro na busca por similaridade para o agente ${agentId}:`, error);
      return [];
    }
  }
  
  // Limpar documentos de um agente específico
  static async clearAgentDocuments(agentId: string): Promise<void> {
    const agentDir = this.getAgentDir(agentId);
    
    // Remover a instância da memória
    this.instances.delete(agentId);
    
    // Remover arquivos do FAISS
    try {
      if (fs.existsSync(path.join(agentDir, 'faiss.index'))) {
        fs.unlinkSync(path.join(agentDir, 'faiss.index'));
      }
      if (fs.existsSync(path.join(agentDir, 'docstore.json'))) {
        fs.unlinkSync(path.join(agentDir, 'docstore.json'));
      }
      
      // Criar um novo índice vazio
      await this.getInstance(agentId);
      
      console.log(`Documentos do agente ${agentId} removidos com sucesso.`);
    } catch (error) {
      console.error(`Erro ao limpar documentos do agente ${agentId}:`, error);
      throw error;
    }
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