import { parseConstraints } from "./parseConstraints";

const either = { mediaType: "either" as const };

describe("parseConstraints", () => {
  it("turns minute, hour, and range phrases into minute bounds", () => {
    expect(parseConstraints("under 2 hours", either)).toMatchObject({
      runtimeMax: 120,
    });
    expect(parseConstraints("shorter than 90 minutes", either)).toMatchObject({
      runtimeMax: 90,
    });
    expect(parseConstraints("at least 90 minutes", either)).toMatchObject({
      runtimeMin: 90,
    });
    expect(parseConstraints("between 30 and 60 minutes", either)).toMatchObject({
      runtimeMin: 30,
      runtimeMax: 60,
    });
    expect(parseConstraints("between 60 and 30 minutes", either)).toMatchObject({
      runtimeMin: 30,
      runtimeMax: 60,
    });
    expect(parseConstraints("90-120 minutes", either)).toMatchObject({
      runtimeMin: 90,
      runtimeMax: 120,
    });
  });

  it("turns genre words into genres and leaves them out of keywords", () => {
    const parsed = parseConstraints("a horror movie about soup", either);
    expect(parsed.genres).toEqual(["horror"]);
    expect(parsed.keywords).toEqual(["soup"]);
    expect(parsed.mediaType).toBe("movie");
  });

  it("drops stopwords", () => {
    const parsed = parseConstraints("i want to watch something about the city", either);
    expect(parsed.keywords).toEqual(["city"]);
    expect(parsed.feelingWords).toEqual([]);
  });

  it("lets a filled form bound replace only that bound", () => {
    const parsed = parseConstraints("under 2 hours", {
      mediaType: "either",
      runtimeMin: 40,
    });
    expect(parsed.runtimeMin).toBe(40);
    expect(parsed.runtimeMax).toBe(120);
  });

  it("lets the form media type replace the sentence", () => {
    const parsed = parseConstraints("a cozy movie", { mediaType: "tv" });
    expect(parsed.mediaType).toBe("tv");
    expect(parsed.keywords).not.toContain("movie");
    expect(parsed.feelingWords).toEqual(["cozy"]);
  });

  it("uses movie or show in the sentence only when the form is either", () => {
    expect(parseConstraints("a short show", either).mediaType).toBe("tv");
    expect(parseConstraints("a short show", { mediaType: "movie" }).mediaType).toBe("movie");
  });

  it("treats mood words as feeling words rather than keywords", () => {
    const parsed = parseConstraints("something warm and funny", either);
    expect(parsed.feelingWords).toEqual(["warm", "funny"]);
    expect(parsed.keywords).toEqual([]);
  });

  it("keeps science fiction as one genre", () => {
    expect(parseConstraints("science fiction movie", either).genres).toEqual([
      "science fiction",
    ]);
  });
});
