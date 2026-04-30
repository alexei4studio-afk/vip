import { useEffect, useState } from 'react';
import type { DataRecord } from './types';

export function parsePrice(value: string | number | null | undefined): number {
  if (value == null) return Infinity;
  const str = String(value).replace(/[^\d,.\-]/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? Infinity : num;
}

export function findMinPriceIndices(data: DataRecord[], key: string): Set<number> {
  let min = Infinity;
  const indices = new Set<number>();
  data.forEach((item, i) => {
    const val = parsePrice(item[key]);
    if (val < min) {
      min = val;
      indices.clear();
      indices.add(i);
    } else if (val === min && val !== Infinity) {
      indices.add(i);
    }
  });
  return indices;
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function getItemCategory(
  item: DataRecord,
  hasDetailedPizzaRows: boolean,
  isNational: boolean,
): string {
  if (item.categorie) return String(item.categorie);
  if (hasDetailedPizzaRows) return String(item.competitor || item.platforma || 'Altele');
  if (isNational) return String(item.nume_sursa || 'Altele');
  const name = String(item.Produs || item.produs || item.product || '').toLowerCase();
  if (/pizza|margherita|diavola|quattro/i.test(name)) return 'Pizza';
  if (/past[aăe]|spaghett|carbonara|bolognese|penne|rigatoni/i.test(name)) return 'Paste';
  if (/desert|tiramisu|tort|cheesecake|panna.?cotta|înghețată/i.test(name)) return 'Deserturi';
  if (/salat/i.test(name)) return 'Salate';
  if (/burger/i.test(name)) return 'Burgeri';
  if (/sup[aă]|ciorb/i.test(name)) return 'Supe';
  return 'Altele';
}

export function matchesSearch(item: DataRecord, query: string): boolean {
  return Object.values(item).some(
    (val) => val != null && String(val).toLowerCase().includes(query),
  );
}

export function getSortPrice(
  item: DataRecord,
  hasDetailedPizzaRows: boolean,
  isNational: boolean,
): number {
  if (hasDetailedPizzaRows) return parsePrice(item.margherita);
  if (isNational) return parsePrice(item.pret_mediu_national);
  return parsePrice(item['Preț'] ?? item.pret ?? item.price);
}

export const ROW_HEIGHT = 48;
export const OVERSCAN = 8;
export const CONTAINER_MAX_H = 600;
export const VIRTUAL_THRESHOLD = 40;

export const GLASS_CARD =
  'rounded-apple border border-apple-border/40 bg-white/70 backdrop-blur-[20px] shadow-glass-lg';

export function deriveClientId(client: { id?: string; name: string }): string {
  return (client.id || client.name.toLowerCase().replace(/ /g, '_')).trim();
}
