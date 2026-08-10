/**
 * ManifestRegistry — синглтон, хранящий зарегистрированные манифесты доменов.
 *
 * Использование:
 *   import { registry } from '@homecraft/contracts';
 *   registry.register(kitchenManifest);
 *   const manifest = registry.get('kitchen');
 */
class ManifestRegistry {
  /** @type {Map<string, import('./product-manifest.js').ProductManifest>} */
  #manifests = new Map();

  /**
   * @param {import('./product-manifest.js').ProductManifest} manifest
   */
  register(manifest) {
    if (this.#manifests.has(manifest.productType)) {
      throw new Error(`Manifest already registered: ${manifest.productType}`);
    }
    this.#manifests.set(manifest.productType, manifest);
  }

  /**
   * @param {string} productType
   * @returns {import('./product-manifest.js').ProductManifest}
   */
  get(productType) {
    const manifest = this.#manifests.get(productType);
    if (!manifest) {
      throw new Error(`No manifest registered for productType: ${productType}`);
    }
    return manifest;
  }

  /** @returns {string[]} */
  registeredTypes() {
    return [...this.#manifests.keys()];
  }

  /**
   * Runs domain-specific initialisation after registration.
   * Keeps the registry itself free of server-side imports.
   *
   * @param {string} productType
   * @param {{
   *   onJourneyQuestions?: (questions: object[]) => void,
   *   onDp4Rules?: (rules: object[]) => void
   * }} [callbacks]
   */
  initDomain(productType, { onJourneyQuestions, onDp4Rules } = {}) {
    const manifest = this.get(productType);
    if (onJourneyQuestions) onJourneyQuestions(manifest.journeyQuestions);
    if (onDp4Rules) onDp4Rules(manifest.dp4Rules);
  }
}

export const registry = new ManifestRegistry();
