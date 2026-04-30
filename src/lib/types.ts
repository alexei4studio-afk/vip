export type SubscriptionTier = 'online' | 'delivery' | 'complet';

export type ClientConfig = {
  id?: string;
  name: string;
  access_token: string;
  type: 'local' | 'national';
  active?: boolean;
  password?: string;
  sources?: string[];
  subscription?: SubscriptionTier;
  location?: string;
  location_radius?: 'local' | 'global';
  keywords?: string[];
  platforme?: string[];
};

export type DiscoverySuggestion = {
  name: string;
  url: string;
  platform: string;
  distance?: string;
  category?: string;
};

export type DiscoveryResult = {
  suggestions: DiscoverySuggestion[];
  searched_at: string | null;
  scope: 'local' | 'global' | null;
};

export type AppConfig = {
  clients: ClientConfig[];
};

export type DataRecord = Record<string, string | number | null | undefined>;

export type ArchivedReport = {
  name: string;
  modified_at: number;
};

export type SortMode = 'default' | 'profit_desc' | 'price_diff';

export type ReportJob = {
  running: boolean;
  logs: string[];
  pid: number | null;
  exit_code: number | null;
  started_at: number | null;
  last_finished_at: number | null;
};
