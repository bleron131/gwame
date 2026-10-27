import { BUILDINGS, BUILDING_TYPES, canAfford, upgradeCost, type BuildingType, type GameState, type Stock } from '@empire/shared';
import { wirkung } from '../game/format';
import { Blatt } from './Blatt';
import { Kosten } from './Kosten';

// Liste aller Gebäude, die man bauen kann
export function BauMenue({ state, vorrat, onWahl, onZu }: { state: GameState; vorrat: Stock; onWahl: (t: BuildingType) => void; onZu: () => void }) {
  const typen = BUILDING_TYPES.filter(t => BUILDINGS[t].buildable).sort((a, b) => BUILDINGS[a].unlockLevel - BUILDINGS[b].unlockLevel);
  return (
    <Blatt titel="Bauen" untertitel="Wähle ein Gebäude und tippe dann auf einen freien Platz" icon="🏗️" onZu={onZu}>
      {typen.map(t => {
        const def = BUILDINGS[t];
        const kosten = upgradeCost(t, 0);
        const gesperrt = state.save.level < def.unlockLevel;
        const kann = !gesperrt && canAfford(vorrat, kosten);
        return (
          <div key={t} className={'karte' + (gesperrt ? ' gesperrt' : '')}>
            <div className="karte-icon">{def.icon}</div>
            <div className="karte-text">
              <b>{def.name}</b>
              <span>{def.description}</span>
              <span className="wirkung">{wirkung(t, 1).join(' · ')}</span>
              {!gesperrt && <Kosten kosten={kosten} vorrat={vorrat} />}
            </div>
            {gesperrt
              ? <button className="knopf aus" disabled>🔒 Level {def.unlockLevel}</button>
              : <button className={'knopf' + (kann ? '' : ' aus')} disabled={!kann} onClick={() => onWahl(t)}>Bauen</button>}
          </div>
        );
      })}
    </Blatt>
  );
}
