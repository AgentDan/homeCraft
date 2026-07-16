/**
 * Builds LLM prompt with RAG chunks. Step0: stub template only.
 */
export function buildPrompt(input) {
  return [
    '# HomeCraft prompt (step0 stub)',
    `Project: ${input.context.projectId}`,
    `Intent: ${input.intent.kind}`,
    `Chunks: ${input.chunks.length}`
  ].join('\n');
}
