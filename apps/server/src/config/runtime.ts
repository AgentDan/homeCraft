import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const runtimeConfig = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/homecraft',
  embeddingsProvider: process.env.EMBEDDINGS_PROVIDER ?? 'stub',
  kbTopK: Number(process.env.KB_TOP_K ?? 5),
  corsOrigin: process.env.CORS_ORIGIN ?? '*'
};
