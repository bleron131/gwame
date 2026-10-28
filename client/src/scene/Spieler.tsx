import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import type { MapNode } from '@empire/shared';
import { STADT_HALB, feldSchluessel, feldZuWelt, weltZuFeld } from '../game/coords';
import { jetztSek, spielerAnim, spielerPos } from '../game/effects';
import { kamera, laufRichtung, steuerEingabe } from '../game/input';
import { BUERGERMEISTER, Figur, type Bewegung } from './Figur';

export const FIGUR_MASS = 0.42; // die Figuren sind kleiner als die Häuser (Türhöhe!)
const RADIUS = 0.25;     // so "dick" ist der Bürgermeister
const TEMPO_NORMAL = 3.4; // Lauftempo
const STRASSEN_TEMPO = 1.35; // auf der Strasse geht es schneller
const DREHEN = 2.6;      // so schnell dreht er sich in Third Person / Ego (pro Sekunde)
const NAH = 1.8;         // so nah muss man an einem Baum stehen
const AUGEN = 0.82;      // Augenhöhe für die Ego-Perspektive

interface Props {
  hindernisse: Map<string, number>; // Feld -> halbe Breite des Hindernisses
  strassen: Set<string>;            // Felder mit Strasse
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

export function Spieler({ hindernisse, strassen, nodes, onNah }: Props) {
  const figur = useRef<Group>(null!);
  const bewegung = useRef<Bewegung>({ laeuft: false, tempo: 0, schlagAt: 0, werkzeug: true });
  const daten = useRef({ hindernisse, strassen, nodes, onNah, nah: null as number | null, blick: 0 });
  daten.current.hindernisse = hindernisse; daten.current.strassen = strassen; daten.current.nodes = nodes; daten.current.onNah = onNah;
  const { camera, size } = useThree();
  const kamZiel = useRef(new Vector3());
  const blickZiel = useRef(new Vector3());
  const blickJetzt = useRef(new Vector3());
  const erstesBild = useRef(true);

  useFrame((_, rohDt) => {
    const dt = Math.min(rohDt, 0.05);
    const d = daten.current;
    const p = spielerPos;
    const g = figur.current;
    const modus = kamera.modus;
    let laeuft = false, tempo = 0;
    const feld = weltZuFeld(p.x, p.z);
    const lauf = TEMPO_NORMAL * (d.strassen.has(feldSchluessel(feld.x, feld.y)) ? STRASSEN_TEMPO : 1);

    if (modus === 'oben') {
      // Von oben: Joystick-Richtung = Laufrichtung auf dem Bildschirm
      const r = laufRichtung();
      p.x += r.x * lauf * r.staerke * dt;
      p.z += r.z * lauf * r.staerke * dt;
      if (r.staerke > 0.05) d.blick = Math.atan2(r.x, r.z);
      laeuft = r.staerke > 0.05; tempo = lauf * r.staerke;
    } else {
      // Third Person / Ego: hoch = vorwärts, links/rechts = drehen (wie ein Auto)
      const e = steuerEingabe();
      d.blick -= e.x * DREHEN * dt;
      const vor = -e.z * lauf;
      p.x += Math.sin(d.blick) * vor * dt;
      p.z += Math.cos(d.blick) * vor * dt;
      laeuft = Math.abs(e.z) > 0.05 || Math.abs(e.x) > 0.05; tempo = Math.abs(vor) || 1.5;
    }
    kollision(p, d.hindernisse);
    g.position.set(p.x, 0, p.z);

    // Beim Zuschlagen schaut er zum Baum, sonst in Laufrichtung
    const schlaegt = jetztSek() - spielerAnim.schlagAt < 0.4;
    const ziel = schlaegt && modus === 'oben' ? Math.atan2(spielerAnim.blickX - p.x, spielerAnim.blickZ - p.z) : d.blick;
    g.rotation.y += Math.atan2(Math.sin(ziel - g.rotation.y), Math.cos(ziel - g.rotation.y)) * Math.min(1, dt * (modus === 'oben' ? 14 : 30));
    bewegung.current.laeuft = laeuft;
    bewegung.current.tempo = tempo;
    bewegung.current.schlagAt = spielerAnim.schlagAt;
    g.visible = modus !== 'ego'; // in der Ego-Perspektive sieht man sich nicht selbst

    // Welcher Baum/Felsen ist in der Nähe?
    let naechster: number | null = null, besteDistanz = NAH;
    for (const n of d.nodes) {
      const [wx, , wz] = feldZuWelt(n.x, n.y);
      const dist = Math.hypot(wx - p.x, wz - p.z);
      if (dist < besteDistanz) { besteDistanz = dist; naechster = n.id; }
    }
    if (naechster !== d.nah) { d.nah = naechster; d.onNah(naechster); }

    // ===== Kamera =====
    const vx = Math.sin(g.rotation.y), vz = Math.cos(g.rotation.y); // Blickrichtung
    if (modus === 'oben') {
      const hoch = size.width / size.height < 0.8;
      const z = kamera.zoom;
      kamZiel.current.set(p.x, (hoch ? 12 : 9.5) * z, p.z + (hoch ? 10 : 8) * z);
      blickZiel.current.set(p.x, 0.3, p.z - 0.6);
    } else if (modus === 'dritte') {
      // Kamera hinter dir – aber nicht in einem Haus: Steht eines im Weg, rückt sie näher heran
      const z = Math.min(1.4, kamera.zoom);
      let abstand = 4.2 * z;
      for (let k = 1; k <= 12; k++) {
        const t = (k / 12) * abstand;
        const f = weltZuFeld(p.x - vx * t, p.z - vz * t);
        if ((d.hindernisse.get(feldSchluessel(f.x, f.y)) ?? 0) > 0.9) { abstand = Math.max(0.9, t - 0.6); break; }
      }
      kamZiel.current.set(p.x - vx * abstand, 0.9 + abstand * 0.36, p.z - vz * abstand);
      blickZiel.current.set(p.x + vx * 2.5, 0.6, p.z + vz * 2.5);
    } else {
      kamZiel.current.set(p.x + vx * 0.12, AUGEN, p.z + vz * 0.12);
      blickZiel.current.set(p.x + vx * 6, AUGEN - 0.35, p.z + vz * 6);
    }
    if (erstesBild.current) {
      camera.position.copy(kamZiel.current); blickJetzt.current.copy(blickZiel.current); erstesBild.current = false;
    } else {
      const k = 1 - Math.exp(-dt * (modus === 'ego' ? 18 : 6));
      camera.position.lerp(kamZiel.current, k);
      blickJetzt.current.lerp(blickZiel.current, k);
    }
    camera.lookAt(blickJetzt.current);
  });

  return <Figur ref={figur} aussehen={BUERGERMEISTER} bewegung={bewegung} skala={FIGUR_MASS} />;
}
