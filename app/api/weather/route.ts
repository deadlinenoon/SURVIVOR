import { NextResponse } from "next/server";
import {
  emojiForWeather,
  formatDetail,
  formatSummary,
  formatWindLabel,
  getStadiumMeta,
  indoorWeatherPayload,
  StadiumMeta,
} from "@/lib/weather";

type WeatherSnapshot = {
  emoji: string;
  summary: string;
  wind: string;
  detail: string;
  stadium: StadiumMeta;
  indoor: boolean;
  tempF?: number;
  precipType?: "rain" | "snow" | null;
  precipIntensity?: number;
  thunderstorm?: boolean;
   windMeta: {
     speed?: number;
     direction?: number;
     gust?: number;
   };
};

function buildUnavailable(team: string, stadium?: StadiumMeta): WeatherSnapshot {
  const fallback =
    stadium ??
    ({
      team,
      name: team,
      city: "",
      state: "",
      latitude: 0,
      longitude: 0,
      indoor: false,
      timezone: "America/New_York",
    } satisfies StadiumMeta);

  return {
    emoji: "❔",
    summary: "Weather unavailable",
    wind: "Forecast not returned",
    detail: fallback.city ? `${fallback.city}, ${fallback.state}` : "Awaiting location data",
    stadium: fallback,
    indoor: fallback.indoor,
    tempF: undefined,
    precipType: null,
    precipIntensity: 0,
    thunderstorm: false,
    windMeta: {},
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamsParam = url.searchParams.get("teams");
  if (!teamsParam) {
    return NextResponse.json({ error: "missing_teams" }, { status: 400 });
  }

  const apiKey =
    process.env.OPENWEATHER_API_KEY ?? process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing_openweather_api_key" }, { status: 500 });
  }

  const teams = Array.from(
    new Set(
      teamsParam
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  const snapshots: Record<string, WeatherSnapshot> = {};

  await Promise.all(
    teams.map(async (team) => {
      const stadium = getStadiumMeta(team);
      if (!stadium) {
        snapshots[team] = buildUnavailable(team);
        return;
      }

      if (stadium.indoor) {
        snapshots[team] = {
          ...indoorWeatherPayload(stadium),
          stadium,
          indoor: true,
          tempF: undefined,
          precipType: null,
          precipIntensity: 0,
          thunderstorm: false,
          windMeta: { speed: 0, direction: 0, gust: 0 },
        };
        return;
      }

      try {
        const endpoint = new URL("https://api.openweathermap.org/data/3.0/onecall");
        endpoint.searchParams.set("lat", stadium.latitude.toString());
        endpoint.searchParams.set("lon", stadium.longitude.toString());
        endpoint.searchParams.set("appid", apiKey);
        endpoint.searchParams.set("units", "imperial");
        endpoint.searchParams.set("exclude", "minutely,hourly,daily,alerts");

        const response = await fetch(endpoint.toString(), {
          cache: "no-store",
        });

        if (!response.ok) {
          snapshots[team] = buildUnavailable(team, stadium);
          return;
        }

        const data = await response.json();
        const current = (data as any)?.current ?? {};
        const condition = current.weather?.[0];

        const windSpeed = typeof current.wind_speed === "number" ? current.wind_speed : undefined;
        const windDeg = typeof current.wind_deg === "number" ? current.wind_deg : undefined;
        const windGust = typeof current.wind_gust === "number" ? current.wind_gust : undefined;

        const tempF = typeof current.temp === "number" ? current.temp : undefined;

        const { precipType, intensity, thunderstorm } = parsePrecipitation(
          condition?.id,
          current.rain,
          current.snow,
        );

        snapshots[team] = {
          emoji: emojiForWeather(condition?.id, condition?.icon),
          summary: formatSummary(current.temp, condition?.description, false),
          wind: formatWindLabel(windSpeed, windDeg, windGust),
          detail: formatDetail(stadium, {
            feelsLike: typeof current.feels_like === "number" ? current.feels_like : undefined,
            humidity: typeof current.humidity === "number" ? current.humidity : undefined,
          }),
          stadium,
          indoor: false,
          tempF,
          precipType,
          precipIntensity: intensity,
          thunderstorm,
          windMeta: {
            speed: windSpeed,
            direction: windDeg,
            gust: windGust,
          },
        };
      } catch (error) {
        snapshots[team] = buildUnavailable(team, stadium);
      }
    }),
  );

  return NextResponse.json(
    {
      fetchedAt: new Date().toISOString(),
      data: snapshots,
    },
    { status: 200 },
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeIntensity(rate: number | undefined, heavyScale: number) {
  if (rate === undefined || Number.isNaN(rate) || rate <= 0) return 0;
  return clamp(rate / heavyScale, 0, 1);
}

function parsePrecipitation(
  weatherId?: number,
  rain?: { [key: string]: number } | number,
  snow?: { [key: string]: number } | number,
) {
  let precipType: "rain" | "snow" | null = null;
  let intensity = 0;
  let thunderstorm = false;

  if (typeof weatherId === "number") {
    if (weatherId >= 200 && weatherId < 300) {
      thunderstorm = true;
      precipType = "rain";
      intensity = Math.max(intensity, 0.8);
    } else if (weatherId >= 300 && weatherId < 600) {
      precipType = "rain";
      intensity = Math.max(intensity, weatherId < 400 ? 0.3 : 0.6);
    } else if (weatherId >= 600 && weatherId < 700) {
      precipType = "snow";
      intensity = Math.max(intensity, weatherId < 603 ? 0.35 : 0.75);
    }
  }

  const rainRate = typeof rain === "number" ? rain : typeof rain?.["1h"] === "number" ? rain["1h"] : undefined;
  if (rainRate !== undefined) {
    precipType = "rain";
    intensity = Math.max(intensity, normalizeIntensity(rainRate, 5));
  }

  const snowRate = typeof snow === "number" ? snow : typeof snow?.["1h"] === "number" ? snow["1h"] : undefined;
  if (snowRate !== undefined) {
    precipType = "snow";
    intensity = Math.max(intensity, normalizeIntensity(snowRate, 2));
  }

  if (!precipType) {
    intensity = 0;
  }

  return { precipType, intensity, thunderstorm };
}
