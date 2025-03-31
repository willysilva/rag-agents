import mongoose, { Schema, Document as MongoDocument, Types } from 'mongoose';
import crypto from 'crypto';

// Subdocumento para Tokens de API
export interface IApiToken extends MongoDocument {
  token: string;
  label: string;
  isActive: boolean;
  lastUsedAt?: Date;
  revokedAt?: Date;
  createdAt: Date; // Mongoose adiciona isso com timestamps, mas definimos explicitamente
}

const ApiTokenSchema = new Schema<IApiToken>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
      select: false, // Não retornar o token por padrão nas buscas gerais do agente
    },
    label: {
      type: String,
      required: [true, 'É necessário um label para o token'],
      trim: true,
      maxlength: [100, 'O label não pode ter mais de 100 caracteres'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, 
    },
    lastUsedAt: {
      type: Date,
    },
    revokedAt: {
        type: Date,
    },
  },
  { timestamps: true } // Adiciona createdAt e updatedAt automaticamente
);

export interface IAgent extends MongoDocument {
  name: string;
  description: string;
  avatarUrl?: string;
  systemPrompt?: string;
  isActive: boolean; // Manter este para ativar/desativar o agente como um todo
  apiKey?: string; // Chave de API externa que o agente pode usar (mantido)
  temperature?: number; // Mantido
  rateLimit?: { // Mantido
    requests: number;
    windowSeconds: number;
  };
  apiTokens: Types.DocumentArray<IApiToken>; // Array de subdocumentos de token
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    name: {
      type: String,
      required: [true, 'Por favor, forneça um nome para o agente'],
      unique: true,
      trim: true,
      maxlength: [50, 'O nome não pode ter mais de 50 caracteres'],
    },
    description: {
      type: String,
      required: [true, 'Por favor, forneça uma descrição para o agente'],
      trim: true,
      maxlength: [500, 'A descrição não pode ter mais de 500 caracteres'],
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    systemPrompt: {
      type: String,
      trim: true,
      default: 'Você é um assistente especializado que responde perguntas com base nos documentos fornecidos.',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    apiKey: {
      type: String,
      trim: true,
      select: false, 
    },
    temperature: {
      type: Number,
      min: 0,
      max: 2,
      default: 0.7,
    },
    rateLimit: {
      requests: { type: Number },
      windowSeconds: { type: Number },
    },
    // Novo campo para gerenciar múltiplos tokens
    apiTokens: [ApiTokenSchema], 
  },
  {
    timestamps: true,
  }
);

// Método para gerar um novo token (pode ser chamado pela rota POST)
AgentSchema.methods.generateApiToken = function(label: string): IApiToken {
    const tokenDoc = this.apiTokens.create({
        token: crypto.randomBytes(32).toString('hex'),
        label: label,
        isActive: true
    });
    this.apiTokens.push(tokenDoc);
    // Nota: É preciso salvar o agente (`await agent.save()`) depois de chamar este método
    return tokenDoc;
};

export default mongoose.models.Agent || mongoose.model<IAgent>('Agent', AgentSchema); 