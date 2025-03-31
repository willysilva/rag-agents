import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IAgentDocument extends MongoDocument {
  agentId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const AgentDocumentSchema = new Schema<IAgentDocument>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: [true, 'Um documento deve estar associado a um agente'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Por favor, forneça um título para o documento'],
      trim: true,
      maxlength: [200, 'O título não pode ter mais de 200 caracteres'],
    },
    content: {
      type: String,
      required: [true, 'O conteúdo do documento é necessário'],
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    embedding: {
      type: [Number],
      select: false, // Não retornar embeddings por padrão nas consultas
    },
  },
  {
    timestamps: true,
  }
);

// Índices para melhorar o desempenho das consultas
AgentDocumentSchema.index({ agentId: 1, createdAt: -1 });
AgentDocumentSchema.index({ title: 'text', content: 'text' });

export default mongoose.models.AgentDocument || 
  mongoose.model<IAgentDocument>('AgentDocument', AgentDocumentSchema); 