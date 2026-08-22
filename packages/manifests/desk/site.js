/**
 * Desk site defaults and slot→path bindings.
 * Desk still bound-checks against a room-shaped shell today; numbers match
 * the previous core defaultRoomShape() (3000/4000/2700) because desk has no
 * domain-specific site dimensions of its own yet.
 */
export const deskDefaultSite = () => ({
  dimensions: { widthMm: 3000, depthMm: 4000, heightMm: 2700 },
  walls: [],
  openings: [],
  utilities: []
});

export const deskSiteBindings = [
  { slot: 'roomWidthMm', path: 'dimensions.widthMm' },
  { slot: 'roomDepthMm', path: 'dimensions.depthMm' }
];
