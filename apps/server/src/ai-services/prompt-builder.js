/** Builds an inspectable prompt for the future LLM path. */
export function buildPrompt(input) {
  const history = input.context.dialogTurns
    .slice(-8)
    .map((turn) => `${turn.role}: ${turn.text}`)
    .join('\n');
  const chunks = input.chunks
    .map((chunk) =>
      'sku' in chunk
        ? `${chunk.sku}: ${chunk.name} (${chunk.dimensions.widthMm} mm)`
        : chunk.text
    )
    .join('\n---\n');
  return [
    '# HomeCraft catalog-grounded prompt',
    `Project: ${input.context.projectId}`,
    `Intent: ${input.intent.kind}`,
    `Budget: ${input.context.budgetRub ?? 'not set'}`,
    'Dialog:',
    history || '(empty)',
    'Retrieved context:',
    chunks || '(no matching context)'
  ].join('\n');
}
