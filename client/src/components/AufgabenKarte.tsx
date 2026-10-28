import { zielText } from '@empire/shared';
import type { AufgabeJetzt } from '../game/aufgaben';

// Die kleine Karte unten: zeigt immer, was Greta gerade von dir möchte
export function AufgabenKarte({ a, onOeffnen }: { a: AufgabeJetzt; onOeffnen: () => void }) {
  return (
    <button className={'aufgaben-karte' + (a.fertig ? ' bereit' : '')} onClick={onOeffnen}>
      <span className="ak-icon">{a.fertig ? '🎁' : '📜'}</span>
      <span className="ak-text">
        <b>{a.fertig ? 'Belohnung abholen!' : a.q.titel}</b>
        <small>{zielText(a.q.ziel)}</small>
        <span className="balken"><i style={{ width: (a.aktuell / a.ziel) * 100 + '%' }} /></span>
      </span>
      <span className="ak-zahl">{a.aktuell}/{a.ziel}</span>
    </button>
  );
}
