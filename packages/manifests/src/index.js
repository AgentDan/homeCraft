import { kitchenManifest } from '../kitchen/manifest.js';
import { deskManifest } from '../desk/manifest.js';

/** Every domain manifest this build knows about. Add new domains here only. */
export const allManifests = [kitchenManifest, deskManifest];

export { kitchenManifest, deskManifest };
