import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import type { MapNode, Outfit, PlacedBuilding } from '@empire/shared';
import { WELT_3D, feldSchluessel, feldZuWelt, weltZuFeld } from '../game/coords';
import { jetztSek, spielerAnim, spielerPos } from '../game/effects';
import { drehTasten, kamera, laufRichtung } from '../game/input';
import { INNEN_FIGUR } from '../game/innen';
import { BUERGERMEISTER, Figur, type Bewegung } from './Figur';

export const FIGUR_MASS = 0.42; // die Figuren sind kleiner als die Häuser (Türhöhe!)
const RADIUS = 0.25;     // so "dick" ist der Bürgermeister
const TEMPO_NORMAL = 3.4; // Lauftempo
const STRASSEN_TEMPO = 1.35; // auf der Strasse geht es schneller
const DREHEN = 2.2;      // so schnell drehen die Pfeiltasten die Kamera (pro Sekunde)
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

    // Pfeiltasten links/rechts drehen die Kamera (für alle, die lieber nur die Tastatur benutzen)
    kamera.gier -= drehTasten() * DREHEN * dt;
    // Drinnen von oben schaut die Kamera immer gerade in den Raum (wie in ein Puppenhaus)
    const gier = d.innen && modus === 'oben' ? 0 : kamera.gier;

    // Laufen: immer passend zur Kamera – W/hoch = dorthin, wohin die Kamera schaut, A/D = seitwärts
    const r = laufRichtung(gier);
    p.x += r.x * lauf * r.staerke * dt;
    p.z += r.z * lauf * r.staerke * dt;
    laeuft = r.staerke > 0.05; tempo = lauf * r.staerke;
    if (modus === 'ego') d.blick = Math.atan2(-Math.sin(gier), -Math.cos(gier)); // Ego: man schaut, wohin die Kamera schaut
    else if (laeuft) d.blick = Math.atan2(r.x, r.z);                              // sonst: in Laufrichtung
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
    const ziel = schlaegt && modus !== 'ego' ? Math.atan2(spielerAnim.blickX - p.x, spielerAnim.blickZ - p.z) : d.blick;
    g.rotation.y += Math.atan2(Math.sin(ziel - g.rotation.y), Math.cos(ziel - g.rotation.y)) * Math.min(1, dt * (modus === 'ego' ? 30 : 12));
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
    // Blickrichtung der Kamera (vorwärts) aus der Drehung "gier"
    const vx = -Math.sin(gier), vz = -Math.cos(gier);
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
        // Schräg von oben – mit der Maus kann man um den Bürgermeister herum drehen und steiler/flacher schauen
        const abstand = (hoch ? 15.6 : 12.4) * z;
        const steil = Math.max(0.45, Math.min(1.45, 0.88 + kamera.neigung * 0.6));
        kamZiel.current.set(p.x - vx * abstand * Math.cos(steil), abstand * Math.sin(steil), p.z - vz * abstand * Math.cos(steil));
        blickZiel.current.set(p.x + vx * 0.6, 0.3, p.z + vz * 0.6);
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
      // Höhe der Kamera: Maus nach unten ziehen = von weiter oben schauen
      const steil = Math.max(0.05, Math.min(1.3, 0.32 + kamera.neigung * 0.9));
      const flach = Math.cos(steil) * abstand;
      kamZiel.current.set(p.x - vx * flach, 0.7 + Math.sin(steil) * abstand, p.z - vz * flach);
      blickZiel.current.set(p.x + vx * 2.5, 0.6 - kamera.neigung * 0.8, p.z + vz * 2.5);
      if (d.innen) {
        // Drinnen bleibt die Kamera im Raum (und etwas höher, über den Möbeln)
        const W = d.innen.breit / 2 - 0.2, T = d.innen.tief / 2 - 0.2;
        kamZiel.current.set(Math.max(-W, Math.min(W, kamZiel.current.x)), Math.min(2.2, kamZiel.current.y + 0.4), Math.max(-T, Math.min(T + 1.5, kamZiel.current.z)));
      }
    } else {
      // Ego: hoch und runter schauen mit der Maus
      const augen = AUGEN * (d.innen ? INNEN_FIGUR : 1);
      const hochRunter = Math.max(-1.2, Math.min(1.2, -kamera.neigung * 1.3));
      kamZiel.current.set(p.x + vx * 0.12, augen, p.z + vz * 0.12);
      blickZiel.current.set(p.x + vx * 6 * Math.cos(hochRunter), augen + Math.sin(hochRunter) * 6, p.z + vz * 6 * Math.cos(hochRunter));
    }
    if (erstesBild.current) {
      camera.position.copy(kamZiel.current); blickJetzt.current.copy(blickZiel.current); erstesBild.current = false;
    } else if (modus === 'ego') {
      // Ego: der Blick folgt der Maus sofort (sonst fühlt sich das Umsehen träge an)
      camera.position.lerp(kamZiel.current, 1 - Math.exp(-dt * 18));
      blickJetzt.current.copy(blickZiel.current);
    } else {
      // Third Person und von oben: Die Kamera gleitet weich hinterher (beim Drehen schneller)
      const k = 1 - Math.exp(-dt * 10);
      camera.position.lerp(kamZiel.current, k);
      blickJetzt.current.lerp(blickZiel.current, k);
    }
    camera.lookAt(blickJetzt.current);
  });

  // Kleidung aus dem Kleiderschrank
  const aussehen = useMemo(() => ({ ...BUERGERMEISTER, jacke: outfit.jacke, hut: outfit.hut, hutFarbe: outfit.hutFarbe }), [outfit]);
  return <Figur ref={figur} aussehen={aussehen} bewegung={bewegung} skala={FIGUR_MASS * (innen ? INNEN_FIGUR : 1)} />;
}
