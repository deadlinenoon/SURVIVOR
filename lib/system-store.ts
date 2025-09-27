import fs from "node:fs/promises";
import path from "node:path";
import { BlobNotFoundError, head, put } from "@vercel/blob";
import type { ConsensusApiResponse } from "@/lib/rooting";
import { cloneConsensusGame } from "@/lib/rooting";

const DATA_DIR = ".data";
const DATA_FILE = `${DATA_DIR}/dashboard.json`;
const BLOB_PATH = process.env.DASHBOARD_BLOB_PATH?.trim() || "system/dashboard.json";

export type DeltaKey = "dod" | "wow" | "mom" | "qoq" | "yoy";

export type AnalyticsMetric = {
  id: string;
  label: string;
  unit?: string;
  value: number;
  deltas: Record<DeltaKey, number>;
};

export type AnalyticsSnapshot = {
  updatedAt: string;
  metrics: AnalyticsMetric[];
};

export type PinnedNote = {
  message: string;
  updatedAt: string;
  author?: string;
};

export type ErrorEntry = {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  status: "open" | "investigating" | "resolved";
  count?: number;
};

export interface RootingOverride {
  data: ConsensusApiResponse;
  uploadedAt: string;
  expiresAt: string;
  sourceName?: string;
  sourcePath?: string;
}

export type DashboardData = {
  analytics: AnalyticsSnapshot;
  note: PinnedNote | null;
  errors: ErrorEntry[];
  rootingOverride?: RootingOverride | null;
};

export const DEFAULT_DASHBOARD: DashboardData = {
  analytics: {
    updatedAt: new Date().toISOString(),
    metrics: [],
  },
  note: null,
  errors: [],
  rootingOverride: null,
};

const EXTERNAL_ERROR_LOG_PATH = process.env.SURVIVOR_ERROR_LOG_PATH?.trim();
const RESOLVED_ERROR_LOG_PATH = EXTERNAL_ERROR_LOG_PATH
  ? path.isAbsolute(EXTERNAL_ERROR_LOG_PATH)
    ? EXTERNAL_ERROR_LOG_PATH
    : path.join(process.cwd(), EXTERNAL_ERROR_LOG_PATH)
  : null;

type ErrorPayload = Partial<ErrorEntry> & {
  id?: string;
  timestamp?: string;
  time?: string;
  date?: string;
  source?: string;
  message?: string;
  detail?: string;
  error?: string;
  service?: string;
  logger?: string;
  occurrences?: number;
  status?: string;
  count?: number;
};

function shouldUseBlobStore(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function requireBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN missing");
  return token;
}

function parseDashboard(raw: string): DashboardData {
  try {
    const parsed = JSON.parse(raw) as Partial<DashboardData>;
    return {
      analytics: parsed.analytics ?? DEFAULT_DASHBOARD.analytics,
      note: parsed.note ?? DEFAULT_DASHBOARD.note,
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      rootingOverride: parsed.rootingOverride ?? null,
    };
  } catch {
    return DEFAULT_DASHBOARD;
  }
}

async function readDashboardFromFile(): Promise<DashboardData> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(DATA_FILE);
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return parseDashboard(raw);
  } catch (error) {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(DATA_FILE, `${JSON.stringify(DEFAULT_DASHBOARD, null, 2)}\n`, "utf8");
    } catch (writeError) {
      console.error("[dashboard] local seed failed:", writeError);
    }
    return DEFAULT_DASHBOARD;
  }
}

async function writeDashboardToFile(data: DashboardData): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error("[dashboard] local write failed:", error);
  }
}

export async function readDashboard(): Promise<DashboardData> {
  if (shouldUseBlobStore()) {
    try {
      const token = requireBlobToken();
      const metadata = await head(BLOB_PATH, { token });
      const response = await fetch(metadata.downloadUrl);
      if (!response.ok) {
        throw new Error(`blob fetch ${response.status} ${response.statusText}`);
      }
      return parseDashboard(await response.text());
    } catch (error) {
      console.error("[dashboard] blob read failed:", error);
      if (error instanceof BlobNotFoundError) {
        try {
          const token = requireBlobToken();
          await put(BLOB_PATH, `${JSON.stringify(DEFAULT_DASHBOARD, null, 2)}\n`, {
            token,
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: "application/json",
          });
        } catch (seedError) {
          console.error("[dashboard] blob seed failed:", seedError);
        }
      }
      return readDashboardFromFile();
    }
  }

  return readDashboardFromFile();
}

export async function writeDashboard(data: DashboardData): Promise<void> {
  if (shouldUseBlobStore()) {
    try {
      const token = requireBlobToken();
      await put(BLOB_PATH, `${JSON.stringify(data, null, 2)}\n`, {
        token,
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    } catch (error) {
      console.error("[dashboard] blob write failed:", error);
    }
  }

  await writeDashboardToFile(data);
}

async function loadExternalErrors(): Promise<ErrorEntry[] | null> {
  if (!RESOLVED_ERROR_LOG_PATH) return null;

  let raw: string;
  try {
    raw = await fs.readFile(RESOLVED_ERROR_LOG_PATH, "utf8");
  } catch {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) return [];

  const records: ErrorPayload[] = [];
  const tryParse = (input: string) => {
    try {
      const parsed = JSON.parse(input) as ErrorPayload | ErrorPayload[];
      if (Array.isArray(parsed)) {
        records.push(...parsed);
      } else if (parsed && typeof parsed === "object") {
        records.push(parsed);
      }
      return true;
    } catch {
      return false;
    }
  };

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        tryParse(line);
      });
  } else if (!tryParse(trimmed)) {
    return null;
  }

  const map = new Map<string, ErrorEntry>();

  records.forEach((record, index) => {
    if (!record) return;
    const id = String(record.id ?? record.source ?? `ext-${index}`);
    const timestampSource = record.timestamp ?? record.time ?? record.date ?? new Date().toISOString();
    const stamp = new Date(timestampSource);
    const timestamp = Number.isNaN(stamp.getTime()) ? new Date().toISOString() : stamp.toISOString();
    const source = String(record.source ?? record.service ?? record.logger ?? "backend");
    const message = String(record.message ?? record.error ?? record.detail ?? "").trim();
    if (!message) return;
    const status = record.status === "resolved" || record.status === "investigating" ? record.status : "open";
    const count =
      typeof record.count === "number"
        ? record.count
        : typeof record.occurrences === "number"
          ? record.occurrences
          : undefined;

    map.set(id, {
      id,
      timestamp,
      source,
      message,
      status,
      count,
    });
  });

  const entries = Array.from(map.values());
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return entries;
}

export async function getDashboard(): Promise<DashboardData> {
  return readDashboard();
}

export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const data = await readDashboard();
  return data.analytics;
}

export async function updateAnalyticsSnapshot(snapshot: AnalyticsSnapshot): Promise<AnalyticsSnapshot> {
  const data = await readDashboard();
  const sanitizedMetrics = snapshot.metrics.map((metric) => ({
    ...metric,
    id: metric.id.trim(),
    label: metric.label.trim(),
    unit: metric.unit?.trim() || undefined,
    value: Number(metric.value) || 0,
    deltas: {
      dod: Number(metric.deltas.dod) || 0,
      wow: Number(metric.deltas.wow) || 0,
      mom: Number(metric.deltas.mom) || 0,
      qoq: Number(metric.deltas.qoq) || 0,
      yoy: Number(metric.deltas.yoy) || 0,
    },
  }));

  const updated: DashboardData = {
    ...data,
    analytics: {
      updatedAt: snapshot.updatedAt || new Date().toISOString(),
      metrics: sanitizedMetrics,
    },
  };

  await writeDashboard(updated);
  return updated.analytics;
}

export async function getPinnedNote(): Promise<PinnedNote | null> {
  const data = await readDashboard();
  return data.note ?? null;
}

export async function setPinnedNote(note: { message: string; author?: string | null }): Promise<PinnedNote> {
  const data = await readDashboard();
  const sanitized: PinnedNote = {
    message: note.message.trim(),
    author: note.author?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  const updated: DashboardData = {
    ...data,
    note: sanitized,
  };
  await writeDashboard(updated);
  return sanitized;
}

export async function listErrors(): Promise<ErrorEntry[]> {
  const dashboard = await readDashboard();
  const external = await loadExternalErrors();

  if (!external) {
    return dashboard.errors ?? [];
  }

  const statusOverrides = new Map<string, ErrorEntry["status"]>();
  (dashboard.errors ?? []).forEach((entry) => {
    statusOverrides.set(entry.id, entry.status);
  });

  return external.map((entry) => ({
    ...entry,
    status: statusOverrides.get(entry.id) ?? entry.status ?? "open",
  }));
}

export async function setErrorStatus(id: string, status: ErrorEntry["status"]): Promise<ErrorEntry[]> {
  const [dashboard, external] = await Promise.all([readDashboard(), loadExternalErrors()]);

  const currentErrors = [...(dashboard.errors ?? [])];
  const existingIndex = currentErrors.findIndex((err) => err.id === id);

  if (existingIndex >= 0) {
    currentErrors[existingIndex] = {
      ...currentErrors[existingIndex],
      status,
    };
  } else {
    const template = external?.find((entry) => entry.id === id);
    currentErrors.push(
      template
        ? {
            ...template,
            status,
          }
        : {
            id,
            timestamp: new Date().toISOString(),
            source: "external",
            message: "External log entry",
            status,
          },
    );
  }

  const updated: DashboardData = {
    ...dashboard,
    errors: currentErrors,
  };
  await writeDashboard(updated);

  if (external) {
    const overrides = new Map<string, ErrorEntry["status"]>(currentErrors.map((entry) => [entry.id, entry.status]));
    return external.map((entry) => ({
      ...entry,
      status: overrides.get(entry.id) ?? entry.status ?? "open",
    }));
  }

  return currentErrors;
}

export async function appendError(entry: ErrorEntry): Promise<ErrorEntry[]> {
  const data = await readDashboard();
  const nextErrors = [...(data.errors ?? []), entry];
  const updated: DashboardData = {
    ...data,
    errors: nextErrors,
  };
  await writeDashboard(updated);
  return nextErrors;
}

export async function getRootingOverride(): Promise<RootingOverride | null> {
  const data = await readDashboard();
  if (!data.rootingOverride) return null;
  return data.rootingOverride;
}

export async function setRootingOverride(payload: {
  data: ConsensusApiResponse;
  expiresAt: string;
  sourceName?: string;
  sourcePath?: string;
}): Promise<RootingOverride> {
  const dashboard = await readDashboard();
  const manual = payload.data.sources?.manual;
  if (!manual) {
    throw new Error("Manual source required for rooting override");
  }

  const sanitized: ConsensusApiResponse = {
    sources: {
      scoresandodds: payload.data.sources?.scoresandodds ?? null,
      vsin: payload.data.sources?.vsin ?? null,
      manual: {
        ...manual,
        markets: {
          moneyline: manual.markets.moneyline.map((game) => cloneConsensusGame(game)),
          spread: manual.markets.spread.map((game) => cloneConsensusGame(game)),
        },
      },
    },
  };

  const override: RootingOverride = {
    data: sanitized,
    uploadedAt: new Date().toISOString(),
    expiresAt: payload.expiresAt,
    sourceName: payload.sourceName,
    sourcePath: payload.sourcePath,
  };

  const updated: DashboardData = {
    ...dashboard,
    rootingOverride: override,
  };

  await writeDashboard(updated);
  return override;
}

export async function clearRootingOverride(): Promise<void> {
  const dashboard = await readDashboard();
  const updated: DashboardData = {
    ...dashboard,
    rootingOverride: null,
  };
  await writeDashboard(updated);
}
