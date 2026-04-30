import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AppConfig, ArchivedReport, ClientConfig, DataRecord } from '../lib/types';
import { deriveClientId } from '../lib/utils';
import {
  fetchConfig,
  fetchExports,
  fetchReportStatus,
  loadClientDataJson,
  saveConfig,
  startClientScraping,
} from '../lib/api';

interface ClientContextValue {
  isAuthenticated: boolean;
  isTransitioning: boolean;
  clientId: string;
  clientName: string;
  clientType: 'local' | 'national' | '';
  activeClient: ClientConfig | null;
  activeToken: string;
  config: AppConfig | null;

  data: DataRecord[];
  strategies: string[];
  loadError: string;

  reportMsg: string;
  isGeneratingReport: boolean;
  reportLogs: string[];
  isReportRunning: boolean;
  archivedReports: ArchivedReport[];

  login: (token: string) => string | null;
  loginError: string;
  logout: () => void;
  triggerReport: (force?: boolean) => void;
  addSource: (url: string) => { success: boolean; error?: string };
  setReportMsg: (msg: string) => void;
}

const ClientContext = createContext<ClientContextValue | null>(null);

export function useClient(): ClientContextValue {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error('useClient must be used within ClientProvider');
  return ctx;
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientType, setClientType] = useState<'local' | 'national' | ''>('');
  const [activeClient, setActiveClient] = useState<ClientConfig | null>(null);
  const [activeToken, setActiveToken] = useState('');
  const [loginError, setLoginError] = useState('');

  const [data, setData] = useState<DataRecord[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');

  const [reportMsg, setReportMsg] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportLogs, setReportLogs] = useState<string[]>([]);
  const [isReportRunning, setIsReportRunning] = useState(false);
  const [archivedReports, setArchivedReports] = useState<ArchivedReport[]>([]);

  const [configReady, setConfigReady] = useState(false);

  const loadData = useCallback((client: ClientConfig) => {
    loadClientDataJson(client)
      .then(({ items, strategies: strats }) => {
        setData(items);
        setStrategies(strats);
        setLoadError('');
      })
      .catch(() => {
        setData([]);
        setStrategies([]);
        setLoadError('Datele clientului nu au putut fi încărcate.');
      });
  }, []);

  const authenticateWithToken = useCallback(
    (token: string, cfg: AppConfig | null): string | null => {
      if (!cfg || !Array.isArray(cfg.clients)) {
        setLoginError('Configurația de acces nu este disponibilă.');
        return null;
      }

      const client = cfg.clients.find((entry) => entry.access_token === token.trim());
      if (!client) {
        setLoginError('Cod de acces invalid. Verifică și încearcă din nou.');
        return null;
      }

      const id = deriveClientId(client);
      setIsTransitioning(true);
      setLoginError('');
      setClientId(id);
      setClientName(client.name);
      setClientType(client.type);
      setActiveClient(client);
      setActiveToken(token.trim());
      localStorage.setItem('azisunt_token', token.trim());
      loadData(client);

      window.setTimeout(() => {
        setIsAuthenticated(true);
        setIsTransitioning(false);
      }, 280);

      return id;
    },
    [loadData],
  );

  // Load config on mount + auto-login from localStorage
  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        setConfig(cfg);
        const savedToken = localStorage.getItem('azisunt_token');
        if (savedToken) {
          authenticateWithToken(savedToken, cfg);
        }
        setConfigReady(true);
      })
      .catch(() => {
        setLoginError('Configurația nu a putut fi încărcată.');
        setConfigReady(true);
      });
  }, [authenticateWithToken]);

  const login = useCallback(
    (token: string): string | null => {
      setLoginError('');
      return authenticateWithToken(token, config);
    },
    [authenticateWithToken, config],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('azisunt_token');
    setIsAuthenticated(false);
    setClientId('');
    setClientName('');
    setClientType('');
    setActiveClient(null);
    setActiveToken('');
    setData([]);
    setStrategies([]);
    setLoadError('');
    setReportMsg('');
    setReportLogs([]);
    setIsReportRunning(false);
    setArchivedReports([]);
    setLoginError('');
  }, []);

  const triggerReport = useCallback(
    (force = false) => {
      if (!activeToken) {
        setReportMsg('Token client indisponibil.');
        return;
      }
      setIsGeneratingReport(true);
      setReportMsg('');
      startClientScraping(activeToken, force)
        .then((payload) => {
          if (payload.requires_confirmation) {
            const confirmRun = window.confirm(
              payload.message || 'Datele sunt recente. Sigur vrei o actualizare nouă?',
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
    },
    [activeToken],
  );

  const addSource = useCallback(
    (url: string): { success: boolean; error?: string } => {
      const trimmedUrl = url.trim();
      if (!trimmedUrl || !activeClient) {
        return { success: false, error: 'Introdu un URL valid.' };
      }
      let parsed: URL;
      try {
        parsed = new URL(trimmedUrl);
      } catch {
        return { success: false, error: 'URL invalid.' };
      }
      const host = parsed.hostname.toLowerCase();
      if (!host.includes('glovo') && !host.includes('wolt')) {
        return { success: false, error: 'Permise doar URL-uri Glovo sau Wolt.' };
      }
      const currentSources = activeClient.sources || [];
      if (currentSources.includes(trimmedUrl)) {
        return { success: false, error: 'Sursa există deja.' };
      }

      if (!config) return { success: false, error: 'Config indisponibil.' };

      const newSources = [...currentSources, trimmedUrl];
      const nextClients = config.clients.map((c) =>
        c.access_token === activeClient.access_token ? { ...c, sources: newSources } : c,
      );
      const nextConfig: AppConfig = { ...config, clients: nextClients };

      saveConfig(nextConfig)
        .then(() => {
          const updatedClient =
            nextClients.find((c) => c.access_token === activeClient.access_token) || null;
          setConfig(nextConfig);
          setActiveClient(updatedClient);
          setReportMsg('Sursele au fost salvate.');
        })
        .catch(() => setReportMsg('Nu am putut salva sursele.'));

      return { success: true };
    },
    [activeClient, config],
  );

  // Poll report status
  useEffect(() => {
    if (!activeToken) return;
    const timer = window.setInterval(() => {
      fetchReportStatus(activeToken)
        .then((status) => {
          setIsReportRunning(Boolean(status.running));
          setReportLogs(Array.isArray(status.logs) ? status.logs : []);
        })
        .catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeToken]);

  // Fetch archives
  const refreshArchives = useCallback(() => {
    if (!activeToken) return;
    fetchExports(activeToken)
      .then(setArchivedReports)
      .catch(() => setArchivedReports([]));
  }, [activeToken]);

  useEffect(() => {
    refreshArchives();
  }, [refreshArchives]);

  useEffect(() => {
    if (!isReportRunning && activeToken) {
      refreshArchives();
    }
  }, [isReportRunning, activeToken, refreshArchives]);

  if (!configReady) return null;

  return (
    <ClientContext.Provider
      value={{
        isAuthenticated,
        isTransitioning,
        clientId,
        clientName,
        clientType,
        activeClient,
        activeToken,
        config,
        data,
        strategies,
        loadError,
        reportMsg,
        isGeneratingReport,
        reportLogs,
        isReportRunning,
        archivedReports,
        login,
        loginError,
        logout,
        triggerReport,
        addSource,
        setReportMsg,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}
