export type ClientConfig = {
  id?: string;
  name: string;
  access_token: string;
  type: 'local' | 'national';
  sources?: string[];
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
