import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { inGrid, seededRandom, type PlacedBuilding } from '@empire/shared';
import { feldSchluessel, feldZuWelt } from '../game/coords';
import { wegFinden } from '../game/pathfinding';
import { Figur, type Aussehen, type Bewegung } from './Figur';
import { FIGUR_MASS } from './Spieler';

const TEMPO = 1.1;

const JACKEN = ['#e67e22', '#27ae60', '#8e44ad', '#16a085', '#d35400', '#2980b9', '#c0392b', '#7f8c8d'];
const HAUT = ['#f1c27d', '#e0ac69', '#8d5524', '#c68642', '#ffdbac'];
const HAARE = ['#3b2a1a', '#1c1c1c', '#a0522d', '#d4a04c', '#6b4a2b'];

type Feld = { x: number; y: number };

// Die "Tür" eines Gebäudes: ein freies Feld daneben (am liebsten davor)
function tueren(gebaeude: PlacedBuilding[], belegt: Set<string>): Feld[] {
  const t: Feld[] = [];
  for (const b of gebaeude) {
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const x = b.x + dx, y = b.y + dy;
      if (inGrid(x, y) && !belegt.has(feldSchluessel(x, y))) { t.push({ x, y }); break; }
    }
  }
  return t;
}

// Ein Einwohner läuft von Gebäude zu Gebäude, bleibt kurz stehen und läuft weiter
function Einwohner({ nr, tuerListe, belegt }: { nr: number; tuerListe: Feld[]; belegt: Set<string> }) {
  const aussehen = useMemo<Aussehen>(() => {
    const r = seededRandom(nr * 977 + 13);
    const wahl = <T,>(l: T[]) => l[Math.floor(r() * l.length)];
    const hut = wahl(['kappe', 'tuch', 'keiner', 'keiner'] as const);
    return { jacke: wahl(JACKEN), hose: wahl(['#34495e', '#5d4037', '#2c3e50', '#4e342e']), haut: wahl(HAUT), hut, hutFarbe: wahl(JACKEN), haar: hut === 'keiner' ? wahl(HAARE) : undefined };
  }, [nr]);
  const figur = useRef<Group>(null!);
  const bewegung = useRef<Bewegung>({ laeuft: false, tempo: TEMPO, schlagAt: -9 });
  const zustand = useRef({ weg: [] as Feld[], schritt: 0, warten: 1 + nr * 0.4, pos: null as null | { x: number; z: number }, feld: null as null | Feld });
  const daten = useRef({ tuerListe, belegt });
  daten.current.tuerListe = tuerListe; daten.current.belegt = belegt;

  useFrame((_, rohDt) => {
    const dt = Math.min(rohDt, 0.05);
    const z = zustand.current, { tuerListe: tl, belegt: bl } = daten.current;
    if (!tl.length) return;
    if (!z.pos || !z.feld) {
      const start = tl[nr % tl.length];
      const [wx, , wz] = feldZuWelt(start.x, start.y);
      z.pos = { x: wx, z: wz }; z.feld = start;
    }
    if (z.weg.length === 0 || z.schritt >= z.weg.length) {
      bewegung.current.laeuft = false;
      z.warten -= dt;
      if (z.warten <= 0) {
        // neues Ziel suchen
        const ziel = tl[Math.floor(Math.random() * tl.length)];
        const weg = wegFinden(bl, z.feld, ziel);
        z.weg = weg && weg.length > 1 ? weg : [];
        z.schritt = 1;
        z.warten = 1.5 + Math.random() * 3;
      }
    } else {
      const naechstes = z.weg[z.schritt];
      const [wx, , wz] = feldZuWelt(naechstes.x, naechstes.y);
      const dx = wx - z.pos.x, dz = wz - z.pos.z, d = Math.hypot(dx, dz);
      const s = TEMPO * dt;
      if (d <= s) { z.pos.x = wx; z.pos.z = wz; z.feld = naechstes; z.schritt++; }
      else {
        z.pos.x += (dx / d) * s; z.pos.z += (dz / d) * s;
        const g = figur.current, ziel = Math.atan2(dx, dz);
        g.rotation.y += Math.atan2(Math.sin(ziel - g.rotation.y), Math.cos(ziel - g.rotation.y)) * Math.min(1, dt * 10);
      }
      bewegung.current.laeuft = true;
    }
    figur.current.position.set(z.pos.x, 0, z.pos.z);
  });

  return <Figur ref={figur} aussehen={aussehen} bewegung={bewegung} skala={FIGUR_MASS * (0.92 + (nr % 3) * 0.05)} />;
}

// So viele Einwohner laufen herum, wie in der Stadt wohnen (höchstens 18 sichtbar)
export function EinwohnerGruppe({ gebaeude, belegt, bevoelkerung }: { gebaeude: PlacedBuilding[]; belegt: Set<string>; bevoelkerung: number }) {
  const tuerListe = useMemo(() => tueren(gebaeude, belegt), [gebaeude, belegt]);
  const anzahl = Math.min(18, Math.max(1, Math.floor(bevoelkerung / 2)));
  return <>{Array.from({ length: anzahl }, (_, i) => <Einwohner key={i} nr={i} tuerListe={tuerListe} belegt={belegt} />)}</>;
}
