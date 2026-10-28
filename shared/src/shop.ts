import type { BuildingType } from './buildings';
import type { Amounts } from './resources';

// Der Online-Shop auf dem PC im Rathaus.
// Man legt Artikel in den Warenkorb, bezahlt mit Gold – und ein Lieferwagen bringt alles.
// - inhalt:   diese Rohstoffe kommen an
// - bausatz:  ein fertiges Gebäude zum Aufstellen (ist sofort gebaut, kostet keine Rohstoffe)
export interface ShopArtikel {
  name: string;
  icon: string;
  text: string;
  kategorie: 'material' | 'nahrung' | 'industrie' | 'bausatz';
  preis: number;            // Gold
  inhalt?: Amounts;
  bausatz?: BuildingType;
  abLevel: number;
  industrie?: boolean;      // nur mit freigeschalteter Industrie
}

export type ShopId =
  | 'holz' | 'stein' | 'bretter' | 'getreide' | 'mehl' | 'brot' | 'stahl' | 'maschinen'
  | 'fertighaus' | 'holzfaeller_set' | 'bauernhof_set' | 'strassen_paket';

export const SHOP: Record<ShopId, ShopArtikel> = {
  holz: { name: 'Holz-Palette', icon: '🪵', text: '60 Holz', kategorie: 'material', preis: 150, inhalt: { wood: 60 }, abLevel: 1 },
  stein: { name: 'Steine', icon: '🪨', text: '40 Stein', kategorie: 'material', preis: 180, inhalt: { stone: 40 }, abLevel: 1 },
  bretter: { name: 'Bretter-Bündel', icon: '🪚', text: '30 Bretter', kategorie: 'material', preis: 260, inhalt: { planks: 30 }, abLevel: 3 },
  getreide: { name: 'Getreidesack', icon: '🌾', text: '40 Getreide', kategorie: 'nahrung', preis: 120, inhalt: { grain: 40 }, abLevel: 2 },
  mehl: { name: 'Mehl', icon: '🥣', text: '30 Mehl', kategorie: 'nahrung', preis: 170, inhalt: { flour: 30 }, abLevel: 3 },
  brot: { name: 'Brot-Kiste', icon: '🍞', text: '25 Brot – macht deine Einwohner satt', kategorie: 'nahrung', preis: 200, inhalt: { bread: 25 }, abLevel: 2 },
  stahl: { name: 'Stahlträger', icon: '🔩', text: '20 Stahl', kategorie: 'industrie', preis: 600, inhalt: { steel: 20 }, abLevel: 6, industrie: true },
  maschinen: { name: 'Maschinen', icon: '⚙️', text: '5 Maschinen', kategorie: 'industrie', preis: 1200, inhalt: { machines: 5 }, abLevel: 6, industrie: true },
  fertighaus: { name: 'Fertighaus', icon: '🏠', text: 'Ein Wohnhaus zum Aufstellen – sofort fertig', kategorie: 'bausatz', preis: 260, bausatz: 'house', abLevel: 1 },
  holzfaeller_set: { name: 'Holzfäller-Set', icon: '🪓', text: 'Ein Holzfäller zum Aufstellen – sofort fertig', kategorie: 'bausatz', preis: 160, bausatz: 'lumberjack', abLevel: 1 },
  bauernhof_set: { name: 'Bauernhof-Set', icon: '🌾', text: 'Ein Bauernhof zum Aufstellen – sofort fertig', kategorie: 'bausatz', preis: 330, bausatz: 'farm', abLevel: 2 },
  strassen_paket: { name: 'Strassen-Paket', icon: '🛣️', text: '10 Strassenstücke zum Verlegen', kategorie: 'bausatz', preis: 60, bausatz: 'road', abLevel: 1 }
};

export const SHOP_IDS = Object.keys(SHOP) as ShopId[];
export const isShopId = (v: unknown): v is ShopId => typeof v === 'string' && v in SHOP;

// Wie viele Bausätze ein Artikel bringt
export const bausatzMenge = (id: ShopId) => (id === 'strassen_paket' ? 10 : 1);

export const MAX_OFFENE_BESTELLUNGEN = 3;
export const MAX_PRO_ARTIKEL = 10;

// Lieferzeit: 20 Sekunden + 4 Sekunden pro Stück, höchstens 2 Minuten
export function lieferzeitSekunden(stueck: number): number {
  return Math.min(120, 20 + 4 * stueck);
}

export interface Bestellung {
  id: number;
  posten: Partial<Record<ShopId, number>>;
  bestelltAm: number;
  ankunft: number;
}
