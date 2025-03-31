import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IApiUsageLog extends MongoDocument {
  agentId: mongoose.Types.ObjectId;
  apiTokenHint: string; // Ex: ultimos 4 chars do token
  timestamp: Date;
  success: boolean; // Se a interação com LLM ocorreu sem erro
  inputLength?: number; // Tamanho da mensagem de entrada
  outputLength?: number; // Tamanho da resposta gerada
  durationMs?: number; // Duração do processamento da API
  errorMessage?: string; // Mensagem de erro se success=false
  ipAddress?: string; // Opcional: IP do requisitante
}

const ApiUsageLogSchema = new Schema<IApiUsageLog>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    apiTokenHint: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    success: {
      type: Boolean,
      required: true,
    },
    inputLength: {
      type: Number,
    },
    outputLength: {
      type: Number,
    },
    durationMs: {
      type: Number,
    },
    errorMessage: {
      type: String,
    },
    ipAddress: {
      type: String,
    }
  },
  {
    timestamps: { createdAt: 'timestamp' } // Usar o campo timestamp existente
  }
);

// Índices adicionais para consultas comuns
ApiUsageLogSchema.index({ agentId: 1, timestamp: -1 });

export default mongoose.models.ApiUsageLog || mongoose.model<IApiUsageLog>('ApiUsageLog', ApiUsageLogSchema); 