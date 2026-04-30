import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, ArrowUpDown, X } from 'lucide-react';
import { useClient } from '../contexts/ClientContext';
import type { SortMode } from '../lib/types';
import {
  GLASS_CARD,
  ROW_HEIGHT,
  OVERSCAN,
  CONTAINER_MAX_H,
  VIRTUAL_THRESHOLD,
  useDebounce,
  getItemCategory,
  matchesSearch,
  getSortPrice,
  findMinPriceIndices,
} from '../lib/utils';

export default function DataTable() {
  const { data, loadError } = useClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Toate');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [scrollTop, setScrollTop] = useState(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveCategory('Toate');
    setSearchQuery('');
    setSortMode('default');
    setScrollTop(0);
    if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
  }, [data]);

  useEffect(() => {
    setScrollTop(0);
    if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
  }, [activeCategory, sortMode]);

  const isNational = useMemo(
    () =>
      data.length > 0 &&
      (Object.prototype.hasOwnProperty.call(data[0], 'nume_sursa') ||
        Object.prototype.hasOwnProperty.call(data[0], 'pret_mediu_national')),
    [data],
  );

  const hasDetailedPizzaRows = useMemo(
    () =>
      data.length > 0 &&
      Object.prototype.hasOwnProperty.call(data[0], 'margherita') &&
      Object.prototype.hasOwnProperty.call(data[0], 'diavola') &&
      Object.prototype.hasOwnProperty.call(data[0], 'quattro_formaggi'),
    [data],
  );

  const debouncedSearch = useDebounce(searchQuery, 300);

  const categories = useMemo(() => {
    if (data.length === 0) return [];
    const cats = new Set<string>();
    for (const item of data) {
      cats.add(getItemCategory(item, hasDetailedPizzaRows, isNational));
    }
    return Array.from(cats).sort();
  }, [data, hasDetailedPizzaRows, isNational]);

  const processedData = useMemo(() => {
    let result = data;
    if (activeCategory !== 'Toate') {
      result = result.filter(
        (item) => getItemCategory(item, hasDetailedPizzaRows, isNational) === activeCategory,
      );
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((item) => matchesSearch(item, q));
    }
    if (sortMode === 'profit_desc') {
      result = [...result].sort(
        (a, b) =>
          getSortPrice(b, hasDetailedPizzaRows, isNational) -
          getSortPrice(a, hasDetailedPizzaRows, isNational),
      );
    } else if (sortMode === 'price_diff') {
      const prices = result
        .map((item) => getSortPrice(item, hasDetailedPizzaRows, isNational))
        .filter((p) => p !== Infinity);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      result = [...result].sort((a, b) => {
        const diffA = getSortPrice(a, hasDetailedPizzaRows, isNational) - minPrice;
        const diffB = getSortPrice(b, hasDetailedPizzaRows, isNational) - minPrice;
        return diffB - diffA;
      });
    }
    return result;
  }, [data, activeCategory, debouncedSearch, sortMode, hasDetailedPizzaRows, isNational]);

  const priceLeaders = useMemo(() => {
    if (hasDetailedPizzaRows) {
      return {
        margherita: findMinPriceIndices(processedData, 'margherita'),
        diavola: findMinPriceIndices(processedData, 'diavola'),
        quattro: findMinPriceIndices(processedData, 'quattro_formaggi'),
      };
    }
    if (isNational) {
      return { price: findMinPriceIndices(processedData, 'pret_mediu_national') };
    }
    const priceKey =
      processedData.length > 0
        ? processedData[0]['Preț'] != null
          ? 'Preț'
          : processedData[0].pret != null
            ? 'pret'
            : 'price'
        : 'price';
    return { price: findMinPriceIndices(processedData, priceKey) };
  }, [processedData, hasDetailedPizzaRows, isNational]);

  const colCount = hasDetailedPizzaRows ? 7 : isNational ? 3 : 4;

  const { virtualRows, topSpacer, bottomSpacer, virtualStartIdx } = useMemo(() => {
    const total = processedData.length;
    if (total <= VIRTUAL_THRESHOLD) {
      return { virtualRows: processedData, topSpacer: 0, bottomSpacer: 0, virtualStartIdx: 0 };
    }
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(total, Math.ceil((scrollTop + CONTAINER_MAX_H) / ROW_HEIGHT) + OVERSCAN);
    return {
      virtualRows: processedData.slice(start, end),
      topSpacer: start * ROW_HEIGHT,
      bottomSpacer: Math.max(0, (total - end) * ROW_HEIGHT),
      virtualStartIdx: start,
    };
  }, [processedData, scrollTop]);

  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <section className={`${GLASS_CARD} overflow-hidden`}>
      {/* Toolbar: Search + Sort */}
      <div className="flex flex-col gap-3 border-b border-apple-border/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-apple-muted/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Caută produse, competitori..."
            className="w-full rounded-xl border border-apple-border bg-white/80 py-2.5 pl-10 pr-9 text-sm text-apple-text transition-all placeholder:text-apple-muted/50 focus:border-apple-gold focus:ring-2 focus:ring-apple-gold/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-apple-muted/60 transition-colors hover:text-apple-text"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-apple-muted/60" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="appearance-none rounded-xl border border-apple-border bg-white/80 py-2 pl-9 pr-8 text-sm text-apple-text transition-all focus:border-apple-gold focus:ring-2 focus:ring-apple-gold/20"
            >
              <option value="default">Implicit</option>
              <option value="profit_desc">Cel mai mare preț</option>
              <option value="price_diff">Diferență preț</option>
            </select>
          </div>
          <span className="whitespace-nowrap text-xs text-apple-muted">
            {processedData.length} / {data.length} produse
          </span>
        </div>
      </div>

      {/* Category Tabs */}
      {categories.length > 1 && (
        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto border-b border-apple-border/20 px-6 py-3">
          <button
            onClick={() => setActiveCategory('Toate')}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              activeCategory === 'Toate'
                ? 'bg-apple-text text-white shadow-glass'
                : 'bg-apple-bg/60 text-apple-muted hover:bg-apple-bg hover:text-apple-text'
            }`}
          >
            Toate
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-apple-text text-white shadow-glass'
                  : 'bg-apple-bg/60 text-apple-muted hover:bg-apple-bg hover:text-apple-text'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Virtualized Table */}
      <div
        ref={tableContainerRef}
        onScroll={processedData.length > VIRTUAL_THRESHOLD ? handleTableScroll : undefined}
        className="overflow-x-auto"
        style={
          processedData.length > VIRTUAL_THRESHOLD
            ? { maxHeight: CONTAINER_MAX_H, overflowY: 'auto' }
            : undefined
        }
      >
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
            <tr className="border-b border-apple-border/60">
              {hasDetailedPizzaRows ? (
                <>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-apple-muted">Platformă</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-apple-muted">Competitor</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-apple-muted">Margherita</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-apple-muted">Diavola</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-apple-muted">Quattro Formaggi</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-apple-muted">Taxă livrare</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-apple-muted">Data</th>
                </>
              ) : (
                <>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-apple-muted">
                    {isNational ? 'Sursă' : 'Produs / Platformă'}
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-apple-muted">
                    {isNational ? 'Preț mediu' : 'Preț'}
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-apple-muted">
                    {isNational ? 'Status stoc' : 'Timp livrare'}
                  </th>
                  {!isNational && (
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-apple-muted">Data</th>
                  )}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {topSpacer > 0 && (
              <tr style={{ height: topSpacer }} aria-hidden>
                <td colSpan={colCount} />
              </tr>
            )}

            {virtualRows.map((item, localIdx) => {
              const globalIdx = virtualStartIdx + localIdx;
              return (
                <tr
                  key={`${String(item.nume_sursa || item.produs || item.Produs || 'row')}-${globalIdx}`}
                  className="border-b border-apple-border/20 transition-colors last:border-b-0 hover:bg-apple-gold/[0.03]"
                  style={{ height: ROW_HEIGHT }}
                >
                  {hasDetailedPizzaRows ? (
                    <>
                      <td className="px-6 py-4 text-sm text-apple-muted">{String(item.platforma || '-')}</td>
                      <td className="px-6 py-4 text-sm font-medium text-apple-text">{String(item.competitor || '-')}</td>
                      <td className={`px-6 py-4 text-sm font-semibold ${priceLeaders.margherita?.has(globalIdx) ? 'text-apple-gold' : 'text-apple-text'}`}>
                        {String(item.margherita || '-')}
                      </td>
                      <td className={`px-6 py-4 text-sm font-semibold ${priceLeaders.diavola?.has(globalIdx) ? 'text-apple-gold' : 'text-apple-text'}`}>
                        {String(item.diavola || '-')}
                      </td>
                      <td className={`px-6 py-4 text-sm font-semibold ${priceLeaders.quattro?.has(globalIdx) ? 'text-apple-gold' : 'text-apple-text'}`}>
                        {String(item.quattro_formaggi || '-')}
                      </td>
                      <td className="px-6 py-4 text-sm text-apple-muted">{String(item.taxa_livrare || '-')}</td>
                      <td className="px-6 py-4 text-sm text-apple-muted">
                        {String(item['Data Verificării'] || item.data || item.date || item.timestamp || '-')}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 text-sm font-medium text-apple-text">
                        {String(item.nume_sursa || item.Produs || item.produs || item.product || '-')}
                      </td>
                      <td className={`px-6 py-4 text-sm font-semibold ${priceLeaders.price?.has(globalIdx) ? 'text-apple-gold' : 'text-apple-text'}`}>
                        {String(item.pret_mediu_national || item['Preț'] || item.pret || item.price || '-')}
                      </td>
                      <td className="px-6 py-4 text-sm text-apple-muted">
                        {String(item.stoc_status || item.timp_livrare || '-')}
                      </td>
                      {!isNational && (
                        <td className="px-6 py-4 text-sm text-apple-muted">
                          {String(item['Data Verificării'] || item.data || item.date || item.timestamp || '-')}
                        </td>
                      )}
                    </>
                  )}
                </tr>
              );
            })}

            {bottomSpacer > 0 && (
              <tr style={{ height: bottomSpacer }} aria-hidden>
                <td colSpan={colCount} />
              </tr>
            )}

            {processedData.length === 0 && (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-6 py-16 text-center text-sm text-apple-muted"
                >
                  {loadError
                    ? loadError
                    : debouncedSearch || activeCategory !== 'Toate'
                      ? 'Niciun rezultat pentru filtrele selectate.'
                      : 'Nu există date disponibile pentru acest client.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
