import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import type { MapNode, Outfit, PlacedBuilding } from '@empire/shared';
import { WELT_3D, feldSchluessel, feldZuWelt, weltZuFeld } from '../game/coords';
import { jetztSek, spielerAnim, spielerPos } from '../game/effects';
import { kamera, laufRichtung, steuerEingabe } from '../game/input';
import { INNEN_FIGUR } from '../game/innen';
import { BUERGERMEISTER, Figur, type Bewegung } from './Figur';

export const FIGUR_MASS = 0.42; // die Figuren sind kleiner als die Häuser (Türhöhe!)
const RADIUS = 0.25;     // so "dick" ist der Bürgermeister
const TEMPO_NORMAL = 3.4; // Lauftempo
const STRASSEN_TEMPO = 1.35; // auf der Strasse geht es schneller
const DREHEN = 2.6;      // so schnell dreht er sich in Third Person / Ego (pro Sekunde)
const NAH = 1.8;         // so nah muss man an einem Baum stehen
const AUGEN = 0.82;      // Augenhöhe für die Ego-Perspektive

// Drinnen: ein Raum mit Wänden, Möbeln (Kreise zum Ausweichen) und Dingen zum Benutzen
export interface InnenBereich {
  breit: number;
  tief: number;
  kreise: { x: number; z: number; r: number }[];
  ziele: { key: string; x: number; z: number }[];
}

interface Props {
  hindernisse: Map<string, number>; // Feld -> halbe Breite des Hindernisses
  strassen: Set<string>;            // Felder mit Strasse
  nodes: MapNode[];
  baustellen: PlacedBuilding[];     // hier kann der Bürgermeister mithelfen
  tueren: { id: number; x: number; z: number }[]; // Türen von Gebäuden mit Innenraum
  innen: InnenBereich | null;       // gesetzt = wir sind drinnen
  outfit: Outfit;
  tempoFaktor: number;              // satt: schneller laufen
  onNah: (nodeId: number | null) => void;
  onNahBau: (gebaeudeId: number | null) => void;
  onNahTuer: (gebaeudeId: number | null) => void;
  onNahZiel: (key: string | null) => void;
  onHinaus: () => void;             // durch die Tür nach draussen gelaufen
}

// Drinnen: im Raum bleiben und um die Möbel herumlaufen
function kollisionInnen(p: { x: number; z: number }, raum: InnenBereich, r: number) {
  for (const k of raum.kreise) {
    if (k.r <= 0) continue;
    const ax = p.x - k.x, az = p.z - k.z, d = Math.hypot(ax, az), min = k.r + r;
    if (d < min && d > 1e-6) { p.x = k.x + (ax / d) * min; p.z = k.z + (az / d) * min; }
  }
  const randX = raum.breit / 2 - r, randZ = raum.tief / 2 - r;
  p.x = Math.max(-randX, Math.min(randX, p.x));
  // Vorne in der Mitte ist die Tür: dort darf man hinaus (etwas weiter als die Wand)
  const tuer = Math.abs(p.x) < 0.55;
  p.z = Math.max(-randZ, Math.min(tuer ? randZ + 0.6 : randZ, p.z));
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
  // Nicht aus der Welt hinauslaufen
  p.x = Math.max(WELT_3D.minX - 3, Math.min(WELT_3D.maxX + 3, p.x));
  p.z = Math.max(WELT_3D.minZ - 3, Math.min(WELT_3D.maxZ + 3, p.z));
}

export function Spieler(props: Props) {
  const { innen, outfit } = props;
  const figur = useRef<Group>(null!);
  const bewegung = useRef<Bewegung>({ laeuft: false, tempo: 0, schlagAt: 0, werkzeug: true });
  const daten = useRef({ ...props, nah: null as number | null, nahBau: null as number | null, nahTuer: null as number | null, nahZiel: null as string | null, blick: 0, hinausBereit: false });
  Object.assign(daten.current, props);
  const { camera, size } = useThree();
  const kamZiel = useRef(new Vector3());
  const blickZiel = useRef(new Vector3());
  const blickJetzt = useRef(new Vector3());
  const erstesBild = useRef(true);
  // Beim Betreten und Verlassen springt die Kamera sofort an die neue Stelle
  const innenKey = innen ? innen.breit * 100 + innen.tief : 0;
  useEffect(() => { erstesBild.current = true; daten.current.hinausBereit = false; }, [innenKey]);

  useFrame((_, rohDt) => {
    const dt = Math.min(rohDt, 0.05);
    const d = daten.current;
    const p = spielerPos;
    const g = figur.current;
    const modus = kamera.modus;
    let laeuft = false, tempo = 0;
    const feld = weltZuFeld(p.x, p.z);
    const aufStrasse = !d.innen && d.strassen.has(feldSchluessel(feld.x, feld.y));
    const lauf = TEMPO_NORMAL * (aufStrasse ? STRASSEN_TEMPO : 1) * d.tempoFaktor * (d.innen ? 0.6 : 1);

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
    if (d.innen) {
      kollisionInnen(p, d.innen, RADIUS * INNEN_FIGUR);
      // Durch die Tür hinaus? (erst, wenn man einmal von der Tür weggegangen ist)
      const anTuer = p.z > d.innen.tief / 2 - 0.1 && Math.abs(p.x) < 0.55;
      if (p.z < d.innen.tief / 2 - 1.0) d.hinausBereit = true;
      if (anTuer && d.hinausBereit) { d.hinausBereit = false; d.onHinaus(); }
    } else {
      kollision(p, d.hindernisse);
    }
    g.position.set(p.x, 0, p.z);

    // Beim Zuschlagen schaut er zum Baum, sonst in Laufrichtung
    const schlaegt = jetztSek() - spielerAnim.schlagAt < 0.4;
    const ziel = schlaegt && modus === 'oben' ? Math.atan2(spielerAnim.blickX - p.x, spielerAnim.blickZ - p.z) : d.blick;
    g.rotation.y += Math.atan2(Math.sin(ziel - g.rotation.y), Math.cos(ziel - g.rotation.y)) * Math.min(1, dt * (modus === 'oben' ? 14 : 30));
    bewegung.current.laeuft = laeuft;
    bewegung.current.tempo = tempo;
    bewegung.current.schlagAt = spielerAnim.schlagAt;
    g.visible = modus !== 'ego'; // in der Ego-Perspektive sieht man sich nicht selbst

    // Drinnen: Was kann man in der Nähe benutzen?
    if (d.innen) {
      let ziel: string | null = null, beste = 0.9;
      for (const z of d.innen.ziele) {
        const dist = Math.hypot(z.x - p.x, z.z - p.z);
        if (dist < beste) { beste = dist; ziel = z.key; }
      }
      if (ziel !== d.nahZiel) { d.nahZiel = ziel; d.onNahZiel(ziel); }
    } else if (d.nahZiel !== null) { d.nahZiel = null; d.onNahZiel(null); }

    // Vor welcher Tür steht er? (draussen)
    let tuer: number | null = null, besteTuer = 0.9;
    if (!d.innen) for (const t of d.tueren) {
      const dist = Math.hypot(t.x - p.x, t.z - p.z);
      if (dist < besteTuer) { besteTuer = dist; tuer = t.id; }
    }
    if (tuer !== d.nahTuer) { d.nahTuer = tuer; d.onNahTuer(tuer); }

    // Welcher Baum/Felsen ist in der Nähe?
    let naechster: number | null = null, besteDistanz = NAH;
    if (!d.innen) for (const n of d.nodes) {
      const [wx, , wz] = feldZuWelt(n.x, n.y);
      const dist = Math.hypot(wx - p.x, wz - p.z);
      if (dist < besteDistanz) { besteDistanz = dist; naechster = n.id; }
    }
    if (naechster !== d.nah) { d.nah = naechster; d.onNah(naechster); }

    // Welche Baustelle ist in der Nähe? (Gebäude sind grösser: etwas mehr Abstand erlaubt)
    let bau: number | null = null, besteBau = NAH + 0.9;
    if (!d.innen) for (const b of d.baustellen) {
      const [wx, , wz] = feldZuWelt(b.x, b.y);
      const dist = Math.hypot(wx - p.x, wz - p.z);
      if (dist < besteBau) { besteBau = dist; bau = b.id; }
    }
    if (bau !== d.nahBau) { d.nahBau = bau; d.onNahBau(bau); }

    // ===== Kamera =====
    const vx = Math.sin(g.rotation.y), vz = Math.cos(g.rotation.y); // Blickrichtung
    if (modus === 'oben') {
      const hoch = size.width / size.height < 0.8;
      const z = kamera.zoom * (d.innen ? 0.72 : 1); // drinnen näher dran
      if (d.innen) {
        // Drinnen schaut die Kamera schräg von vorne in den Raum (wie in ein Puppenhaus)
        const mx = p.x * 0.5, mz = p.z * 0.35;
        // Im Hochformat (Handy) weiter weg, damit der ganze Raum ins Bild passt
        kamZiel.current.set(mx, (hoch ? 21 : 8.5) * z, mz + (hoch ? 19 : 8) * z);
        blickZiel.current.set(mx, 0.4, mz - 0.3);
      } else {
        kamZiel.current.set(p.x, (hoch ? 12 : 9.5) * z, p.z + (hoch ? 10 : 8) * z);
        blickZiel.current.set(p.x, 0.3, p.z - 0.6);
      }
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
      if (d.innen) {
        // Drinnen bleibt die Kamera im Raum (und etwas höher, über den Möbeln)
        const W = d.innen.breit / 2 - 0.2, T = d.innen.tief / 2 - 0.2;
        kamZiel.current.set(Math.max(-W, Math.min(W, kamZiel.current.x)), Math.min(2.2, kamZiel.current.y + 0.4), Math.max(-T, Math.min(T + 1.5, kamZiel.current.z)));
      }
    } else {
      const augen = AUGEN * (d.innen ? INNEN_FIGUR : 1);
      kamZiel.current.set(p.x + vx * 0.12, augen, p.z + vz * 0.12);
      blickZiel.current.set(p.x + vx * 6, augen - 0.35, p.z + vz * 6);
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

  // Kleidung aus dem Kleiderschrank
  const aussehen = useMemo(() => ({ ...BUERGERMEISTER, jacke: outfit.jacke, hut: outfit.hut, hutFarbe: outfit.hutFarbe }), [outfit]);
  return <Figur ref={figur} aussehen={aussehen} bewegung={bewegung} skala={FIGUR_MASS * (innen ? INNEN_FIGUR : 1)} />;
}
