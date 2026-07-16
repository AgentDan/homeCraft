/**
 * Feature-flagged LLM client wrapper. Step0: disabled stub.
 */
export type LlmClientConfig = {
  provider: 'stub' | 'openai' | 'anthropic';
  apiKey?: string;
  model?: string;
};

export class LlmClient {
  constructor(private readonly config: LlmClientConfig) {}

  /** @throws Error when called in step0 stub mode */
  async complete(_prompt: string): Promise<string> {
    if (this.config.provider === 'stub') {
      throw new Error('Not implemented: LLM client is stub-only in step0');
    }
    throw new Error('Not implemented');
  }
}

export function createLlmClientFromEnv(): LlmClient {
  const provider = (process.env.LLM_PROVIDER ?? 'stub') as LlmClientConfig['provider'];
  return new LlmClient({
    provider,
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL
  });
}
