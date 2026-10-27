// Steuerung: Joystick (Finger/Maus) und Tastatur (WASD / Pfeiltasten)
export const eingabe = { joyX: 0, joyY: 0, tasten: new Set<string>() };

const istTextfeld = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
window.addEventListener('keydown', e => { if (!istTextfeld(e)) eingabe.tasten.add(e.key.toLowerCase()); });
window.addEventListener('keyup', e => { eingabe.tasten.delete(e.key.toLowerCase()); });
window.addEventListener('blur', () => eingabe.tasten.clear());

// ===== Kamera =====
// "oben"   = Blick von oben auf die Stadt (gut zum Bauen)
// "dritte" = Third Person: Kamera hinter dem Bürgermeister
// "ego"    = Ego-Perspektive: durch die Augen des Bürgermeisters
export type KameraModus = 'oben' | 'dritte' | 'ego';
export const KAMERA_MODI: { id: KameraModus; icon: string; name: string }[] = [
  { id: 'oben', icon: '🗺️', name: 'Von oben' },
  { id: 'dritte', icon: '🧍', name: 'Third Person' },
  { id: 'ego', icon: '👁️', name: 'Ego' }
];
function gespeicherterModus(): KameraModus {
  try { const m = localStorage.getItem('empire-kamera'); if (m === 'oben' || m === 'dritte' || m === 'ego') return m; } catch { /* egal */ }
  return 'oben';
}
export const kamera = { modus: gespeicherterModus(), zoom: 1 };
export function kameraModusSetzen(m: KameraModus) {
  kamera.modus = m;
  try { localStorage.setItem('empire-kamera', m); } catch { /* privater Modus */ }
}
export function zoomen(faktor: number) {
  kamera.zoom = Math.max(0.5, Math.min(2.2, kamera.zoom * faktor));
}

// Rohe Eingabe: x = links/rechts, z = hoch/runter (Joystick nach oben = negativ), Stärke 0..1
export function steuerEingabe(): { x: number; z: number; staerke: number } {
  const t = eingabe.tasten;
  const kx = (t.has('d') || t.has('arrowright') ? 1 : 0) - (t.has('a') || t.has('arrowleft') ? 1 : 0);
  const kz = (t.has('s') || t.has('arrowdown') ? 1 : 0) - (t.has('w') || t.has('arrowup') ? 1 : 0);
  if (kx || kz) return { x: kx, z: kz, staerke: 1 };
  const l = Math.hypot(eingabe.joyX, eingabe.joyY);
  if (l < 0.05) return { x: 0, z: 0, staerke: 0 };
  return { x: eingabe.joyX, z: eingabe.joyY, staerke: Math.min(1, l) };
}

// Von oben: In welche Richtung auf dem Bildschirm soll der Bürgermeister laufen?
export function laufRichtung(): { x: number; z: number; staerke: number } {
  const e = steuerEingabe();
  if (e.staerke === 0) return e;
  const l = Math.hypot(e.x, e.z);
  return { x: e.x / l, z: e.z / l, staerke: e.staerke };
}
