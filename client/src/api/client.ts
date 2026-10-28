import type { ApiErrorBody, BuildingType, GameResponse, MoebelId, Outfit, ResearchId, ResourceId, ShopId } from '@empire/shared';

// Ein Fehler vom Server, mit verständlicher Meldung
export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

// Eindeutige Nummer für jede Aktion (damit ein Doppelklick nicht zweimal baut)
function neueId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function anfrage<T>(method: 'GET' | 'POST' | 'DELETE', pfad: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (method !== 'GET') headers['Idempotency-Key'] = neueId();
  let res: Response;
  try {
    res = await fetch('/api' + pfad, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('NETWORK', 'Keine Verbindung zum Server. Läuft „npm run dev“?', 0);
  }
  const daten = await res.json().catch(() => null);
  if (!res.ok) {
    const f = daten as ApiErrorBody | null;
    throw new ApiError(f?.error ?? 'UNKNOWN', f?.message ?? 'Der Server hat komisch geantwortet.', res.status);
  }
  return daten as T;
}

// Alle Aktionen, die der Browser beim Server auslösen kann
export const serverApi = {
  laden: (willkommen: boolean) => anfrage<GameResponse>('GET', willkommen ? '/game?welcome=1' : '/game'),
  neueStadt: (cityName: string, replace = false) => anfrage<GameResponse>('POST', '/game/new', { cityName, replace }),
  bauen: (type: BuildingType, x: number, y: number, bausatz = false) => anfrage<GameResponse>('POST', '/buildings', { type, x, y, bausatz }),
  mitbauen: (id: number) => anfrage<GameResponse>('POST', `/buildings/${id}/hammer`),
  moebel: (id: number, platz: number, moebel: MoebelId | null) => anfrage<GameResponse>('POST', `/buildings/${id}/furniture`, { platz, moebel }),
  innen: (id: number, was: InnenAktion, outfit?: Outfit) => anfrage<GameResponse>('POST', `/buildings/${id}/inside/${was}`, { outfit }),
  arbeiter: (id: number, mehr: boolean) => anfrage<GameResponse>('POST', `/buildings/${id}/workers`, { mehr }),
  bauarbeiter: (mehr: boolean) => anfrage<GameResponse>('POST', '/builders', { mehr }),
  landKaufen: (px: number, py: number) => anfrage<GameResponse>('POST', '/land', { px, py }),
  industrie: () => anfrage<GameResponse>('POST', '/land/industrie'),
  bestellen: (posten: Partial<Record<ShopId, number>>) => anfrage<GameResponse>('POST', '/shop/orders', { posten }),
  verbessern: (id: number) => anfrage<GameResponse>('POST', `/buildings/${id}/upgrade`),
  abreissen: (id: number) => anfrage<GameResponse>('DELETE', `/buildings/${id}`),
  abbauen: (nodeId: number) => anfrage<GameResponse>('POST', `/nodes/${nodeId}/harvest`),
  forschen: (id: ResearchId) => anfrage<GameResponse>('POST', `/research/${id}`),
  abholen: (aufgabeId: string) => anfrage<GameResponse>('POST', `/quests/${aufgabeId}/claim`),
  blackjack: (rohstoff: ResourceId, menge: number) => anfrage<GameResponse>('POST', '/blackjack', { rohstoff, menge }),
  blackjackZug: (zug: BlackjackZug) => anfrage<GameResponse>('POST', `/blackjack/${zug}`)
};

export type BlackjackZug = 'ziehen' | 'halten' | 'verdoppeln' | 'teilen';
export type InnenAktion = 'ausruhen' | 'essen' | 'lesen' | 'umziehen' | 'benutzen';

// GitHub-Pages-Version: Datenbank und Spielregeln laufen im Browser (wird erst bei Bedarf geladen)
export const IM_BROWSER = import.meta.env.VITE_SPEICHER === 'browser';
let lokal: Promise<typeof import('./browserServer')> | null = null;
const browser = () => (lokal ??= import('./browserServer'));

// Jede Funktion von serverApi bekommt im Browser ihr Gegenstück aus browserServer.ts
type Api = typeof serverApi;
const browserVersion = new Proxy({} as Api, {
  get: (_, name: string) => async (...args: unknown[]) => {
    const f = (await browser()).browserApi[name as keyof Api] as (...a: unknown[]) => Promise<GameResponse>;
    return f(...args);
  }
});

export const api: Api = IM_BROWSER ? browserVersion : serverApi;
