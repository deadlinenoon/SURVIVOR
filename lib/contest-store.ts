import { promises as fs } from "fs";
import path from "path";
import {
  CIRCA_CONTEST,
  SCS_CONTEST,
  ContestConfig,
  ContestView,
  EntryConfig,
  Pick,
  Result,
  WeekKey,
  WeekPickSummary,
  computeContestView,
  getTeamCode,
  getTeamCodeFromWordmark,
  getTeamName,
} from "@/lib/survivor";

const DATA_FILE = path.join(process.cwd(), "data", "picks.json");

const CONTEST_MAP = {
  circa: CIRCA_CONTEST,
  scs: SCS_CONTEST,
} as const;

export type ContestId = keyof typeof CONTEST_MAP;

type PersistedContest = {
  entries: EntryConfig[];
  updatedAt?: string;
  weekSummaries?: Partial<Record<WeekKey, WeekPickSummary>>;
};

type PersistedData = Partial<Record<ContestId, PersistedContest>>;

type UpsertPickParams = {
  contestId: ContestId;
  entryName: string;
  week: string;
  team: string;
  result?: Result;
};

type ParsedPickRow = {
  entryName: string;
  team: string;
  week: WeekKey | null;
};

export type WeekPickIngestMode = "entries" | "summary";

export interface WeekPickIngestResult {
  contestId: ContestId;
  week: WeekKey;
  summary: WeekPickSummary;
  matchedEntries: Array<{ name: string; team: string }>;
  missingEntries: string[];
  unknownTeams: string[];
  mode: WeekPickIngestMode;
}

async function readPersistedData(): Promise<PersistedData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedData;
    (Object.keys(parsed) as ContestId[]).forEach((contestId) => {
      const contest = parsed[contestId];
      if (contest) {
        contest.weekSummaries = contest.weekSummaries ?? {};
      }
    });
    return parsed;
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
    const fallback: PersistedData = {
      circa: {
        entries: cloneEntries(CIRCA_CONTEST.entries),
        updatedAt: new Date().toISOString(),
        weekSummaries: {},
      },
      scs: {
        entries: cloneEntries(SCS_CONTEST.entries),
        updatedAt: new Date().toISOString(),
        weekSummaries: {},
      },
    };
    await writePersistedData(fallback);
    return fallback;
  }
}

async function writePersistedData(data: PersistedData) {
  const payload = JSON.stringify(data, null, 2);
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, `${payload}\n`, "utf8");
}

function cloneEntries(entries: EntryConfig[]): EntryConfig[] {
  return entries.map((entry) => ({
    name: entry.name,
    picks: entry.picks.map((pick) => ({ ...pick })),
  }));
}

function sanitizeTeam(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  return trimmed.toUpperCase();
}

export async function getContestConfig(contestId: ContestId): Promise<ContestConfig> {
  const base = CONTEST_MAP[contestId];
  const persisted = (await readPersistedData())[contestId];
  const entries = persisted?.entries?.length ? persisted.entries : base.entries;
  return { ...base, entries: cloneEntries(entries) };
}

export async function getContestView(contestId: ContestId): Promise<ContestView> {
  const config = await getContestConfig(contestId);
  const view = computeContestView(config);
  const data = await readPersistedData();
  const summaries = data[contestId]?.weekSummaries ?? {};
  return {
    ...view,
    weekSummaries: summaries,
    currentWeekSummary: summaries?.[config.currentWeek] ?? null,
  };
}

function normalizeEntry(baseEntries: EntryConfig[], persistedEntries?: EntryConfig[]): EntryConfig[] {
  const overridesByName = new Map<string, EntryConfig>();
  (persistedEntries ?? []).forEach((entry) => overridesByName.set(entry.name, {
    name: entry.name,
    picks: entry.picks.map((pick) => ({ ...pick })),
  }));

  return baseEntries.map((entry) => overridesByName.get(entry.name) ?? {
    name: entry.name,
    picks: entry.picks.map((pick) => ({ ...pick })),
  });
}

function upsertPickInEntry(entry: EntryConfig, week: string, team: string, result: Result): EntryConfig {
  const normalizedTeam = sanitizeTeam(team);
  const existingIndex = entry.picks.findIndex((pick) => pick.week === week);
  const updatedPick: Pick = { week, team: normalizedTeam, result };

  if (existingIndex >= 0) {
    const next = [...entry.picks];
    next[existingIndex] = { ...next[existingIndex], ...updatedPick };
    return { name: entry.name, picks: next };
  }

  return {
    name: entry.name,
    picks: [...entry.picks, updatedPick],
  };
}

export async function upsertContestPick({ contestId, entryName, week, team, result }: UpsertPickParams) {
  if (!CONTEST_MAP[contestId]) {
    throw new Error(`Unknown contest: ${contestId}`);
  }

  const data = await readPersistedData();
  const base = CONTEST_MAP[contestId];
  const normalizedEntries = normalizeEntry(base.entries, data[contestId]?.entries);

  const entryIndex = normalizedEntries.findIndex((entry) => entry.name === entryName);
  if (entryIndex < 0) {
    throw new Error(`Entry not found: ${entryName}`);
  }

  const safeResult: Result = result ?? "P";
  const updatedEntry = upsertPickInEntry(normalizedEntries[entryIndex], week, team, safeResult);
  const nextEntries = [...normalizedEntries];
  nextEntries[entryIndex] = updatedEntry;

  data[contestId] = {
    entries: nextEntries,
    updatedAt: new Date().toISOString(),
    weekSummaries: data[contestId]?.weekSummaries ?? {},
  };

  await writePersistedData(data);
}

type IngestContestWeekPicksParams = {
  contestId: ContestId;
  content: string | Buffer;
  week?: WeekKey;
  sourceName?: string;
  filename?: string;
  mimetype?: string;
};

export async function ingestContestWeekPicks({
  contestId,
  content,
  week,
  sourceName,
  filename,
  mimetype,
}: IngestContestWeekPicksParams): Promise<WeekPickIngestResult> {
  const contestConfig = CONTEST_MAP[contestId];
  if (!contestConfig) {
    throw new Error(`Unknown contest: ${contestId}`);
  }

  const buffer = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  const rawText = await readContentAsText(buffer, filename, mimetype);
  const aggregate = tryParseAggregatedSummary(rawText);

  const data = await readPersistedData();
  const persistedContest = data[contestId];
  const normalizedEntries = normalizeEntry(contestConfig.entries, persistedContest?.entries);
  const targetWeek = week ?? contestConfig.currentWeek;

  if (aggregate) {
    const aggregateTotal = Array.from(aggregate.picksByTeam.values()).reduce((sum, value) => sum + value, 0);
    const totalEntries = aggregate.totalEntries ?? aggregateTotal;

    if (!aggregateTotal) {
      throw new Error("Unable to recognize any team counts in uploaded file.");
    }

    const summary: WeekPickSummary = {
      week: targetWeek,
      totalEntries,
      uploadedAt: new Date().toISOString(),
      sourceName,
      picksByTeam: mapToSortedRecord(aggregate.picksByTeam),
    };

    data[contestId] = {
      entries: normalizedEntries,
      updatedAt: new Date().toISOString(),
      weekSummaries: {
        ...(persistedContest?.weekSummaries ?? {}),
        [targetWeek]: summary,
      },
    };

    await writePersistedData(data);

    return {
      contestId,
      week: targetWeek,
      summary,
      matchedEntries: [],
      missingEntries: [],
      unknownTeams: aggregate.unknownLabels,
      mode: "summary",
    };
  }

  const parsedRows = parsePickRows(rawText);
  if (!parsedRows.length) {
    throw new Error("No picks detected in uploaded file.");
  }

  const weekFilteredRows = parsedRows.filter((row) => {
    const rowWeek = row.week ?? targetWeek;
    return rowWeek === targetWeek;
  });

  if (!weekFilteredRows.length) {
    throw new Error(`No picks found for week ${targetWeek}.`);
  }

  const entryKeyToIndex = new Map<string, number>();
  normalizedEntries.forEach((entry, index) => {
    entryKeyToIndex.set(normalizeEntryKey(entry.name), index);
  });

  const matchedEntriesMap = new Map<number, string>();
  const unknownTeams = new Set<string>();
  const picksByTeam = new Map<string, number>();
  let totalEntries = 0;

  weekFilteredRows.forEach((row) => {
    const teamCode = normalizeTeamCode(row.team);
    if (!teamCode) {
      const rawTeam = row.team?.trim();
      if (rawTeam) unknownTeams.add(rawTeam);
      return;
    }

    picksByTeam.set(teamCode, (picksByTeam.get(teamCode) ?? 0) + 1);
    totalEntries += 1;

    const key = normalizeEntryKey(row.entryName);
    if (!key) return;

    const entryIndex = entryKeyToIndex.get(key);
    if (entryIndex !== undefined) {
      matchedEntriesMap.set(entryIndex, teamCode);
    }
  });

  if (totalEntries === 0) {
    throw new Error(`No valid picks found for week ${targetWeek}.`);
  }

  const updatedEntries = [...normalizedEntries];
  matchedEntriesMap.forEach((teamCode, index) => {
    updatedEntries[index] = upsertPickInEntry(updatedEntries[index], targetWeek, teamCode, "P");
  });

  const summary: WeekPickSummary = {
    week: targetWeek,
    totalEntries,
    uploadedAt: new Date().toISOString(),
    sourceName,
    picksByTeam: mapToSortedRecord(picksByTeam),
  };

  data[contestId] = {
    entries: updatedEntries,
    updatedAt: new Date().toISOString(),
    weekSummaries: {
      ...(persistedContest?.weekSummaries ?? {}),
      [targetWeek]: summary,
    },
  };

  await writePersistedData(data);

  const matchedEntries = Array.from(matchedEntriesMap.entries())
    .map(([index, teamCode]) => ({ name: normalizedEntries[index].name, team: teamCode }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const missingEntries = normalizedEntries
    .map((entry, index) => ({ entry, index }))
    .filter(({ index }) => !matchedEntriesMap.has(index))
    .map(({ entry }) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const unknownTeamsList = Array.from(unknownTeams).sort((a, b) => a.localeCompare(b));

  return {
    contestId,
    week: targetWeek,
    summary,
    matchedEntries,
    missingEntries,
    unknownTeams: unknownTeamsList,
    mode: "entries",
  };
}

const ENTRY_HEADER_TOKENS = new Set([
  "entry",
  "entryname",
  "entryid",
  "entry#",
  "name",
]);

const TEAM_HEADER_TOKENS = new Set([
  "team",
  "teamname",
  "teamcode",
  "selection",
  "pick",
  "pickteam",
]);

const WEEK_HEADER_TOKENS = new Set([
  "week",
  "weeknumber",
  "weekid",
  "week#",
  "weekkey",
]);

const ENTRY_FIELD_KEYS = ["entryName", "entry", "name", "Entry", "EntryName", "entry_id", "entryId"] as const;
const TEAM_FIELD_KEYS = ["team", "Team", "pick", "Pick", "selection", "Selection", "teamCode", "team_code"] as const;
const WEEK_FIELD_KEYS = ["week", "Week", "weekNumber", "week_number", "weekId", "week_id", "weekKey"] as const;

function parsePickRows(content: string): ParsedPickRow[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const jsonRows = parsePickRowsFromJson(trimmed);
  if (jsonRows) return jsonRows;

  return parsePickRowsFromDelimited(trimmed);
}

function parsePickRowsFromJson(content: string): ParsedPickRow[] | null {
  try {
    const parsed = JSON.parse(content);
    const array = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as any).rows)
      ? (parsed as any).rows
      : null;
    if (!array) return null;

    const rows: ParsedPickRow[] = [];
    array.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const record = item as Record<string, any>;
      const entryRaw = pickFirst(record, ENTRY_FIELD_KEYS);
      const teamRaw = pickFirst(record, TEAM_FIELD_KEYS);
      const weekRaw = pickFirst(record, WEEK_FIELD_KEYS);
      const entryName = typeof entryRaw === "string" ? entryRaw.trim() : entryRaw ? String(entryRaw).trim() : "";
      const team = typeof teamRaw === "string" ? teamRaw.trim() : teamRaw ? String(teamRaw).trim() : "";
      const week = normalizeWeekInput(weekRaw);
      if (!entryName || !team) return;
      rows.push({ entryName, team, week });
    });
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

function parsePickRowsFromDelimited(content: string): ParsedPickRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines.slice(0, Math.min(lines.length, 10)));
  const table = lines.map((line) => parseDelimitedLine(line, delimiter));

  if (!table.length) return [];

  let startIndex = 0;
  let entryIndex = 0;
  let teamIndex = 1;
  let weekIndex: number | null = null;

  const headerTokens = table[0].map((cell) => normalizeHeaderKey(cell));
  const hasHeader = headerTokens.some((token) => ENTRY_HEADER_TOKENS.has(token) || TEAM_HEADER_TOKENS.has(token));

  if (hasHeader) {
    const entryTokenIndex = headerTokens.findIndex((token) => ENTRY_HEADER_TOKENS.has(token));
    const teamTokenIndex = headerTokens.findIndex((token) => TEAM_HEADER_TOKENS.has(token));
    const weekTokenIndex = headerTokens.findIndex((token) => WEEK_HEADER_TOKENS.has(token));

    if (entryTokenIndex !== -1) entryIndex = entryTokenIndex;
    if (teamTokenIndex !== -1) teamIndex = teamTokenIndex;
    weekIndex = weekTokenIndex !== -1 ? weekTokenIndex : null;
    startIndex = 1;
  } else if (table[0].length > 2) {
    weekIndex = 2;
  }

  const rows: ParsedPickRow[] = [];
  for (let i = startIndex; i < table.length; i += 1) {
    const row = table[i];
    if (row.length === 0) continue;
    const entryName = row[entryIndex]?.trim();
    const team = row[teamIndex]?.trim();
    if (!entryName || !team) continue;
    const weekValue = weekIndex !== null ? row[weekIndex] : undefined;
    const week = weekIndex !== null ? normalizeWeekInput(weekValue) : null;
    rows.push({ entryName, team, week });
  }

  return rows;
}

function pickFirst(record: Record<string, any>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return undefined;
}

function normalizeHeaderKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9#]+/g, "");
}

function normalizeEntryKey(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeTeamCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const resolved = getTeamCode(trimmed) ?? getTeamCodeFromWordmark(trimmed);
  if (resolved) return resolved;
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{2,3}$/.test(upper)) {
    return upper;
  }
  return null;
}

function normalizeWeekInput(value: unknown): WeekKey | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value)) as WeekKey;
  }
  const text = String(value).trim();
  if (!text) return null;
  const upper = text.toUpperCase();
  if (upper === "TG" || upper === "XMAS") {
    return upper as WeekKey;
  }
  const digits = upper.match(/\d+/);
  return digits ? (digits[0] as WeekKey) : null;
}

function detectDelimiter(lines: string[]): string {
  const delimiters: Array<[string, number]> = [",", "\t", "|", ";"].map((delim) => [
    delim,
    lines.reduce((count, line) => count + countOccurrences(line, delim), 0),
  ]);
  delimiters.sort((a, b) => b[1] - a[1]);
  return delimiters[0][0];
}

function countOccurrences(line: string, delimiter: string): number {
  let count = 0;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === delimiter) count += 1;
  }
  return count;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      if (char !== "\r") current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function mapToSortedRecord(values: Map<string, number>): Record<string, number> {
  const sorted = Array.from(values.entries()).sort((a, b) => {
    if (b[1] === a[1]) return a[0].localeCompare(b[0]);
    return b[1] - a[1];
  });
  return Object.fromEntries(sorted);
}

async function readContentAsText(buffer: Buffer, filename?: string, mimetype?: string): Promise<string> {
  const loweredName = filename?.toLowerCase() ?? "";
  const loweredType = mimetype?.toLowerCase() ?? "";

  if (loweredType.includes("pdf") || loweredName.endsWith(".pdf")) {
    try {
      const { default: pdfParse } = await import("pdf-parse");
      const parsed = await pdfParse(buffer);
      if (parsed.text?.trim()) {
        return parsed.text;
      }
    } catch (error) {
      console.error("[picks-upload] pdf parse failed", error);
    }
  }

  return buffer.toString("utf8");
}

type AggregatedSummary = {
  picksByTeam: Map<string, number>;
  totalEntries: number | null;
  unknownLabels: string[];
};

function tryParseAggregatedSummary(content: string): AggregatedSummary | null {
  const picksByTeam = new Map<string, number>();
  const unknownLabels = new Set<string>();
  let totalEntries: number | null = null;

  const normalized = content.replace(/\u00a0/g, " ");
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  lines.forEach((line) => {
    if (/current\s+live\s+entries/i.test(line)) {
      const totalMatch = line.replace(/[,]/g, "").match(/(\d{3,})/);
      if (totalMatch) {
        totalEntries = Number(totalMatch[1]);
      }
    }
  });

  const rowRegex = /^([A-Z0-9&'\.\-\s]+?)\s+([\d,]{1,6})(?:\s+(\d+(?:\.\d+)?)%?)?$/;

  lines.forEach((line) => {
    const match = line.match(rowRegex);
    if (!match) return;
    const [, labelRaw, countRaw] = match;
    const count = Number(countRaw.replace(/,/g, ""));
    if (!Number.isFinite(count) || count <= 0) return;

    const label = labelRaw.trim();
    const code = getTeamCodeFromWordmark(label);
    if (code) {
      picksByTeam.set(code, (picksByTeam.get(code) ?? 0) + count);
    } else if (!/TEAM|SELECTIONS|%/.test(label.toUpperCase())) {
      unknownLabels.add(label);
    }
  });

  if (!picksByTeam.size) {
    return null;
  }

  return {
    picksByTeam,
    totalEntries,
    unknownLabels: Array.from(unknownLabels).sort((a, b) => a.localeCompare(b)),
  };
}

export async function listContestViews(): Promise<Record<ContestId, ContestView>> {
  const views = await Promise.all((Object.keys(CONTEST_MAP) as ContestId[]).map(async (contestId) => [
    contestId,
    await getContestView(contestId),
  ] as const));

  return Object.fromEntries(views) as Record<ContestId, ContestView>;
}

export async function getPersistedUpdatedAt(contestId: ContestId): Promise<string | undefined> {
  const data = await readPersistedData();
  return data[contestId]?.updatedAt;
}

export function describeTeam(teamCode: string): string {
  return getTeamName(teamCode) ?? teamCode;
}
