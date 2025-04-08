import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rag-agents';

// Definir o tipo para o cache de conexão global
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Cache da conexão no ambiente de desenvolvimento
// @ts-ignore
const cached: MongooseCache = global.mongoose || { conn: null, promise: null };

// Verificar se a conexão já existe no objeto global
// @ts-ignore
if (!global.mongoose) {
  // @ts-ignore
  global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('MongoDB conectado com sucesso!');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('Erro ao conectar ao MongoDB:', e);
    throw e;
  }

  return cached.conn;
}

export default connectDB; 