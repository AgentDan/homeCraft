/**
 * Shared compatibility-engine primitives (geometry helpers + JSDoc typedefs).
 *
 * Typedefs live in `./types.js` (no runtime exports). They are aliased here
 * so consumers can write the short path `import('@homecraft/engine').RuleContext`
 * instead of `import('@homecraft/engine/src/types.js').RuleContext`.
 *
 * @typedef {import('./types.js').ConflictKind} ConflictKind
 * @typedef {import('./types.js').Conflict} Conflict
 * @typedef {import('./types.js').PlacedModule} PlacedModule
 * @typedef {import('./types.js').UtilityPoint} UtilityPoint
 * @typedef {import('./types.js').RoomShapeLike} RoomShapeLike
 * @typedef {import('./types.js').RuleContext} RuleContext
 */
export * from './geometry.js';
