import { Activity } from 'lucide-react';
import { useClient } from '../contexts/ClientContext';
import { GLASS_CARD } from '../lib/utils';

export default function LiveStatus() {
  const { isReportRunning, reportLogs } = useClient();

  return (
    <section className={`${GLASS_CARD} mt-6 p-6`}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-apple-bg">
          <Activity className="h-4 w-4 text-apple-muted" />
          {isReportRunning && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-apple-gold" />
          )}
        </div>
        <h2 className="text-base font-semibold text-apple-text">Status Activitate</h2>
        {isReportRunning && (
          <span className="rounded-full bg-apple-gold/10 px-3 py-0.5 text-xs font-medium text-apple-gold">
            Live
          </span>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto rounded-xl border border-apple-border/30 bg-apple-bg/60 p-4">
        {reportLogs.length === 0 ? (
          <p className="text-sm text-apple-muted">Niciun eveniment înregistrat.</p>
        ) : (
          <div className="space-y-1.5">
            {reportLogs.map((line, index) => (
              <p
                key={`${line}-${index}`}
                className="whitespace-pre-wrap break-words text-xs leading-relaxed text-apple-text/60"
              >
                <span className="mr-2 text-apple-muted/40">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
