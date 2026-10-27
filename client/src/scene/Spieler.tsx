import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import type { MapNode } from '@empire/shared';
import { STADT_HALB, feldSchluessel, feldZuWelt, weltZuFeld } from '../game/coords';
import { jetztSek, spielerAnim, spielerPos } from '../game/effects';
import { laufRichtung } from '../game/input';
import { BUERGERMEISTER, Figur, type Bewegung } from './Figur';

const RADIUS = 0.4;     // so "dick" ist der Bürgermeister
const TEMPO = 5;        // Lauftempo
const NAH = 2.0;        // so nah muss man an einem Baum stehen

interface Props {
  hindernisse: Map<string, number>; // Feld -> halbe Breite des Hindernisses
  nodes: MapNode[];
  onNah: (nodeId: number | null) => void;
}

// Schiebt den Bürgermeister aus Häusern und Bäumen heraus
function kollision(p: { x: number; z: number }, hindernisse: Map<string, number>) {
  const f = weltZuFeld(p.x, p.z);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const halb = hindernisse.get(feldSchluessel(f.x + dx, f.y + dy));
    if (!halb) continue;
    const [cx, , cz] = feldZuWelt(f.x + dx, f.y + dy);
    const nx = Math.max(cx - halb, Math.min(p.x, cx + halb)), nz = Math.max(cz - halb, Math.min(p.z, cz + halb));
    const ax = p.x - nx, az = p.z - nz, d = Math.hypot(ax, az);
    if (d >= RADIUS) continue;
    if (d > 1e-6) { p.x = nx + (ax / d) * RADIUS; p.z = nz + (az / d) * RADIUS; }
    else p.z = cz + halb + RADIUS; // ganz drin: nach vorne raus
  }
  const grenze = STADT_HALB + 4;
  p.x = Math.max(-grenze, Math.min(grenze, p.x));
  p.z = Math.max(-grenze, Math.min(grenze, p.z));
}

export function Spieler({ hindernisse, nodes, onNah }: Props) {
  const figur = useRef<Group>(null!);
  const bewegung = useRef<Bewegung>({ laeuft: false, tempo: 0, schlagAt: 0, werkzeug: true });
  const daten = useRef({ hindernisse, nodes, onNah, nah: null as number | null });
  daten.current.hindernisse = hindernisse; daten.current.nodes = nodes; daten.current.onNah = onNah;
  const { camera, size } = useThree();
  const kamZiel = useRef(new Vector3());
  const erstesBild = useRef(true);

  useFrame((_, rohDt) => {
    const dt = Math.min(rohDt, 0.05);
    const d = daten.current;
    const r = laufRichtung();
    const p = spielerPos;
    p.x += r.x * TEMPO * r.staerke * dt;
    p.z += r.z * TEMPO * r.staerke * dt;
    kollision(p, d.hindernisse);

    const g = figur.current;
    g.position.set(p.x, 0, p.z);
    const schlaegt = jetztSek() - spielerAnim.schlagAt < 0.4;
    let ziel: number | null = null;
    if (schlaegt) ziel = Math.atan2(spielerAnim.blickX - p.x, spielerAnim.blickZ - p.z);
    else if (r.staerke > 0.05) ziel = Math.atan2(r.x, r.z);
    if (ziel !== null) g.rotation.y += Math.atan2(Math.sin(ziel - g.rotation.y), Math.cos(ziel - g.rotation.y)) * Math.min(1, dt * 14);
    bewegung.current.laeuft = r.staerke > 0.05;
    bewegung.current.tempo = TEMPO * r.staerke;
    bewegung.current.schlagAt = spielerAnim.schlagAt;

    // Welcher Baum/Felsen ist in der Nähe?
    let naechster: number | null = null, besteDistanz = NAH;
    for (const n of d.nodes) {
      const [wx, , wz] = feldZuWelt(n.x, n.y);
      const dist = Math.hypot(wx - p.x, wz - p.z);
      if (dist < besteDistanz) { besteDistanz = dist; naechster = n.id; }
    }
    if (naechster !== d.nah) { d.nah = naechster; d.onNah(naechster); }

    // Kamera folgt dir (im Hochformat etwas weiter weg)
    const hoch = size.width / size.height < 0.8;
    kamZiel.current.set(p.x, hoch ? 19 : 14, p.z + (hoch ? 15 : 12));
    if (erstesBild.current) { camera.position.copy(kamZiel.current); erstesBild.current = false; }
    else camera.position.lerp(kamZiel.current, 1 - Math.exp(-dt * 5));
    camera.lookAt(camera.position.x, 0.6, camera.position.z - (hoch ? 15 : 12) - 1);
  });

  return <Figur ref={figur} aussehen={BUERGERMEISTER} bewegung={bewegung} />;
}
