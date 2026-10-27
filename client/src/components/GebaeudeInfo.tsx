import { useState } from 'react';
import { BUILDINGS, DEMOLISH_REFUND, canAfford, upgradeCost, type GameState, type PlacedBuilding, type Stock } from '@empire/shared';
import { mengenText, wirkung, zahl } from '../game/format';
import { Blatt } from './Blatt';
import { Kosten } from './Kosten';

// Infos zu einem Gebäude: was es macht, verbessern, abreissen
export function GebaeudeInfo({ b, state, vorrat, onVerbessern, onAbreissen, onZu }: {
  b: PlacedBuilding; state: GameState; vorrat: Stock;
  onVerbessern: () => void; onAbreissen: () => void; onZu: () => void;
}) {
  const [sicher, setSicher] = useState(false);
  const def = BUILDINGS[b.type];
  const max = b.level >= def.maxLevel;
  const kosten = upgradeCost(b.type, b.level);
  const kann = !max && canAfford(vorrat, kosten);
  const jetzt = wirkung(b.type, b.level), danach = wirkung(b.type, b.level + 1);
  const rueckgabe: Record<string, number> = {};
  for (const [r, v] of Object.entries(upgradeCost(b.type, 0))) rueckgabe[r] = Math.floor((v ?? 0) * DEMOLISH_REFUND);

  return (
    <Blatt titel={`${def.name}`} untertitel={`Level ${b.level} von ${def.maxLevel}`} icon={def.icon} onZu={onZu}>
      <p className="beschreibung">{def.description}</p>
      {b.type === 'townhall' && (
        <div className="werte">
          <div><small>Einwohner</small><b>👥 {state.stats.population}</b></div>
          <div><small>Steuern + Rathaus</small><b>🪙 +{zahl(state.stats.ratesPerMinute.gold)}/Min.</b></div>
        </div>
      )}
      <div className="werte">
        <div><small>Jetzt</small><b>{jetzt.join(' · ') || '–'}</b></div>
        <div><small>Nach Verbesserung</small><b className="gruen">{max ? 'Höchste Stufe ✓' : danach.join(' · ')}</b></div>
      </div>
      {!max && <div className="kosten-zeile">Kosten: <Kosten kosten={kosten} vorrat={vorrat} /></div>}
      <button className={'knopf gross' + (kann ? '' : ' aus')} disabled={!kann} onClick={onVerbessern}>
        {max ? 'Höchste Stufe erreicht' : `⬆ Verbessern auf Level ${b.level + 1}`}
      </button>
      {b.type !== 'townhall' && (
        sicher
          ? <button className="knopf gross rot" onClick={() => { setSicher(false); onAbreissen(); }}>Wirklich abreissen? Du bekommst {mengenText(rueckgabe)}</button>
          : <button className="knopf gross leise" onClick={() => setSicher(true)}>🗑️ Abreissen</button>
      )}
    </Blatt>
  );
}
