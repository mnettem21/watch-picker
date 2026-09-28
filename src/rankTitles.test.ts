import { rankTitles } from "./rankTitles";
import type { CatalogTitle } from "./filterTitles";

function title(overrides: Partial<CatalogTitle>): CatalogTitle {
  return {
    id: 1,
    mediaType: "movie",
    title: "Title",
    overview: "",
    popularity: 1,
    year: "2020",
    posterPath: null,
    ...overrides,
  };
}

describe("rankTitles", () => {
  it("orders by mood match ahead of popularity", () => {
    const ranked = rankTitles(
      [
        title({ id: 1, popularity: 100, overview: "A bleak heist" }),
        title({ id: 2, popularity: 5, overview: "A warm and comforting evening" }),
      ],
      ["cozy"],
    );
    expect(ranked.map((item) => item.id)).toEqual([2, 1]);
  });

  it("sorts by popularity when there are no feeling words", () => {
    const ranked = rankTitles(
      [title({ id: 1, popularity: 3, overview: "zzz" }), title({ id: 2, popularity: 9, overview: "aaa" })],
      [],
    );
    expect(ranked.map((item) => item.id)).toEqual([2, 1]);
  });

  it("breaks equal mood scores with popularity", () => {
    const ranked = rankTitles(
      [
        title({ id: 1, popularity: 4, overview: "warm" }),
        title({ id: 2, popularity: 12, overview: "comforting" }),
      ],
      ["cozy"],
    );
    expect(ranked.map((item) => item.id)).toEqual([2, 1]);
  });

  it("counts a mood group once", () => {
    const ranked = rankTitles(
      [
        title({ id: 1, popularity: 1, overview: "warm and cozy and gentle" }),
        title({ id: 2, popularity: 1, overview: "warm and also bleak" }),
      ],
      ["cozy", "dark"],
    );
    expect(ranked.map((item) => item.id)).toEqual([2, 1]);
  });
});
