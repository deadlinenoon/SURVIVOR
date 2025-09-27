export interface StadiumMeta {
  team: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  indoor: boolean;
  timezone: string;
  orientationDeg?: number;
}

export const TEAM_STADIUMS = {
  ARI: {
    team: "ARI",
    name: "State Farm Stadium",
    city: "Glendale",
    state: "AZ",
    latitude: 33.5276,
    longitude: -112.2626,
    indoor: true,
    timezone: "America/Phoenix",
  },
  ATL: {
    team: "ATL",
    name: "Mercedes-Benz Stadium",
    city: "Atlanta",
    state: "GA",
    latitude: 33.7554,
    longitude: -84.4008,
    indoor: true,
    timezone: "America/New_York",
  },
  BAL: {
    team: "BAL",
    name: "M&T Bank Stadium",
    city: "Baltimore",
    state: "MD",
    latitude: 39.278,
    longitude: -76.6227,
    indoor: false,
    timezone: "America/New_York",
  },
  BUF: {
    team: "BUF",
    name: "Highmark Stadium",
    city: "Orchard Park",
    state: "NY",
    latitude: 42.7738,
    longitude: -78.787,
    indoor: false,
    timezone: "America/New_York",
  },
  CAR: {
    team: "CAR",
    name: "Bank of America Stadium",
    city: "Charlotte",
    state: "NC",
    latitude: 35.2251,
    longitude: -80.8526,
    indoor: false,
    timezone: "America/New_York",
  },
  CHI: {
    team: "CHI",
    name: "Soldier Field",
    city: "Chicago",
    state: "IL",
    latitude: 41.8625,
    longitude: -87.6166,
    indoor: false,
    timezone: "America/Chicago",
  },
  CIN: {
    team: "CIN",
    name: "Paycor Stadium",
    city: "Cincinnati",
    state: "OH",
    latitude: 39.0955,
    longitude: -84.5161,
    indoor: false,
    timezone: "America/New_York",
  },
  CLE: {
    team: "CLE",
    name: "Cleveland Browns Stadium",
    city: "Cleveland",
    state: "OH",
    latitude: 41.5061,
    longitude: -81.6995,
    indoor: false,
    timezone: "America/New_York",
  },
  DAL: {
    team: "DAL",
    name: "AT&T Stadium",
    city: "Arlington",
    state: "TX",
    latitude: 32.7473,
    longitude: -97.0945,
    indoor: true,
    timezone: "America/Chicago",
  },
  DEN: {
    team: "DEN",
    name: "Empower Field at Mile High",
    city: "Denver",
    state: "CO",
    latitude: 39.7439,
    longitude: -105.02,
    indoor: false,
    timezone: "America/Denver",
  },
  DET: {
    team: "DET",
    name: "Ford Field",
    city: "Detroit",
    state: "MI",
    latitude: 42.339,
    longitude: -83.0456,
    indoor: true,
    timezone: "America/Detroit",
  },
  GB: {
    team: "GB",
    name: "Lambeau Field",
    city: "Green Bay",
    state: "WI",
    latitude: 44.5013,
    longitude: -88.0622,
    indoor: false,
    timezone: "America/Chicago",
  },
  HOU: {
    team: "HOU",
    name: "NRG Stadium",
    city: "Houston",
    state: "TX",
    latitude: 29.6847,
    longitude: -95.4107,
    indoor: true,
    timezone: "America/Chicago",
  },
  IND: {
    team: "IND",
    name: "Lucas Oil Stadium",
    city: "Indianapolis",
    state: "IN",
    latitude: 39.7601,
    longitude: -86.1639,
    indoor: true,
    timezone: "America/Indiana/Indianapolis",
  },
  JAX: {
    team: "JAX",
    name: "EverBank Stadium",
    city: "Jacksonville",
    state: "FL",
    latitude: 30.3239,
    longitude: -81.6373,
    indoor: false,
    timezone: "America/New_York",
  },
  KC: {
    team: "KC",
    name: "GEHA Field at Arrowhead Stadium",
    city: "Kansas City",
    state: "MO",
    latitude: 39.0489,
    longitude: -94.4839,
    indoor: false,
    timezone: "America/Chicago",
  },
  LV: {
    team: "LV",
    name: "Allegiant Stadium",
    city: "Las Vegas",
    state: "NV",
    latitude: 36.0909,
    longitude: -115.1833,
    indoor: true,
    timezone: "America/Los_Angeles",
  },
  LAC: {
    team: "LAC",
    name: "SoFi Stadium",
    city: "Inglewood",
    state: "CA",
    latitude: 33.9535,
    longitude: -118.338,
    indoor: true,
    timezone: "America/Los_Angeles",
  },
  LAR: {
    team: "LAR",
    name: "SoFi Stadium",
    city: "Inglewood",
    state: "CA",
    latitude: 33.9535,
    longitude: -118.338,
    indoor: true,
    timezone: "America/Los_Angeles",
  },
  MIA: {
    team: "MIA",
    name: "Hard Rock Stadium",
    city: "Miami Gardens",
    state: "FL",
    latitude: 25.958,
    longitude: -80.2389,
    indoor: false,
    timezone: "America/New_York",
  },
  MIN: {
    team: "MIN",
    name: "U.S. Bank Stadium",
    city: "Minneapolis",
    state: "MN",
    latitude: 44.9738,
    longitude: -93.2572,
    indoor: true,
    timezone: "America/Chicago",
  },
  NE: {
    team: "NE",
    name: "Gillette Stadium",
    city: "Foxborough",
    state: "MA",
    latitude: 42.0909,
    longitude: -71.2643,
    indoor: false,
    timezone: "America/New_York",
  },
  NO: {
    team: "NO",
    name: "Caesars Superdome",
    city: "New Orleans",
    state: "LA",
    latitude: 29.9509,
    longitude: -90.0814,
    indoor: true,
    timezone: "America/Chicago",
  },
  NYG: {
    team: "NYG",
    name: "MetLife Stadium",
    city: "East Rutherford",
    state: "NJ",
    latitude: 40.8135,
    longitude: -74.0745,
    indoor: false,
    timezone: "America/New_York",
  },
  NYJ: {
    team: "NYJ",
    name: "MetLife Stadium",
    city: "East Rutherford",
    state: "NJ",
    latitude: 40.8135,
    longitude: -74.0745,
    indoor: false,
    timezone: "America/New_York",
  },
  PHI: {
    team: "PHI",
    name: "Lincoln Financial Field",
    city: "Philadelphia",
    state: "PA",
    latitude: 39.9008,
    longitude: -75.1675,
    indoor: false,
    timezone: "America/New_York",
  },
  PIT: {
    team: "PIT",
    name: "Acrisure Stadium",
    city: "Pittsburgh",
    state: "PA",
    latitude: 40.4468,
    longitude: -80.0158,
    indoor: false,
    timezone: "America/New_York",
  },
  SEA: {
    team: "SEA",
    name: "Lumen Field",
    city: "Seattle",
    state: "WA",
    latitude: 47.5952,
    longitude: -122.3316,
    indoor: false,
    timezone: "America/Los_Angeles",
  },
  SF: {
    team: "SF",
    name: "Levi's Stadium",
    city: "Santa Clara",
    state: "CA",
    latitude: 37.403,
    longitude: -121.97,
    indoor: false,
    timezone: "America/Los_Angeles",
  },
  TB: {
    team: "TB",
    name: "Raymond James Stadium",
    city: "Tampa",
    state: "FL",
    latitude: 27.9759,
    longitude: -82.5033,
    indoor: false,
    timezone: "America/New_York",
  },
  TEN: {
    team: "TEN",
    name: "Nissan Stadium",
    city: "Nashville",
    state: "TN",
    latitude: 36.1665,
    longitude: -86.7713,
    indoor: false,
    timezone: "America/Chicago",
  },
  WAS: {
    team: "WAS",
    name: "Commanders Field",
    city: "Landover",
    state: "MD",
    latitude: 38.9077,
    longitude: -76.8645,
    indoor: false,
    timezone: "America/New_York",
  },
} as const satisfies Record<string, StadiumMeta>;

export type TeamCode = keyof typeof TEAM_STADIUMS;

export function getStadiumMeta(team: string): StadiumMeta | undefined {
  return TEAM_STADIUMS[team.toUpperCase() as TeamCode];
}

export function formatWindDirection(degrees?: number): string {
  if (degrees === undefined || Number.isNaN(degrees)) return "VRB";
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % dirs.length;
  return dirs[index];
}

export function describeWindRelativeToField(degrees?: number): string {
  if (degrees === undefined || Number.isNaN(degrees)) return "variable across the field";
  const normalized = ((degrees % 360) + 360) % 360;
  const sector = (value: number, center: number) => {
    const diff = Math.abs((((value - center) % 360) + 540) % 360 - 180);
    return diff <= 22.5;
  };

  if (sector(normalized, 0)) return "toward the north uprights";
  if (sector(normalized, 180)) return "toward the south uprights";
  if (sector(normalized, 90)) return "across the field toward the east sideline";
  if (sector(normalized, 270)) return "across the field toward the west sideline";
  if (normalized > 0 && normalized < 90) return "into the northeast corner";
  if (normalized > 90 && normalized < 180) return "into the southeast corner";
  if (normalized > 180 && normalized < 270) return "into the southwest corner";
  return "into the northwest corner";
}

export function formatWindLabel(
  speed?: number,
  direction?: number,
  gust?: number,
): string {
  if (speed === undefined || Number.isNaN(speed) || speed < 0.5) {
    return "Calm";
  }
  const dirLabel = formatWindDirection(direction);
  const relative = describeWindRelativeToField(direction);
  const gustLabel = gust !== undefined && Number.isFinite(gust) && gust > speed + 1
    ? `; gusting to ${Math.round(gust)} mph`
    : "";
  return `${dirLabel} ${Math.round(speed)} mph (${relative}${gustLabel})`;
}

export function emojiForWeather(weatherId?: number, icon?: string): string {
  if (!weatherId) return "🌡️";
  if (weatherId >= 200 && weatherId < 300) return "⛈️";
  if (weatherId >= 300 && weatherId < 600) return "🌧️";
  if (weatherId >= 600 && weatherId < 700) return "❄️";
  if (weatherId >= 700 && weatherId < 800) return "🌫️";
  if (weatherId === 800) return icon?.includes("n") ? "🌙" : "☀️";
  if (weatherId === 801 || weatherId === 802) return "⛅";
  if (weatherId === 803 || weatherId === 804) return "☁️";
  return "🌡️";
}

export function formatSummary(temp?: number, description?: string, indoor = false): string {
  if (indoor) return "Indoors • Climate controlled";
  const readable = description ? `${description.charAt(0).toUpperCase()}${description.slice(1)}` : "Conditions";
  if (temp === undefined || Number.isNaN(temp)) return readable;
  return `${readable} · ${Math.round(temp)}°F`;
}

export function formatDetail(
  stadium: StadiumMeta,
  {
    feelsLike,
    humidity,
  }: {
    feelsLike?: number;
    humidity?: number;
  } = {},
): string {
  const parts = [`${stadium.city}, ${stadium.state}`];
  if (feelsLike !== undefined && Number.isFinite(feelsLike)) {
    parts.push(`Feels like ${Math.round(feelsLike)}°F`);
  }
  if (humidity !== undefined && Number.isFinite(humidity)) {
    parts.push(`Humidity ${Math.round(humidity)}%`);
  }
  return parts.join(" • ");
}

export function indoorWeatherPayload(stadium: StadiumMeta) {
  return {
    emoji: "🏟️",
    summary: "Indoors • Climate controlled",
    wind: "No wind — roof closed",
    detail: `${stadium.city}, ${stadium.state}`,
    windMeta: {
      speed: 0,
      direction: 0,
    },
  };
}
