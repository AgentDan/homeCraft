export class LlmClient {
  constructor(config) {
    this.config = config;
  }

  async complete(_prompt) {
    if (this.config.provider === 'stub') {
      throw new Error('Not implemented: LLM client is stub-only in step0');
    }
    throw new Error('Not implemented');
  }
}

export function createLlmClientFromEnv() {
  const provider = process.env.LLM_PROVIDER ?? 'stub';
  return new LlmClient({
    provider,
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL
  });
}
