export const SAVE_KEY = 'after-the-brush:starry-night:v1';
export const PLAYER_RADIUS = 0.38;
export const WORLD_LIMITS = { minX: -31, maxX: 31, minZ: -42, maxZ: 28 };
export function blocked(x, z, colliders, radius = PLAYER_RADIUS) {
  return colliders.some(c => x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius);
}
export function movePlayer(position, dx, dz, colliders, bounds = WORLD_LIMITS) {
  // Small steps prevent walking through thin walls when a frame takes longer.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
  let { x, z } = position;
  for (let i = 0; i < steps; i++) {
    const nx = Math.max(bounds.minX, Math.min(bounds.maxX, x + dx / steps));
    if (!blocked(nx, z, colliders)) x = nx;
    const nz = Math.max(bounds.minZ, Math.min(bounds.maxZ, z + dz / steps));
    if (!blocked(x, nz, colliders)) z = nz;
  }
  return { x, z };
}
export function readProgress(storage, ids) {
  try {
    const parsed = JSON.parse(storage.getItem(SAVE_KEY) || '[]');
    return Array.isArray(parsed) ? [...new Set(parsed.filter(id => ids.includes(id)))] : [];
  } catch { return []; }
}
export function saveProgress(storage, ids) {
  try { storage.setItem(SAVE_KEY, JSON.stringify([...new Set(ids)])); return true; }
  catch { return false; }
}
export function compassHeading(yaw) {
  const bearings = ['N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE'];
  return bearings[((Math.round(yaw / (Math.PI / 4)) % 8) + 8) % 8];
}
