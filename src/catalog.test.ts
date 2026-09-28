import { drawRandom, searchTitles } from "./catalog";

const either = { mediaType: "either" as const };

function discoverPage(results: Record<string, unknown>[]) {
  return new Response(JSON.stringify({ results }), { status: 200 });
}

function providers(flatrate: { provider_id: number; provider_name: string }[]) {
  return new Response(JSON.stringify({ results: { US: { flatrate } } }), { status: 200 });
}

function movie(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Cozy Night",
    overview: "A warm diner story about soup",
    popularity: 20,
    poster_path: "/poster.jpg",
    release_date: "2020-04-01",
    runtime: 95,
    media_type: "movie",
    ...overrides,
  };
}

describe("catalog", () => {
  it("sends subscription constraints and omits sentence constraints for random", async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/watch/providers")) return providers([{ provider_id: 8, provider_name: "Netflix" }]);
      return discoverPage([movie()]);
    };

    await drawRandom({
      sentence: "horror under 2 hours",
      form: { mediaType: "movie", runtimeMax: 90 },
      country: "US",
      providerIds: [8, 1899, 384],
      apiKey: "key",
      fetch: fetchImpl,
      random: () => 0,
    });

    const discoverUrls = urls.filter((url) => url.includes("/discover/"));
    expect(discoverUrls.some((url) => url.includes("/discover/movie"))).toBe(true);
    expect(discoverUrls.some((url) => url.includes("/discover/tv"))).toBe(true);
    for (const url of discoverUrls) {
      const params = new URL(url).searchParams;
      expect(params.get("watch_region")).toBe("US");
      expect(params.get("with_watch_monetization_types")).toBe("flatrate");
      expect(params.get("with_watch_providers")).toBe("8|1899|384");
      expect(params.get("sort_by")).toBe("popularity.desc");
      expect(params.has("with_genres")).toBe(false);
      expect(params.has("with_runtime.gte")).toBe(false);
      expect(params.has("with_runtime.lte")).toBe(false);
    }
  });

  it("applies active search constraints on discover", async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/watch/providers")) return providers([{ provider_id: 8, provider_name: "Netflix" }]);
      return discoverPage([movie({ overview: "A warm diner story about soup" })]);
    };

    const result = await searchTitles({
      sentence: "cozy soup under 2 hours",
      form: either,
      country: "US",
      providerIds: [8],
      apiKey: "key",
      fetch: fetchImpl,
    });

    const movieUrl = urls.find((url) => url.includes("/discover/movie"));
    const params = new URL(movieUrl ?? "").searchParams;
    expect(params.get("with_runtime.lte")).toBe("120");
    expect(params.get("with_watch_providers")).toBe("8");
    expect(result.kind).toBe("results");
    if (result.kind === "results") {
      expect(result.cards[0]?.title).toBe("Cozy Night");
      expect(result.cards[0]?.services.map((service) => service.label)).toEqual(["Netflix"]);
      expect(result.cards[0]?.services[0]?.href).toBe("https://www.themoviedb.org/movie/1/watch?locale=US");
    }
  });

  it("ignores a later page failure after the first page succeeds", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("page=2")) return new Response("nope", { status: 500 });
      if (url.includes("/watch/providers")) return providers([{ provider_id: 8, provider_name: "Netflix" }]);
      return discoverPage([movie()]);
    };
    const result = await searchTitles({
      sentence: "soup",
      form: { mediaType: "movie" },
      country: "US",
      providerIds: [8],
      apiKey: "key",
      fetch: fetchImpl,
    });
    expect(result.kind).toBe("results");
  });

  it("reports nothing matched without describing a catalog failure when the filter removes every title", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/watch/providers")) return providers([{ provider_id: 8, provider_name: "Netflix" }]);
      return discoverPage([movie({ title: "Other", overview: "A heist" })]);
    };
    const result = await searchTitles({
      sentence: "zzzzunique",
      form: { mediaType: "movie" },
      country: "US",
      providerIds: [8],
      apiKey: "key",
      fetch: fetchImpl,
    });
    expect(result).toEqual({ kind: "empty", message: "Nothing matched." });
  });

  it("returns a catalog error when the first page fails", async () => {
    const fetchImpl: typeof fetch = async () => new Response("no", { status: 429 });
    const result = await searchTitles({
      sentence: "soup",
      form: { mediaType: "movie" },
      country: "US",
      providerIds: [8],
      apiKey: "key",
      fetch: fetchImpl,
    });
    expect(result).toEqual({ kind: "error", message: "The catalog could not be loaded." });
  });

  it("still returns a card when the service lookup fails", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/watch/providers")) return new Response("no", { status: 500 });
      return discoverPage([movie()]);
    };
    const result = await searchTitles({
      sentence: "soup",
      form: { mediaType: "movie" },
      country: "US",
      providerIds: [8],
      apiKey: "key",
      fetch: fetchImpl,
    });
    expect(result.kind).toBe("results");
    if (result.kind === "results") {
      expect(result.cards[0]?.servicesUnconfirmed).toBe(true);
      expect(result.cards[0]?.title).toBe("Cozy Night");
    }
  });

  it("stops random after three titles that are not on the checked services", async () => {
    let draws = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/watch/providers")) {
        draws += 1;
        return providers([{ provider_id: 350, provider_name: "Apple TV Plus" }]);
      }
      if (url.includes("/discover/movie")) {
        return discoverPage([movie({ id: 1 }), movie({ id: 2, title: "Second" }), movie({ id: 3, title: "Third" })]);
      }
      return discoverPage([]);
    };
    const result = await drawRandom({
      country: "US",
      providerIds: [8],
      apiKey: "key",
      fetch: fetchImpl,
      random: () => 0,
    });
    expect(draws).toBe(3);
    expect(result).toMatchObject({ kind: "empty", message: "Nothing is available on the checked services." });
  });
});
