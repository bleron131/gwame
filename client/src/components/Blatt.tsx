import type { ReactNode } from 'react';

// Ein Menü, das von unten hochfährt
export function Blatt({ titel, untertitel, icon, onZu, children }: { titel: string; untertitel?: string; icon: string; onZu: () => void; children: ReactNode }) {
  return (
    <div className="blatt">
      <div className="griff" />
      <button className="zu" onClick={onZu} aria-label="Schliessen">✕</button>
      <div className="blatt-kopf">
        <div className="blatt-icon">{icon}</div>
        <div><h2>{titel}</h2>{untertitel && <p>{untertitel}</p>}</div>
      </div>
      <div className="blatt-inhalt">{children}</div>
    </div>
  );
}

// Ein Fenster in der Mitte
export function Fenster({ children }: { children: ReactNode }) {
  return <div className="fenster-hinter"><div className="fenster">{children}</div></div>;
}
