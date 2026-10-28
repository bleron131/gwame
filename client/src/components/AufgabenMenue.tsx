import { QUESTS, zielText, type GameState, type Stock } from '@empire/shared';
import { aufgabeJetzt } from '../game/aufgaben';
import { mengenText } from '../game/format';
import { Blatt } from './Blatt';

// Greta, die Beraterin, erklärt die aktuelle Aufgabe
export function AufgabenMenue({ state, vorrat, onAbholen, onZu }: {
  state: GameState; vorrat: Stock; onAbholen: (id: string) => void; onZu: () => void;
}) {
  const a = aufgabeJetzt(state, vorrat);
  const nummer = Math.min(state.aufgabe.nummer + 1, QUESTS.length);
  return (
    <Blatt titel="Aufgaben" untertitel={a ? `Aufgabe ${nummer} von ${QUESTS.length}` : 'Alle Aufgaben erledigt'} icon="📜" onZu={onZu}>
      <div className="greta">
        <div className="greta-bild">👩‍🌾</div>
        <div className="sprechblase">
          <b>Greta</b>
          <p>{a ? a.q.text : 'Du hast alles geschafft, Bürgermeister! Unsere Stadt ist die schönste im ganzen Land. Bau weiter – ich bin stolz auf dich!'}</p>
        </div>
      </div>
      {a && (
        <div className={'karte aufgabe' + (a.fertig ? ' bereit' : '')}>
          <div className="karte-text">
            <b>{a.q.titel}</b>
            <span>{zielText(a.q.ziel)}</span>
            <div className="balken"><i style={{ width: (a.aktuell / a.ziel) * 100 + '%' }} /></div>
            <span>{a.aktuell} / {a.ziel}</span>
            <span className="wirkung">🎁 Belohnung: {mengenText(a.q.belohnung)}  +{a.q.xp} ⭐</span>
          </div>
        </div>
      )}
      {a && (
        <button className={'knopf gross' + (a.fertig ? '' : ' aus')} disabled={!a.fertig} onClick={() => onAbholen(a.q.id)}>
          {a.fertig ? '🎁 Belohnung abholen' : 'Noch nicht fertig'}
        </button>
      )}
    </Blatt>
  );
}
