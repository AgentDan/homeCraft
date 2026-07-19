import { runCatalogIndexer } from './indexer.js';
import { closeMongo } from '../storage/mongo.js';

runCatalogIndexer()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeMongo);
