import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group } from 'three';
import type { MapNode } from '@empire/shared';
import { feldZuWelt } from '../game/coords';
import { jetztSek, trefferZeit } from '../game/effects';
import { Teil } from './modelle';

// Bäume und Felsen aus dem Kenney Nature Kit
const BAUM_ARTEN = ['natur/tree_default', 'natur/tree_oak', 'natur/tree_detailed', 'natur/tree_fat', 'natur/tree_pineRoundA', 'natur/tree_cone'];
const FELS_ARTEN = ['natur/stone_tallA', 'natur/stone_largeB', 'natur/stone_tallC', 'natur/stone_largeD'];
// Wo die einzelnen Bäume/Felsen auf dem Feld stehen (ein Feld = kleine Baumgruppe)
const PLAETZE: [number, number][] = [[-0.35, -0.3], [0.4, -0.1], [-0.05, 0.4], [0.35, 0.45]];

const SEITENSTART = jetztSek(); // wann die Seite geladen wurde

// Ein Baum oder Felsen, den der Bürgermeister abbauen kann.
// Jeder Schlag nimmt einen Baum (oder Stein) aus der Gruppe weg.
export function NaturObjekt({ node, nah, onTipp }: { node: MapNode; nah: boolean; onTipp: (id: number) => void }) {
  const gruppe = useRef<Group>(null!);
  const pos = feldZuWelt(node.x, node.y);
  const baum = node.type === 'tree';
  const arten = baum ? BAUM_ARTEN : FELS_ARTEN;
  // Ist der Baum neu nachgewachsen (nicht schon beim Laden da)? Dann wächst er langsam aus dem Boden.
  const geboren = useRef(jetztSek());
  const waechst = geboren.current - SEITENSTART > 4;

  useFrame(() => {
    const seit = jetztSek() - (trefferZeit.get(node.id) ?? -9);
    gruppe.current.rotation.z = seit < 0.5 ? Math.sin(seit * 45) * 0.12 * (1 - seit / 0.5) : 0;
    const alter = jetztSek() - geboren.current;
    gruppe.current.scale.setScalar(waechst && alter < 1.5 ? Math.max(0.05, 1 - Math.pow(1 - alter / 1.5, 3)) : 1);
  });

  const tipp = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 10) return; e.stopPropagation(); onTipp(node.id); };

  return (
    <group position={pos} onClick={tipp}>
      <group ref={gruppe}>
        {PLAETZE.slice(0, node.hitsLeft).map(([x, z], k) => (
          <Teil key={k} m={arten[(node.id + k) % arten.length]} p={[x, 0, z]} r={node.id * 1.7 + k * 2.1} s={baum ? 1.6 + ((node.id + k) % 3) * 0.2 : 1.3 + (k % 2) * 0.3} />
        ))}
      </group>
      {/* Wenn du nah genug bist, leuchtet ein Ring */}
      {nah && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.9, 1.02, 40]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}

export const NATUR_MODELLE = [...BAUM_ARTEN, ...FELS_ARTEN];
