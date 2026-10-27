import { useEffect, useRef, useState, type RefObject } from 'react';
import { eingabe, zoomen } from '../game/input';

const RADIUS = 50;

// Finger (oder Maus) auf die Welt legen und ziehen = laufen.
// Kurz tippen bleibt ein Tippen (zum Auswählen von Gebäuden).
// Zwei Finger auseinander/zusammen oder Mausrad = zoomen.
export function Joystick({ ziel }: { ziel: RefObject<HTMLDivElement> }) {
  const [anzeige, setAnzeige] = useState<{ sx: number; sy: number; dx: number; dy: number } | null>(null);
  const aktiv = useRef<{ id: number; sx: number; sy: number } | null>(null);
  const finger = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);

  useEffect(() => {
    const el = ziel.current;
    if (!el) return;
    const stopp = () => { aktiv.current = null; eingabe.joyX = eingabe.joyY = 0; setAnzeige(null); };
    const abstand = () => { const [a, b] = [...finger.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

    const runter = (e: PointerEvent) => {
      finger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (finger.current.size === 2) { stopp(); pinch.current = abstand(); return; } // zweiter Finger: Zoom statt Laufen
      if (!aktiv.current) aktiv.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY };
    };
    const bewegen = (e: PointerEvent) => {
      if (finger.current.has(e.pointerId)) finger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current !== null && finger.current.size === 2) {
        const neu = abstand();
        zoomen(pinch.current / neu);
        pinch.current = neu;
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
      if (aktiv.current && e.pointerId === aktiv.current.id) stopp();
    };
    const rad = (e: WheelEvent) => { e.preventDefault(); zoomen(1 + Math.sign(e.deltaY) * 0.1); };

    el.addEventListener('pointerdown', runter);
    el.addEventListener('wheel', rad, { passive: false });
    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', hoch);
    window.addEventListener('pointercancel', hoch);
    return () => {
      el.removeEventListener('pointerdown', runter);
      el.removeEventListener('wheel', rad);
      window.removeEventListener('pointermove', bewegen);
      window.removeEventListener('pointerup', hoch);
      window.removeEventListener('pointercancel', hoch);
    };
  }, [ziel]);

  if (!anzeige) return null;
  return (
    <div className="joystick" style={{ left: anzeige.sx, top: anzeige.sy }}>
      <div className="knauf" style={{ transform: `translate(${anzeige.dx}px, ${anzeige.dy}px)` }} />
    </div>
  );
}
