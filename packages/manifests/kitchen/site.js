/**
 * Kitchen site defaults and slot→path bindings (domain data, not core).
 * Copied from the previous defaultRoomShape() in room-context-builder.js.
 */
export const kitchenDefaultSite = () => ({
  dimensions: { widthMm: 3000, depthMm: 4000, heightMm: 2700 },
  walls: [],
  openings: [],
  utilities: []
});

export const kitchenSiteBindings = [
  { slot: 'roomWidthMm', path: 'dimensions.widthMm' },
  { slot: 'roomDepthMm', path: 'dimensions.depthMm' }
];
