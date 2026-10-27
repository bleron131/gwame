import { GRID_SIZE } from '@empire/shared';

// Ein Feld auf dem Raster ist 2 x 2 Einheiten gross in der 3D-Welt
export const TILE = 2;
const MITTE = (GRID_SIZE - 1) / 2;
export const STADT_HALB = (GRID_SIZE * TILE) / 2; // halbe Breite der Stadt (16)

// Feld (x, y) -> Punkt in der 3D-Welt (x, 0, z)
export function feldZuWelt(x: number, y: number): [number, number, number] {
  return [(x - MITTE) * TILE, 0, (y - MITTE) * TILE];
}

// Punkt in der 3D-Welt -> Feld
export function weltZuFeld(wx: number, wz: number): { x: number; y: number } {
  return { x: Math.round(wx / TILE + MITTE), y: Math.round(wz / TILE + MITTE) };
}

export const feldSchluessel = (x: number, y: number) => `${x},${y}`;
