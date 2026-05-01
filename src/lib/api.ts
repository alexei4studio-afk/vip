import type { AppConfig, ClientConfig, DataRecord, ArchivedReport, DiscoveryResult, GroupedStrategies } from './types';

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.DEV) {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return window.location.origin;
}

export async function fetchConfig(): Promise<AppConfig> {
  const apiBase = getApiBaseUrl();
  try {
    const res = await fetch(`${apiBase}/api/config`);
    return await res.json();
  } catch {
    const res = await fetch('/config.json');
    return await res.json();
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Save failed');
}

export async function clientAuth(
  accessToken: string,
  password: string,
): Promise<{ client: ClientConfig }> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/client/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken, password }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || 'Autentificare eșuată.');
  return payload;
}

export async function addClientSource(
  token: string,
  url: string,
): Promise<{ sources: string[] }> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/client/add-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, url }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || 'Nu am putut adăuga sursa.');
  return payload;
}

export async function startClientScraping(
  token: string,
  force: boolean,
): Promise<{ requires_confirmation?: boolean; message?: string; error?: string; pid?: number }> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/start-client`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, force }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || 'Run failed');
  return payload;
}

export async function fetchReportStatus(
  token: string,
): Promise<{ running: boolean; logs: string[] }> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(
    `${apiBase}/api/report-status?access_token=${encodeURIComponent(token)}`,
  );
  return await res.json();
}

export async function fetchExports(token: string): Promise<ArchivedReport[]> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(
    `${apiBase}/api/exports?access_token=${encodeURIComponent(token)}`,
  );
  const payload = await res.json();
  return Array.isArray(payload.exports) ? payload.exports : [];
}

export async function loadClientDataJson(
  client: ClientConfig,
): Promise<{ items: DataRecord[]; strategies: string[]; groupedStrategies: GroupedStrategies | null }> {
  const jsonPath =
    client.type === 'national'
      ? '/data/national_business.json'
      : `/data/client_${(client.id || client.name.toLowerCase().replace(/ /g, '_')).trim()}.json`;

  const res = await fetch(jsonPath);
  if (!res.ok) throw new Error('Data fetch failed');
  const payload = await res.json();

  let items: DataRecord[] = [];
  if (Array.isArray(payload)) {
    items = payload;
  } else if (Array.isArray(payload.items)) {
    items = payload.items;
  } else if (Array.isArray(payload.prices)) {
    items = payload.prices;
  } else if (Array.isArray(payload.regiuni)) {
    items = payload.regiuni;
  }

  let strategies: string[] = [];
  let groupedStrategies: GroupedStrategies | null = null;

  const raw = payload.strategii;
  if (Array.isArray(raw)) {
    strategies = raw.filter((v: unknown) => typeof v === 'string');
  } else if (raw && typeof raw === 'object') {
    groupedStrategies = {
      imediate: Array.isArray(raw.imediate) ? raw.imediate.filter((v: unknown) => typeof v === 'string') : [],
      termen_mediu: Array.isArray(raw.termen_mediu) ? raw.termen_mediu.filter((v: unknown) => typeof v === 'string') : [],
      diferentiere: Array.isArray(raw.diferentiere) ? raw.diferentiere.filter((v: unknown) => typeof v === 'string') : [],
    };
    strategies = [...groupedStrategies.imediate, ...groupedStrategies.termen_mediu, ...groupedStrategies.diferentiere];
  }

  return { items, strategies, groupedStrategies };
}

export function getExportDownloadUrl(filename: string, token: string): string {
  const apiBase = getApiBaseUrl();
  return `${apiBase}/api/exports/${encodeURIComponent(filename)}?access_token=${encodeURIComponent(token)}`;
}

export async function startDiscovery(
  token: string,
  scope: 'local' | 'global' = 'local',
): Promise<{ message?: string; error?: string; pid?: number }> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/discover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, scope }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || 'Discovery failed');
  return payload;
}

export async function fetchDiscoveryStatus(
  token: string,
): Promise<{ running: boolean; logs: string[] }> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(
    `${apiBase}/api/discover-status?access_token=${encodeURIComponent(token)}`,
  );
  return await res.json();
}

export async function fetchDiscoveryResults(
  token: string,
): Promise<DiscoveryResult> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(
    `${apiBase}/api/discover-results?access_token=${encodeURIComponent(token)}`,
  );
  return await res.json();
}
