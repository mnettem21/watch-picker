export type CatalogTitle = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  popularity: number;
  year: string;
  posterPath: string | null;
  runtime?: number;
};

export type TitleFilter = {
  keywords: string[];
  runtimeMin?: number;
  runtimeMax?: number;
};

export function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, "i").test(text);
}

export function filterTitles(titles: CatalogTitle[], filter: TitleFilter): CatalogTitle[] {
  const bounded = filter.runtimeMin != null || filter.runtimeMax != null;
  return titles.filter((title) => {
    if (filter.keywords.length > 0) {
      const haystack = `${title.title} ${title.overview}`;
      if (!filter.keywords.some((keyword) => containsWord(haystack, keyword))) return false;
    }
    if (!bounded) return true;
    if (!title.runtime) return false;
    if (filter.runtimeMin != null && title.runtime < filter.runtimeMin) return false;
    if (filter.runtimeMax != null && title.runtime > filter.runtimeMax) return false;
    return true;
  });
}
