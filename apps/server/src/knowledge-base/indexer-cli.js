import { runCatalogIndexer } from './indexer.js';
import { closeMongo } from '../storage/mongo.js';
import { registry } from '@homecraft/contracts';
import { allManifests } from '@homecraft/manifests';

for (const manifest of allManifests) {
  if (!registry.registeredTypes().includes(manifest.productType)) {
    registry.register(manifest);
  }
}

Promise.all(registry.registeredTypes().map((productType) => runCatalogIndexer(productType)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeMongo);
