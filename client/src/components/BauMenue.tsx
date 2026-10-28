import { BUILDINGS, BUILDING_TYPES, bauzeit, canAfford, upgradeCost, type BuildingType, type GameState, type Stock } from '@empire/shared';
import { dauer, wirkung } from '../game/format';
import { Blatt } from './Blatt';
import { Kosten } from './Kosten';

// Liste aller Gebäude, die man bauen kann – Stadt und Industrie getrennt, dazu die Bausätze aus dem Shop
export function BauMenue({ state, vorrat, onWahl, onBausatz, onZu }: {
  state: GameState; vorrat: Stock; onWahl: (t: BuildingType) => void; onBausatz: (t: BuildingType) => void; onZu: () => void;
}) {
  const sortiert = BUILDING_TYPES.filter(t => BUILDINGS[t].buildable).sort((a, b) => BUILDINGS[a].unlockLevel - BUILDINGS[b].unlockLevel);
  const stadt = sortiert.filter(t => BUILDINGS[t].gebiet !== 'industrie');
  const industrie = sortiert.filter(t => BUILDINGS[t].gebiet === 'industrie');
  const bausaetze = Object.entries(state.shop.bausaetze) as [BuildingType, number][];

  const karte = (t: BuildingType) => {
    const def = BUILDINGS[t];
    const kosten = upgradeCost(t, 0);
    const ohneIndustrie = def.gebiet === 'industrie' && !state.land.industrie;
    const gesperrt = state.save.level < def.unlockLevel || ohneIndustrie;
    const kann = !gesperrt && canAfford(vorrat, kosten);
    const zeit = bauzeit(t, 1, state.personal.bauarbeiter);
    return (
      <div key={t} className={'karte' + (gesperrt ? ' gesperrt' : '')}>
        <div className="karte-icon">{def.icon}</div>
        <div className="karte-text">
          <b>{def.name}</b>
          <span>{def.description}</span>
          <span className="wirkung">{wirkung(t, 1).join(' · ')}</span>
          {!gesperrt && <span>{zeit > 0 ? `⏱️ Bauzeit ${dauer(zeit)}` : '⚡ sofort fertig'}</span>}
          {!gesperrt && <Kosten kosten={kosten} vorrat={vorrat} />}
        </div>
        {gesperrt
          ? <button className="knopf aus" disabled>🔒 {ohneIndustrie && state.save.level >= def.unlockLevel ? 'Industrie' : `Level ${def.unlockLevel}`}</button>
          : <button className={'knopf' + (kann ? '' : ' aus')} disabled={!kann} onClick={() => onWahl(t)}>Bauen</button>}
      </div>
    );
  };

  return (
    <Blatt titel="Bauen" untertitel="Wähle ein Gebäude und tippe dann auf einen freien Platz" icon="🏗️" onZu={onZu}>
      {bausaetze.length > 0 && (
        <>
          <h3 className="abschnitt">📦 Deine Bausätze (sofort fertig)</h3>
          {bausaetze.map(([t, n]) => (
            <div key={'k' + t} className="karte bausatz">
              <div className="karte-icon">{BUILDINGS[t].icon}</div>
              <div className="karte-text"><b>{n}× {BUILDINGS[t].name}</b><span>Aus dem PC-Shop – kostet nichts mehr</span></div>
              <button className="knopf" onClick={() => onBausatz(t)}>Aufstellen</button>
            </div>
          ))}
        </>
      )}
      <h3 className="abschnitt">🏘️ Stadt</h3>
      {stadt.map(karte)}
      <h3 className="abschnitt">🏭 Industrie {state.land.industrie ? '' : '(erst freischalten)'}</h3>
      {industrie.map(karte)}
    </Blatt>
  );
}
