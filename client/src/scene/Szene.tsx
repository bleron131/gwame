import { Suspense, memo, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { BUILDINGS, START_PARZELLEN, gebietVon, parzellenSchluessel, type BuildingType, type GameState, type Parzelle } from '@empire/shared';
import { feldSchluessel, weltZuFeld } from '../game/coords';
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
modelleVorladen([...GEBAEUDE_MODELLE, ...NATUR_MODELLE, ...LANDSCHAFT_MODELLE, 'natur/sign']);

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
      <Spieler hindernisse={hindernisse} strassen={strassen} nodes={state.nodes} baustellen={baustellen} onNah={p.onNah} onNahBau={p.onNahBau} />
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
      <Lieferwagen bestellungen={state.shop.bestellungen} blockiert={blockiert} />
      <Greta belohnung={p.gretaBelohnung} onTipp={p.onGreta} />
      </Suspense>
      <Schwebtexte />
    </Canvas>
  );
});
