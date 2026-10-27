import { useEffect, useRef, useState, type RefObject } from 'react';
import { eingabe } from '../game/input';

const RADIUS = 50;

// Finger (oder Maus) auf die Welt legen und ziehen = laufen.
// Kurz tippen bleibt ein Tippen (zum Auswählen von Gebäuden).
export function Joystick({ ziel }: { ziel: RefObject<HTMLDivElement> }) {
  const [anzeige, setAnzeige] = useState<{ sx: number; sy: number; dx: number; dy: number } | null>(null);
  const aktiv = useRef<{ id: number; sx: number; sy: number } | null>(null);

  useEffect(() => {
    const el = ziel.current;
    if (!el) return;
    const runter = (e: PointerEvent) => {
      if (aktiv.current) return;
      aktiv.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY };
    };
    const bewegen = (e: PointerEvent) => {
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
      if (!aktiv.current || e.pointerId !== aktiv.current.id) return;
      aktiv.current = null;
      eingabe.joyX = eingabe.joyY = 0;
      setAnzeige(null);
    };
    el.addEventListener('pointerdown', runter);
    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', hoch);
    window.addEventListener('pointercancel', hoch);
    return () => {
      el.removeEventListener('pointerdown', runter);
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
