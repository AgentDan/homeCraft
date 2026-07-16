import { bootstrap } from './app.js';

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
