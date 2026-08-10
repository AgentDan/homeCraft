import './config/load-env.js';

import { registry } from '@homecraft/contracts';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import { startServer } from './server.js';

registry.register(kitchenManifest);
console.log(
  `[HomeCraft] Manifest registered: ${kitchenManifest.productType} v${kitchenManifest.version}`
);

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
