import { filterTitles, type CatalogTitle } from "./filterTitles";
import { genreIds, keywordsForMedia } from "./genres";
import { parseConstraints, type SearchForm } from "./parseConstraints";
import { rankTitles } from "./rankTitles";
import { matchedServices, providerIdsFor } from "./services";

const API = "https://api.themoviedb.org/3";

export const CATALOG_ERROR = "The catalog could not be loaded.";
export const NOTHING_MATCHED = "Nothing matched.";
export const NOTHING_AVAILABLE = "Nothing is available on the checked services.";

export type WatchCard = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string;
  runtime?: number;
  overviewLine: string;
  posterUrl: string | null;
  services: { label: string; href: string }[];
  servicesUnconfirmed: boolean;
};

export type CatalogOutcome =
  | { kind: "results"; cards: WatchCard[]; pool?: CatalogTitle[] }
  | { kind: "empty"; message: string; pool?: CatalogTitle[] }
  | { kind: "error"; message: string };

type RawTitle = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  popularity?: number;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
};

type DiscoverQuery = {
  country: string;
  providerIds: number[];
  apiKey: string;
  genreIds: number[];
  runtimeMin?: number;
  runtimeMax?: number;
};

type Client = {
  country: string;
  providerIds: number[];
  apiKey: string;
  fetch: typeof fetch;
};

export async function searchTitles(input: Client & { sentence: string; form: SearchForm }): Promise<CatalogOutcome> {
  if (!input.apiKey) return { kind: "error", message: CATALOG_ERROR };
  const constraints = parseConstraints(input.sentence, input.form);
  const medias: Array<"movie" | "tv"> = constraints.mediaType === "either" ? ["movie", "tv"] : [constraints.mediaType];
  const titles: CatalogTitle[] = [];
  let loadedSomething = false;

  for (const media of medias) {
    const loaded = await loadPages(input, {
      country: input.country,
      providerIds: input.providerIds,
      apiKey: input.apiKey,
      genreIds: genreIds(constraints.genres, media),
      runtimeMin: constraints.runtimeMin,
      runtimeMax: constraints.runtimeMax,
    }, media);
    if (loaded.failed && !loadedSomething) return { kind: "error", message: CATALOG_ERROR };
    if (!loaded.failed) loadedSomething = true;
    titles.push(...loaded.titles);
  }

  const bounded = constraints.runtimeMin != null || constraints.runtimeMax != null;
  const hydrated = bounded ? await hydrateRuntimes(dedupe(titles), input) : dedupe(titles);
  const filtered = hydrated.filter((title) => {
    const keywords = keywordsForMedia(constraints.genres, constraints.keywords, title.mediaType);
    return (
      filterTitles([title], {
        keywords,
        runtimeMin: constraints.runtimeMin,
        runtimeMax: constraints.runtimeMax,
      }).length === 1
    );
  });
  if (filtered.length === 0) return { kind: "empty", message: NOTHING_MATCHED };

  const ranked = rankTitles(filtered, constraints.feelingWords).slice(0, 12);
  const cards = await Promise.all(ranked.map((title) => loadCard(title, input)));
  return { kind: "results", cards };
}

export async function drawRandom(
  input: Client & { random?: () => number; pool?: CatalogTitle[]; sentence?: string; form?: SearchForm },
): Promise<CatalogOutcome> {
  if (!input.apiKey) return { kind: "error", message: CATALOG_ERROR };
  let pool = input.pool;
  if (!pool) {
    const query: DiscoverQuery = {
      country: input.country,
      providerIds: input.providerIds,
      apiKey: input.apiKey,
      genreIds: [],
    };
    const movies = await loadPages(input, query, "movie", 1);
    if (movies.failed) return { kind: "error", message: CATALOG_ERROR };
    const shows = await loadPages(input, query, "tv", 1);
    pool = dedupe([...movies.titles, ...(shows.failed ? [] : shows.titles)]);
  }
  if (pool.length === 0) return { kind: "empty", message: NOTHING_AVAILABLE, pool };

  const working = [...pool];
  const random = input.random ?? Math.random;
  let discards = 0;
  while (working.length > 0 && discards < 3) {
    const index = Math.min(working.length - 1, Math.floor(random() * working.length));
    const title = working.splice(index, 1)[0];
    if (!title) break;
    const card = await loadCard(title, input);
    if (card.servicesUnconfirmed || card.services.length > 0) {
      return { kind: "results", cards: [card], pool: working };
    }
    discards += 1;
  }
  return { kind: "empty", message: NOTHING_AVAILABLE, pool: working };
}

async function loadPages(
  client: Client,
  query: DiscoverQuery,
  media: "movie" | "tv",
  maxPages = 3,
): Promise<{ titles: CatalogTitle[]; failed: boolean }> {
  const titles: CatalogTitle[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    let response: Response;
    try {
      response = await client.fetch(discoverUrl(media, page, query));
    } catch {
      return { titles, failed: page === 1 && titles.length === 0 };
    }
    if (!response.ok) return { titles, failed: page === 1 && titles.length === 0 };
    const body = (await response.json()) as { results?: RawTitle[] };
    titles.push(...(body.results ?? []).map((item) => toTitle(item, media)));
  }
  return { titles, failed: false };
}

function discoverUrl(media: "movie" | "tv", page: number, query: DiscoverQuery): string {
  const params = new URLSearchParams({
    api_key: query.apiKey,
    page: String(page),
    watch_region: query.country,
    with_watch_providers: providerIdsFor(query.providerIds),
    with_watch_monetization_types: "flatrate",
    sort_by: "popularity.desc",
  });
  if (query.genreIds.length > 0) params.set("with_genres", query.genreIds.join("|"));
  if (query.runtimeMin != null) params.set("with_runtime.gte", String(query.runtimeMin));
  if (query.runtimeMax != null) params.set("with_runtime.lte", String(query.runtimeMax));
  return `${API}/discover/${media}?${params.toString()}`;
}

async function hydrateRuntimes(titles: CatalogTitle[], client: Client): Promise<CatalogTitle[]> {
  return Promise.all(
    titles.map(async (title) => {
      if (title.runtime) return title;
      try {
        const response = await client.fetch(`${API}/${title.mediaType}/${title.id}?api_key=${client.apiKey}`);
        if (!response.ok) return title;
        const body = (await response.json()) as RawTitle;
        return { ...title, runtime: positiveRuntime(body) };
      } catch {
        return title;
      }
    }),
  );
}

function toTitle(raw: RawTitle, mediaType: "movie" | "tv"): CatalogTitle {
  const date = mediaType === "movie" ? raw.release_date : raw.first_air_date;
  return {
    id: raw.id,
    mediaType,
    title: raw.title ?? raw.name ?? "Untitled",
    overview: raw.overview ?? "",
    popularity: raw.popularity ?? 0,
    year: date?.slice(0, 4) ?? "",
    posterPath: raw.poster_path ?? null,
    runtime: positiveRuntime(raw),
  };
}

function positiveRuntime(raw: RawTitle): number | undefined {
  if (raw.runtime && raw.runtime > 0) return raw.runtime;
  const episode = raw.episode_run_time?.find((value) => value > 0);
  return episode;
}

async function loadCard(title: CatalogTitle, client: Client): Promise<WatchCard> {
  const href = `https://www.themoviedb.org/${title.mediaType}/${title.id}/watch?locale=${client.country}`;
  const base: WatchCard = {
    id: title.id,
    mediaType: title.mediaType,
    title: title.title,
    year: title.year,
    runtime: title.runtime,
    overviewLine: title.overview.split("\n")[0]?.trim() ?? "",
    posterUrl: title.posterPath ? `https://image.tmdb.org/t/p/w342${title.posterPath}` : null,
    services: [],
    servicesUnconfirmed: false,
  };
  try {
    const response = await client.fetch(
      `${API}/${title.mediaType}/${title.id}/watch/providers?api_key=${client.apiKey}`,
    );
    if (!response.ok) return { ...base, servicesUnconfirmed: true };
    const body = (await response.json()) as {
      results?: Record<string, { flatrate?: { provider_id: number }[] }>;
    };
    const flatrate = body.results?.[client.country]?.flatrate ?? [];
    return {
      ...base,
      services: matchedServices(
        flatrate.map((item) => item.provider_id),
        client.providerIds,
      ).map((service) => ({ label: service.label, href })),
    };
  } catch {
    return { ...base, servicesUnconfirmed: true };
  }
}

function dedupe(titles: CatalogTitle[]): CatalogTitle[] {
  const seen = new Set<string>();
  return titles.filter((title) => {
    const key = `${title.mediaType}:${title.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
