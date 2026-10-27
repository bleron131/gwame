import { useState } from 'react';
import { RESOURCES, RESOURCE_IDS, xpForLevel, type GameState, type Stock } from '@empire/shared';
import { KAMERA_MODI, kamera, kameraModusSetzen } from '../game/input';
import { zahl } from '../game/format';

// Obere Leiste: Rohstoffe, Einwohner, Level
export function Leiste({ state, vorrat, onEinstellungen }: { state: GameState; vorrat: Stock; onEinstellungen: () => void }) {
  const [modus, setModus] = useState(kamera.modus);
  const aktuell = KAMERA_MODI.find(m => m.id === modus)!;
  // Kamera-Knopf: wechselt zwischen Von oben -> Third Person -> Ego
  const wechseln = () => {
    const naechster = KAMERA_MODI[(KAMERA_MODI.indexOf(aktuell) + 1) % KAMERA_MODI.length];
    kameraModusSetzen(naechster.id);
    setModus(naechster.id);
  };
  const { level, experience } = state.save;
  const von = xpForLevel(level), bis = xpForLevel(level + 1);
  const fortschritt = Math.min(100, ((experience - von) / (bis - von)) * 100);
  return (
    <div className="leiste">
      <div className="rohstoffe">
        {RESOURCE_IDS.map(r => {
          const cap = state.stats.capacity[r];
          const voll = cap !== null && vorrat[r] >= cap;
          return (
            <div key={r} className={'chip' + (voll ? ' voll' : '')} title={RESOURCES[r].name}>
              <span className="icon">{RESOURCES[r].icon}</span>
              <span className="wert">
                <b>{zahl(vorrat[r])}</b>{cap !== null && <small>/{zahl(cap)}</small>}
                <em>+{zahl(state.stats.ratesPerMinute[r])}/Min.</em>
              </span>
            </div>
          );
        })}
        <div className="chip" title="Einwohner"><span className="icon">👥</span><span className="wert"><b>{state.stats.population}</b><em>Einwohner</em></span></div>
      </div>
      <div className="rechts">
        <div className="level" title={`${experience} / ${bis} Erfahrung`}>
          <div className="stadtname">{state.save.cityName}</div>
          <div className="lvl"><b>⭐ {level}</b><div className="xp"><i style={{ width: fortschritt + '%' }} /></div></div>
        </div>
        <button className="rund-klein" onClick={wechseln} aria-label={'Kamera: ' + aktuell.name} title={'Kamera: ' + aktuell.name}>{aktuell.icon}</button>
        <button className="rund-klein" onClick={onEinstellungen} aria-label="Einstellungen">⚙️</button>
      </div>
    </div>
  );
}
