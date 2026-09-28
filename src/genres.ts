const MOVIE_GENRES: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  "science fiction": 878,
  "sci-fi": 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

const TV_GENRES: Record<string, number> = {
  action: 10759,
  adventure: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 10765,
  mystery: 9648,
  "science fiction": 10765,
  "sci-fi": 10765,
  war: 10768,
  western: 37,
};

export function genreIds(names: string[], media: "movie" | "tv"): number[] {
  const table = media === "movie" ? MOVIE_GENRES : TV_GENRES;
  const ids: number[] = [];
  for (const name of names) {
    const id = table[name];
    if (id != null && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function keywordsForMedia(genres: string[], keywords: string[], media: "movie" | "tv"): string[] {
  const extra = genres.filter((name) => genreIds([name], media).length === 0);
  return [...keywords, ...extra];
}
