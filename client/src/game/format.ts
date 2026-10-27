import { BUILDINGS, RESOURCES, RESOURCE_IDS, type Amounts, type BuildingType } from '@empire/shared';

const EINHEITEN = ['', 'K', 'M', 'B', 'T'];

// 1500 -> "1.5K", 2300000 -> "2.3M"
export function zahl(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return Math.floor(n).toString();
  let i = 0;
  while (n >= 1000 && i < EINHEITEN.length - 1) { n /= 1000; i++; }
  return (n < 10 ? Math.floor(n * 10) / 10 : Math.floor(n)).toString() + EINHEITEN[i];
}

// 3725 Sekunden -> "1 Std. 2 Min."
export function dauer(sekunden: number): string {
  const h = Math.floor(sekunden / 3600), m = Math.floor((sekunden % 3600) / 60);
  if (h > 0) return `${h} Std. ${m} Min.`;
  if (m > 0) return `${m} Min.`;
  return `${Math.floor(sekunden)} Sek.`;
}

// "+20 🪵 +5 🪨"
export function mengenText(a: Amounts): string {
  return RESOURCE_IDS.filter(r => a[r]).map(r => `+${zahl(a[r]!)} ${RESOURCES[r].icon}`).join('  ');
}

// Was ein Gebäude auf einem Level bewirkt, als kurze Texte
export function wirkung(type: BuildingType, level: number): string[] {
  const def = BUILDINGS[type];
  const t: string[] = [];
  if ('production' in def && def.production) {
    for (const r of RESOURCE_IDS) {
      const v = (def.production as Amounts)[r];
      if (v) t.push(`+${zahl(v * level)} ${RESOURCES[r].icon}/Min.`);
    }
  }
  if ('population' in def && def.population) t.push(`+${def.population * level} 👥 Einwohner`);
  if ('storage' in def && def.storage) {
    const platz = def.storage * (type === 'townhall' ? level - 1 : level);
    if (platz > 0) t.push(`+${zahl(platz)} 📦 Lagerplatz`);
  }
  return t;
}
