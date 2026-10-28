import { useEffect, useState } from 'react';
import {
  ABBAU_RUECKGABE, HUETE, JACKEN_FARBEN, MOEBEL, MOEBEL_IDS, QUESTS, RANGLISTE_MITSPIELER, RESOURCES, RESOURCE_IDS, canAfford, zielText,
  type BlackjackStatistik, type GameState, type Hut, type MoebelId, type Outfit, type Stock
} from '@empire/shared';
import { mengenText, zahl } from '../game/format';
import { Blatt, Fenster } from './Blatt';
import { Kosten } from './Kosten';

// ===== Einrichten: ein Möbelstück für einen Stellplatz wählen =====
export function EinrichtenBlatt({ platz, belegt, vorrat, onStellen, onWegraeumen, onZu }: {
  platz: number; belegt: MoebelId | undefined; vorrat: Stock;
  onStellen: (m: MoebelId) => void; onWegraeumen: () => void; onZu: () => void;
}) {
  if (belegt) {
    const def = MOEBEL[belegt];
    const zurueck: Record<string, number> = {};
    for (const [r, v] of Object.entries(def.kosten)) zurueck[r] = Math.floor((v ?? 0) * ABBAU_RUECKGABE);
    return (
      <Blatt titel={def.name} untertitel={`Stellplatz ${platz + 1} · Gemütlichkeit +${def.gemuetlichkeit}`} icon={def.icon} onZu={onZu}>
        <p className="beschreibung">Hier steht schon etwas. Willst du es wegräumen? Du bekommst die Hälfte zurück: {mengenText(zurueck)}</p>
        <button className="knopf gross rot" onClick={onWegraeumen}>🗑️ Wegräumen</button>
      </Blatt>
    );
  }
  return (
    <Blatt titel="Einrichten" untertitel={`Stellplatz ${platz + 1} – was soll hier stehen?`} icon="🛋️" onZu={onZu}>
      {MOEBEL_IDS.map(id => {
        const def = MOEBEL[id];
        const kann = canAfford(vorrat, def.kosten);
        const wozu = def.aktion === 'essen' ? 'Hier kannst du essen' : def.aktion === 'lesen' ? 'Hier kannst du lesen (+⭐)'
          : def.aktion === 'umziehen' ? 'Hier kannst du dich umziehen' : def.aktion === 'fernsehen' ? 'Stadt-Nachrichten schauen'
          : def.aktion === 'pc' ? 'Den PC von zu Hause benutzen' : def.aktion === 'sitzen' ? 'Zum Hinsetzen' : 'Deko';
        return (
          <div key={id} className="karte">
            <div className="karte-icon">{def.icon}</div>
            <div className="karte-text">
              <b>{def.name}</b>
              <span>{wozu}</span>
              <span className="wirkung">🛋️ Gemütlichkeit +{def.gemuetlichkeit}</span>
              <Kosten kosten={def.kosten} vorrat={vorrat} />
            </div>
            <button className={'knopf' + (kann ? '' : ' aus')} disabled={!kann} onClick={() => onStellen(id)}>Hinstellen</button>
          </div>
        );
      })}
    </Blatt>
  );
}

// ===== Fernseher: Nachrichten aus deiner Stadt =====
export function Fernseher({ state, onZu }: { state: GameState; onZu: () => void }) {
  const q = QUESTS[state.aufgabe.nummer];
  const bilanz = state.blackjack.statistik.bilanz.gold ?? 0;
  const meldungen = [
    `📰 ${state.save.cityName} wächst: Schon ${state.stats.population} Menschen wohnen hier!`,
    `🪙 Die Stadtkasse nimmt ${zahl(state.stats.ratesPerMinute.gold)} Gold pro Minute ein.`,
    `🏗️ ${state.buildings.filter(b => b.type !== 'road').length} Gebäude und ${state.buildings.filter(b => b.type === 'road').length} Strassenstücke – die Bauarbeiter sind fleissig.`,
    bilanz >= 0 ? `🃏 Glückspilz! Der Bürgermeister liegt beim Blackjack mit ${zahl(bilanz)} Gold vorne.` : `🃏 Pech im Spiel: Der Bürgermeister hat beim Blackjack ${zahl(-bilanz)} Gold verloren.`,
    state.land.industrie ? '🏭 Die Industrie brummt: Rauch steigt aus den Schloten.' : '🏭 Wann kommt endlich die Industrie? Die Bürger warten gespannt.',
    q ? `📜 Greta sagt: „${zielText(q.ziel)}“ wäre jetzt wichtig.` : '📜 Greta ist stolz: Alle Aufgaben sind erledigt!',
    `🌤️ Wetter: ${new Date().getHours() < 18 ? 'sonnig und mild' : 'sternenklare Nacht'} – perfekt zum Bauen.`
  ];
  const [nr, setNr] = useState(0);
  useEffect(() => { const t = setInterval(() => setNr(n => (n + 1) % meldungen.length), 3500); return () => clearInterval(t); }, [meldungen.length]);
  return (
    <Fenster>
      <div className="tv">
        <div className="tv-bild">
          <div className="tv-logo">EMPIRE NEWS</div>
          <p key={nr} className="tv-text">{meldungen[nr]}</p>
          <div className="tv-ticker">+++ {meldungen.join(' +++ ')} +++</div>
        </div>
      </div>
      <button className="knopf gross" onClick={onZu}>Ausschalten</button>
    </Fenster>
  );
}

// ===== Kleiderschrank =====
const HUT_ICON: Record<Hut, string> = { zylinder: '🎩', kappe: '🧢', tuch: '🧣', keiner: '🚫' };
export function Kleiderschrank({ outfit, onSpeichern, onZu }: { outfit: Outfit; onSpeichern: (o: Outfit) => void; onZu: () => void }) {
  const [o, setO] = useState(outfit);
  return (
    <Fenster>
      <h2>👔 Kleiderschrank</h2>
      <div className="vorschau-figur">
        <div className="vf-hut" style={{ background: o.hut === 'keiner' ? 'transparent' : o.hutFarbe }} data-hut={o.hut} />
        <div className="vf-kopf" />
        <div className="vf-jacke" style={{ background: o.jacke }}><i /></div>
      </div>
      <p>Jacke</p>
      <div className="farben">{JACKEN_FARBEN.map(f => <button key={f} className={o.jacke === f ? 'an' : ''} style={{ background: f }} onClick={() => setO({ ...o, jacke: f })} aria-label={f} />)}</div>
      <p>Hut</p>
      <div className="hut-wahl">{HUETE.map(h => <button key={h} className={o.hut === h ? 'an' : ''} onClick={() => setO({ ...o, hut: h })}>{HUT_ICON[h]}</button>)}</div>
      {o.hut !== 'keiner' && (
        <>
          <p>Hutfarbe</p>
          <div className="farben">{JACKEN_FARBEN.map(f => <button key={f} className={o.hutFarbe === f ? 'an' : ''} style={{ background: f }} onClick={() => setO({ ...o, hutFarbe: f })} aria-label={f} />)}</div>
        </>
      )}
      <button className="knopf gross" onClick={() => onSpeichern(o)}>✓ Anziehen</button>
      <button className="knopf gross leise" onClick={onZu}>Abbrechen</button>
    </Fenster>
  );
}

// ===== Vorräte im Lagerhaus =====
export function Vorraete({ state, vorrat, onZu }: { state: GameState; vorrat: Stock; onZu: () => void }) {
  return (
    <Blatt titel="Vorräte" untertitel="Alles, was in deinen Lagern liegt" icon="📦" onZu={onZu}>
      {RESOURCE_IDS.filter(r => r === 'gold' || vorrat[r] >= 1 || state.stats.ratesPerMinute[r] !== 0).map(r => {
        const cap = state.stats.capacity[r];
        const rate = state.stats.ratesPerMinute[r];
        return (
          <div key={r} className="vorrat-zeile">
            <span className="vz-icon">{RESOURCES[r].icon}</span>
            <div>
              <b>{RESOURCES[r].name}: {zahl(vorrat[r])}{cap !== null ? ` / ${zahl(cap)}` : ''}</b>
              {cap !== null && <div className="balken"><i style={{ width: Math.min(100, (vorrat[r] / cap) * 100) + '%' }} /></div>}
              <small className={rate < 0 ? 'minus' : ''}>{rate < 0 ? '−' : '+'}{zahl(Math.abs(rate))} pro Minute</small>
            </div>
          </div>
        );
      })}
    </Blatt>
  );
}

// ===== Rangliste am Blackjack-Tisch =====
export function Rangliste({ statistik, stadtname, onZu }: { statistik: BlackjackStatistik; stadtname: string; onZu: () => void }) {
  const du = { name: `Du (${stadtname})`, icon: '🎩', bilanz: statistik.bilanz.gold ?? 0, ich: true };
  const liste = [...RANGLISTE_MITSPIELER.map(m => ({ ...m, ich: false })), du].sort((a, b) => b.bilanz - a.bilanz);
  const platz = liste.indexOf(du) + 1;
  const vor = liste[platz - 2];
  return (
    <Blatt titel="Rangliste" untertitel={`Du bist auf Platz ${platz} von ${liste.length}`} icon="🏆" onZu={onZu}>
      <p className="beschreibung">Wer hat beim Blackjack am meisten Gold gewonnen? Die anderen Spieler sind Leute aus der Gegend.
        {vor ? ` Noch ${zahl(vor.bilanz - du.bilanz + 1)} Gold, dann überholst du ${vor.name}!` : ' Du bist die Nummer 1! 👑'}</p>
      <div className="rangliste">
        {liste.map((e, i) => (
          <div key={e.name} className={'rang' + (e.ich ? ' ich' : '')}>
            <span className="rang-nr">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
            <span>{e.icon} {e.name}</span>
            <b className={e.bilanz < 0 ? 'minus' : ''}>{e.bilanz < 0 ? '−' : '+'}{zahl(Math.abs(e.bilanz))} 🪙</b>
          </div>
        ))}
      </div>
      <h3 className="abschnitt">⭐ Deine grössten Gewinne</h3>
      {statistik.besteGewinne.length === 0 && <p className="beschreibung">Noch keine Gewinne – ab an den Tisch!</p>}
      {statistik.besteGewinne.map((g, i) => (
        <div key={i} className="rang">
          <span className="rang-nr">{i + 1}.</span>
          <span>{new Date(g.am).toLocaleDateString('de-CH')} {new Date(g.am).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</span>
          <b>+{zahl(g.menge)} {RESOURCES[g.rohstoff].icon}</b>
        </div>
      ))}
    </Blatt>
  );
}
