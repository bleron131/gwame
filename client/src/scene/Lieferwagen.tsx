import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { TOWNHALL_POS, WELT, type Bestellung } from '@empire/shared';
import { feldZuWelt } from '../game/coords';
import { serverJetzt } from '../game/effects';
import { wegFinden } from '../game/pathfinding';
import { textTextur } from './textSprite';

type Feld = { x: number; y: number };

// Ein Lieferwagen fährt vom Rand der Welt zum Rathaus.
// Wo er gerade ist, hängt nur von der Zeit ab: bestellt -> angekommen.
function Wagen({ b, weg }: { b: Bestellung; weg: [number, number][] }) {
  const g = useRef<Group>(null!);
  const raeder = useRef<Group>(null!);
  const kiste = useMemo(() => textTextur('📦 EMPIRE-SHOP', '#ffffff', '#c0392b'), []);
  // Länge der einzelnen Wegstücke (für gleichmässiges Fahren)
  const laengen = useMemo(() => {
    const l = [0];
    for (let i = 1; i < weg.length; i++) l.push(l[i - 1] + Math.hypot(weg[i][0] - weg[i - 1][0], weg[i][1] - weg[i - 1][1]));
    return l;
  }, [weg]);
  useFrame((_, dt) => {
    const k = Math.max(0, Math.min(1, (serverJetzt() - b.bestelltAm) / Math.max(1, b.ankunft - b.bestelltAm)));
    const s = k * laengen[laengen.length - 1];
    let i = 1;
    while (i < laengen.length - 1 && laengen[i] < s) i++;
    const a = weg[i - 1], z = weg[i];
    const t = (s - laengen[i - 1]) / Math.max(0.001, laengen[i] - laengen[i - 1]);
    g.current.position.set(a[0] + (z[0] - a[0]) * t, 0, a[1] + (z[1] - a[1]) * t);
    const ziel = Math.atan2(z[0] - a[0], z[1] - a[1]);
    g.current.rotation.y += Math.atan2(Math.sin(ziel - g.current.rotation.y), Math.cos(ziel - g.current.rotation.y)) * Math.min(1, dt * 6);
    if (k < 1) raeder.current.children.forEach(r => { r.rotation.x += dt * 8; });
  });
  return (
    <group ref={g} position={[weg[0][0], 0, weg[0][1]]}>
      {/* Laderaum */}
      <mesh position={[0, 0.42, -0.2]} castShadow><boxGeometry args={[0.8, 0.6, 1.0]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
      <mesh position={[0.405, 0.45, -0.2]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[0.9, 0.25]} /><meshBasicMaterial map={kiste.tex} /></mesh>
      <mesh position={[-0.405, 0.45, -0.2]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[0.9, 0.25]} /><meshBasicMaterial map={kiste.tex} /></mesh>
      {/* Fahrerhaus */}
      <mesh position={[0, 0.33, 0.5]} castShadow><boxGeometry args={[0.78, 0.44, 0.4]} /><meshStandardMaterial color="#c0392b" /></mesh>
      <mesh position={[0, 0.42, 0.705]}><boxGeometry args={[0.6, 0.2, 0.02]} /><meshStandardMaterial color="#9fd4f5" metalness={0.5} roughness={0.2} /></mesh>
      <group ref={raeder}>
        {[[-0.38, 0.45], [0.38, 0.45], [-0.38, -0.45], [0.38, -0.45]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.13, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.13, 0.13, 0.08, 12]} /><meshStandardMaterial color="#222" /></mesh>
        ))}
      </group>
    </group>
  );
}

export function Lieferwagen({ bestellungen, blockiert }: { bestellungen: Bestellung[]; blockiert: Set<string> }) {
  // Weg: vom unteren Rand der Welt über freie Felder bis vor das Rathaus
  const weg = useMemo(() => {
    const start: Feld = { x: TOWNHALL_POS.x, y: WELT.maxY + 1 };
    const ziel: Feld = { x: TOWNHALL_POS.x, y: TOWNHALL_POS.y + 1 };
    const felder = wegFinden(blockiert, start, ziel) ?? [start, ziel];
    return felder.map(f => { const [x, , z] = feldZuWelt(f.x, f.y); return [x + 0.5, z] as [number, number]; });
  }, [blockiert]);
  return <>{bestellungen.map(b => <Wagen key={b.id} b={b} weg={weg} />)}</>;
}
