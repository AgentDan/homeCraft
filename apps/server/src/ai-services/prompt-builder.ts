import type { IntentResult, RetrievedModule, RoomContext } from '@homecraft/contracts';

export type PromptBuildInput = {
  context: RoomContext;
  intent: IntentResult;
  chunks: RetrievedModule[];
};

/**
 * Builds LLM prompt with RAG chunks. Step0: stub template only.
 */
export function buildPrompt(input: PromptBuildInput): string {
  return [
    '# HomeCraft prompt (step0 stub)',
    `Project: ${input.context.projectId}`,
    `Intent: ${input.intent.kind}`,
    `Chunks: ${input.chunks.length}`
  ].join('\n');
}
