import { runCatalogIndexer } from './indexer.js';
import { closeMongo } from '../storage/mongo.js';
import { registry } from '@homecraft/contracts';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import { deskManifest } from '@homecraft/manifests/desk';

if (!registry.registeredTypes().includes('kitchen')) {
  registry.register(kitchenManifest);
}
if (!registry.registeredTypes().includes('desk')) {
  registry.register(deskManifest);
}

Promise.all(registry.registeredTypes().map((productType) => runCatalogIndexer(productType)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeMongo);
