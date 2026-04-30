import { useState } from 'react';
import { Globe, Plus } from 'lucide-react';
import { useClient } from '../contexts/ClientContext';
import { GLASS_CARD } from '../lib/utils';

export default function SourcesSection() {
  const { activeClient, reportMsg, addSource, setReportMsg, hasDelivery } = useClient();
  const [sourceInput, setSourceInput] = useState('');

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addSource(sourceInput);
    if (result.error) {
      setReportMsg(result.error);
    } else {
      setSourceInput('');
    }
  };

  return (
    <section className={`${GLASS_CARD} mt-6 p-6`}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-apple-gold/10">
          <Globe className="h-4 w-4 text-apple-gold" />
        </div>
        <h2 className="text-base font-semibold text-apple-text">Configurare Surse</h2>
      </div>
      {hasDelivery && (
        <form onSubmit={handleAddSource} className="flex flex-col gap-3 md:flex-row">
          <input
            type="url"
            value={sourceInput}
            onChange={(e) => setSourceInput(e.target.value)}
            placeholder="URL Glovo / Wolt / Bolt Food / Tazz"
            className="flex-1 rounded-xl border border-apple-border bg-white px-4 py-2.5 text-sm text-apple-text transition-all placeholder:text-apple-muted/50 focus:border-apple-gold focus:ring-2 focus:ring-apple-gold/20"
            required
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-2 rounded-full bg-apple-text px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-apple-text/90 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Adaugă
          </button>
        </form>
      )}
      <div className="mt-4 space-y-2">
        {(activeClient?.sources || []).length === 0 && (
          <p className="text-sm text-apple-muted">Nu există surse configurate.</p>
        )}
        {(activeClient?.sources || []).map((sourceUrl) => (
          <div
            key={sourceUrl}
            className="rounded-xl border border-apple-border/30 bg-apple-bg/50 px-4 py-2.5 text-sm text-apple-text/70"
          >
            {sourceUrl}
          </div>
        ))}
      </div>
      {reportMsg && (
        <p className="mt-3 rounded-xl bg-apple-gold/5 px-4 py-2 text-sm text-apple-gold">
          {reportMsg}
        </p>
      )}
    </section>
  );
}
