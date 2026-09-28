import { MOOD_WORDS } from "./moods";

export type MediaChoice = "movie" | "tv" | "either";

export type SearchForm = {
  mediaType: MediaChoice;
  runtimeMin?: number;
  runtimeMax?: number;
};

export type Constraints = {
  mediaType: MediaChoice;
  runtimeMin?: number;
  runtimeMax?: number;
  genres: string[];
  keywords: string[];
  feelingWords: string[];
};

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "and",
  "or",
  "to",
  "for",
  "with",
  "in",
  "on",
  "about",
  "something",
  "some",
  "me",
  "my",
  "i",
  "want",
  "watch",
  "like",
  "feel",
  "feeling",
]);

const GENRE_TOKENS: Record<string, string> = {
  sciencefiction: "science fiction",
  scifi: "sci-fi",
};

const GENRE_WORDS = new Set([
  "action",
  "adventure",
  "animation",
  "comedy",
  "crime",
  "documentary",
  "drama",
  "family",
  "fantasy",
  "history",
  "horror",
  "music",
  "mystery",
  "romance",
  "thriller",
  "war",
  "western",
]);

const UNIT = "(minutes|minute|mins|min|hours|hour|hrs|hr)";
const NUMBER = "(\\d+(?:\\.\\d+)?)";

function toMinutes(value: number, unit: string | undefined): number {
  const hours = unit != null && unit.startsWith("h");
  return Math.round(hours ? value * 60 : value);
}

function takeRuntime(text: string): { text: string; runtimeMin?: number; runtimeMax?: number } {
  let runtimeMin: number | undefined;
  let runtimeMax: number | undefined;

  let next = text.replace(new RegExp(`between\\s+${NUMBER}\\s+and\\s+${NUMBER}\\s*${UNIT}?`, "g"), (_, a: string, b: string, unit?: string) => {
    const left = toMinutes(Number(a), unit);
    const right = toMinutes(Number(b), unit);
    runtimeMin = Math.min(left, right);
    runtimeMax = Math.max(left, right);
    return " ";
  });

  next = next.replace(new RegExp(`${NUMBER}\\s*-\\s*${NUMBER}\\s*${UNIT}`, "g"), (_, a: string, b: string, unit: string) => {
    const left = toMinutes(Number(a), unit);
    const right = toMinutes(Number(b), unit);
    runtimeMin = Math.min(left, right);
    runtimeMax = Math.max(left, right);
    return " ";
  });

  next = next.replace(
    new RegExp(`(?:under|less than|shorter than)\\s+${NUMBER}\\s*${UNIT}`, "g"),
    (_, value: string, unit: string) => {
      runtimeMax = toMinutes(Number(value), unit);
      return " ";
    },
  );

  next = next.replace(
    new RegExp(`(?:at least|more than|longer than|over)\\s+${NUMBER}\\s*${UNIT}`, "g"),
    (_, value: string, unit: string) => {
      runtimeMin = toMinutes(Number(value), unit);
      return " ";
    },
  );

  return { text: next, runtimeMin, runtimeMax };
}

export function parseConstraints(sentence: string, form: SearchForm): Constraints {
  const runtime = takeRuntime(sentence.toLowerCase());
  let text = runtime.text.replace(/science fiction/g, " sciencefiction ").replace(/sci-fi/g, " scifi ");

  let sawMovie = false;
  let sawShow = false;
  text = text.replace(/\b(movies|movie|films|film|shows|show|series|tv)\b/g, (word) => {
    if (word === "movie" || word === "movies" || word === "film" || word === "films") sawMovie = true;
    else sawShow = true;
    return " ";
  });

  let mediaType = form.mediaType;
  if (form.mediaType === "either") {
    if (sawMovie && !sawShow) mediaType = "movie";
    else if (sawShow && !sawMovie) mediaType = "tv";
  }

  const genres: string[] = [];
  const keywords: string[] = [];
  const feelingWords: string[] = [];

  for (const token of text.split(/[^a-z0-9]+/).filter(Boolean)) {
    const genre = GENRE_TOKENS[token] ?? (GENRE_WORDS.has(token) ? token : undefined);
    if (genre) {
      if (!genres.includes(genre)) genres.push(genre);
      continue;
    }
    if (STOPWORDS.has(token)) continue;
    if (MOOD_WORDS.has(token)) {
      feelingWords.push(token);
      continue;
    }
    keywords.push(token);
  }

  return {
    mediaType,
    runtimeMin: form.runtimeMin ?? runtime.runtimeMin,
    runtimeMax: form.runtimeMax ?? runtime.runtimeMax,
    genres,
    keywords,
    feelingWords,
  };
}
