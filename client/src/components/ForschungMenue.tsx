import { RESEARCH, RESEARCH_IDS, canAfford, type GameState, type ResearchId, type Stock } from '@empire/shared';
import { dauer } from '../game/format';
import { Blatt } from './Blatt';
import { Kosten } from './Kosten';

// Das Forschungs-Menü: eine Forschung nach der anderen, jede macht die Stadt dauerhaft besser
export function ForschungMenue({ state, vorrat, jetzt, onForschen, onZu }: {
  state: GameState; vorrat: Stock; jetzt: number; onForschen: (id: ResearchId) => void; onZu: () => void;
}) {
  const { fertig, aktiv, endetAm } = state.forschung;
  // Sortiert: zuerst was man erforschen kann, Erledigtes ganz unten
  const liste = [...RESEARCH_IDS].sort((a, b) =>
    Number(fertig.includes(a)) - Number(fertig.includes(b)) || RESEARCH[a].unlockLevel - RESEARCH[b].unlockLevel);

  return (
    <Blatt titel="Forschung" untertitel={`${fertig.length} von ${RESEARCH_IDS.length} erforscht · immer nur eine gleichzeitig`} icon="🔬" onZu={onZu}>
      {aktiv && (() => {
        const def = RESEARCH[aktiv];
        const rest = Math.max(0, (endetAm - jetzt) / 1000);
        const prozent = Math.min(100, 100 - (rest / def.seconds) * 100);
        return (
          <div className="karte aktiv">
            <div className="karte-icon">{def.icon}</div>
            <div className="karte-text">
              <b>{def.name}</b>
              <span>{def.text}</span>
              <div className="balken"><i style={{ width: prozent + '%' }} /></div>
              <span className="wirkung">⏳ {rest > 0 ? `noch ${dauer(rest)}` : 'gleich fertig …'}</span>
            </div>
          </div>
        );
      })()}
      {liste.filter(id => id !== aktiv).map(id => {
        const def = RESEARCH[id];
        const erledigt = fertig.includes(id);
        const gesperrt = state.save.level < def.unlockLevel;
        const kann = !erledigt && !gesperrt && !aktiv && canAfford(vorrat, def.cost);
        return (
          <div key={id} className={'karte' + (gesperrt ? ' gesperrt' : '') + (erledigt ? ' erledigt' : '')}>
            <div className="karte-icon">{def.icon}</div>
            <div className="karte-text">
              <b>{def.name}</b>
              <span>{def.text}</span>
              {!erledigt && !gesperrt && <span>⏱️ {dauer(def.seconds)}</span>}
              {!erledigt && !gesperrt && <Kosten kosten={def.cost} vorrat={vorrat} />}
            </div>
            {erledigt ? <span className="haken">✓</span>
              : gesperrt ? <button className="knopf aus" disabled>🔒 Level {def.unlockLevel}</button>
              : <button className={'knopf' + (kann ? '' : ' aus')} disabled={!kann} onClick={() => onForschen(id)}>
                  {aktiv ? 'Warten' : 'Forschen'}
                </button>}
          </div>
        );
      })}
    </Blatt>
  );
}
