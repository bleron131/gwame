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
// gier    = wohin die Kamera schaut (Drehung um die Hochachse, 0 = "nach Norden" wie von oben)
// neigung = wie steil die Kamera nach unten (positiv) oder oben (negativ) schaut
export const kamera = { modus: gespeicherterModus(), zoom: 1, gier: 0, neigung: 0 };
export function kameraModusSetzen(m: KameraModus) {
  kamera.modus = m;
  kamera.neigung = 0;
  try { localStorage.setItem('empire-kamera', m); } catch { /* privater Modus */ }
}
export function zoomen(faktor: number) {
  kamera.zoom = Math.max(0.5, Math.min(2.2, kamera.zoom * faktor));
}

// Umsehen mit Maus oder Finger: dx/dy = wie weit (in Pixeln) bewegt wurde
export function drehen(dx: number, dy: number) {
  kamera.gier -= dx * 0.0045;
  kamera.neigung = Math.max(-1, Math.min(1, kamera.neigung + dy * 0.0035));
}

// Pfeiltasten links/rechts drehen die Kamera (in Third Person und Ego): -1, 0 oder 1
export function drehTasten(): number {
  if (kamera.modus === 'oben') return 0;
  const t = eingabe.tasten;
  return (t.has('arrowright') ? 1 : 0) - (t.has('arrowleft') ? 1 : 0);
}

// Rohe Eingabe: x = links/rechts, z = hoch/runter (Joystick nach oben = negativ), Stärke 0..1
export function steuerEingabe(): { x: number; z: number; staerke: number } {
  const t = eingabe.tasten;
  const pfeileSeitlich = kamera.modus === 'oben'; // sonst drehen die Pfeiltasten links/rechts die Kamera
  const kx = (t.has('d') || (pfeileSeitlich && t.has('arrowright')) ? 1 : 0) - (t.has('a') || (pfeileSeitlich && t.has('arrowleft')) ? 1 : 0);
  const kz = (t.has('s') || t.has('arrowdown') ? 1 : 0) - (t.has('w') || t.has('arrowup') ? 1 : 0);
  if (kx || kz) return { x: kx, z: kz, staerke: 1 };
  const l = Math.hypot(eingabe.joyX, eingabe.joyY);
  if (l < 0.05) return { x: 0, z: 0, staerke: 0 };
  return { x: eingabe.joyX, z: eingabe.joyY, staerke: Math.min(1, l) };
}

// In welche Richtung (in der Welt) soll der Bürgermeister laufen?
// Immer passend zur Kamera: "hoch/W" = dorthin, wohin die Kamera schaut, "A/D" = seitwärts.
export function laufRichtung(gier: number): { x: number; z: number; staerke: number } {
  const e = steuerEingabe();
  if (e.staerke === 0) return e;
  const l = Math.hypot(e.x, e.z);
  const vor = -e.z / l, seit = e.x / l;
  // vorwärts = (-sin g, -cos g), rechts = (cos g, -sin g)
  const x = -Math.sin(gier) * vor + Math.cos(gier) * seit;
  const z = -Math.cos(gier) * vor - Math.sin(gier) * seit;
  return { x, z, staerke: e.staerke };
}
