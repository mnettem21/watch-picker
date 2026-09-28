import { containsWord, type CatalogTitle } from "./filterTitles";
import { MOOD_GROUPS } from "./moods";

export function rankTitles(titles: CatalogTitle[], feelingWords: string[]): CatalogTitle[] {
  const groups = MOOD_GROUPS.filter((group) => group.words.some((word) => feelingWords.includes(word)));
  return [...titles].sort((left, right) => {
    if (feelingWords.length > 0) {
      const scoreDelta = score(right, groups) - score(left, groups);
      if (scoreDelta !== 0) return scoreDelta;
    }
    return right.popularity - left.popularity;
  });
}

function score(title: CatalogTitle, groups: readonly { words: readonly string[] }[]): number {
  return groups.reduce((total, group) => {
    return total + (group.words.some((word) => containsWord(title.overview, word)) ? 1 : 0);
  }, 0);
}
