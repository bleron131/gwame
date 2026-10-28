import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { TOWNHALL_POS, seededRandom, type PlacedBuilding } from '@empire/shared';
import { feldZuWelt } from '../game/coords';
import { jetztSek, serverJetzt } from '../game/effects';
import { Figur, type Aussehen, type Bewegung } from './Figur';
import { FIGUR_MASS } from './Spieler';

// Angestellte Einwohner: Arbeiter stehen an ihrem Gebäude und arbeiten,
// Bauarbeiter (gelber Helm) hämmern auf den Baustellen.

const ARBEITS_JACKEN = ['#2c6fbb', '#3d8b40', '#8e5b34', '#5d6d7e'];
const ECKEN: [number, number, number][] = [[0.95, 0.75, -2.4], [-0.95, 0.8, 2.4], [0.2, 1.05, 3.1]]; // x, z, Blickrichtung

function Werker({ pos, blick, aussehen, takt, versatz }: { pos: [number, number, number]; blick: number; aussehen: Aussehen; takt: number; versatz: number }) {
  const bewegung = useRef<Bewegung>({ laeuft: false, tempo: 0, schlagAt: -9, werkzeug: true });
  useFrame(() => {
    // Alle "takt" Sekunden ein Schlag mit dem Werkzeug
    const t = jetztSek() + versatz;
    const letzter = Math.floor(t / takt) * takt;
    bewegung.current.schlagAt = letzter - versatz;
  });
  return (
    <group position={pos} rotation={[0, blick, 0]}>
      <Figur aussehen={aussehen} bewegung={bewegung} skala={FIGUR_MASS * 0.95} />
    </group>
  );
}

export function Personal({ gebaeude, bauarbeiter }: { gebaeude: PlacedBuilding[]; bauarbeiter: number }) {
  const jetzt = serverJetzt();
  // Arbeiter: bis zu 3 pro Gebäude, an den Ecken verteilt
  const arbeiter = gebaeude.flatMap(b => Array.from({ length: Math.min(3, b.arbeiter ?? 0) }, (_, k) => {
    const [wx, , wz] = feldZuWelt(b.x, b.y);
    const [dx, dz, blick] = ECKEN[k];
    const r = seededRandom(b.id * 31 + k);
    const aussehen: Aussehen = { jacke: ARBEITS_JACKEN[Math.floor(r() * 4)], hose: '#34495e', haut: ['#f1c27d', '#e0ac69', '#8d5524', '#c68642'][Math.floor(r() * 4)], hut: 'kappe', hutFarbe: '#5d4037' };
    return { key: `a${b.id}-${k}`, pos: [wx + dx, 0, wz + dz] as [number, number, number], blick, aussehen, versatz: r() * 2 };
  }));
  // Bauarbeiter: auf die Baustellen verteilt – gibt es keine, warten sie am Rathaus
  const baustellen = gebaeude.filter(b => (b.bauEnde ?? 0) > jetzt);
  const bau = useMemo(() => Array.from({ length: bauarbeiter }, (_, k) => {
    const ziel = baustellen.length ? baustellen[k % baustellen.length] : null;
    const [wx, , wz] = ziel ? feldZuWelt(ziel.x, ziel.y) : feldZuWelt(TOWNHALL_POS.x, TOWNHALL_POS.y);
    const ecke = ECKEN[Math.floor(k / Math.max(1, baustellen.length)) % 3];
    const pos: [number, number, number] = ziel ? [wx + ecke[0], 0, wz + ecke[1]] : [wx - 1.1 + k * 0.35, 0, wz + 1.2];
    return { key: `b${k}`, pos, blick: ziel ? ecke[2] : 0, arbeitet: !!ziel };
  }), [bauarbeiter, baustellen.map(b => b.id).join(',')]);
  const helm: Aussehen = { jacke: '#f39c12', hose: '#2c3e50', haut: '#e0ac69', hut: 'kappe', hutFarbe: '#f1c40f' };
  return (
    <>
      {arbeiter.map(a => <Werker key={a.key} pos={a.pos} blick={a.blick} aussehen={a.aussehen} takt={1.4} versatz={a.versatz} />)}
      {bau.map((b, k) => <Werker key={b.key} pos={b.pos} blick={b.blick} aussehen={helm} takt={b.arbeitet ? 0.8 : 99} versatz={k * 0.3} />)}
    </>
  );
}
