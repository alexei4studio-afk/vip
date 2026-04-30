import { useState } from 'react';
import { Search, Check, Plus } from 'lucide-react';
import { useClient } from '../contexts/ClientContext';
import { GLASS_CARD } from '../lib/utils';

export default function DiscoverySection() {
  const {
    discoverySuggestions,
    isDiscoveryRunning,
    activeClient,
    addSource,
    setReportMsg,
  } = useClient();

  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());

  const existingSources = new Set(activeClient?.sources || []);

  const handleMonitor = (url: string) => {
    const result = addSource(url);
    if (result.error) {
      setReportMsg(result.error);
    } else {
      setAddedUrls((prev) => new Set(prev).add(url));
    }
  };

  const platformColor: Record<string, string> = {
    glovo: 'bg-yellow-100 text-yellow-800',
    wolt: 'bg-blue-100 text-blue-800',
    tazz: 'bg-orange-100 text-orange-800',
    bolt: 'bg-green-100 text-green-800',
  };

  const getBadgeClass = (platform: string) => {
    const key = platform.toLowerCase().replace(/\s+/g, '');
    for (const [k, v] of Object.entries(platformColor)) {
      if (key.includes(k)) return v;
    }
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <section className={`${GLASS_CARD} mt-6 p-6`}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
          <Search className="h-4 w-4 text-cyan-600" />
        </div>
        <h2 className="text-base font-semibold text-apple-text">Sugestii Competitori</h2>
        {isDiscoveryRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-cyan-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
            Se caută...
          </span>
        )}
      </div>

      {discoverySuggestions.length === 0 && !isDiscoveryRunning && (
        <p className="text-sm text-apple-muted">
          Nu au fost descoperite sugestii. Apasă „Descoperă Competitori Noi" pentru a căuta.
        </p>
      )}

      {discoverySuggestions.length > 0 && (
        <div className="space-y-2">
          {discoverySuggestions.map((suggestion) => {
            const alreadyMonitored = existingSources.has(suggestion.url) || addedUrls.has(suggestion.url);

            return (
              <div
                key={suggestion.url}
                className="flex items-center gap-3 rounded-xl border border-apple-border/30 bg-apple-bg/50 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-apple-text">{suggestion.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getBadgeClass(suggestion.platform)}`}>
                      {suggestion.platform}
                    </span>
                    {suggestion.category && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                        {suggestion.category}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-apple-muted">{suggestion.url}</p>
                </div>

                {alreadyMonitored ? (
                  <span className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-emerald-600">
                    <Check className="h-3.5 w-3.5" />
                    Adăugat
                  </span>
                ) : (
                  <button
                    onClick={() => handleMonitor(suggestion.url)}
                    className="flex items-center gap-1 whitespace-nowrap rounded-full border border-apple-gold/50 px-3 py-1.5 text-xs font-semibold text-apple-gold transition-all hover:bg-apple-gold hover:text-white active:scale-[0.97]"
                  >
                    <Plus className="h-3 w-3" />
                    Monitorizează
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
