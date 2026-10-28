import { useState } from 'react';
import { BUILDINGS, RESOURCES, RESOURCE_IDS, xpForLevel, type GameState, type ResourceId, type Stock } from '@empire/shared';
import { KAMERA_MODI, kamera, kameraModusSetzen } from '../game/input';
import { zahl } from '../game/format';
import { tageszeit, uhrText } from '../game/tageszeit';

// Obere Leiste: Rohstoffe, Einwohner, Level
export function Leiste({ state, vorrat, jetzt, onEinstellungen }: { state: GameState; vorrat: Stock; jetzt: number; onEinstellungen: () => void }) {
  const [modus, setModus] = useState(kamera.modus);
  const [tipp, setTipp] = useState(0); // wann der Steuerungs-Tipp gezeigt wurde
  const aktuell = KAMERA_MODI.find(m => m.id === modus)!;
  // Kamera-Knopf: wechselt zwischen Von oben -> Third Person -> Ego (und zeigt kurz, wie man steuert)
  const wechseln = () => {
    const naechster = KAMERA_MODI[(KAMERA_MODI.indexOf(aktuell) + 1) % KAMERA_MODI.length];
    kameraModusSetzen(naechster.id);
    setModus(naechster.id);
    setTipp(Date.now());
  };
  const handy = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const { level, experience } = state.save;
  const von = xpForLevel(level), bis = xpForLevel(level + 1);
  const fortschritt = Math.min(100, ((experience - von) / (bis - von)) * 100);
  // Nur Rohstoffe zeigen, die man schon hat oder herstellt – sonst wird die Leiste zu voll
  const stellHer = new Set(state.buildings.flatMap(b => Object.keys(BUILDINGS[b.type].production ?? {})));
  const sichtbar = RESOURCE_IDS.filter((r: ResourceId) => r === 'gold' || r === 'wood' || r === 'stone' || vorrat[r] >= 1 || stellHer.has(r));
  return (
    <div className="leiste">
      <div className="rohstoffe">
        {sichtbar.map(r => {
          const cap = state.stats.capacity[r];
          const voll = cap !== null && vorrat[r] >= cap;
          return (
            <div key={r} className={'chip' + (voll ? ' voll' : '')} title={RESOURCES[r].name}>
              <span className="icon">{RESOURCES[r].icon}</span>
              <span className="wert">
                <b>{zahl(vorrat[r])}</b>{cap !== null && <small>/{zahl(cap)}</small>}
                <em className={state.stats.ratesPerMinute[r] < 0 ? 'minus' : ''}>
                  {state.stats.ratesPerMinute[r] < 0 ? '−' : '+'}{zahl(Math.abs(state.stats.ratesPerMinute[r]))}/Min.
                </em>
              </span>
            </div>
          );
        })}
        {/* Ausgeruht / satt: wie lange noch? */}
        {state.buergermeister.ausgeruhtBis > jetzt && <div className="buff" title="Ausgeruht: doppelter Ertrag">😴 {uhrzeit(state.buergermeister.ausgeruhtBis - jetzt)}</div>}
        {state.buergermeister.sattBis > jetzt && <div className="buff" title="Satt: schneller laufen">🍽️ {uhrzeit(state.buergermeister.sattBis - jetzt)}</div>}
        <div className="chip" title="Einwohner"><span className="icon">👥</span><span className="wert"><b>{state.stats.population}</b><em>Einwohner</em></span></div>
      </div>
      <div className="rechts">
        <div className="level" title={`${experience} / ${bis} Erfahrung`}>
          <div className="stadtname">{state.save.cityName}</div>
          <div className="lvl"><b>⭐ {level}</b><div className="xp"><i style={{ width: fortschritt + '%' }} /></div></div>
        </div>
        <div className="uhr" title="Tageszeit – nachts leuchten die Fenster">{tageszeit().hell > 0.5 ? '☀️' : '🌙'} {uhrText(tageszeit().stunde)}</div>
        <button className="rund-klein" onClick={wechseln} aria-label={'Kamera: ' + aktuell.name} title={'Kamera: ' + aktuell.name}>{aktuell.icon}</button>
        <button className="rund-klein" onClick={onEinstellungen} aria-label="Einstellungen">⚙️</button>
      </div>
      {Date.now() - tipp < 6000 && (
        <div className="kamera-tipp">
          <b>{aktuell.icon} {aktuell.name}</b><br />
          {modus === 'oben'
            ? (handy ? '☝️ Ziehen = laufen · ✌️ zwei Finger = zoomen' : '⌨️ WASD = laufen · 🖱️ rechte Maustaste ziehen = Kamera drehen · Mausrad = zoomen')
            : (handy ? '👈 Linke Hälfte = laufen · 👉 rechte Hälfte ziehen = umsehen'
              : '⌨️ W/S = vor/zurück · A/D = seitwärts · 🖱️ Maus ziehen = umsehen · Doppelklick = Maus fangen (Esc = loslassen)')}
        </div>
      )}
    </div>
  );
}

// 125000 ms -> "2:05"
function uhrzeit(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
