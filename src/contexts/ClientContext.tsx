import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AppConfig, ArchivedReport, ClientConfig, DataRecord, DiscoverySuggestion, GroupedStrategies, SubscriptionTier } from '../lib/types';
import { deriveClientId } from '../lib/utils';
import {
  clientAuth,
  addClientSource,
  fetchExports,
  fetchReportStatus,
  fetchDiscoveryStatus,
  fetchDiscoveryResults,
  loadClientDataJson,
  startClientScraping,
  startDiscovery,
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
  groupedStrategies: GroupedStrategies | null;
  loadError: string;

  reportMsg: string;
  isGeneratingReport: boolean;
  reportLogs: string[];
  isReportRunning: boolean;
  archivedReports: ArchivedReport[];

  subscriptionTier: SubscriptionTier;
  hasDiscovery: boolean;
  hasDelivery: boolean;

  discoverySuggestions: DiscoverySuggestion[];
  isDiscoveryRunning: boolean;
  discoveryLogs: string[];

  login: (token: string, password: string) => Promise<string | null>;
  loginError: string;
  logout: () => void;
  triggerReport: (force?: boolean) => void;
  triggerDiscovery: (scope?: 'local' | 'global') => void;
  addSource: (url: string) => Promise<{ success: boolean; error?: string }>;
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
  const [groupedStrategies, setGroupedStrategies] = useState<GroupedStrategies | null>(null);
  const [loadError, setLoadError] = useState('');

  const [reportMsg, setReportMsg] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportLogs, setReportLogs] = useState<string[]>([]);
  const [isReportRunning, setIsReportRunning] = useState(false);
  const [archivedReports, setArchivedReports] = useState<ArchivedReport[]>([]);

  const [discoverySuggestions, setDiscoverySuggestions] = useState<DiscoverySuggestion[]>([]);
  const [isDiscoveryRunning, setIsDiscoveryRunning] = useState(false);
  const [discoveryLogs, setDiscoveryLogs] = useState<string[]>([]);

  const [configReady, setConfigReady] = useState(false);

  const loadData = useCallback((client: ClientConfig) => {
    loadClientDataJson(client)
      .then(({ items, strategies: strats, groupedStrategies: grouped }) => {
        setData(items);
        setStrategies(strats);
        setGroupedStrategies(grouped);
        setLoadError('');
      })
      .catch(() => {
        setData([]);
        setStrategies([]);
        setGroupedStrategies(null);
        setLoadError('Datele clientului nu au putut fi încărcate.');
      });
  }, []);

  const authenticateViaApi = useCallback(
    async (token: string, password: string): Promise<string | null> => {
      try {
        const { client } = await clientAuth(token, password);
        const id = deriveClientId(client);
        setIsTransitioning(true);
        setLoginError('');
        setClientId(id);
        setClientName(client.name);
        setClientType(client.type);
        setActiveClient(client);
        setActiveToken(client.access_token);
        localStorage.setItem('azisunt_token', client.access_token);
        loadData(client);

        window.setTimeout(() => {
          setIsAuthenticated(true);
          setIsTransitioning(false);
        }, 280);

        return id;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Autentificare eșuată.';
        setLoginError(message);
        return null;
      }
    },
    [loadData],
  );

  // Auto-login from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('azisunt_token');
    if (savedToken) {
      authenticateViaApi(savedToken, '').catch(() => {
        localStorage.removeItem('azisunt_token');
      });
    }
    setConfigReady(true);
  }, [authenticateViaApi]);

  const login = useCallback(
    async (token: string, password: string): Promise<string | null> => {
      setLoginError('');
      return authenticateViaApi(token, password);
    },
    [authenticateViaApi],
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
    setDiscoverySuggestions([]);
    setIsDiscoveryRunning(false);
    setDiscoveryLogs([]);
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
    async (url: string): Promise<{ success: boolean; error?: string }> => {
      if (!activeToken) return { success: false, error: 'Nu ești autentificat.' };
      try {
        const { sources } = await addClientSource(activeToken, url);
        setActiveClient((prev) => (prev ? { ...prev, sources } : prev));
        setReportMsg('Sursa a fost adăugată.');
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Nu am putut adăuga sursa.';
        return { success: false, error: message };
      }
    },
    [activeToken],
  );

  const triggerDiscovery = useCallback(
    (scope: 'local' | 'global' = 'local') => {
      if (!activeToken) return;
      setReportMsg('');
      startDiscovery(activeToken, scope)
        .then(() => {
          setIsDiscoveryRunning(true);
          setDiscoveryLogs([]);
          setReportMsg('Căutarea de competitori a fost pornită.');
        })
        .catch((err) => setReportMsg(err.message || 'Nu am putut porni descoperirea.'));
    },
    [activeToken],
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

  const subscriptionTier: SubscriptionTier = activeClient?.subscription || 'delivery';
  const hasDiscovery = subscriptionTier === 'online' || subscriptionTier === 'complet';
  const hasDelivery = subscriptionTier === 'delivery' || subscriptionTier === 'complet';

  // Poll discovery status
  useEffect(() => {
    if (!activeToken || !hasDiscovery) return;
    const timer = window.setInterval(() => {
      fetchDiscoveryStatus(activeToken)
        .then((status) => {
          setIsDiscoveryRunning(Boolean(status.running));
          setDiscoveryLogs(Array.isArray(status.logs) ? status.logs : []);
        })
        .catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeToken, hasDiscovery]);

  // Load discovery results when discovery finishes
  useEffect(() => {
    if (!isDiscoveryRunning && activeToken && hasDiscovery) {
      fetchDiscoveryResults(activeToken)
        .then((result) => setDiscoverySuggestions(result.suggestions || []))
        .catch(() => setDiscoverySuggestions([]));
    }
  }, [isDiscoveryRunning, activeToken, hasDiscovery]);

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
        groupedStrategies,
        loadError,
        reportMsg,
        isGeneratingReport,
        reportLogs,
        isReportRunning,
        archivedReports,
        subscriptionTier,
        hasDiscovery,
        hasDelivery,
        discoverySuggestions,
        isDiscoveryRunning,
        discoveryLogs,
        login,
        loginError,
        logout,
        triggerReport,
        triggerDiscovery,
        addSource,
        setReportMsg,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}
