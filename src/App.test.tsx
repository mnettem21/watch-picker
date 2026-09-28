import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function movie() {
  return {
    id: 7,
    title: "Cozy Night",
    overview: "A warm diner story about soup",
    popularity: 20,
    poster_path: "/poster.jpg",
    release_date: "2020-04-01",
    runtime: 95,
  };
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not request the catalog when no service is checked", () => {
    const fetchImpl = vi.fn();
    render(<App apiKey="key" fetchImpl={fetchImpl} />);
    expect(screen.getByText("Choose at least one service.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Search" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Random" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("leaves the form unchanged and says nothing matched", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/watch/providers")) return json({ results: { US: { flatrate: [] } } });
      return json({ results: [{ ...movie(), title: "Other", overview: "A heist" }] });
    });
    render(<App apiKey="key" fetchImpl={fetchImpl} />);
    fireEvent.click(screen.getByLabelText("Netflix"));
    const sentence = screen.getByLabelText("What do you want to watch?");
    fireEvent.change(sentence, { target: { value: "zzzzunique" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Nothing matched.")).toBeTruthy();
    expect((sentence as HTMLInputElement).value).toBe("zzzzunique");
  });

  it("keeps the previous cards when a later search cannot load the catalog", async () => {
    let fail = false;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (fail) return new Response("no", { status: 429 });
      if (url.includes("/watch/providers")) {
        return json({ results: { US: { flatrate: [{ provider_id: 8, provider_name: "Netflix" }] } } });
      }
      return json({ results: [movie()] });
    });
    render(<App apiKey="key" fetchImpl={fetchImpl} />);
    fireEvent.click(screen.getByLabelText("Netflix"));
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "movie" } });
    fireEvent.change(screen.getByLabelText("What do you want to watch?"), { target: { value: "soup" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Cozy Night")).toBeTruthy();
    fail = true;
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("The catalog could not be loaded.")).toBeTruthy();
    expect(screen.getByText("Cozy Night")).toBeTruthy();
  });
});
