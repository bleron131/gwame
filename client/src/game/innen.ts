import {
  BACKEN, BAUERNHOF_ABFUELLEN, ESSEN, LESEN, MOEBEL, raumFuerHaus, wirksamesLevel,
  type GameState, type MoebelAktion, type MoebelId, type PlacedBuilding
} from '@empire/shared';

// Die Pläne der Innenräume: wie gross der Raum ist, was darin steht, woran man stösst
// und was man anfassen kann. (Das Aussehen baut scene/Innenraum.tsx daraus.)

export const MOEBEL_MASS = 1.25;   // Möbel aus dem Kenney Furniture Kit etwas grösser (passend zum Bürgermeister)
export const INNEN_FIGUR = 1.1;    // der Bürgermeister drinnen etwas grösser als draussen

// Etwas, das in einem Raum steht: ein Möbelstück aus dem Katalog oder ein festes Teil
export interface Gegenstand {
  key: string;
  x: number; z: number; r: number;
  moebel?: MoebelId;                     // aus dem Möbel-Katalog
  teile?: { m: string; p?: [number, number, number]; r?: number; s?: number }[]; // feste Teile (Furniture Kit)
  extra?: 'kuh' | 'huhn' | 'heu' | 'saecke' | 'spieltisch' | 'automat' | 'ofen' | 'brote' | 'kisten' | 'tafel' | 'fahne' | 'buch';
  radius: number;                        // so gross ist das Hindernis
}

// Etwas, das man benutzen kann – mit Text für den Knopf
export interface Ziel {
  key: string;
  x: number; z: number;
  icon: string;
  text: string;
  aktion: 'ausruhen' | MoebelAktion | 'abfuellen' | 'backen' | 'blackjack' | 'rangliste' | 'aufgaben' | 'vorraete' | 'kuh';
}

export interface InnenPlan {
  titel: string;
  breit: number;
  tief: number;
  boden: string;          // Farbe des Bodens
  wand: string;           // Farbe der Wände
  gegenstaende: Gegenstand[];
  ziele: Ziel[];
  einrichtbar: boolean;
  stellplaetze: { x: number; z: number; r: number }[];
}

// Was man mit einem Möbelstück tun kann
const MOEBEL_ZIEL: Record<MoebelAktion, { icon: string; text: string }> = {
  essen: { icon: '🍽️', text: `Essen (${ESSEN.brot} 🍞)` },
  lesen: { icon: '📚', text: `Lesen (+${LESEN.xp} ⭐)` },
  umziehen: { icon: '👔', text: 'Umziehen' },
  fernsehen: { icon: '📺', text: 'Fernsehen' },
  pc: { icon: '🖥️', text: 'PC benutzen' },
  sitzen: { icon: '🛋️', text: 'Hinsetzen' }
};

const vor = (x: number, z: number, r: number, d = 0.75) => ({ x: x + Math.sin(r) * d, z: z + Math.cos(r) * d });

export function innenPlan(b: PlacedBuilding, state: GameState, jetzt: number): InnenPlan | null {
  const level = Math.max(1, wirksamesLevel(b, jetzt));
  switch (b.type) {
    case 'house': {
      const raum = raumFuerHaus(level);
      const name = level >= 8 ? 'Deine Wohnung im Wohnblock' : level >= 5 ? 'Deine Wohnung im Mehrfamilienhaus' : 'Dein Wohnhaus';
      const gegenstaende: Gegenstand[] = [
        { key: 'bett', ...raum.bett, teile: [{ m: level >= 5 ? 'bedDouble' : 'bedSingle' }, { m: 'cabinetBedDrawer', p: [0.95, 0, -0.65] }], radius: 1.0 }
      ];
      const ziele: Ziel[] = [{ key: 'bett', ...vor(raum.bett.x + 0.3, raum.bett.z, 0, 1.45), icon: '😴', text: 'Ausruhen', aktion: 'ausruhen' }];
      raum.stellplaetze.forEach((p, i) => {
        const id = b.einrichtung?.[i];
        if (!id) return;
        const def = MOEBEL[id];
        gegenstaende.push({ key: 'platz' + i, ...p, moebel: id, radius: id === 'teppich' ? 0 : id === 'tisch' ? 0.85 : 0.55 });
        if (def.aktion) ziele.push({ key: 'platz' + i, ...vor(p.x, p.z, p.r, id === 'tisch' ? 1.1 : 0.9), ...MOEBEL_ZIEL[def.aktion], aktion: def.aktion });
      });
      return { titel: name, breit: raum.breit, tief: raum.tief, boden: '#c49a6c', wand: level >= 8 ? '#e9ecef' : '#f3e6cf', gegenstaende, ziele, einrichtbar: true, stellplaetze: raum.stellplaetze };
    }
    case 'farm':
      return {
        titel: 'Im Bauernhof', breit: 8, tief: 6, boden: '#a88b5a', wand: '#c9a26b', einrichtbar: false, stellplaetze: [],
        gegenstaende: [
          { key: 'heu1', x: -3.2, z: -2.2, r: 0, extra: 'heu', radius: 0.7 },
          { key: 'heu2', x: -2.0, z: -2.4, r: 0.3, extra: 'heu', radius: 0.7 },
          { key: 'kuh', x: 2.4, z: -1.6, r: -0.6, extra: 'kuh', radius: 0.8 },
          { key: 'huhn1', x: -0.8, z: 1.2, r: 1, extra: 'huhn', radius: 0.2 },
          { key: 'huhn2', x: 0.3, z: 1.6, r: 2.5, extra: 'huhn', radius: 0.2 },
          { key: 'saecke', x: -3.3, z: 0.8, r: Math.PI / 2, extra: 'saecke', radius: 0.6 }
        ],
        ziele: [
          { key: 'saecke', x: -2.4, z: 0.8, icon: '🌾', text: `Getreide abfüllen (+${BAUERNHOF_ABFUELLEN.getreideProLevel * level} 🌾)`, aktion: 'abfuellen' },
          { key: 'kuh', x: 1.6, z: -0.8, icon: '🐄', text: 'Kuh streicheln', aktion: 'kuh' }
        ]
      };
    case 'casino':
      return {
        titel: 'In der Spielhalle', breit: 9, tief: 7, boden: '#6b1f2a', wand: '#2e1f3a', einrichtbar: false, stellplaetze: [],
        gegenstaende: [
          { key: 'tisch', x: 0, z: -0.9, r: 0, extra: 'spieltisch', radius: 1.1 },
          { key: 'automat1', x: -4.0, z: -2.2, r: Math.PI / 2, extra: 'automat', radius: 0.4 },
          { key: 'automat2', x: -4.0, z: -0.9, r: Math.PI / 2, extra: 'automat', radius: 0.4 },
          { key: 'automat3', x: -4.0, z: 0.4, r: Math.PI / 2, extra: 'automat', radius: 0.4 },
          { key: 'bar', x: 3.6, z: -1.2, r: -Math.PI / 2, teile: [{ m: 'kitchenBar' }, { m: 'kitchenBar', p: [0, 0, 0.5] }, { m: 'kitchenBarEnd', p: [0, 0, 1.0] }], radius: 0.6 },
          { key: 'hocker1', x: 2.9, z: -1.2, r: 0, teile: [{ m: 'stoolBar' }], radius: 0.2 },
          { key: 'hocker2', x: 2.9, z: -0.4, r: 0, teile: [{ m: 'stoolBar' }], radius: 0.2 },
          { key: 'tafel', x: 2.3, z: -3.35, r: 0, extra: 'tafel', radius: 0.3 },
          { key: 'pflanze', x: 4.0, z: 2.6, r: 0, teile: [{ m: 'pottedPlant' }], radius: 0.3 }
        ],
        ziele: [
          { key: 'tisch', x: 0, z: 0.5, icon: '🃏', text: 'Blackjack spielen', aktion: 'blackjack' },
          { key: 'tafel', x: 2.3, z: -2.5, icon: '🏆', text: 'Rangliste ansehen', aktion: 'rangliste' }
        ]
      };
    case 'bakery':
      return {
        titel: 'In der Bäckerei', breit: 7, tief: 5, boden: '#d9c7a8', wand: '#f2e2c4', einrichtbar: false, stellplaetze: [],
        gegenstaende: [
          { key: 'ofen', x: -1.6, z: -2.0, r: 0, extra: 'ofen', radius: 0.8 },
          { key: 'herd', x: 1.0, z: -2.1, r: 0, teile: [{ m: 'kitchenStove' }, { m: 'kitchenCabinet', p: [0.45, 0, 0] }], radius: 0.5 },
          { key: 'theke', x: 0.4, z: 0.2, r: Math.PI, teile: [{ m: 'kitchenBar' }, { m: 'kitchenBar', p: [0.5, 0, 0] }, { m: 'kitchenBar', p: [-0.5, 0, 0] }], radius: 0.6 },
          { key: 'regal', x: 3.1, z: -1.6, r: -Math.PI / 2, extra: 'brote', radius: 0.5 }
        ],
        ziele: [{ key: 'ofen', x: -1.6, z: -1.0, icon: '🍞', text: `Selbst backen (${BACKEN.mehl} 🥣 → ${BACKEN.brot} 🍞)`, aktion: 'backen' }]
      };
    case 'townhall':
      return {
        titel: 'Im Rathaus – dein Büro', breit: 8, tief: 6, boden: '#8a5a3c', wand: '#efe4d2', einrichtbar: false, stellplaetze: [],
        gegenstaende: [
          { key: 'pc', x: 0, z: -1.9, r: 0, moebel: 'schreibtisch', radius: 0.7 },
          { key: 'regal1', x: -2.2, z: -2.65, r: 0, teile: [{ m: 'bookcaseClosedWide' }], radius: 0.4 },
          { key: 'regal2', x: 2.2, z: -2.65, r: 0, teile: [{ m: 'bookcaseOpen' }, { m: 'books', p: [0, 0.35, 0] }], radius: 0.4 },
          { key: 'buch', x: -3.3, z: 0.4, r: Math.PI / 2, extra: 'buch', radius: 0.4 },
          { key: 'teppich', x: 0, z: 0.4, r: 0, teile: [{ m: 'rugRounded', s: 1.3 }], radius: 0 },
          { key: 'fahne', x: 3.4, z: -2.4, r: 0, extra: 'fahne', radius: 0.3 },
          { key: 'pflanze', x: 3.4, z: 2.2, r: 0, teile: [{ m: 'pottedPlant' }], radius: 0.3 },
          { key: 'sofa', x: 3.4, z: 0.3, r: -Math.PI / 2, teile: [{ m: 'loungeSofa' }], radius: 0.5 }
        ],
        ziele: [
          { key: 'pc', x: 0, z: -0.9, icon: '💻', text: 'PC benutzen', aktion: 'pc' },
          { key: 'buch', x: -2.5, z: 0.4, icon: '📜', text: 'Stadtbuch (Aufgaben)', aktion: 'aufgaben' }
        ]
      };
    case 'warehouse': {
      // Je voller das Lager, desto mehr Kisten stehen herum
      const cap = state.stats.capacity.wood ?? 1;
      const fuell = (['wood', 'stone', 'planks', 'grain', 'flour', 'bread'] as const).reduce((s, r) => s + state.resources[r] / cap, 0) / 6;
      return {
        titel: 'Im Lagerhaus', breit: 8, tief: 6, boden: '#9a948a', wand: '#b9a78f', einrichtbar: false, stellplaetze: [],
        gegenstaende: [
          { key: 'regal1', x: -2.6, z: -2.65, r: 0, teile: [{ m: 'bookcaseOpen' }, { m: 'cardboardBoxClosed', p: [0, 0.45, 0], s: 0.7 }], radius: 0.4 },
          { key: 'regal2', x: -1.6, z: -2.65, r: 0, teile: [{ m: 'bookcaseOpen' }, { m: 'cardboardBoxOpen', p: [0, 0.02, 0], s: 0.7 }], radius: 0.4 },
          { key: 'regal3', x: 1.6, z: -2.65, r: 0, teile: [{ m: 'bookcaseOpen' }], radius: 0.4 },
          { key: 'kisten', x: 2.5, z: -0.4, r: 0, extra: 'kisten', radius: 0.9 * Math.min(1, 0.4 + fuell) },
          { key: 'pult', x: -2.8, z: 0.9, r: Math.PI / 2, teile: [{ m: 'desk' }, { m: 'laptop', p: [0, 0.38, 0] }], radius: 0.5 }
        ],
        ziele: [{ key: 'pult', x: -2.0, z: 0.9, icon: '📦', text: 'Vorräte ansehen', aktion: 'vorraete' }]
      };
    }
    default:
      return null;
  }
}
