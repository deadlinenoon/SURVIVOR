export type Result = "W" | "L" | "T" | "P";
export type WeekKey = string;

export const TEAM_NAMES: Record<string, string> = {
  ARI: "Cardinals",
  ATL: "Falcons",
  BAL: "Ravens",
  BUF: "Bills",
  CAR: "Panthers",
  CHI: "Bears",
  CIN: "Bengals",
  CLE: "Browns",
  DAL: "Cowboys",
  DEN: "Broncos",
  DET: "Lions",
  GB: "Packers",
  HOU: "Texans",
  IND: "Colts",
  JAX: "Jaguars",
  KC: "Chiefs",
  LV: "Raiders",
  LAC: "Chargers",
  LAR: "Rams",
  MIA: "Dolphins",
  MIN: "Vikings",
  NE: "Patriots",
  NO: "Saints",
  NYG: "Giants",
  NYJ: "Jets",
  PHI: "Eagles",
  PIT: "Steelers",
  SEA: "Seahawks",
  SF: "49ers",
  TB: "Buccaneers",
  TEN: "Titans",
  WAS: "Commanders",
};

export const NFL_TEAMS = Object.keys(TEAM_NAMES);

const TEAM_FULL_NAME_ALIASES: Record<string, string> = {
  "arizona cardinals": "ARI",
  "atlanta falcons": "ATL",
  "baltimore ravens": "BAL",
  "buffalo bills": "BUF",
  "carolina panthers": "CAR",
  "chicago bears": "CHI",
  "cincinnati bengals": "CIN",
  "cleveland browns": "CLE",
  "dallas cowboys": "DAL",
  "denver broncos": "DEN",
  "detroit lions": "DET",
  "green bay packers": "GB",
  "houston texans": "HOU",
  "indianapolis colts": "IND",
  "jacksonville jaguars": "JAX",
  "kansas city chiefs": "KC",
  "las vegas raiders": "LV",
  "los angeles chargers": "LAC",
  "los angeles rams": "LAR",
  "miami dolphins": "MIA",
  "minnesota vikings": "MIN",
  "new england patriots": "NE",
  "new orleans saints": "NO",
  "new york giants": "NYG",
  "new york jets": "NYJ",
  "philadelphia eagles": "PHI",
  "pittsburgh steelers": "PIT",
  "san francisco 49ers": "SF",
  "seattle seahawks": "SEA",
  "tampa bay buccaneers": "TB",
  "tennessee titans": "TEN",
  "washington commanders": "WAS",
};

const TEAM_CODE_FROM_NAME: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(TEAM_NAMES).map(([code, name]) => [name.toLowerCase(), code])
  ),
  ...TEAM_FULL_NAME_ALIASES,
  jac: "JAX",
  wsh: "WAS",
};

const TEAM_WORDMARK_ALIASES: Record<string, string> = {
  SEAHAWKS: "SEA",
  BILLS: "BUF",
  BUCS: "TB",
  BUCCANEERS: "TB",
  PACKERS: "GB",
  FALCONS: "ATL",
  COLTS: "IND",
  CHIEFS: "KC",
  VIKINGS: "MIN",
  COMMANDERS: "WAS",
  "49ERS": "SF",
  NINERS: "SF",
  CHARGERS: "LAC",
  TEXANS: "HOU",
  COWBOYS: "DAL",
  RAVENS: "BAL",
  STEELERS: "PIT",
  BEARS: "CHI",
  PATRIOTS: "NE",
  EAGLES: "PHI",
  JAGUARS: "JAX",
  RAIDERS: "LV",
  PANTHERS: "CAR",
  TITANS: "TEN",
  RAMS: "LAR",
  SAINTS: "NO",
  DOLPHINS: "MIA",
  CARDINALS: "ARI",
  BRONCOS: "DEN",
  BROWNS: "CLE",
  GIANTS: "NYG",
  JETS: "NYJ",
  LIONS: "DET",
  PACK: "GB",
  BENGALS: "CIN",
  CHARGER: "LAC",
  TEXAN: "HOU",
  COWBOY: "DAL",
  RAVEN: "BAL",
  STEELER: "PIT",
};

const TEAM_LOGO_SLUGS: Record<string, string> = {
  ARI: "ari",
  ATL: "atl",
  BAL: "bal",
  BUF: "buf",
  CAR: "car",
  CHI: "chi",
  CIN: "cin",
  CLE: "cle",
  DAL: "dal",
  DEN: "den",
  DET: "det",
  GB: "gb",
  HOU: "hou",
  IND: "ind",
  JAX: "jac",
  KC: "kc",
  LV: "rai",
  LAC: "lac",
  LAR: "lar",
  MIA: "mia",
  MIN: "min",
  NE: "ne",
  NO: "no",
  NYG: "nyg",
  NYJ: "nyj",
  PHI: "phi",
  PIT: "pit",
  SEA: "sea",
  SF: "sf",
  TB: "tb",
  TEN: "ten",
  WAS: "wsh",
};

const TEAM_PRIMARY_COLORS: Record<string, string> = {
  ARI: "#97233F",
  ATL: "#A71930",
  BAL: "#241773",
  BUF: "#00338D",
  CAR: "#0085CA",
  CHI: "#0B162A",
  CIN: "#FB4F14",
  CLE: "#FF3C00",
  DAL: "#041E42",
  DEN: "#0C2340",
  DET: "#0076B6",
  GB: "#203731",
  HOU: "#03202F",
  IND: "#002C5F",
  JAX: "#006778",
  KC: "#E31837",
  LV: "#A5ACAF",
  LAC: "#0080C6",
  LAR: "#003594",
  MIA: "#008E97",
  MIN: "#4F2683",
  NE: "#002244",
  NO: "#D3BC8D",
  NYG: "#0B2265",
  NYJ: "#125740",
  PHI: "#004C54",
  PIT: "#FFB612",
  SEA: "#69BE28",
  SF: "#AA0000",
  TB: "#D50A0A",
  TEN: "#4B92DB",
  WAS: "#5A1414",
};

export function getTeamName(code: string): string {
  return TEAM_NAMES[code] ?? code;
}

export function getTeamLogo(identifier: string): string {
  const code = getTeamCode(identifier);
  if (!code) return "";
  const slug = TEAM_LOGO_SLUGS[code] ?? code.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${slug}.png`;
}

export function getTeamPrimaryColor(identifier: string): string {
  const code = getTeamCode(identifier);
  if (!code) return "#6366f1";
  return TEAM_PRIMARY_COLORS[code] ?? "#6366f1";
}

export function getTeamCode(identifier: string): string | undefined {
  if (!identifier) return undefined;
  const trimmed = identifier.trim();
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  if (TEAM_NAMES[upper]) return upper;
  return TEAM_CODE_FROM_NAME[trimmed.toLowerCase()];
}

export function getTeamCodeFromWordmark(label: string): string | undefined {
  if (!label) return undefined;
  const upper = label.toUpperCase();
  const cleaned = upper.replace(/[^A-Z0-9]/g, "");
  return TEAM_WORDMARK_ALIASES[cleaned] ?? TEAM_WORDMARK_ALIASES[upper] ?? getTeamCode(label);
}

export const TG_BF = ["GB", "DET", "KC", "DAL", "CIN", "BAL", "CHI", "PHI"];
export const XMAS = ["DAL", "WAS", "DET", "MIN", "DEN", "KC"];

const TG_SET = new Set(TG_BF);
const XMAS_SET = new Set(XMAS);

export interface Pick {
  week: WeekKey;
  team: string;
  result: Result;
}

export interface EntryConfig {
  name: string;
  picks: Pick[];
}

export interface SpecialGame {
  tag: string;
  date: string;
  time: string;
  away: string;
  home: string;
}

export interface SpecialGameGroup {
  key: string;
  title: string;
  games: SpecialGame[];
}

export interface WeekPickSummary {
  week: WeekKey;
  totalEntries: number;
  uploadedAt: string;
  sourceName?: string;
  picksByTeam: Record<string, number>;
}

export const SPECIAL_GAME_GROUPS: SpecialGameGroup[] = [
  {
    key: "TG_BF",
    title: "Thanksgiving & Black Friday Slate",
    games: [
      { tag: "TG", date: "Thu • Nov 27", time: "12:30p ET", away: "GB", home: "DET" },
      { tag: "TG", date: "Thu • Nov 27", time: "4:30p ET", away: "KC", home: "DAL" },
      { tag: "TG", date: "Thu • Nov 27", time: "8:20p ET", away: "CIN", home: "BAL" },
      { tag: "BF", date: "Fri • Nov 28", time: "3:00p ET", away: "CHI", home: "PHI" },
    ],
  },
  {
    key: "XMAS",
    title: "Christmas Slate",
    games: [
      { tag: "XMAS", date: "Thu • Dec 25", time: "1:00p ET", away: "MIN", home: "DET" },
      { tag: "XMAS", date: "Thu • Dec 25", time: "4:30p ET", away: "WAS", home: "DAL" },
      { tag: "XMAS", date: "Thu • Dec 25", time: "8:15p ET", away: "DEN", home: "KC" },
    ],
  },
];

export interface ContestConfig {
  id: "circa" | "scs";
  title: string;
  shortTitle: string;
  season: number;
  currentWeek: WeekKey;
  weekDates: Record<WeekKey, string>;
  entries: EntryConfig[];
  buyIn: number;
  initialEntries: number;
  liveEntries: number;
  totalPrizePool: number;
  entriesOnChalkTonight: number;
}

const CIRCA_WEEK_DATES: Record<WeekKey, string> = {
  "1": "2025-09-07",
  "2": "2025-09-14",
  "3": "2025-09-21",
  "4": "2025-09-28",
  "5": "2025-10-05",
  "6": "2025-10-12",
  "7": "2025-10-19",
  "8": "2025-10-26",
  "9": "2025-11-02",
  "10": "2025-11-09",
  "11": "2025-11-16",
  "12": "2025-11-23",
  TG: "2025-11-27",
  "13": "2025-11-30",
  "14": "2025-12-07",
  "15": "2025-12-14",
  XMAS: "2025-12-25",
  "16": "2025-12-28",
  "17": "2026-01-04",
};

const CIRCA_ENTRIES: EntryConfig[] = [
  {
    name: "Cremaster Reflex 1",
    picks: [
      { week: "1", team: "ARI", result: "W" },
      { week: "2", team: "LAR", result: "W" },
      { week: "3", team: "SEA", result: "W" },
    ],
  },
  {
    name: "Cremaster Reflex 2",
    picks: [
      { week: "1", team: "DEN", result: "W" },
      { week: "2", team: "ARI", result: "W" },
      { week: "3", team: "TB", result: "W" },
    ],
  },
  {
    name: "BulletProof Tiger 1",
    picks: [
      { week: "1", team: "DEN", result: "W" },
      { week: "2", team: "ARI", result: "W" },
      { week: "3", team: "KC", result: "W" },
    ],
  },
  {
    name: "BulletProof Tiger 2",
    picks: [
      { week: "1", team: "DEN", result: "W" },
      { week: "2", team: "BAL", result: "W" },
      { week: "3", team: "SEA", result: "W" },
    ],
  },
  {
    name: "BulletProof Tiger 3",
    picks: [
      { week: "1", team: "ARI", result: "W" },
      { week: "2", team: "DAL", result: "W" },
      { week: "3", team: "BUF", result: "W" },
    ],
  },
  {
    name: "ChiPhi 1",
    picks: [
      { week: "1", team: "JAX", result: "W" },
      { week: "2", team: "DET", result: "W" },
      { week: "3", team: "KC", result: "W" },
    ],
  },
  {
    name: "Creamsicle Cabana",
    picks: [
      { week: "1", team: "WAS", result: "W" },
      { week: "2", team: "DAL", result: "W" },
      { week: "3", team: "SEA", result: "W" },
    ],
  },
  {
    name: "Gambling Grocer-7",
    picks: [
      { week: "1", team: "CIN", result: "W" },
      { week: "2", team: "DET", result: "W" },
      { week: "3", team: "KC", result: "W" },
    ],
  },
  {
    name: "SlyBiz",
    picks: [
      { week: "1", team: "ARI", result: "W" },
      { week: "2", team: "DAL", result: "W" },
      { week: "3", team: "GB", result: "L" },
    ],
  },
];

export const CIRCA_CONTEST: ContestConfig = {
  id: "circa",
  title: "DeadlineNoon — Circa Survivor",
  shortTitle: "Circa Survivor",
  season: 2025,
  currentWeek: "4",
  weekDates: CIRCA_WEEK_DATES,
  entries: CIRCA_ENTRIES,
  buyIn: 1000,
  initialEntries: 18718,
  liveEntries: 16908,
  totalPrizePool: 18718000,
  entriesOnChalkTonight: 0,
};

const SCS_WEEK_DATES: Record<WeekKey, string> = {
  "1": "2025-09-07",
  "2": "2025-09-14",
  "3": "2025-09-21",
  "4": "2025-09-28",
  "5": "2025-10-05",
  "6": "2025-10-12",
  "7": "2025-10-19",
  "8": "2025-10-26",
  "9": "2025-11-02",
  "10": "2025-11-09",
  "11": "2025-11-16",
  "12": "2025-11-23",
  "13": "2025-11-30",
  "14": "2025-12-07",
  "15": "2025-12-14",
  "16": "2025-12-28",
  "17": "2026-01-04",
};

const SCS_ENTRIES: EntryConfig[] = [
  {
    name: "Doigetashirtwiththat",
    picks: [
      { week: "1", team: "JAX", result: "W" },
      { week: "2", team: "DET", result: "W" },
      { week: "3", team: "KC", result: "W" },
    ],
  },
];

export const SCS_FORCED_WINS: Record<string, string> = {
  "1": "Jaguars",
  "2": "Lions",
  "3": "Chiefs",
};

export const SCS_CONTEST: ContestConfig = {
  id: "scs",
  title: "DeadlineNoon — SuperContest Survivor",
  shortTitle: "SuperContest Survivor",
  season: 2025,
  currentWeek: "4",
  weekDates: SCS_WEEK_DATES,
  entries: SCS_ENTRIES,
  buyIn: 5000,
  initialEntries: 111,
  liveEntries: 81,
  totalPrizePool: 555000,
  entriesOnChalkTonight: 0,
};

const WEEK_LABEL_MAP: Record<WeekKey, string> = {
  TG: "Thanksgiving + Black Friday",
  XMAS: "Christmas",
};

export const SPECIAL_THRESHOLD = 0.4;
export const TG_THRESHOLD = Math.ceil(TG_BF.length * SPECIAL_THRESHOLD);
export const XMAS_THRESHOLD = Math.ceil(XMAS.length * SPECIAL_THRESHOLD);

function weekOrder(config: ContestConfig): WeekKey[] {
  return Object.keys(config.weekDates);
}

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUSD(value: number): string {
  return formatter.format(value);
}

export function weekLabel(week: WeekKey): string {
  return WEEK_LABEL_MAP[week] ?? `Week ${week}`;
}

function poolForWeek(week: WeekKey): string[] {
  if (week === "TG") return TG_BF;
  if (week === "XMAS") return XMAS;
  return NFL_TEAMS;
}

function formatDateLabel(dateIso: string | undefined): string {
  if (!dateIso) return "";
  const date = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateIso;
  return Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export interface EntryView {
  name: string;
  eliminated: boolean;
  eliminationReason?: string;
  used: Array<{
    week: WeekKey;
    label: string;
    team: string;
    teamName: string;
    result: Result;
  }>;
  availableTeams: Array<{ code: string; name: string }>;
  special: {
    tgUsed: number;
    tgAvailable: Array<{ code: string; name: string }>;
    xmUsed: number;
    xmAvailable: Array<{ code: string; name: string }>;
  };
}

export interface ContestView {
  config: ContestConfig;
  activeCount: number;
  totalEntries: number;
  currentWeekLabel: string;
  currentWeekDateLabel: string;
  entries: EntryView[];
  weekOrder: WeekKey[];
  weekSummaries?: Partial<Record<WeekKey, WeekPickSummary>>;
  currentWeekSummary?: WeekPickSummary | null;
}

export function computeContestView(config: ContestConfig): ContestView {
  const order = weekOrder(config);
  const orderIndex = new Map<WeekKey, number>(order.map((wk, idx) => [wk, idx]));
  const currentIndex = orderIndex.get(config.currentWeek) ?? (order.length - 1);

  const entries: EntryView[] = config.entries.map((entry) => {
    const sorted = [...entry.picks].sort((a, b) => {
      const ia = orderIndex.get(a.week) ?? 0;
      const ib = orderIndex.get(b.week) ?? 0;
      return ia - ib;
    });

    const usedThroughCurrent = sorted.filter((pick) => {
      const idx = orderIndex.get(pick.week) ?? 0;
      return idx <= currentIndex;
    });

    let eliminated = false;
    let eliminationPick: Pick | null = null;
    for (const pick of usedThroughCurrent) {
      if (pick.result === "L" || pick.result === "T") {
        eliminated = true;
        eliminationPick = pick;
        break;
      }
    }

    const usedSet = new Set(usedThroughCurrent.map((pick) => pick.team));
    const priorSet = new Set(
      sorted
        .filter((pick) => {
          const idx = orderIndex.get(pick.week) ?? 0;
          return idx < currentIndex;
        })
        .map((pick) => pick.team),
    );

    const pool = poolForWeek(config.currentWeek);
    const availableTeams = eliminated
      ? []
      : pool.filter((team) => !priorSet.has(team));

    const tgUsed = Array.from(usedSet).filter((team) => TG_SET.has(team)).length;
    const xmUsed = Array.from(usedSet).filter((team) => XMAS_SET.has(team)).length;

    const tgAvailable = TG_BF.filter((team) => !priorSet.has(team));
    const xmAvailable = XMAS.filter((team) => !priorSet.has(team));

    const usedDetails = usedThroughCurrent.map((pick) => ({
      week: pick.week,
      label: weekLabel(pick.week),
      team: pick.team,
      teamName: TEAM_NAMES[pick.team] ?? pick.team,
      result: pick.result,
    }));

    const eliminationReason = eliminationPick
      ? `Loss in ${weekLabel(eliminationPick.week)} (${TEAM_NAMES[eliminationPick.team] ?? eliminationPick.team})`
      : undefined;

    return {
      name: entry.name,
      eliminated,
      eliminationReason,
      used: usedDetails,
      availableTeams: availableTeams.map((team) => ({ code: team, name: getTeamName(team) })),
      special: {
        tgUsed,
        tgAvailable: tgAvailable.map((team) => ({ code: team, name: getTeamName(team) })),
        xmUsed,
        xmAvailable: xmAvailable.map((team) => ({ code: team, name: getTeamName(team) })),
      },
    };
  });

  const activeCount = entries.filter((entry) => !entry.eliminated).length;

  return {
    config,
    activeCount,
    totalEntries: config.entries.length,
    currentWeekLabel: weekLabel(config.currentWeek),
    currentWeekDateLabel: formatDateLabel(config.weekDates[config.currentWeek]),
    entries,
    weekOrder: order,
  };
}
