import { useState } from 'react';
import {
  ARBEITER_BONUS, BUILDINGS, DEMOLISH_REFUND, RESOURCES, RESOURCE_IDS, arbeiterPreis, ausbaustufe, canAfford, hatInnenraum, maxEinsatz, upgradeCost,
  type GameState, type PlacedBuilding, type Stock
} from '@empire/shared';
import { dauer, mengenText, wirkung, zahl } from '../game/format';
import { Blatt } from './Blatt';
import { Kosten } from './Kosten';

// Infos zu einem Gebäude: was es macht, verbessern, abreissen
export function GebaeudeInfo({ b, state, vorrat, jetzt: uhr, onVerbessern, onAbreissen, onSpielen, onArbeiter, onPc, onEintreten, onZu }: {
  b: PlacedBuilding; state: GameState; vorrat: Stock; jetzt: number;
  onVerbessern: () => void; onAbreissen: () => void; onSpielen: () => void;
  onArbeiter: (mehr: boolean) => void; onPc: () => void; onEintreten: () => void; onZu: () => void;
}) {
  const [sicher, setSicher] = useState(false);
  const def = BUILDINGS[b.type];
  const stufe = ausbaustufe(b.type, b.level);
  const naechste = ausbaustufe(b.type, b.level + 1);
  const baut = (b.bauEnde ?? 0) > uhr;
  const rest = Math.max(0, ((b.bauEnde ?? 0) - uhr) / 1000);
  const max = b.level >= def.maxLevel;
  const kosten = upgradeCost(b.type, b.level);
  const kann = !max && !baut && canAfford(vorrat, kosten);
  const plaetze = def.arbeitsplaetze ?? 0;
  const arbeiter = b.arbeiter ?? 0;
  const frei = state.stats.population - state.stats.angestellte;
  const jetzt = wirkung(b.type, b.level), danach = wirkung(b.type, b.level + 1);
  const rueckgabe: Record<string, number> = {};
  for (const [r, v] of Object.entries(upgradeCost(b.type, 0))) rueckgabe[r] = Math.floor((v ?? 0) * DEMOLISH_REFUND);

  // Läuft das Gebäude? (fehlen Zutaten, ist das Lager voll, hängt es an der Strasse?)
  const verbunden = state.stats.verbunden.includes(b.id);
  // Zutat fehlt nur, wenn das Lager leer ist UND mehr verbraucht als hergestellt wird
  // (ist das Lager leer, aber die Kette liefert genug nach, läuft alles)
  const fehlt = RESOURCE_IDS.filter(r => (def.consumes?.[r] ?? 0) > 0 && vorrat[r] < 1 && state.stats.ratesPerMinute[r] < -1e-9);
  const voll = RESOURCE_IDS.filter(r => (def.production?.[r] ?? 0) > 0 && state.stats.capacity[r] !== null && vorrat[r] >= state.stats.capacity[r]!);
  const zeigeStrasse = b.type !== 'townhall' && b.type !== 'road' && (def.production || def.population);

  return (
    <Blatt titel={stufe.name} untertitel={def.maxLevel > 1 ? `Level ${b.level} von ${def.maxLevel}` : undefined} icon={stufe.icon} onZu={onZu}>
      <p className="beschreibung">{def.description}</p>
      {baut && (
        <div className="status bau">🏗️ {b.level > 1 ? `Wird auf Level ${b.level} verbessert` : 'Wird gebaut'} – noch {dauer(rest)}.
          Lauf hin und tippe auf 🔨, um mitzuhelfen!</div>
      )}
      {hatInnenraum(b.type) && !baut && (
        <button className="knopf gross" onClick={onEintreten}>🚪 Hineingehen{b.type === 'house' ? ' – einrichten, ausruhen …' : ''}</button>
      )}
      {b.type === 'townhall' && (
        <button className="knopf gross blau" onClick={onPc}>💻 PC öffnen – Shop, Lieferungen, Personal, Land</button>
      )}
      {b.type === 'casino' && (
        <>
          <button className="knopf gross gelb" onClick={onSpielen}>🃏 An den Blackjack-Tisch{state.blackjack.runde?.laeuft ? ' (Runde läuft)' : ''}</button>
          <div className="werte">
            <div><small>Höchsteinsatz Gold</small><b>🪙 {zahl(maxEinsatz('gold', b.level))}</b></div>
            <div><small>Höchsteinsatz Rohstoffe</small><b>{zahl(maxEinsatz('wood', b.level))} je Sorte</b></div>
          </div>
        </>
      )}
      {b.type === 'townhall' && (
        <div className="werte">
          <div><small>Einwohner</small><b>👥 {state.stats.population}</b></div>
          <div><small>Steuern + Rathaus</small><b>🪙 +{zahl(state.stats.ratesPerMinute.gold)}/Min.</b></div>
        </div>
      )}
      {fehlt.length > 0 && (
        <div className="status schlecht">⚠️ Es fehlt: {fehlt.map(r => `${RESOURCES[r].icon} ${RESOURCES[r].name}`).join(', ')} – das Gebäude wartet.</div>
      )}
      {voll.length > 0 && <div className="status schlecht">📦 Das Lager ist voll – das Gebäude macht Pause.</div>}
      {zeigeStrasse && (
        verbunden
          ? <div className="status gut">🛣️ Mit dem Rathaus verbunden: +50 % Leistung</div>
          : <div className="status">🛣️ Nicht verbunden. Bau eine Strasse vom Rathaus bis hierher: +50 %!</div>
      )}
      {plaetze > 0 && (
        <div className="arbeiter-box">
          <div>
            <b>🧑‍🌾 Arbeiter: {arbeiter} / {plaetze}</b>
            <small>Jeder Arbeiter: +{ARBEITER_BONUS * 100} % · Lohn 1 🪙/Min. · {frei} Einwohner frei</small>
            {arbeiter < plaetze && <Kosten kosten={arbeiterPreis(arbeiter)} vorrat={vorrat} />}
          </div>
          <div className="knopf-spalte">
            <button className={'knopf' + (arbeiter < plaetze && frei > 0 && canAfford(vorrat, arbeiterPreis(arbeiter)) ? '' : ' aus')}
              disabled={arbeiter >= plaetze} onClick={() => onArbeiter(true)}>+ Anstellen</button>
            {arbeiter > 0 && <button className="knopf leise" onClick={() => onArbeiter(false)}>Entlassen</button>}
          </div>
        </div>
      )}
      {!max && naechste.name !== stufe.name && (
        <div className="status gut">✨ Mit Level {b.level + 1} wird daraus ein {naechste.icon} {naechste.name}!</div>
      )}
      {b.type === 'road' && (
        <div className="werte">
          <div><small>Verbundene Gebäude</small><b>🏠 {state.stats.verbunden.length - 1}</b></div>
          <div><small>Strassenstücke</small><b>🛣️ {state.buildings.filter(x => x.type === 'road').length}</b></div>
        </div>
      )}
      {def.maxLevel > 1 && <div className="werte">
        <div><small>Jetzt</small><b>{jetzt.join(' · ') || '–'}</b></div>
        <div><small>Nach Verbesserung</small><b className="gruen">{max ? 'Höchste Stufe ✓' : danach.join(' · ')}</b></div>
      </div>}
      {!max && <div className="kosten-zeile">Kosten: <Kosten kosten={kosten} vorrat={vorrat} /></div>}
      {def.maxLevel > 1 && (
        <button className={'knopf gross' + (kann ? '' : ' aus')} disabled={!kann} onClick={onVerbessern}>
          {max ? 'Höchste Stufe erreicht' : baut ? '🏗️ Wird noch gebaut …' : `⬆ Verbessern auf Level ${b.level + 1}`}
        </button>
      )}
      {b.type !== 'townhall' && (
        sicher
          ? <button className="knopf gross rot" onClick={() => { setSicher(false); onAbreissen(); }}>Wirklich abreissen? Du bekommst {mengenText(rueckgabe)}</button>
          : <button className="knopf gross leise" onClick={() => setSicher(true)}>🗑️ Abreissen</button>
      )}
    </Blatt>
  );
}
