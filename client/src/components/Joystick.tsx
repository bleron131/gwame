import { useEffect, useRef, useState, type RefObject } from 'react';
import { drehen, eingabe, kamera, zoomen } from '../game/input';

const RADIUS = 50;

// Maus und Finger auf der 3D-Welt:
// - Von oben: Finger/Maus ziehen = laufen. Rechte Maustaste ziehen = Kamera drehen.
// - Third Person / Ego: Maus ziehen (linke oder rechte Taste) = umsehen.
//   Doppelklick = Maus "fangen": Dann sieht man sich ohne Klicken um (Esc = loslassen).
//   Handy: linke Bildschirmhälfte = laufen, rechte Hälfte = umsehen.
// - Kurz tippen bleibt ein Tippen (zum Auswählen von Gebäuden).
// - Zwei Finger auseinander/zusammen oder Mausrad = zoomen.
export function Joystick({ ziel }: { ziel: RefObject<HTMLDivElement> }) {
  const [anzeige, setAnzeige] = useState<{ sx: number; sy: number; dx: number; dy: number } | null>(null);
  const [gefangen, setGefangen] = useState(false);
  const aktiv = useRef<{ id: number; sx: number; sy: number } | null>(null);   // Joystick (laufen)
  const schauen = useRef<{ id: number; x: number; y: number } | null>(null);  // Umsehen
  const finger = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);

  useEffect(() => {
    const el = ziel.current;
    if (!el) return;
    const stopp = () => { aktiv.current = null; eingabe.joyX = eingabe.joyY = 0; setAnzeige(null); };
    const abstand = () => { const [a, b] = [...finger.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

    const runter = (e: PointerEvent) => {
      finger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (finger.current.size === 2) { stopp(); schauen.current = null; pinch.current = abstand(); return; } // zweiter Finger: Zoom
      const umsehenModus = kamera.modus !== 'oben';
      const maus = e.pointerType === 'mouse';
      // Womit wird umgesehen? Maus: rechte Taste immer, linke Taste in Third Person/Ego. Finger: rechte Hälfte in Third Person/Ego.
      const zumSchauen = maus ? e.button === 2 || (umsehenModus && e.button === 0) : umsehenModus && e.clientX > window.innerWidth / 2;
      if (zumSchauen) { if (!schauen.current) schauen.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
      if (!aktiv.current && e.button === 0) aktiv.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY };
    };
    const bewegen = (e: PointerEvent) => {
      if (finger.current.has(e.pointerId)) finger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current !== null && finger.current.size === 2) {
        const neu = abstand();
        zoomen(pinch.current / neu);
        pinch.current = neu;
        return;
      }
      const s = schauen.current;
      if (s && e.pointerId === s.id) {
        // Finger etwas schneller als die Maus (der Bildschirm ist kleiner)
        const k = e.pointerType === 'mouse' ? 1 : 1.6;
        drehen((e.clientX - s.x) * k, (e.clientY - s.y) * k);
        s.x = e.clientX; s.y = e.clientY;
        return;
      }
      const a = aktiv.current;
      if (!a || e.pointerId !== a.id) return;
      const dx = e.clientX - a.sx, dy = e.clientY - a.sy, l = Math.hypot(dx, dy);
      if (l < 10) { eingabe.joyX = eingabe.joyY = 0; return; }
      const k = Math.min(l, RADIUS) / l;
      eingabe.joyX = (dx * k) / RADIUS;
      eingabe.joyY = (dy * k) / RADIUS;
      setAnzeige({ sx: a.sx, sy: a.sy, dx: dx * k, dy: dy * k });
    };
    const hoch = (e: PointerEvent) => {
      finger.current.delete(e.pointerId);
      if (finger.current.size < 2) pinch.current = null;
      if (schauen.current && e.pointerId === schauen.current.id) schauen.current = null;
      if (aktiv.current && e.pointerId === aktiv.current.id) stopp();
    };
    const rad = (e: WheelEvent) => { e.preventDefault(); zoomen(1 + Math.sign(e.deltaY) * 0.1); };
    const keinMenue = (e: MouseEvent) => e.preventDefault(); // rechte Maustaste: kein Browser-Menü

    // Maus fangen (Pointer Lock): Doppelklick in Third Person / Ego
    const doppelklick = () => { if (kamera.modus !== 'oben' && !document.pointerLockElement) el.requestPointerLock?.(); };
    // (Manche Browser melden direkt nach dem Fangen einen riesigen Sprung – den ignorieren wir)
    const gefangenBewegen = (e: MouseEvent) => {
      if (document.pointerLockElement !== el || Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      drehen(e.movementX, e.movementY);
    };
    const sperreGeaendert = () => setGefangen(document.pointerLockElement === el);

    el.addEventListener('pointerdown', runter);
    el.addEventListener('wheel', rad, { passive: false });
    el.addEventListener('contextmenu', keinMenue);
    el.addEventListener('dblclick', doppelklick);
    document.addEventListener('mousemove', gefangenBewegen);
    document.addEventListener('pointerlockchange', sperreGeaendert);
    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', hoch);
    window.addEventListener('pointercancel', hoch);
    return () => {
      el.removeEventListener('pointerdown', runter);
      el.removeEventListener('wheel', rad);
      el.removeEventListener('contextmenu', keinMenue);
      el.removeEventListener('dblclick', doppelklick);
      document.removeEventListener('mousemove', gefangenBewegen);
      document.removeEventListener('pointerlockchange', sperreGeaendert);
      window.removeEventListener('pointermove', bewegen);
      window.removeEventListener('pointerup', hoch);
      window.removeEventListener('pointercancel', hoch);
    };
  }, [ziel]);

  return (
    <>
      {/* Fadenkreuz, solange die Maus gefangen ist */}
      {gefangen && <div className="fadenkreuz" />}
      {gefangen && <div className="maus-hinweis">🖱️ Maus bewegen = umsehen · <b>Esc</b> = Maus loslassen</div>}
      {anzeige && (
        <div className="joystick" style={{ left: anzeige.sx, top: anzeige.sy }}>
          <div className="knauf" style={{ transform: `translate(${anzeige.dx}px, ${anzeige.dy}px)` }} />
        </div>
      )}
    </>
  );
}
