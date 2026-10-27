import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group } from 'three';
import type { MapNode } from '@empire/shared';
import { feldZuWelt } from '../game/coords';
import { jetztSek, trefferZeit } from '../game/effects';

const KRONEN = ['#4c9a3c', '#5fb34a', '#3f8a3a', '#6aa84f'];

// Ein Baum oder Felsen, den der Bürgermeister abbauen kann.
// Er wackelt, wenn man draufschlägt, und wird mit jedem Schlag kleiner.
export function NaturObjekt({ node, nah, onTipp }: { node: MapNode; nah: boolean; onTipp: (id: number) => void }) {
  const gruppe = useRef<Group>(null!);
  const pos = feldZuWelt(node.x, node.y);
  // etwas Abwechslung: jeder Baum steht leicht versetzt und ist anders gross
  const vx = ((node.id * 37) % 7) / 10 - 0.3, vz = ((node.id * 53) % 7) / 10 - 0.3;
  const groesse = (node.type === 'tree' ? 0.75 : 0.7) + node.hitsLeft * 0.1;

  useFrame(() => {
    const seit = jetztSek() - (trefferZeit.get(node.id) ?? -9);
    const wackel = seit < 0.5 ? Math.sin(seit * 45) * 0.18 * (1 - seit / 0.5) : 0;
    gruppe.current.rotation.z = wackel;
  });

  const tipp = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 10) return; e.stopPropagation(); onTipp(node.id); };

  return (
    <group position={[pos[0] + vx, 0, pos[2] + vz]} onClick={tipp}>
      <group ref={gruppe} scale={groesse}>
        {node.type === 'tree' ? (
          <>
            <mesh position={[0, 0.6, 0]} castShadow><cylinderGeometry args={[0.13, 0.19, 1.2, 7]} /><meshStandardMaterial color="#7a5232" roughness={0.9} /></mesh>
            <mesh position={[0, 1.55, 0]} rotation={[0, node.id, 0]} castShadow><icosahedronGeometry args={[0.8, 0]} /><meshStandardMaterial color={KRONEN[node.id % KRONEN.length]} roughness={0.85} flatShading /></mesh>
            <mesh position={[0.15, 2.15, 0.05]} rotation={[0, node.id * 2, 0]} castShadow><icosahedronGeometry args={[0.52, 0]} /><meshStandardMaterial color={KRONEN[(node.id + 1) % KRONEN.length]} roughness={0.85} flatShading /></mesh>
          </>
        ) : (
          <>
            <mesh position={[0, 0.4, 0]} rotation={[0.4, node.id, 0.2]} scale={[1.1, 0.8, 1]} castShadow receiveShadow><dodecahedronGeometry args={[0.6, 0]} /><meshStandardMaterial color="#8d8f94" roughness={0.95} flatShading /></mesh>
            <mesh position={[0.45, 0.22, 0.25]} rotation={[0, node.id * 3, 0.5]} castShadow><dodecahedronGeometry args={[0.3, 0]} /><meshStandardMaterial color="#7b7d83" roughness={0.95} flatShading /></mesh>
          </>
        )}
      </group>
      {/* Wenn du nah genug bist, leuchtet ein Ring um den Baum/Felsen */}
      {nah && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.75, 0.9, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}
