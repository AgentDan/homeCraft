import { createApp } from './app.js';
import { warnProductionClientDistMissing } from './core/api/middleware.js';
import { isProduction, runtimeConfig, runtimeLabel } from './config/runtime.js';
import { ensureStorage } from './storage/local-storage.js';

export async function startServer() {
  if (isProduction) {
    warnProductionClientDistMissing();
  }

  try {
    const { root } = await ensureStorage();
    console.log(`[storage] готово: ${root}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[storage] не удалось инициализировать хранилище: ${msg}`);
    console.error(
      '[storage] Проверьте права на каталог apps/server/data или задайте SERVER_STORAGE_DIR.'
    );
  }

  const { port, host } = runtimeConfig;
  const app = createApp();

  await new Promise((resolve, reject) => {
    const httpServer = app.listen(port, host, () => {
      console.log(`[${runtimeLabel()}] Сервер: http://${host}:${port}`);
      resolve(httpServer);
    });
    httpServer.on('error', reject);
  });
}
