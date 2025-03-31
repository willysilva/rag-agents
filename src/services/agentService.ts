import Agent, { IAgent } from '@/models/Agent';
import AgentDocument from '@/models/AgentDocument';
import { AgentVectorStore } from '@/lib/agent-vector';
import connectDB from '@/lib/mongodb';
import { Document } from 'langchain/document';
import { Types } from 'mongoose';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";

export interface AgentInput {
  name: string;
  description: string;
  avatarUrl?: string;
  systemPrompt?: string;
  isActive?: boolean;
}

export interface AgentDocumentInput {
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Serviço para gerenciar operações relacionadas a agentes
 */
export class AgentService {
  /**
   * Criar um novo agente
   */
  static async createAgent(agentData: AgentInput) {
    await connectDB();
    
    try {
      const agent = new Agent(agentData);
      await agent.save();
      return agent;
    } catch (error: any) {
      console.error('Erro ao criar agente:', error);
      
      // Verificar se é erro de duplicação (nome de agente existente)
      if (error.code === 11000) {
        throw new Error('Já existe um agente com este nome');
      }
      
      throw error;
    }
  }
  
  /**
   * Obter todos os agentes
   */
  static async getAllAgents(showInactive = false) {
    await connectDB();
    
    const query = showInactive ? {} : { isActive: true };
    
    try {
      const agents = await Agent.find(query).sort({ createdAt: -1 });
      return agents;
    } catch (error) {
      console.error('Erro ao buscar agentes:', error);
      throw error;
    }
  }
  
  /**
   * Obter um agente por ID
   */
  static async getAgentById(id: string) {
    await connectDB();
    
    try {
      const agent = await Agent.findById(id);
      if (!agent) {
        throw new Error('Agente não encontrado');
      }
      return agent;
    } catch (error) {
      console.error(`Erro ao buscar agente ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Atualizar um agente
   */
  static async updateAgent(id: string, agentData: Partial<AgentInput>) {
    await connectDB();
    
    try {
      const agent = await Agent.findByIdAndUpdate(
        id, 
        agentData, 
        { new: true, runValidators: true }
      );
      
      if (!agent) {
        throw new Error('Agente não encontrado');
      }
      
      return agent;
    } catch (error) {
      console.error(`Erro ao atualizar agente ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Desativar um agente
   */
  static async deactivateAgent(id: string) {
    return this.updateAgent(id, { isActive: false });
  }
  
  /**
   * Ativar um agente
   */
  static async activateAgent(id: string) {
    return this.updateAgent(id, { isActive: true });
  }
  
  /**
   * Excluir um agente e seus documentos
   */
  static async deleteAgent(id: string) {
    await connectDB();
    
    try {
      // Verificar se o agente existe
      const agent = await Agent.findById(id);
      if (!agent) {
        throw new Error('Agente não encontrado');
      }
      
      // Eliminar o vetor FAISS do agente
      await AgentVectorStore.clearAgentDocuments(id);
      
      // Excluir documentos do agente no MongoDB
      await AgentDocument.deleteMany({ agentId: id });
      
      // Excluir o agente
      await Agent.findByIdAndDelete(id);
      
      return { success: true, message: 'Agente e seus documentos excluídos com sucesso' };
    } catch (error) {
      console.error(`Erro ao excluir agente ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Adicionar um documento a um agente
   */
  static async addDocumentToAgent(agentId: string, documentData: AgentDocumentInput) {
    await connectDB();
    
    try {
      // Verificar se o agente existe
      const agent = await Agent.findById(agentId);
      if (!agent) {
        throw new Error('Agente não encontrado');
      }
      
      // Criar o documento no MongoDB
      const document = new AgentDocument({
        agentId,
        title: documentData.title,
        content: documentData.content,
        metadata: documentData.metadata || {}
      });
      
      await document.save();
      
      // Adicionar o documento ao vetor FAISS
      const langchainDoc = new Document({
        pageContent: documentData.content,
        metadata: {
          id: document._id.toString(),
          title: documentData.title,
          ...documentData.metadata
        }
      });
      
      await AgentVectorStore.addDocuments(agentId, [langchainDoc]);
      
      return document;
    } catch (error) {
      console.error(`Erro ao adicionar documento ao agente ${agentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Obter documentos de um agente
   */
  static async getAgentDocuments(agentId: string) {
    await connectDB();
    
    try {
      const documents = await AgentDocument.find({ agentId })
        .sort({ createdAt: -1 });
      
      return documents;
    } catch (error) {
      console.error(`Erro ao buscar documentos do agente ${agentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Excluir um documento de um agente
   */
  static async deleteAgentDocument(agentId: string, documentId: string) {
    await connectDB();
    
    try {
      // Verificar se o documento existe e pertence ao agente
      const document = await AgentDocument.findOne({
        _id: documentId,
        agentId
      });
      
      if (!document) {
        throw new Error('Documento não encontrado ou não pertence a este agente');
      }
      
      // Excluir o documento
      await AgentDocument.findByIdAndDelete(documentId);
      
      // Sincronizar vetores (recriar FAISS sem este documento)
      await AgentVectorStore.syncFromDatabase(agentId);
      
      return { success: true, message: 'Documento excluído com sucesso' };
    } catch (error) {
      console.error(`Erro ao excluir documento ${documentId} do agente ${agentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Buscar documentos similares de um agente para uma query
   */
  static async searchAgentDocuments(agentId: string, query: string, limit = 5) {
    try {
      // Buscar documentos similares no vetor
      const documents = await AgentVectorStore.similaritySearch(agentId, query, limit);
      
      return documents;
    } catch (error) {
      console.error(`Erro na busca de documentos do agente ${agentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Limpar todos os documentos de um agente
   */
  static async clearAgentDocuments(agentId: string) {
    await connectDB();
    
    try {
      // Verificar se o agente existe
      const agent = await Agent.findById(agentId);
      if (!agent) {
        throw new Error('Agente não encontrado');
      }
      
      // Excluir documentos do MongoDB
      await AgentDocument.deleteMany({ agentId });
      
      // Limpar vetores FAISS
      await AgentVectorStore.clearAgentDocuments(agentId);
      
      return { success: true, message: 'Documentos do agente excluídos com sucesso' };
    } catch (error) {
      console.error(`Erro ao limpar documentos do agente ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Processa uma mensagem do usuário através de um agente específico, 
   * buscando contexto relevante e gerando uma resposta via LLM.
   * @param agent O objeto do agente (deve incluir campos como _id, systemPrompt, temperature)
   * @param userMessage A mensagem enviada pelo usuário.
   * @param k O número de documentos relevantes a buscar (padrão 5).
   * @returns A resposta gerada pelo LLM.
   */
  static async getAgentApiResponse(
    agent: Pick<IAgent, '_id' | 'systemPrompt' | 'temperature' | 'name'>, 
    userMessage: string, 
    k = 5 // Número de documentos a buscar
  ): Promise<string> {
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Chave da API OpenAI não configurada no ambiente.');
    }
    
    const agentId = (agent._id as Types.ObjectId).toString();
    console.log(`[AgentService] Iniciando resposta para Agente: ${agent.name} (${agentId})`);
    console.log(`[AgentService] Mensagem do usuário: "${userMessage}"`);
    
    try {
      // 1. Buscar documentos relevantes no Vector Store
      const relevantDocs = await AgentVectorStore.similaritySearch(agentId, userMessage, k);
      console.log(`[AgentService] Encontrados ${relevantDocs.length} documentos relevantes.`);

      // 2. Construir o histórico da conversa/prompt
      const messages: (SystemMessage | HumanMessage | AIMessage)[] = [];

      // Adicionar o prompt do sistema do agente
      messages.push(new SystemMessage(agent.systemPrompt || 'Você é um assistente prestativo.'));

      // Adicionar contexto dos documentos relevantes (se houver)
      if (relevantDocs.length > 0) {
        const context = relevantDocs
          .map((doc, i) => `Documento ${i + 1} (Fonte: ${doc.metadata?.title || 'desconhecida'}):\n${doc.pageContent}`)
          .join('\n\n---\n\n');
        messages.push(new SystemMessage(`Contexto relevante dos documentos:\n${context}`));
      }

      // Adicionar a mensagem atual do usuário
      messages.push(new HumanMessage(userMessage));

      // 3. Preparar o modelo LLM (ChatOpenAI)
      const chatModel = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "gpt-4o", // Ou outro modelo apropriado
        temperature: agent.temperature ?? 0.7, // Usar a temperatura do agente ou padrão
      });

      // 4. Preparar o parser de saída
      const outputParser = new StringOutputParser();

      // 5. Criar a cadeia (chain)
      const chain = chatModel.pipe(outputParser);

      // 6. Invocar a cadeia com as mensagens
      console.log(`[AgentService] Chamando LLM com ${messages.length} mensagens (Temperatura: ${agent.temperature ?? 0.7})...`);
      const response = await chain.invoke(messages);
      console.log(`[AgentService] Resposta recebida do LLM.`);

      return response;

    } catch (error: any) {
      console.error(`[AgentService] Erro ao gerar resposta para agente ${agentId}:`, error);
      // Considerar lançar um erro mais específico ou retornar uma mensagem de erro padrão
      throw new Error(`Falha ao gerar resposta: ${error.message}`);
    }
  }
} 