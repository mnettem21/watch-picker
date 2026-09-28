import { genreIds, keywordsForMedia } from "./genres";

describe("genre ids", () => {
  it("maps action and adventure separately for movies and once for TV", () => {
    expect(genreIds(["action", "adventure"], "movie")).toEqual([28, 12]);
    expect(genreIds(["action", "adventure"], "tv")).toEqual([10759]);
  });

  it("maps science fiction and fantasy onto the TV science-fiction and fantasy id once each pair", () => {
    expect(genreIds(["fantasy", "sci-fi"], "tv")).toEqual([10765]);
    expect(genreIds(["science fiction"], "movie")).toEqual([878]);
  });

  it("treats a genre with no TV id as a keyword for TV", () => {
    expect(genreIds(["horror"], "tv")).toEqual([]);
    expect(keywordsForMedia(["horror"], [], "tv")).toEqual(["horror"]);
    expect(keywordsForMedia(["horror"], ["soup"], "movie")).toEqual(["soup"]);
  });
});
