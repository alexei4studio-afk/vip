import { Archive } from 'lucide-react';
import { useClient } from '../contexts/ClientContext';
import { GLASS_CARD } from '../lib/utils';
import { getExportDownloadUrl } from '../lib/api';

export default function ArchiveSection() {
  const { archivedReports, activeToken } = useClient();

  return (
    <section className={`${GLASS_CARD} mt-6 p-6`}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-apple-gold/10">
          <Archive className="h-4 w-4 text-apple-gold" />
        </div>
        <h2 className="text-base font-semibold text-apple-text">Arhivă Rapoarte</h2>
      </div>
      <div className="space-y-2">
        {archivedReports.length === 0 && (
          <p className="text-sm text-apple-muted">Nu există rapoarte arhivate.</p>
        )}
        {archivedReports.map((report) => (
          <a
            key={report.name}
            href={getExportDownloadUrl(report.name, activeToken)}
            className="flex items-center justify-between rounded-xl border border-apple-border/30 bg-apple-bg/50 px-4 py-3 text-sm text-apple-text/70 transition-all hover:border-apple-gold/40 hover:bg-apple-gold/[0.03]"
          >
            <span className="font-medium text-apple-text">{report.name}</span>
            <span className="text-xs text-apple-muted">
              {new Date(report.modified_at * 1000).toLocaleString('ro-RO')}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
