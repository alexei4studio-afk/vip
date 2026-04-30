import { useNavigate } from 'react-router-dom';
import { LogOut, Play, FileDown } from 'lucide-react';
import { useClient } from '../contexts/ClientContext';
import { generateExecutivePdf } from '../lib/pdfReport';
import DataTable from './DataTable';
import StrategySection from './StrategySection';
import SourcesSection from './SourcesSection';
import LiveStatus from './LiveStatus';
import ArchiveSection from './ArchiveSection';

export default function DashboardPage() {
  const {
    clientName,
    isTransitioning,
    logout,
    data,
    strategies,
    isGeneratingReport,
    isReportRunning,
    triggerReport,
  } = useClient();

  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const handleGenerateReport = () => triggerReport(false);

  const handleDownloadPdf = () => {
    generateExecutivePdf(clientName, data, strategies);
  };

  return (
    <div className="min-h-screen bg-apple-bg px-4 py-6 font-sans text-apple-text sm:px-8 md:px-12 md:py-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header
          className={`mb-8 flex flex-col gap-4 transition-opacity duration-500 md:flex-row md:items-center md:justify-between ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-apple-text md:text-3xl">
              Market Intelligence
            </h1>
            <p className="mt-1 text-sm text-apple-muted">
              Dashboard &middot;{' '}
              <span className="font-medium text-apple-text">{clientName}</span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-fit items-center gap-2 rounded-full border border-apple-border px-5 py-2 text-sm text-apple-muted transition-all hover:border-apple-text hover:text-apple-text active:scale-[0.97]"
          >
            <LogOut className="h-4 w-4" />
            Deconectare
          </button>
        </header>

        {/* Action Bar */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleGenerateReport}
            disabled={isGeneratingReport || isReportRunning}
            className="flex items-center justify-center gap-2 rounded-full bg-apple-text px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-apple-text/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {isGeneratingReport || isReportRunning ? 'Se generează...' : 'Generează Raport'}
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center justify-center gap-2 rounded-full border-2 border-apple-gold px-6 py-2.5 text-sm font-semibold text-apple-gold transition-all hover:bg-apple-gold hover:text-white active:scale-[0.97]"
          >
            <FileDown className="h-4 w-4" />
            Descarcă Raport PDF
          </button>
        </div>

        <DataTable />
        <StrategySection />
        <SourcesSection />
        <LiveStatus />
        <ArchiveSection />

        {/* Footer */}
        <footer className="mt-12 pb-6 text-center text-[11px] text-apple-muted/50">
          AZISUNT.VIP &middot; Business Intelligence Platform
        </footer>
      </div>
    </div>
  );
}
