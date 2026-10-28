import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { INDUSTRIE, alleParzellen, kaufbar, landPreis, parzellenSchluessel, type Parzelle } from '@empire/shared';
import { parzellenMitte } from '../game/coords';
import { zahl } from '../game/format';
import { Teil } from './modelle';
import { textTextur } from './textSprite';

// Ein Holzschild mit Text darüber
function Schild({ pos, zeilen, farbe, onTipp, gross }: { pos: [number, number, number]; zeilen: string[]; farbe: string; onTipp: () => void; gross?: boolean }) {
  const texte = useMemo(() => zeilen.map((z, i) => textTextur(z, '#ffffff', i === 0 ? farbe : 'rgba(28,36,51,0.85)')), [zeilen.join('|'), farbe]);
  const tipp = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 10) return; e.stopPropagation(); onTipp(); };
  const s = gross ? 1.4 : 1;
  return (
    <group position={pos} onClick={tipp}>
      <Teil m="natur/sign" s={3 * s} r={0} />
      {texte.map((t, i) => (
        <sprite key={i} position={[0, (2.2 - i * 0.45) * s, 0]} scale={[t.verhaeltnis * 0.42 * s, 0.42 * s, 1]}>
          <spriteMaterial map={t.tex} depthTest={false} />
        </sprite>
      ))}
      {/* unsichtbare Fläche, damit man das Schild leicht antippen kann */}
      <mesh position={[0, 1.2 * s, 0]}><boxGeometry args={[2.2 * s, 2.4 * s, 1]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    </group>
  );
}

// Schilder "Zu verkaufen" auf Land, das an deine Stadt grenzt – und das Tor zur Industrie
export function LandSchilder({ besitz, gekauft, industrie, level, onLand, onIndustrie }: {
  besitz: Set<string>; gekauft: number; industrie: boolean; level: number;
  onLand: (p: Parzelle) => void; onIndustrie: () => void;
}) {
  const preis = landPreis(gekauft);
  const zuKaufen = alleParzellen().filter(p => p.gebiet === 'stadt' && kaufbar(p, besitz));
  const ind = alleParzellen().filter(p => p.gebiet === 'industrie');
  // Das Tor steht am linken Rand des Industrie-Gebiets, in der Mitte
  const tor = useMemo(() => {
    const m = ind.map(parzellenMitte);
    const minX = Math.min(...m.map(x => x[0])) - 8;
    const z = (Math.min(...m.map(x => x[2])) + Math.max(...m.map(x => x[2]))) / 2;
    return [minX + 1.5, 0, z] as [number, number, number];
  }, []);
  return (
    <>
      {zuKaufen.map(p => (
        <Schild key={parzellenSchluessel(p)} pos={parzellenMitte(p)} farbe="#2e8b57"
          zeilen={['ZU VERKAUFEN', `${zahl(preis.gold!)} Gold`]} onTipp={() => onLand(p)} />
      ))}
      {!industrie && (
        <Schild pos={tor} gross farbe="#555c66" onTipp={onIndustrie}
          zeilen={['INDUSTRIE', level >= INDUSTRIE.level ? 'Antippen zum Freischalten' : `gesperrt bis Level ${INDUSTRIE.level}`]} />
      )}
    </>
  );
}
