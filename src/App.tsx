import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetch('/prices.json')
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        // Handle both array and object wrapping array
        const items = Array.isArray(data) ? data : (data.items || data.prices || []);
        setData(items);
      })
      .catch(err => console.error("Failed to fetch prices:", err));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-extrabold mb-10 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 drop-shadow-sm">
          Dashboard Monitorizare AI - azisunt.vip
        </h1>
        
        <div className="overflow-x-auto bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/40 text-slate-300 text-xs md:text-sm uppercase tracking-widest">
                <th className="p-5 font-semibold border-b border-slate-700/50">Produs</th>
                <th className="p-5 font-semibold border-b border-slate-700/50">Preț</th>
                <th className="p-5 font-semibold border-b border-slate-700/50">Data Verificării</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data.map((item, index) => (
                <tr key={index} className="hover:bg-slate-750 transition-all duration-200 ease-in-out group">
                  <td className="p-5 text-slate-200 font-medium group-hover:text-cyan-300 transition-colors">
                    {item.Produs || item.produs || item.product || '-'}
                  </td>
                  <td className="p-5 text-emerald-400 font-bold tracking-wide">
                    {item['Preț'] || item.pret || item.price || '-'}
                  </td>
                  <td className="p-5 text-slate-400 text-sm font-light">
                    {item['Data Verificării'] || item.data || item.date || item.timestamp || '-'}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-12 text-center text-slate-500 italic">
                    Nu s-au găsit date sau se încarcă...
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
