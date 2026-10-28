import {
  INDUSTRIE, LAND_AB_LEVEL, START_PARZELLEN, TOWNHALL_POS, PARZELLE, canAfford, gebietVon, industrieFehlt, landPreis,
  type GameState, type Parzelle, type Stock
} from '@empire/shared';
import { Blatt } from './Blatt';
import { Kosten } from './Kosten';

// Wie viele Parzellen hast du schon dazugekauft?
export const gekauftAnzahl = (state: GameState) =>
  state.land.parzellen.filter(p => gebietVon(p.px, p.py) === 'stadt').length - START_PARZELLEN.length;

// "im Norden", "im Südosten" … (vom Rathaus aus gesehen)
export function richtung(p: Parzelle): string {
  const mx = (p.px + 0.5) * PARZELLE - TOWNHALL_POS.x, my = (p.py + 0.5) * PARZELLE - TOWNHALL_POS.y;
  const ns = my < -4 ? 'Nord' : my > 4 ? 'Süd' : '';
  const ow = mx < -4 ? 'west' : mx > 4 ? 'ost' : '';
  const name = ns ? ns + ow : ow ? ow[0].toUpperCase() + ow.slice(1) : 'Mitte';
  return `im ${name.replace('Nordost', 'Nordosten').replace('Nordwest', 'Nordwesten').replace('Südost', 'Südosten').replace('Südwest', 'Südwesten')
    .replace(/^Nord$/, 'Norden').replace(/^Süd$/, 'Süden').replace(/^Ost$/, 'Osten').replace(/^West$/, 'Westen')}`;
}

// Land kaufen (nach Antippen eines Schildes)
export function LandBlatt({ p, state, vorrat, onKaufen, onZu }: {
  p: Parzelle; state: GameState; vorrat: Stock; onKaufen: () => void; onZu: () => void;
}) {
  const preis = landPreis(gekauftAnzahl(state));
  const gesperrt = state.save.level < LAND_AB_LEVEL;
  const kann = !gesperrt && canAfford(vorrat, preis);
  return (
    <Blatt titel="Land kaufen" untertitel={`Ein Stück Land ${richtung(p)} – 8 × 8 Felder`} icon="🗺️" onZu={onZu}>
      <p className="beschreibung">Mehr Platz für Häuser, Felder und Betriebe! Auf neuem Land wachsen schon Bäume und liegen Felsen.
        Jedes weitere Stück Land wird etwas teurer.</p>
      <div className="kosten-zeile">Preis: <Kosten kosten={preis} vorrat={vorrat} /></div>
      <button className={'knopf gross' + (kann ? '' : ' aus')} disabled={!kann} onClick={onKaufen}>
        {gesperrt ? `🔒 Land kaufen ab Level ${LAND_AB_LEVEL}` : '🗺️ Kaufen'}
      </button>
    </Blatt>
  );
}

// Das Industrie-Gebiet: was fehlt noch?
export function IndustrieBlatt({ state, vorrat, onFreischalten, onZu }: {
  state: GameState; vorrat: Stock; onFreischalten: () => void; onZu: () => void;
}) {
  const fehlt = industrieFehlt(state.save.level, state.stats.population, state.buildings.map(b => b.type));
  const bedingungen = [
    { text: `Level ${INDUSTRIE.level}`, ok: state.save.level >= INDUSTRIE.level },
    { text: `${INDUSTRIE.einwohner} Einwohner (jetzt ${state.stats.population})`, ok: state.stats.population >= INDUSTRIE.einwohner },
    { text: '🪚 Sägewerk gebaut', ok: state.buildings.some(b => b.type === 'sawmill') },
    { text: '🥖 Bäckerei gebaut', ok: state.buildings.some(b => b.type === 'bakery') }
  ];
  const kann = fehlt.length === 0 && canAfford(vorrat, INDUSTRIE.preis);
  return (
    <Blatt titel="Industrie-Gebiet" untertitel={state.land.industrie ? 'Freigeschaltet ✓' : 'Rechts neben deiner Stadt – noch gesperrt'} icon="🏭" onZu={onZu}>
      <p className="beschreibung">Im Industrie-Gebiet baust du Erzminen, Stahlwerke und Maschinenfabriken – und gründest eigene Firmen,
        die dir viel Gold bringen. Maschinen brauchst du auch für Wohnblöcke.</p>
      {!state.land.industrie && (
        <>
          <div className="checkliste">
            {bedingungen.map(b => <div key={b.text} className={b.ok ? 'ok' : ''}>{b.ok ? '✅' : '⬜'} {b.text}</div>)}
          </div>
          <div className="kosten-zeile">Preis: <Kosten kosten={INDUSTRIE.preis} vorrat={vorrat} /></div>
          <button className={'knopf gross' + (kann ? '' : ' aus')} disabled={!kann} onClick={onFreischalten}>
            {fehlt.length ? '🔒 Noch nicht weit genug' : '🏭 Industrie freischalten'}
          </button>
        </>
      )}
    </Blatt>
  );
}
