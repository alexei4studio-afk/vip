import type { AppConfig, ClientConfig, DataRecord, ArchivedReport } from './types';

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
): Promise<{ items: DataRecord[]; strategies: string[] }> {
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

  const strategies = Array.isArray(payload.strategii)
    ? payload.strategii.filter((v: unknown) => typeof v === 'string')
    : [];

  return { items, strategies };
}

export function getExportDownloadUrl(filename: string, token: string): string {
  const apiBase = getApiBaseUrl();
  return `${apiBase}/api/exports/${encodeURIComponent(filename)}?access_token=${encodeURIComponent(token)}`;
}
