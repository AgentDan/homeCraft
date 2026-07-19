import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Loaded before other modules: `.env` at the monorepo root. */
const __dirnameConfig = path.dirname(fileURLToPath(import.meta.url));
const repoRootEnv = path.resolve(__dirnameConfig, '..', '..', '..', '..', '.env');

if (fs.existsSync(repoRootEnv)) {
  dotenv.config({ path: repoRootEnv });
}

dotenv.config();
