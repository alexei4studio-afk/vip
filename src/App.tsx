import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState<any[]>([]);
  const [clientName, setClientName] = useState<string>('');
  const [config, setConfig] = useState<any>(null);
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 1. Fetch config.json on mount
  useEffect(() => {
    fetch('/config.json')
      .then(res => res.json())
      .then(cfg => {
        setConfig(cfg);
        // Check local storage for existing token
        const savedToken = localStorage.getItem('azisunt_token');
        if (savedToken) {
          authenticateWithToken(savedToken, cfg);
        }
      })
      .catch(err => console.error("Nu am putut încărca setările:", err));
  }, []);

  const authenticateWithToken = (token: string, cfg: any) => {
    if (!cfg || !cfg.clients) return;
    
    // Find matching client by access_token
    const client = cfg.clients.find((c: any) => c.access_token === token);
    
    if (client) {
      setIsAuthenticated(true);
      setClientName(client.name);
      localStorage.setItem('azisunt_token', token);
      loadClientData(client);
    } else {
      setErrorMsg('Acces neautorizat. Contactați azisunt.net');
    }
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
    setTokenInput('');
  };

  const loadClientData = (client: any) => {
    let jsonPath = '';
    if (client.type === 'national') {
      jsonPath = '/data/national_business.json';
    } else {
      // Normalize client name for filename
      const baseName = client.id || client.name.toLowerCase().replace(/ /g, '_');
      jsonPath = `/data/client_${baseName}.json`;
    }

    fetch(jsonPath)
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        let items = [];
        if (Array.isArray(data)) {
          items = data;
        } else if (data.items) {
          items = data.items;
        } else if (data.prices) {
          items = data.prices;
        } else if (data.regiuni) {
          items = data.regiuni;
        }
        setData(items);
      })
      .catch(err => {
        console.error("Failed to fetch prices:", err);
        setData([]); 
      });
  };

  // Determine headers based on whether we have national or local data
  const isNational = data.length > 0 && data[0].hasOwnProperty('nume_sursa');

  // --- Render Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="bg-slate-800 p-8 md:p-12 rounded-2xl shadow-2xl border border-slate-700 max-w-md w-full">
          <h1 className="text-3xl font-extrabold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
            Acces Platformă
          </h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor="token">
                Cod de Acces (Token)
              </label>
              <input
                id="token"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg py-3 px-4 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                placeholder="Introdu codul tău..."
                required
              />
            </div>
            {errorMsg && (
              <p className="text-red-400 text-sm font-medium text-center bg-red-400/10 py-2 rounded-md">
                {errorMsg}
              </p>
            )}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all transform hover:scale-105"
            >
              Intră în Dashboard
            </button>
          </form>
          <p className="text-slate-500 text-xs text-center mt-8">
            &copy; 2026 azisunt.net. Toate drepturile rezervate.
          </p>
        </div>
      </div>
    );
  }

  // --- Render Dashboard ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 drop-shadow-sm">
              Dashboard Monitorizare AI
            </h1>
            <h2 className="text-xl text-slate-400 capitalize">
              Client: <span className="text-slate-200 font-semibold">{clientName.replace('_', ' ')}</span>
            </h2>
          </div>
          <button 
            onClick={handleLogout}
            className="mt-6 md:mt-0 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-6 rounded-full border border-slate-700 transition-colors"
          >
            Deconectare
          </button>
        </div>
        
        <div className="overflow-x-auto bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/40 text-slate-300 text-xs md:text-sm uppercase tracking-widest">
                <th className="p-5 font-semibold border-b border-slate-700/50">
                  {isNational ? 'Sursă' : 'Produs / Nume'}
                </th>
                <th className="p-5 font-semibold border-b border-slate-700/50">Preț</th>
                <th className="p-5 font-semibold border-b border-slate-700/50">
                  {isNational ? 'Status Stoc' : 'Timp Livrare / Data'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data.map((item, index) => (
                <tr key={index} className="hover:bg-slate-750 transition-all duration-200 ease-in-out group">
                  <td className="p-5 text-slate-200 font-medium group-hover:text-cyan-300 transition-colors">
                    {item.nume_sursa || item.Produs || item.produs || item.product || '-'}
                  </td>
                  <td className="p-5 text-emerald-400 font-bold tracking-wide">
                    {item.pret_mediu_national || item['Preț'] || item.pret || item.price || '-'}
                  </td>
                  <td className="p-5 text-slate-400 text-sm font-light">
                    {item.stoc_status || item.timp_livrare || item['Data Verificării'] || item.data || item.date || item.timestamp || '-'}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-12 text-center text-slate-500 italic">
                    Nu s-au găsit date încă sau acestea se încarcă... Așteaptă rularea IA.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
