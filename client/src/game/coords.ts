import { GRID_SIZE, PARZELLE, WELT, type Parzelle } from '@empire/shared';

// Ein Feld auf dem Raster ist 2 x 2 Einheiten gross in der 3D-Welt
export const TILE = 2;
const MITTE = (GRID_SIZE - 1) / 2;
export const STADT_HALB = (GRID_SIZE * TILE) / 2; // halbe Breite der Start-Stadt (16)

// Feld (x, y) -> Punkt in der 3D-Welt (x, 0, z)
export function feldZuWelt(x: number, y: number): [number, number, number] {
  return [(x - MITTE) * TILE, 0, (y - MITTE) * TILE];
}

// Punkt in der 3D-Welt -> Feld
export function weltZuFeld(wx: number, wz: number): { x: number; y: number } {
  return { x: Math.round(wx / TILE + MITTE), y: Math.round(wz / TILE + MITTE) };
}

export const feldSchluessel = (x: number, y: number) => `${x},${y}`;

// Die Mitte einer Parzelle in der 3D-Welt
export function parzellenMitte(p: Parzelle): [number, number, number] {
  const [x0, , z0] = feldZuWelt(p.px * PARZELLE, p.py * PARZELLE);
  const halb = ((PARZELLE - 1) * TILE) / 2;
  return [x0 + halb, 0, z0 + halb];
}
export const PARZELLE_BREIT = PARZELLE * TILE; // 16 Einheiten

// Die ganze Welt (alle Parzellen) in 3D-Koordinaten
const [weltMinX, , weltMinZ] = feldZuWelt(WELT.minX, WELT.minY);
const [weltMaxX, , weltMaxZ] = feldZuWelt(WELT.maxX, WELT.maxY);
export const WELT_3D = { minX: weltMinX - TILE / 2, maxX: weltMaxX + TILE / 2, minZ: weltMinZ - TILE / 2, maxZ: weltMaxZ + TILE / 2 };
