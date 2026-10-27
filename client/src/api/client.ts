import type { ApiErrorBody, BuildingType, GameResponse } from '@empire/shared';

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
const serverApi = {
  laden: (willkommen: boolean) => anfrage<GameResponse>('GET', willkommen ? '/game?welcome=1' : '/game'),
  neueStadt: (cityName: string, replace = false) => anfrage<GameResponse>('POST', '/game/new', { cityName, replace }),
  bauen: (type: BuildingType, x: number, y: number) => anfrage<GameResponse>('POST', '/buildings', { type, x, y }),
  verbessern: (id: number) => anfrage<GameResponse>('POST', `/buildings/${id}/upgrade`),
  abreissen: (id: number) => anfrage<GameResponse>('DELETE', `/buildings/${id}`),
  abbauen: (nodeId: number) => anfrage<GameResponse>('POST', `/nodes/${nodeId}/harvest`)
};

// GitHub-Pages-Version: Datenbank und Spielregeln laufen im Browser (wird erst bei Bedarf geladen)
export const IM_BROWSER = import.meta.env.VITE_SPEICHER === 'browser';
let lokal: Promise<typeof import('./browserServer')> | null = null;
const browser = () => (lokal ??= import('./browserServer'));

export const api: typeof serverApi = IM_BROWSER
  ? {
      laden: async w => (await browser()).browserApi.laden(w),
      neueStadt: async (n, r) => (await browser()).browserApi.neueStadt(n, r),
      bauen: async (t, x, y) => (await browser()).browserApi.bauen(t, x, y),
      verbessern: async i => (await browser()).browserApi.verbessern(i),
      abreissen: async i => (await browser()).browserApi.abreissen(i),
      abbauen: async i => (await browser()).browserApi.abbauen(i)
    }
  : serverApi;
