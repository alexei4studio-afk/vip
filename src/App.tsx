import { useEffect, useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';

type ClientConfig = {
  id?: string;
  name: string;
  access_token: string;
  type: 'local' | 'national';
};

type AppConfig = {
  clients: ClientConfig[];
};

type DataRecord = Record<string, string | number | null | undefined>;

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

  useEffect(() => {
    fetch('/config.json')
      .then((res) => res.json())
      .then((cfg: AppConfig) => {
        setConfig(cfg);
        const savedToken = localStorage.getItem('azisunt_token');
        if (savedToken) {
          authenticateWithToken(savedToken, cfg);
        }
      })
      .catch(() => {
        setErrorMsg('Configurația nu a putut fi încărcată.');
      });
  }, []);

  const loadClientData = (client: ClientConfig) => {
    const jsonPath =
      client.type === 'national'
        ? '/data/national_business.json'
        : `/data/client_${(client.id || client.name.toLowerCase().replace(/ /g, '_')).trim()}.json`;

    fetch(jsonPath)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Data fetch failed');
        }
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
    setData([]);
    setStrategies([]);
    setTokenInput('');
    setLoadError('');
  };

  const isNational = useMemo(
    () =>
      data.length > 0 &&
      (Object.prototype.hasOwnProperty.call(data[0], 'nume_sursa') ||
        Object.prototype.hasOwnProperty.call(data[0], 'pret_mediu_national')),
    [data]
  );

  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-10 font-sans">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_80%_90%,_rgba(99,102,241,0.18),transparent_40%)]" />
        <div
          className={`relative z-10 w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center shadow-2xl backdrop-blur transition-opacity duration-300 md:p-10 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-6xl">
            Market Intelligence AI
          </h1>
          <p className="mt-4 text-base text-slate-300 md:text-lg">
            Monitorizare strategică și analiză competitivă în timp real
          </p>

          <form onSubmit={handleLogin} className="mx-auto mt-10 max-w-sm space-y-4 text-left">
            <label htmlFor="accessCode" className="block text-sm font-medium text-slate-300">
              Cod Acces Client
            </label>
            <input
              id="accessCode"
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
              placeholder="Introduceți codul de acces"
              required
            />
            {errorMsg && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {errorMsg}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Intră în Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100 md:px-10 md:py-10">
      <div className="mx-auto max-w-6xl">
        <header
          className={`mb-8 flex flex-col gap-4 border-b border-slate-800 pb-6 transition-opacity duration-500 md:flex-row md:items-end md:justify-between ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div>
            <h1 className="text-3xl font-bold text-white md:text-4xl">Market Intelligence AI</h1>
            <p className="mt-2 text-sm text-slate-400 md:text-base">
              Dashboard client: <span className="font-semibold text-slate-200">{clientName}</span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-fit rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
          >
            Deconectare
          </button>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-slate-900/90 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-semibold">
                    {isNational ? 'Sursă' : 'Produs / Platformă'}
                  </th>
                  <th className="px-6 py-4 font-semibold">{isNational ? 'Preț mediu' : 'Preț'}</th>
                  <th className="px-6 py-4 font-semibold">
                    {isNational ? 'Status stoc' : 'Timp livrare'}
                  </th>
                  {!isNational && <th className="px-6 py-4 font-semibold">Data verificării</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr
                    key={`${String(item.nume_sursa || item.produs || item.Produs || 'row')}-${index}`}
                    className={`border-t border-slate-800 text-sm transition-colors hover:bg-slate-800/60 ${
                      index % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/60'
                    }`}
                  >
                    <td className="px-6 py-4 font-medium text-slate-100">
                      {String(item.nume_sursa || item.Produs || item.produs || item.product || '-')}
                    </td>
                    <td className="px-6 py-4 font-semibold text-emerald-400">
                      {String(item.pret_mediu_national || item['Preț'] || item.pret || item.price || '-')}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {String(item.stoc_status || item.timp_livrare || '-')}
                    </td>
                    {!isNational && (
                      <td className="px-6 py-4 text-slate-400">
                        {String(item['Data Verificării'] || item.data || item.date || item.timestamp || '-')}
                      </td>
                    )}
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td
                      colSpan={isNational ? 3 : 4}
                      className="px-6 py-10 text-center text-sm italic text-slate-400"
                    >
                      {loadError || 'Nu există date disponibile pentru acest client.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-300" />
            <h2 className="text-lg font-semibold text-white">Strategie AI</h2>
          </div>
          {strategies.length > 0 ? (
            <ul className="space-y-3 text-sm text-slate-200">
              {strategies.map((strategy, index) => (
                <li key={`${strategy.slice(0, 20)}-${index}`} className="rounded-lg bg-slate-800/70 p-3">
                  {strategy}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">
              Momentan nu există recomandări strategice pentru acest client.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
