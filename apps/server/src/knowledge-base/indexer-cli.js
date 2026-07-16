import { runCatalogIndexer } from './indexer.js';

runCatalogIndexer().catch((error) => {
  console.error(error);
  process.exit(1);
});
