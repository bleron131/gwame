import { useState } from 'react';
import {
  RESOURCES, RESOURCE_IDS, handWert, maxEinsatz,
  type BlackjackSicht, type GameState, type Karte, type ResourceId, type Stock
} from '@empire/shared';
import type { BlackjackZug } from '../api/client';
import { zahl } from '../game/format';

// Eine Spielkarte. null = verdeckt (die Rückseite)
function Spielkarte({ karte, nr }: { karte: Karte | null; nr: number }) {
  const stil = { animationDelay: `${nr * 0.12}s` }; // Karten kommen nacheinander
  if (!karte) return <div className="spielkarte rueckseite" style={stil} />;
  const rot = karte.farbe === '♥' || karte.farbe === '♦';
  return (
    <div className={'spielkarte' + (rot ? ' rot' : '')} style={stil}>
      <span className="ecke">{karte.rang}<br />{karte.farbe}</span>
      <span className="mitte">{karte.farbe}</span>
    </div>
  );
}

function Hand({ titel, karten, wer }: { titel: string; karten: (Karte | null)[]; wer: 'bank' | 'du' }) {
  const sichtbar = karten.filter((k): k is Karte => k !== null);
  const wert = handWert(sichtbar).wert;
  const verdeckt = sichtbar.length < karten.length;
  return (
    <div className={'hand ' + wer}>
      <div className="hand-kopf">{titel} <b className={wert > 21 ? 'ueber' : ''}>{verdeckt ? `${wert} + ?` : wert}</b></div>
      <div className="karten">{karten.map((k, i) => <Spielkarte key={i} karte={k} nr={i} />)}</div>
    </div>
  );
}

// Was nach der Runde passiert ist, in einem Satz
function ergebnisText(bj: BlackjackSicht): { text: string; art: 'gut' | 'neutral' | 'schlecht' } {
  const icon = RESOURCES[bj.rohstoff].icon;
  const netto = bj.ausgezahlt - bj.einsatz;
  switch (bj.ergebnis) {
    case 'blackjack': return { text: `🃏 BLACKJACK! +${zahl(netto)} ${icon}`, art: 'gut' };
    case 'gewonnen': return { text: `🎉 Gewonnen! +${zahl(netto)} ${icon}`, art: 'gut' };
    case 'unentschieden': return { text: `🤝 Unentschieden – du bekommst ${zahl(bj.einsatz)} ${icon} zurück`, art: 'neutral' };
    default: return { text: `😬 Verloren: −${zahl(bj.einsatz)} ${icon}`, art: 'schlecht' };
  }
}

// Der Blackjack-Tisch in der Spielhalle
export function BlackjackTisch({ state, vorrat, onSetzen, onZug, onZu }: {
  state: GameState; vorrat: Stock;
  onSetzen: (rohstoff: ResourceId, menge: number) => Promise<unknown>;
  onZug: (zug: BlackjackZug) => Promise<unknown>;
  onZu: () => void;
}) {
  const bj = state.blackjack;
  const [rohstoff, setRohstoff] = useState<ResourceId>(bj?.rohstoff ?? 'gold');
  const [menge, setMenge] = useState(bj && !bj.laeuft ? bj.einsatz : 10);
  const [warte, setWarte] = useState(false); // eine Anfrage läuft gerade (gegen Doppelklicks)

  const hallenLevel = Math.max(1, ...state.buildings.filter(b => b.type === 'casino').map(b => b.level));
  const max = Math.max(0, Math.min(maxEinsatz(rohstoff, hallenLevel), Math.floor(vorrat[rohstoff])));
  const einsatz = Math.max(1, Math.min(menge, max));
  const kannSetzen = max >= 1 && !warte;
  // Womit kann man spielen? Gold immer, Rohstoffe nur, wenn man welche hat
  const auswahl = RESOURCE_IDS.filter(r => r === 'gold' || vorrat[r] >= 1);

  const mit = (f: () => Promise<unknown>) => async () => { setWarte(true); try { await f(); } finally { setWarte(false); } };
  const laeuft = !!bj?.laeuft;
  const kannVerdoppeln = laeuft && bj!.spieler.length === 2 && vorrat[bj!.rohstoff] + 1e-9 >= bj!.einsatz;
  const ende = bj && !bj.laeuft && bj.ergebnis ? ergebnisText(bj) : null;

  return (
    <div className="fenster-hinter">
      <div className="tisch">
        <button className="zu" onClick={onZu} aria-label="Schliessen">✕</button>
        <h2>🃏 Blackjack</h2>
        <p className="regeln">Komm näher an 21 als die Bank. Die Bank zieht bis 16 und bleibt ab 17 · Blackjack zahlt 3:2</p>

        {bj ? <Hand titel="Bank" wer="bank" karten={bj.bank} /> : <div className="hand leer">Setz deinen Einsatz – dann geht es los!</div>}
        {ende && <div className={'ergebnis ' + ende.art}>{ende.text}</div>}
        {laeuft && <div className="ergebnis neutral">Einsatz: {zahl(bj!.einsatz)} {RESOURCES[bj!.rohstoff].icon}{bj!.verdoppelt ? ' (verdoppelt)' : ''}</div>}
        {bj && <Hand titel="Du" wer="du" karten={bj.spieler} />}

        {laeuft ? (
          <div className="zuege">
            <button className="knopf" disabled={warte} onClick={mit(() => onZug('ziehen'))}>➕ Ziehen</button>
            <button className="knopf blau" disabled={warte} onClick={mit(() => onZug('halten'))}>✋ Halten</button>
            <button className={'knopf gelb' + (kannVerdoppeln ? '' : ' aus')} disabled={warte || !kannVerdoppeln} onClick={mit(() => onZug('verdoppeln'))}>×2 Verdoppeln</button>
          </div>
        ) : (
          <div className="einsatz">
            <div className="einsatz-wahl">
              {auswahl.map(r => (
                <button key={r} className={'chip-knopf' + (r === rohstoff ? ' an' : '')} onClick={() => setRohstoff(r)}>
                  {RESOURCES[r].icon} {zahl(vorrat[r])}
                </button>
              ))}
            </div>
            <div className="einsatz-menge">
              <button className="rund-klein" onClick={() => setMenge(Math.max(1, einsatz - (einsatz > 20 ? 10 : 1)))}>−</button>
              <b>{zahl(einsatz)} {RESOURCES[rohstoff].icon}</b>
              <button className="rund-klein" onClick={() => setMenge(Math.min(max, einsatz + (einsatz >= 20 ? 10 : 1)))}>+</button>
            </div>
            <div className="einsatz-schnell">
              <button onClick={() => setMenge(10)}>10</button>
              <button onClick={() => setMenge(Math.floor(max / 4))}>¼</button>
              <button onClick={() => setMenge(Math.floor(max / 2))}>½</button>
              <button onClick={() => setMenge(max)}>Max ({zahl(max)})</button>
            </div>
            <button className={'knopf gross' + (kannSetzen ? '' : ' aus')} disabled={!kannSetzen}
              onClick={mit(() => onSetzen(rohstoff, einsatz))}>
              {max < 1 ? `Du hast kein ${RESOURCES[rohstoff].name}` : `🂠 Karten geben – Einsatz ${zahl(einsatz)} ${RESOURCES[rohstoff].icon}`}
            </button>
            <p className="regeln">Höchsteinsatz in deiner Spielhalle (Level {hallenLevel}): {zahl(maxEinsatz(rohstoff, hallenLevel))} {RESOURCES[rohstoff].icon}.
              {rohstoff !== 'gold' && ' Rohstoff-Gewinne passen nur bis zur Lagergrenze.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
