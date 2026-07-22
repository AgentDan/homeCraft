/**
 * Shared JSDoc types for compatibility rules. This module intentionally exports
 * no runtime values — it only carries typedefs referenced via `import('./types.js')`.
 */

/**
 * @typedef {'overlap' | 'dimension_exceeded' | 'clearance_violation'
 *   | 'mounting_mismatch' | 'utility_conflict' | 'unsupported_appliance'} ConflictKind
 */

/**
 * @typedef {object} Conflict
 * @property {ConflictKind} kind
 * @property {string} message
 * @property {string[]} instanceIds
 * @property {string[]} suggestedSkus
 */

/**
 * A materialized module placed in the room (catalog module + instance placement).
 * @typedef {object} PlacedModule
 * @property {string} instanceId
 * @property {string} sku
 * @property {string} name
 * @property {string} category
 * @property {'floor' | 'wall' | 'tall' | 'corner'} mounting
 * @property {{ widthMm: number, heightMm: number, depthMm: number }} dimensions
 * @property {{ topMm: number, bottomMm: number, leftMm: number, rightMm: number, backMm: number }} [clearances]
 * @property {Array<'water' | 'gas' | 'electric' | 'drain'>} [utilities]
 * @property {{ x: number, y: number, z: number }} position
 * @property {number} rotationY
 */

/**
 * @typedef {object} UtilityPoint
 * @property {string} id
 * @property {'water' | 'gas' | 'electric' | 'drain'} kind
 * @property {{ x: number, y: number, z: number }} position
 */

/**
 * @typedef {object} RoomShapeLike
 * @property {{ widthMm: number, depthMm: number, heightMm: number }} dimensions
 * @property {UtilityPoint[]} [utilities]
 */

/**
 * @typedef {object} RuleContext
 * @property {PlacedModule[]} modules
 * @property {{ roomShape: RoomShapeLike }} context
 * @property {ReturnType<import('../spatial-index.js').buildSpatialIndex>} index
 */

export {};
