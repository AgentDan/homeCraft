const EXAMPLES = [
  '"replace module-1 with BASE-400"',
  '"add base cabinet 600"',
  '"add sink cabinet 800"',
  '"change the last cabinet to oak"',
  '"remove the last module"',
  '"show price"',
  '"budget up to 150000"',
  '"add kitchen cabinet 3x4"',
  '"undo" or "redo"'
];

export function getHelpMessage() {
  return [
    'I can help you assemble a kitchen from the demo catalog.',
    `Example commands: ${EXAMPLES.join('; ')}.`
  ].join(' ');
}
