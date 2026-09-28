import { filterTitles, type CatalogTitle } from "./filterTitles";

function title(overrides: Partial<CatalogTitle>): CatalogTitle {
  return {
    id: 1,
    mediaType: "movie",
    title: "Night Shift",
    overview: "A cook opens a diner.",
    popularity: 10,
    year: "2020",
    posterPath: null,
    runtime: 100,
    ...overrides,
  };
}

describe("filterTitles", () => {
  it("keeps a title when one keyword is in the title or overview", () => {
    const kept = filterTitles(
      [title({ title: "Other", overview: "A cook opens a diner." }), title({ id: 2, overview: "A heist." })],
      { keywords: ["cook"], runtimeMin: undefined, runtimeMax: undefined },
    );
    expect(kept.map((item) => item.id)).toEqual([1]);
  });

  it("leaves the set unchanged when there are no keywords", () => {
    const titles = [title({ id: 1 }), title({ id: 2, title: "Other" })];
    expect(filterTitles(titles, { keywords: [], runtimeMin: undefined, runtimeMax: undefined })).toEqual(titles);
  });

  it("drops a title with a missing or zero runtime when a bound is set", () => {
    const titles = [
      title({ id: 1, runtime: undefined }),
      title({ id: 2, runtime: 0 }),
      title({ id: 3, runtime: 80 }),
    ];
    expect(filterTitles(titles, { keywords: [], runtimeMin: 30, runtimeMax: undefined }).map((item) => item.id)).toEqual([
      3,
    ]);
  });
});
