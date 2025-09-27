import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "./system-store";

const access = vi.fn();
const readFile = vi.fn();
const writeFile = vi.fn();
const mkdir = vi.fn();

vi.mock("node:fs/promises", () => ({
  __esModule: true,
  default: {
    access,
    readFile,
    writeFile,
    mkdir,
  },
  access,
  readFile,
  writeFile,
  mkdir,
}));

const head = vi.fn();
const put = vi.fn();
class MockBlobNotFoundError extends Error {}

vi.mock("@vercel/blob", () => ({
  head: (...args: any[]) => head(...args),
  put: (...args: any[]) => put(...args),
  BlobNotFoundError: MockBlobNotFoundError,
}));

const fetchMock = vi.fn();
const realFetch = globalThis.fetch;
const originalEnv = { ...process.env };

const DATA_DIR = ".data";
const DATA_FILE = `${DATA_DIR}/dashboard.json`;
const DEFAULT_BLOB_PATH = "system/dashboard.json";

function setEnv(key: string, value?: string) {
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>)[key];
  } else {
    (process.env as Record<string, string | undefined>)[key] = value;
  }
}

async function loadSystemStore() {
  vi.resetModules();
  return import("./system-store");
}

function expectDefaultDashboard(data: DashboardData) {
  expect(Array.isArray(data.analytics.metrics)).toBe(true);
  expect(typeof data.analytics.updatedAt).toBe("string");
  expect(data.note).toBeNull();
  expect(data.errors).toEqual([]);
  expect(data.rootingOverride ?? null).toBeNull();
}

beforeEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = fetchMock as any;

  access.mockReset().mockResolvedValue(undefined);
  readFile.mockReset();
  writeFile.mockReset().mockResolvedValue(undefined);
  mkdir.mockReset().mockResolvedValue(undefined);

  head.mockReset();
  put.mockReset();
  fetchMock.mockReset();
});

afterEach(() => {
  globalThis.fetch = realFetch as any;
  process.env = { ...originalEnv };
});

describe("readDashboard via getDashboard", () => {
  it("uses Blob when token exists: head() + fetch(downloadUrl) + parse", async () => {
    setEnv("BLOB_READ_WRITE_TOKEN", "rw_123");

    const sut = await loadSystemStore();

    head.mockResolvedValueOnce({ downloadUrl: "https://blob.example/dashboard.json" });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          analytics: { updatedAt: "2024-01-01T00:00:00.000Z", metrics: [] },
          note: { message: "hi", updatedAt: "2024-01-01T00:00:00.000Z" },
          errors: [],
          rootingOverride: null,
        }),
        { status: 200 },
      ),
    );

    const result = await sut.getDashboard();

    expect(head).toHaveBeenCalledWith(DEFAULT_BLOB_PATH, { token: "rw_123" });
    expect(fetchMock).toHaveBeenCalledWith("https://blob.example/dashboard.json");
    expect(result.note?.message).toBe("hi");
    expect(result.analytics.metrics).toEqual([]);
  });

  it("on BlobNotFoundError seeds with DEFAULT via put() and returns DEFAULT", async () => {
    setEnv("BLOB_READ_WRITE_TOKEN", "rw_123");

    const sut = await loadSystemStore();

    head.mockRejectedValueOnce(new MockBlobNotFoundError("not found"));
    put.mockResolvedValueOnce({});
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      /* noop */
    });

    const result = await sut.getDashboard();

    expect(put).toHaveBeenCalledTimes(1);
    const [pathArg, body, options] = put.mock.calls[0];
    expect(pathArg).toBe(DEFAULT_BLOB_PATH);
    expect(options).toMatchObject({
      token: "rw_123",
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    const seeded = JSON.parse(body as string);
    expect(seeded.errors).toEqual([]);
    expect(seeded.note).toBeNull();
    expectDefaultDashboard(result);

    consoleErrorSpy.mockRestore();
  });

  it("on other Blob error logs and returns DEFAULT without throwing", async () => {
    setEnv("BLOB_READ_WRITE_TOKEN", "rw_123");

    const sut = await loadSystemStore();

    head.mockRejectedValueOnce(new Error("network down"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      /* noop */
    });

    const result = await sut.getDashboard();

    expectDefaultDashboard(result);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("without token: reads from fs when file exists", async () => {
    const sut = await loadSystemStore();

    const localDashboard: DashboardData = {
      analytics: { updatedAt: "2024-01-01T00:00:00.000Z", metrics: [] },
      note: { message: "local", updatedAt: "2024-01-02T00:00:00.000Z" },
      errors: [],
      rootingOverride: null,
    };

    readFile.mockResolvedValueOnce(JSON.stringify(localDashboard));

    const result = await sut.getDashboard();

    expect(readFile).toHaveBeenCalledWith(DATA_FILE, "utf8");
    expect(result.note?.message).toBe("local");
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("without token and missing file: seeds default and returns it", async () => {
    const sut = await loadSystemStore();

    readFile.mockRejectedValueOnce(new Error("missing"));

    const result = await sut.getDashboard();

    expect(mkdir).toHaveBeenCalledWith(DATA_DIR, { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(DATA_FILE, expect.any(String), "utf8");
    const seeded = JSON.parse(writeFile.mock.calls[0][1] as string);
    expect(seeded.errors).toEqual([]);
    expectDefaultDashboard(result);
  });

  it("invalid JSON returns DEFAULT_DASHBOARD", async () => {
    const sut = await loadSystemStore();

    readFile.mockResolvedValueOnce("{bad json");

    const result = await sut.getDashboard();
    expectDefaultDashboard(result);
  });
});

describe("writeDashboard via setPinnedNote", () => {
  const baseDashboard: DashboardData = {
    analytics: { updatedAt: "2024-01-01T00:00:00.000Z", metrics: [] },
    note: null,
    errors: [],
    rootingOverride: null,
  };

  it("with token calls put() with JSON payload and options", async () => {
    setEnv("BLOB_READ_WRITE_TOKEN", "rw_123");

    const sut = await loadSystemStore();

    head.mockResolvedValueOnce({ downloadUrl: "https://blob.example/dashboard.json" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(baseDashboard), { status: 200 }));

    await sut.setPinnedNote({ message: "memo" });

    expect(put).toHaveBeenCalledTimes(1);
    const [pathArg, body, options] = put.mock.calls[0];
    expect(pathArg).toBe(DEFAULT_BLOB_PATH);
    expect(JSON.parse(body as string)).toMatchObject({ note: { message: "memo" } });
    expect(options).toMatchObject({
      token: "rw_123",
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    expect(writeFile).toHaveBeenCalledWith(
      DATA_FILE,
      expect.stringContaining("\"memo\""),
      "utf8",
    );
  });

  it("falls back to fs write when put() throws", async () => {
    setEnv("BLOB_READ_WRITE_TOKEN", "rw_123");

    const sut = await loadSystemStore();

    head.mockResolvedValueOnce({ downloadUrl: "https://blob.example/dashboard.json" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(baseDashboard), { status: 200 }));
    put.mockRejectedValueOnce(new Error("denied"));

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      /* noop */
    });

    await sut.setPinnedNote({ message: "fallback" });

    expect(put).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledWith(
      DATA_FILE,
      expect.stringContaining("\"fallback\""),
      "utf8",
    );
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("without token writes directly to fs", async () => {
    const sut = await loadSystemStore();

    readFile.mockResolvedValueOnce(JSON.stringify(baseDashboard));

    await sut.setPinnedNote({ message: "fs-only" });

    expect(put).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith(
      DATA_FILE,
      expect.stringContaining("\"fs-only\""),
      "utf8",
    );
  });
});

describe("listErrors", () => {
  it("merges external log fields with overrides and normalises timestamps", async () => {
    setEnv("SURVIVOR_ERROR_LOG_PATH", "tmp/external-errors.json");

    const sut = await loadSystemStore();

    readFile
      .mockResolvedValueOnce(
        JSON.stringify({
          analytics: { updatedAt: "2024-01-01T00:00:00.000Z", metrics: [] },
          note: null,
          errors: [
            {
              id: "abc",
              timestamp: "2024-01-01T00:00:00.000Z",
              source: "ops",
              message: "Original message",
              status: "investigating",
            },
          ],
          rootingOverride: null,
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify([
          {
            id: "abc",
            time: "2024-01-01T01:00:00Z",
            source: "infra",
            message: "CPU spike",
            occurrences: 5,
          },
          {
            id: "def",
            date: "2024-01-02T00:00:00Z",
            service: "cron-worker",
            error: "Over capacity",
            status: "resolved",
            count: 2,
          },
        ]),
      );

    const result = await sut.listErrors();

    expect(result).toHaveLength(2);
    const [latest, earlier] = result;

    expect(latest).toMatchObject({
      id: "def",
      timestamp: "2024-01-02T00:00:00.000Z",
      source: "cron-worker",
      message: "Over capacity",
      status: "resolved",
      count: 2,
    });

    expect(earlier).toMatchObject({
      id: "abc",
      timestamp: "2024-01-01T01:00:00.000Z",
      source: "infra",
      status: "investigating",
      count: 5,
    });
  });
});
