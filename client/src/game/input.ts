// Steuerung: Joystick (Finger/Maus) und Tastatur (WASD / Pfeiltasten)
export const eingabe = { joyX: 0, joyY: 0, tasten: new Set<string>() };

const istTextfeld = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
window.addEventListener('keydown', e => { if (!istTextfeld(e)) eingabe.tasten.add(e.key.toLowerCase()); });
window.addEventListener('keyup', e => { eingabe.tasten.delete(e.key.toLowerCase()); });
window.addEventListener('blur', () => eingabe.tasten.clear());

// In welche Richtung soll der Bürgermeister laufen? (x = rechts, z = nach vorne/unten)
export function laufRichtung(): { x: number; z: number; staerke: number } {
  const t = eingabe.tasten;
  const kx = (t.has('d') || t.has('arrowright') ? 1 : 0) - (t.has('a') || t.has('arrowleft') ? 1 : 0);
  const kz = (t.has('s') || t.has('arrowdown') ? 1 : 0) - (t.has('w') || t.has('arrowup') ? 1 : 0);
  if (kx || kz) { const l = Math.hypot(kx, kz); return { x: kx / l, z: kz / l, staerke: 1 }; }
  const l = Math.hypot(eingabe.joyX, eingabe.joyY);
  if (l < 0.05) return { x: 0, z: 0, staerke: 0 };
  return { x: eingabe.joyX / l, z: eingabe.joyY / l, staerke: Math.min(1, l) };
}
