import { useMemo, useState } from "react";
import { drawRandom, searchTitles, type WatchCard } from "./catalog";
import type { CatalogTitle } from "./filterTitles";
import { createPreferenceStore } from "./preferences";
import type { MediaChoice } from "./parseConstraints";
import { SERVICES, toggleService } from "./services";

type AppProps = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export function App({ apiKey = import.meta.env.VITE_TMDB_API_KEY ?? "", fetchImpl = fetch }: AppProps) {
  const store = useMemo(() => createPreferenceStore(localStorage), []);
  const saved = store.get();
  const [services, setServices] = useState(saved.services);
  const [country, setCountry] = useState(saved.country);
  const [sentence, setSentence] = useState("");
  const [mediaType, setMediaType] = useState<MediaChoice>("either");
  const [runtimeMin, setRuntimeMin] = useState("");
  const [runtimeMax, setRuntimeMax] = useState("");
  const [cards, setCards] = useState<WatchCard[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pool, setPool] = useState<CatalogTitle[] | undefined>(undefined);
  const [showingRandom, setShowingRandom] = useState(false);

  const needsService = services.length === 0;

  function persist(nextServices: number[], nextCountry: string) {
    setServices(nextServices);
    setCountry(nextCountry);
    store.set({ services: nextServices, country: nextCountry });
  }

  function form() {
    return {
      mediaType,
      runtimeMin: runtimeMin.trim() === "" ? undefined : Number(runtimeMin),
      runtimeMax: runtimeMax.trim() === "" ? undefined : Number(runtimeMax),
    };
  }

  async function onSearch() {
    if (needsService || busy) return;
    setBusy(true);
    setShowingRandom(false);
    const result = await searchTitles({
      sentence,
      form: form(),
      country,
      providerIds: services,
      apiKey,
      fetch: fetchImpl,
    });
    setBusy(false);
    setPool(undefined);
    if (result.kind === "error") {
      setMessage(result.message);
      return;
    }
    if (result.kind === "empty") {
      setCards([]);
      setMessage(result.message);
      return;
    }
    setCards(result.cards);
    setMessage(null);
  }

  async function onRandom() {
    if (needsService || busy) return;
    setBusy(true);
    const result = await drawRandom({
      country,
      providerIds: services,
      apiKey,
      fetch: fetchImpl,
      pool,
    });
    setBusy(false);
    setShowingRandom(true);
    if (result.kind === "error") {
      setMessage(result.message);
      return;
    }
    setPool(result.pool);
    if (result.kind === "empty") {
      setCards([]);
      setMessage(result.message);
      return;
    }
    setCards(result.cards);
    setMessage(null);
  }

  return (
    <main className="page">
      <header className="masthead">
        <p className="eyebrow">Tonight</p>
        <h1>Watch Picker</h1>
        <p className="lede">Find something included with the services you already pay for.</p>
      </header>

      <section className="panel">
        <fieldset>
          <legend>Your services</legend>
          <div className="services">
            {SERVICES.map((service) => {
              const checked = service.providerIds.every((id) => services.includes(id));
              return (
                <label key={service.label} className={checked ? "chip checked" : "chip"}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => persist(toggleService(services, service.providerIds), country)}
                  />
                  {service.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="field">
          Country
          <select value={country} onChange={(event) => persist(services, event.target.value)}>
            <option value="US">United States</option>
          </select>
        </label>

        <form
          className="search"
          onSubmit={(event) => {
            event.preventDefault();
            void onSearch();
          }}
        >
          <label className="field sentence">
            What do you want to watch?
            <input
              value={sentence}
              onChange={(event) => setSentence(event.target.value)}
              placeholder="cozy movie under 2 hours"
            />
          </label>
          <label className="field">
            Type
            <select value={mediaType} onChange={(event) => setMediaType(event.target.value as MediaChoice)}>
              <option value="either">Either</option>
              <option value="movie">Movie</option>
              <option value="tv">TV</option>
            </select>
          </label>
          <label className="field">
            Minimum minutes
            <input inputMode="numeric" value={runtimeMin} onChange={(event) => setRuntimeMin(event.target.value)} />
          </label>
          <label className="field">
            Maximum minutes
            <input inputMode="numeric" value={runtimeMax} onChange={(event) => setRuntimeMax(event.target.value)} />
          </label>
          <div className="actions">
            <button type="submit" disabled={needsService || busy}>
              Search
            </button>
            <button type="button" disabled={needsService || busy} onClick={() => void onRandom()}>
              Random
            </button>
          </div>
        </form>
        {needsService ? <p className="notice">Choose at least one service.</p> : null}
      </section>

      <section className="results" aria-live="polite">
        {message ? <p className="notice">{message}</p> : null}
        {showingRandom && cards.length === 1 ? (
          <button type="button" className="roll" disabled={busy} onClick={() => void onRandom()}>
            Roll again
          </button>
        ) : null}
        <div className={showingRandom ? "grid single" : "grid"}>
          {cards.map((card) => (
            <article key={`${card.mediaType}-${card.id}`} className="card">
              {card.posterUrl ? <img src={card.posterUrl} alt="" /> : <div className="poster-missing" />}
              <div className="card-body">
                <h2>{card.title}</h2>
                <p className="meta">
                  {[card.year, card.mediaType === "movie" ? "Movie" : "TV", card.runtime ? `${card.runtime} min` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {card.servicesUnconfirmed ? (
                  <p className="unconfirmed">Streaming services could not be confirmed.</p>
                ) : (
                  <p className="badges">
                    {card.services.map((service) => (
                      <a key={service.label} href={service.href} target="_blank" rel="noreferrer">
                        {service.label}
                      </a>
                    ))}
                  </p>
                )}
                {card.overviewLine ? <p className="overview">{card.overviewLine}</p> : null}
              </div>
            </article>
          ))}
        </div>
        <p className="credit">
          Streaming availability data by{" "}
          <a href="https://www.justwatch.com" target="_blank" rel="noreferrer">
            JustWatch
          </a>
          .
        </p>
      </section>
    </main>
  );
}
