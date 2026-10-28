import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, Vector3, type Group } from 'three';
import { TOWNHALL_POS, type Bestellung } from '@empire/shared';
import { feldZuWelt } from '../game/coords';
import { serverJetzt } from '../game/effects';
import { strassenWeg } from '../game/strassenweg';
import { useModell } from './modelle';

const WAGEN_MASS = 0.5;
const SPUR = 0.42; // rechte Fahrspur: so weit neben der Strassenmitte

// Der Lieferwagen aus dem Kenney Car Kit, auf den Boden gestellt
function WagenModell() {
  const objekt = useModell('autos/delivery');
  const versatz = useMemo(() => {
    const box = new Box3().setFromObject(objekt);
    const c = box.getCenter(new Vector3());
    return [-c.x, -box.min.y, -c.z] as const;
  }, [objekt]);
  return <group scale={WAGEN_MASS}><primitive object={objekt} position={versatz} /></group>;
}

// Ein Lieferwagen fährt vom Rand der Welt über deine Strassen zum Rathaus.
// Wo er gerade ist, hängt nur von der Zeit ab: bestellt -> angekommen.
function Wagen({ b, weg }: { b: Bestellung; weg: [number, number][] }) {
  const g = useRef<Group>(null!);
  // Länge der einzelnen Wegstücke (für gleichmässiges Fahren)
  const laengen = useMemo(() => {
    const l = [0];
    for (let i = 1; i < weg.length; i++) l.push(l[i - 1] + Math.hypot(weg[i][0] - weg[i - 1][0], weg[i][1] - weg[i - 1][1]));
    return l;
  }, [weg]);
  useFrame((_, dt) => {
    const k = Math.max(0, Math.min(1, (serverJetzt() - b.bestelltAm) / Math.max(1, b.ankunft - b.bestelltAm)));
    // Sanft anfahren und bremsen
    const s = (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) * laengen[laengen.length - 1];
    let i = 1;
    while (i < laengen.length - 1 && laengen[i] < s) i++;
    const a = weg[i - 1], z = weg[i];
    const t = (s - laengen[i - 1]) / Math.max(0.001, laengen[i] - laengen[i - 1]);
    const dx = z[0] - a[0], dz = z[1] - a[1], d = Math.hypot(dx, dz) || 1;
    // Auf der rechten Spur fahren: quer zur Fahrtrichtung verschieben
    g.current.position.set(a[0] + dx * t - (dz / d) * SPUR, 0, a[1] + dz * t + (dx / d) * SPUR);
    const ziel = Math.atan2(dx, dz);
    g.current.rotation.y += Math.atan2(Math.sin(ziel - g.current.rotation.y), Math.cos(ziel - g.current.rotation.y)) * Math.min(1, dt * 5);
  });
  return <group ref={g} position={[weg[0][0], 0, weg[0][1]]}><WagenModell /></group>;
}

export function Lieferwagen({ bestellungen, blockiert, strassen }: { bestellungen: Bestellung[]; blockiert: Set<string>; strassen: Set<string> }) {
  // Weg: vom Rand der Welt, möglichst über Strassen, bis vor das Rathaus
  const weg = useMemo(() => {
    const ziel = { x: TOWNHALL_POS.x, y: TOWNHALL_POS.y + 1 };
    return strassenWeg(blockiert, strassen, ziel).map(f => { const [x, , z] = feldZuWelt(f.x, f.y); return [x, z] as [number, number]; });
  }, [blockiert, strassen]);
  if (!bestellungen.length) return null;
  return <>{bestellungen.map(b => <Wagen key={b.id} b={b} weg={weg} />)}</>;
}
