import { useEffect, useMemo, useState } from 'react';
import { Lightbulb, LogOut, Play, FileDown, Plus, Globe, Archive, Activity } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ClientConfig = {
  id?: string;
  name: string;
  access_token: string;
  type: 'local' | 'national';
  sources?: string[];
};

type AppConfig = {
  clients: ClientConfig[];
};

type DataRecord = Record<string, string | number | null | undefined>;
type ArchivedReport = {
  name: string;
  modified_at: number;
};

function parsePrice(value: string | number | null | undefined): number {
  if (value == null) return Infinity;
  const str = String(value).replace(/[^\d,.\-]/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? Infinity : num;
}

function findMinPriceIndices(data: DataRecord[], key: string): Set<number> {
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

const GLASS_CARD =
  'rounded-apple border border-apple-border/40 bg-white/70 backdrop-blur-[20px] shadow-glass-lg';

function App() {
  const [data, setData] = useState<DataRecord[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [clientName, setClientName] = useState('');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [activeClient, setActiveClient] = useState<ClientConfig | null>(null);
  const [activeToken, setActiveToken] = useState('');
  const [sourceInput, setSourceInput] = useState('');
  const [reportMsg, setReportMsg] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportLogs, setReportLogs] = useState<string[]>([]);
  const [isReportRunning, setIsReportRunning] = useState(false);
  const [archivedReports, setArchivedReports] = useState<ArchivedReport[]>([]);

  const apiBaseUrl = `${window.location.protocol}//${window.location.hostname}:5000`;

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/config`)
      .then((res) => res.json())
      .then((cfg: AppConfig) => {
        setConfig(cfg);
        const savedToken = localStorage.getItem('azisunt_token');
        if (savedToken) {
          authenticateWithToken(savedToken, cfg);
        }
      })
      .catch(() => {
        fetch('/config.json')
          .then((res) => res.json())
          .then((cfg: AppConfig) => {
            setConfig(cfg);
          })
          .catch(() => setErrorMsg('Configurația nu a putut fi încărcată.'));
      });
  }, [apiBaseUrl]);

  const loadClientData = (client: ClientConfig) => {
    const jsonPath =
      client.type === 'national'
        ? '/data/national_business.json'
        : `/data/client_${(client.id || client.name.toLowerCase().replace(/ /g, '_')).trim()}.json`;

    fetch(jsonPath)
      .then((res) => {
        if (!res.ok) throw new Error('Data fetch failed');
        return res.json();
      })
      .then((payload: Record<string, unknown>) => {
        let items: DataRecord[] = [];
        if (Array.isArray(payload)) {
          items = payload as DataRecord[];
        } else if (Array.isArray(payload.items)) {
          items = payload.items as DataRecord[];
        } else if (Array.isArray(payload.prices)) {
          items = payload.prices as DataRecord[];
        } else if (Array.isArray(payload.regiuni)) {
          items = payload.regiuni as DataRecord[];
        }

        const aiStrategies = Array.isArray(payload.strategii)
          ? (payload.strategii.filter((value) => typeof value === 'string') as string[])
          : [];

        setData(items);
        setStrategies(aiStrategies);
        setLoadError('');
      })
      .catch(() => {
        setData([]);
        setStrategies([]);
        setLoadError('Datele clientului nu au putut fi încărcate.');
      });
  };

  const authenticateWithToken = (token: string, cfg: AppConfig | null) => {
    if (!cfg || !Array.isArray(cfg.clients)) {
      setErrorMsg('Configurația de acces nu este disponibilă.');
      return;
    }

    const client = cfg.clients.find((entry) => entry.access_token === token.trim());
    if (!client) {
      setErrorMsg('Cod de acces invalid. Verifică și încearcă din nou.');
      return;
    }

    setIsTransitioning(true);
    setErrorMsg('');
    setClientName(client.name);
    setActiveClient(client);
    setActiveToken(token.trim());
    localStorage.setItem('azisunt_token', token.trim());
    loadClientData(client);

    window.setTimeout(() => {
      setIsAuthenticated(true);
      setIsTransitioning(false);
    }, 280);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    authenticateWithToken(tokenInput, config);
  };

  const handleLogout = () => {
    localStorage.removeItem('azisunt_token');
    setIsAuthenticated(false);
    setClientName('');
    setActiveClient(null);
    setActiveToken('');
    setData([]);
    setStrategies([]);
    setTokenInput('');
    setLoadError('');
    setReportMsg('');
  };

  const saveSourcesToClient = (sources: string[]) => {
    if (!config || !activeClient) return;

    const nextClients = config.clients.map((client) =>
      client.access_token === activeClient.access_token ? { ...client, sources } : client
    );
    const nextConfig: AppConfig = { ...config, clients: nextClients };

    fetch(`${apiBaseUrl}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextConfig),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Save failed');
        const updatedClient =
          nextClients.find((client) => client.access_token === activeClient.access_token) || null;
        setConfig(nextConfig);
        setActiveClient(updatedClient);
        setReportMsg('Sursele au fost salvate.');
      })
      .catch(() => setReportMsg('Nu am putut salva sursele.'));
  };

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = sourceInput.trim();
    if (!trimmedUrl || !activeClient) {
      setReportMsg('Introdu un URL valid.');
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmedUrl);
    } catch {
      setReportMsg('URL invalid.');
      return;
    }
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('glovo') && !host.includes('wolt')) {
      setReportMsg('Permise doar URL-uri Glovo sau Wolt.');
      return;
    }
    const currentSources = activeClient.sources || [];
    if (currentSources.includes(trimmedUrl)) {
      setReportMsg('Sursa există deja.');
      return;
    }
    saveSourcesToClient([...currentSources, trimmedUrl]);
    setSourceInput('');
  };

  const triggerReport = (force = false) => {
    if (!activeToken) {
      setReportMsg('Token client indisponibil.');
      return;
    }
    setIsGeneratingReport(true);
    setReportMsg('');
    fetch(`${apiBaseUrl}/api/start-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: activeToken, force }),
    })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'Run failed');
        if (payload.requires_confirmation) {
          const confirmRun = window.confirm(
            payload.message || 'Datele sunt recente. Sigur vrei o actualizare nouă?'
          );
          if (confirmRun) {
            triggerReport(true);
          } else {
            setReportMsg('Actualizarea a fost anulată.');
          }
          return;
        }
        setReportMsg('Raportul a fost pornit pentru clientul curent.');
        setReportLogs([]);
        setIsReportRunning(true);
      })
      .catch((err) => setReportMsg(err.message || 'Nu am putut porni generarea raportului.'))
      .finally(() => setIsGeneratingReport(false));
  };

  const handleGenerateReport = () => triggerReport(false);

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const generatedDate = new Date().toLocaleString('ro-RO');
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(245, 245, 247);
    doc.rect(0, 0, pageWidth, 50, 'F');

    doc.setFillColor(212, 175, 55);
    doc.rect(14, 42, pageWidth - 28, 0.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(29, 29, 31);
    doc.text(clientName, 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(134, 134, 139);
    doc.text('Business Intelligence Report', 14, 30);
    doc.text(generatedDate, 14, 37);

    doc.setFontSize(9);
    doc.setTextColor(212, 175, 55);
    doc.text('AZISUNT.VIP', pageWidth - 14, 22, { align: 'right' });

    const columns = hasDetailedPizzaRows
      ? ['Platforma', 'Competitor', 'Margherita', 'Diavola', 'Quattro Formaggi', 'Taxa livrare']
      : isNational
        ? ['Sursa', 'Pret mediu', 'Status stoc']
        : ['Produs / Platforma', 'Pret', 'Timp livrare', 'Data'];

    const priceKeys = hasDetailedPizzaRows
      ? ['margherita', 'diavola', 'quattro_formaggi']
      : isNational
        ? ['pret_mediu_national']
        : ['Preț', 'pret', 'price'];

    const minSets = priceKeys.map((key) => findMinPriceIndices(data, key));

    const body = data.map((item, rowIdx) => {
      if (hasDetailedPizzaRows) {
        return [
          String(item.platforma || '-'),
          String(item.competitor || '-'),
          String(item.margherita || '-'),
          String(item.diavola || '-'),
          String(item.quattro_formaggi || '-'),
          String(item.taxa_livrare || '-'),
        ].map((val, colIdx) => {
          if (colIdx >= 2 && colIdx <= 4 && minSets[colIdx - 2]?.has(rowIdx)) {
            return { content: val, styles: { textColor: [212, 175, 55] as [number, number, number], fontStyle: 'bold' as const } };
          }
          return val;
        });
      }
      if (isNational) {
        return [
          String(item.nume_sursa || '-'),
          String(item.pret_mediu_national || '-'),
          String(item.stoc_status || '-'),
        ].map((val, colIdx) => {
          if (colIdx === 1 && minSets[0]?.has(rowIdx)) {
            return { content: val, styles: { textColor: [212, 175, 55] as [number, number, number], fontStyle: 'bold' as const } };
          }
          return val;
        });
      }
      const priceVal = String(item['Preț'] || item.pret || item.price || '-');
      const isLeader = minSets.some((s) => s.has(rowIdx));
      return [
        String(item.nume_sursa || item.Produs || item.produs || item.product || '-'),
        isLeader
          ? { content: priceVal, styles: { textColor: [212, 175, 55] as [number, number, number], fontStyle: 'bold' as const } }
          : priceVal,
        String(item.timp_livrare || '-'),
        String(item['Data Verificării'] || item.data || item.date || item.timestamp || '-'),
      ];
    });

    autoTable(doc, {
      head: [columns],
      body,
      startY: 52,
      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor: [210, 210, 215],
        lineWidth: 0,
        textColor: [29, 29, 31],
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [29, 29, 31],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
      },
    });

    let nextY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 52;
    nextY += 14;

    doc.setFillColor(212, 175, 55);
    doc.rect(14, nextY - 4, 3, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(29, 29, 31);
    doc.text('Recomandari Strategice', 20, nextY + 4);
    nextY += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 67);
    const strategyLines = strategies.length > 0 ? strategies : ['Nu exista recomandari disponibile.'];
    strategyLines.forEach((line, i) => {
      const bullet = `${i + 1}. ${line}`;
      const wrapped = doc.splitTextToSize(bullet, pageWidth - 34);
      doc.text(wrapped, 20, nextY);
      nextY += wrapped.length * 5.5;
    });

    nextY += 8;
    doc.setDrawColor(210, 210, 215);
    doc.line(14, nextY, pageWidth - 14, nextY);
    nextY += 8;
    doc.setFontSize(7);
    doc.setTextColor(134, 134, 139);
    doc.text('Generat automat de AZISUNT.VIP Business Intelligence', 14, nextY);
    doc.text('Confidential', pageWidth - 14, nextY, { align: 'right' });

    doc.save(`raport_${clientName.replace(/\s+/g, '_').toLowerCase()}.pdf`);
  };

  const fetchArchives = () => {
    if (!activeToken) return;
    fetch(`${apiBaseUrl}/api/exports?access_token=${encodeURIComponent(activeToken)}`)
      .then((res) => res.json())
      .then((payload) => {
        setArchivedReports(Array.isArray(payload.exports) ? payload.exports : []);
      })
      .catch(() => setArchivedReports([]));
  };

  useEffect(() => {
    if (!activeToken) return;
    const timer = window.setInterval(() => {
      fetch(`${apiBaseUrl}/api/report-status?access_token=${encodeURIComponent(activeToken)}`)
        .then((res) => res.json())
        .then((status) => {
          setIsReportRunning(Boolean(status.running));
          setReportLogs(Array.isArray(status.logs) ? status.logs : []);
        })
        .catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeToken, apiBaseUrl]);

  useEffect(() => {
    fetchArchives();
  }, [activeToken]);

  useEffect(() => {
    if (!isReportRunning && activeToken) {
      fetchArchives();
    }
  }, [isReportRunning, activeToken]);

  const isNational = useMemo(
    () =>
      data.length > 0 &&
      (Object.prototype.hasOwnProperty.call(data[0], 'nume_sursa') ||
        Object.prototype.hasOwnProperty.call(data[0], 'pret_mediu_national')),
    [data]
  );

  const hasDetailedPizzaRows = useMemo(
    () =>
      data.length > 0 &&
      Object.prototype.hasOwnProperty.call(data[0], 'margherita') &&
      Object.prototype.hasOwnProperty.call(data[0], 'diavola') &&
      Object.prototype.hasOwnProperty.call(data[0], 'quattro_formaggi'),
    [data]
  );

  const priceLeaders = useMemo(() => {
    if (hasDetailedPizzaRows) {
      return {
        margherita: findMinPriceIndices(data, 'margherita'),
        diavola: findMinPriceIndices(data, 'diavola'),
        quattro: findMinPriceIndices(data, 'quattro_formaggi'),
      };
    }
    if (isNational) {
      return { price: findMinPriceIndices(data, 'pret_mediu_national') };
    }
    const priceKey = data.length > 0
      ? (data[0]['Preț'] != null ? 'Preț' : data[0].pret != null ? 'pret' : 'price')
      : 'price';
    return { price: findMinPriceIndices(data, priceKey) };
  }, [data, hasDetailedPizzaRows, isNational]);

  // ─── LOGIN SCREEN ───
  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-apple-bg px-6 py-10 font-sans">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-apple-gold/[0.06] blur-3xl" />
          <div className="absolute -bottom-48 -left-32 h-[600px] w-[600px] rounded-full bg-apple-gold/[0.04] blur-3xl" />
        </div>

        <div
          className={`relative z-10 w-full max-w-md rounded-apple border border-apple-border/40 bg-white/70 p-10 text-center shadow-glass-xl backdrop-blur-[20px] transition-opacity duration-300 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-apple-text">
            <Activity className="h-7 w-7 text-apple-gold" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-apple-text">
            Market Intelligence
          </h1>
          <p className="mt-2 text-sm text-apple-muted">
            Monitorizare strategică și analiză competitivă
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4 text-left">
            <div>
              <label htmlFor="accessCode" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-apple-muted">
                Cod Acces Client
              </label>
              <input
                id="accessCode"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-text transition-all placeholder:text-apple-muted/60 focus:border-apple-gold focus:ring-2 focus:ring-apple-gold/20"
                placeholder="Introduceți codul de acces"
                required
              />
            </div>
            {errorMsg && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                {errorMsg}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-full bg-apple-text px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-apple-text/90 active:scale-[0.98]"
            >
              Intră în Dashboard
            </button>
          </form>

          <p className="mt-6 text-[11px] text-apple-muted/60">
            AZISUNT.VIP &middot; Business Intelligence Platform
          </p>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ───
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
              Dashboard &middot; <span className="font-medium text-apple-text">{clientName}</span>
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

        {/* Data Table */}
        <section className={`${GLASS_CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
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
                {data.map((item, index) => (
                  <tr
                    key={`${String(item.nume_sursa || item.produs || item.Produs || 'row')}-${index}`}
                    className="border-b border-apple-border/20 transition-colors last:border-b-0 hover:bg-apple-gold/[0.03]"
                  >
                    {hasDetailedPizzaRows ? (
                      <>
                        <td className="px-6 py-4 text-sm text-apple-muted">{String(item.platforma || '-')}</td>
                        <td className="px-6 py-4 text-sm font-medium text-apple-text">{String(item.competitor || '-')}</td>
                        <td className={`px-6 py-4 text-sm font-semibold ${priceLeaders.margherita?.has(index) ? 'text-apple-gold' : 'text-apple-text'}`}>
                          {String(item.margherita || '-')}
                        </td>
                        <td className={`px-6 py-4 text-sm font-semibold ${priceLeaders.diavola?.has(index) ? 'text-apple-gold' : 'text-apple-text'}`}>
                          {String(item.diavola || '-')}
                        </td>
                        <td className={`px-6 py-4 text-sm font-semibold ${priceLeaders.quattro?.has(index) ? 'text-apple-gold' : 'text-apple-text'}`}>
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
                        <td className={`px-6 py-4 text-sm font-semibold ${priceLeaders.price?.has(index) ? 'text-apple-gold' : 'text-apple-text'}`}>
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
                ))}
                {data.length === 0 && (
                  <tr>
                    <td
                      colSpan={hasDetailedPizzaRows ? 7 : isNational ? 3 : 4}
                      className="px-6 py-16 text-center text-sm text-apple-muted"
                    >
                      {loadError || 'Nu există date disponibile pentru acest client.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* AI Strategy */}
        <section className={`${GLASS_CARD} mt-6 p-6`}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-apple-gold/10">
              <Lightbulb className="h-4 w-4 text-apple-gold" />
            </div>
            <h2 className="text-base font-semibold text-apple-text">Strategie AI</h2>
          </div>
          {strategies.length > 0 ? (
            <ul className="space-y-2.5">
              {strategies.map((strategy, index) => (
                <li
                  key={`${strategy.slice(0, 20)}-${index}`}
                  className="rounded-xl border border-apple-border/30 bg-apple-bg/50 px-4 py-3 text-sm leading-relaxed text-apple-text/80"
                >
                  {strategy}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-apple-muted">
              Momentan nu există recomandări strategice pentru acest client.
            </p>
          )}
        </section>

        {/* Sources Configuration */}
        <section className={`${GLASS_CARD} mt-6 p-6`}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-apple-gold/10">
              <Globe className="h-4 w-4 text-apple-gold" />
            </div>
            <h2 className="text-base font-semibold text-apple-text">Configurare Surse</h2>
          </div>
          <form onSubmit={handleAddSource} className="flex flex-col gap-3 md:flex-row">
            <input
              type="url"
              value={sourceInput}
              onChange={(e) => setSourceInput(e.target.value)}
              placeholder="URL Glovo / Wolt"
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

        {/* Live Status */}
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
                    <span className="mr-2 text-apple-muted/40">{String(index + 1).padStart(2, '0')}</span>
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Report Archive */}
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
                href={`${apiBaseUrl}/api/exports/${encodeURIComponent(report.name)}`}
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

        {/* Footer */}
        <footer className="mt-12 pb-6 text-center text-[11px] text-apple-muted/50">
          AZISUNT.VIP &middot; Business Intelligence Platform
        </footer>
      </div>
    </div>
  );
}

export default App;
