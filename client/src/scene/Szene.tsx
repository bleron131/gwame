import { Suspense, memo, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  BUILDINGS, START_PARZELLEN, gebietVon, hatInnenraum, parzellenSchluessel, wirksamesLevel, type BuildingType, type GameState, type Parzelle
} from '@empire/shared';
import { feldSchluessel, feldZuWelt, weltZuFeld } from '../game/coords';
import type { InnenPlan } from '../game/innen';
import { INNEN_MODELLE, Innenraum } from './Innenraum';
import { EinwohnerGruppe } from './Einwohner';
import { GEBAEUDE_MODELLE, Gebaeude, GebaeudeVorschau } from './Gebaeude';
import { Greta } from './Greta';
import { LandSchilder } from './LandSchilder';
import { Lieferwagen } from './Lieferwagen';
import { modelleVorladen } from './modelle';
import { NATUR_MODELLE, NaturObjekt } from './Natur';
import { Personal } from './Personal';
import { Schwebtexte } from './Schwebtexte';
import { Spieler } from './Spieler';
import { Boden, FreieFelder, LANDSCHAFT_MODELLE, Landschaft, Licht } from './Umgebung';

// Alle 3D-Modelle schon beim Start laden
modelleVorladen([...GEBAEUDE_MODELLE, ...NATUR_MODELLE, ...LANDSCHAFT_MODELLE, 'natur/sign', 'autos/delivery', ...INNEN_MODELLE]);

interface Props {
  state: GameState;
  platzieren: BuildingType | null;
  vorschau: { x: number; y: number } | null;
  vorschauOk: boolean;
  ausgewaehlt: number | null;
  nahNode: number | null;
  nahBau: number | null;
  onFeld: (x: number, y: number) => void;
  onGebaeude: (id: number) => void;
  onNode: (id: number) => void;
  onNah: (id: number | null) => void;
  onNahBau: (id: number | null) => void;
  onDaneben: () => void;
  onGreta: () => void;
  onLand: (p: Parzelle) => void;
  onIndustrie: () => void;
  gretaBelohnung: boolean; // wartet eine Belohnung bei Greta?
  // Drinnen
  innen: InnenPlan | null;
  einrichten: boolean;
  gewaehlterPlatz: number | null;
  nahZiel: string | null;
  onPlatz: (i: number) => void;
  onNahTuer: (id: number | null) => void;
  onNahZiel: (key: string | null) => void;
  onHinaus: () => void;
}

// Die ganze 3D-Welt
export const Szene = memo(function Szene(p: Props) {
  const { state } = p;
  // Welche Felder sind belegt? (für Bauen, Laufen und Wegsuche)
  const belegt = useMemo(() => {
    const s = new Set<string>();
    for (const b of state.buildings) s.add(feldSchluessel(b.x, b.y));
    for (const n of state.nodes) s.add(feldSchluessel(n.x, n.y));
    return s;
  }, [state.buildings, state.nodes]);
  // Strassen sind belegt (dort kann man nicht bauen), aber man kann darauf laufen
  const strassen = useMemo(() => new Set(state.buildings.filter(b => b.type === 'road').map(b => feldSchluessel(b.x, b.y))), [state.buildings]);
  const blockiert = useMemo(() => new Set([...belegt].filter(k => !strassen.has(k))), [belegt, strassen]);
  const hindernisse = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of state.buildings) if (b.type !== 'road') m.set(feldSchluessel(b.x, b.y), 0.92);
    for (const n of state.nodes) m.set(feldSchluessel(n.x, n.y), 0.7);
    return m;
  }, [state.buildings, state.nodes]);
  const ohneStrassen = useMemo(() => state.buildings.filter(b => b.type !== 'road'), [state.buildings]);
  const besitz = useMemo(() => new Set(state.land.parzellen.map(parzellenSchluessel)), [state.land.parzellen]);
  const gekauft = state.land.parzellen.filter(x => gebietVon(x.px, x.py) === 'stadt').length - START_PARZELLEN.length;
  const baustellen = useMemo(() => state.buildings.filter(b => (b.bauEnde ?? 0) > state.serverTime), [state.buildings, state.serverTime]);
  const angestellte = state.stats.angestellte;

  // Türen der Gebäude, in die man hineingehen kann (vorne, vor der Mitte)
  const tueren = useMemo(() => state.buildings
    .filter(b => hatInnenraum(b.type) && wirksamesLevel(b, state.serverTime) > 0)
    .map(b => { const [x, , z] = feldZuWelt(b.x, b.y); return { id: b.id, x: b.type === 'townhall' ? x - 0.4 : x - 0.3, z: z + 1.2 }; }),
  [state.buildings, state.serverTime]);
  const innenBereich = useMemo(() => p.innen && ({
    breit: p.innen.breit, tief: p.innen.tief,
    kreise: p.innen.gegenstaende.map(g => ({ x: g.x, z: g.z, r: g.radius })),
    ziele: p.innen.ziele.map(z => ({ key: z.key, x: z.x, z: z.z }))
  }), [p.innen]);
  const spieler = (
    <Spieler hindernisse={hindernisse} strassen={strassen} nodes={state.nodes} baustellen={baustellen} tueren={tueren}
      innen={innenBereich} outfit={state.buergermeister.outfit}
      tempoFaktor={state.buergermeister.sattBis > state.serverTime ? 1.3 : 1}
      onNah={p.onNah} onNahBau={p.onNahBau} onNahTuer={p.onNahTuer} onNahZiel={p.onNahZiel} onHinaus={p.onHinaus} />
  );

  // ===== Drinnen: nur der Raum =====
  if (p.innen) {
    return (
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 50, near: 0.05, far: 100, position: [0, 8, 8] }}>
        {spieler}
        <Suspense fallback={null}>
          <Innenraum plan={p.innen} einrichten={p.einrichten} gewaehlt={p.gewaehlterPlatz} onPlatz={p.onPlatz} nahZiel={p.nahZiel} />
        </Suspense>
        <Schwebtexte />
      </Canvas>
    );
  }

  const bodenTipp = (wx: number, wz: number) => {
    const f = weltZuFeld(wx, wz);
    p.onFeld(f.x, f.y);
  };

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 50, near: 0.05, far: 400, position: [0, 12, 12] }} onPointerMissed={p.onDaneben}>
      <color attach="background" args={['#9fd4f5']} />
      <fog attach="fog" args={['#cfe9fa', 55, 140]} />
      <Licht />
      <Boden besitz={besitz} industrie={state.land.industrie} onTipp={bodenTipp} />
      {spieler}
      {/* Modelle werden geladen – bis dahin wird einfach nichts gezeigt */}
      <Suspense fallback={null}>
      <Landschaft besitz={besitz} />
      <LandSchilder besitz={besitz} gekauft={gekauft} industrie={state.land.industrie} level={state.save.level} onLand={p.onLand} onIndustrie={p.onIndustrie} />
      {p.platzieren && <FreieFelder belegt={belegt} besitz={besitz} gebiet={BUILDINGS[p.platzieren].gebiet} />}
      {state.buildings.map(b => (
        <Gebaeude key={b.id} b={b} ausgewaehlt={b.id === p.ausgewaehlt || b.id === p.nahBau} bauarbeiter={state.personal.bauarbeiter} onTipp={p.onGebaeude} />
      ))}
      {state.nodes.map(n => <NaturObjekt key={n.id} node={n} nah={n.id === p.nahNode} onTipp={p.onNode} />)}
      {p.platzieren && p.vorschau && (
        <GebaeudeVorschau x={p.vorschau.x} y={p.vorschau.y} ok={p.vorschauOk} symbol={`${BUILDINGS[p.platzieren].icon} ${BUILDINGS[p.platzieren].name}`} />
      )}
      <EinwohnerGruppe gebaeude={ohneStrassen} belegt={blockiert} bevoelkerung={Math.max(0, state.stats.population - angestellte)} />
      <Personal gebaeude={state.buildings} bauarbeiter={state.personal.bauarbeiter} />
      <Lieferwagen bestellungen={state.shop.bestellungen} blockiert={blockiert} strassen={strassen} />
      <Greta belohnung={p.gretaBelohnung} onTipp={p.onGreta} />
      </Suspense>
      <Schwebtexte />
    </Canvas>
  );
});
