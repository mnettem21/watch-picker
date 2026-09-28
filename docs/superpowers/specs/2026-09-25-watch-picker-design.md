# Watch Picker Design

Date: 2026-09-25

A public web page that picks something to watch from the subscriptions a person already pays for. Each visitor checks their own services. Those choices stay in the browser. There is no account.

## Decisions

- The app is a single-page Vite + React + TypeScript app. It calls TMDB from the browser. There is no server and no database.
- The TMDB key is the public build-time variable `VITE_TMDB_API_KEY`. Anyone who can open the app can see it. Calls are read-only catalog lookups.
- Country is a stored setting and defaults to `US`. The control offers United States only. Catalog requests take the stored country code, so another country is another option in that control.
- A title is eligible only when TMDB lists it as `flatrate` (included with a subscription) for a checked service in that country. Rent, buy, ads, and free copies are ignored.
- Search applies deterministic filters first, then sorts the survivors by a local mood match against the sentence.
- Random ignores the sentence and the form. It picks any subscription title on the checked services.
- Streaming availability is shown with a visible JustWatch attribution, which TMDB requires for this data. A service badge links to the TMDB watch page for that title and country, which is where the deep link lives.

## Services

Checked services are stored as TMDB provider ids. Max also matches the older HBO Max id so a title still filed under that id counts as Max.

| Label | Provider ids |
| --- | --- |
| Netflix | 8 |
| Prime Video | 9 |
| Hulu | 15 |
| Disney+ | 337 |
| Apple TV+ | 350 |
| Peacock | 386 |
| Paramount+ | 531 |
| Max | 1899, 384 |

Checking Max stores both 1899 and 384. Unchecking Max removes both. Discover joins the selected ids with `|`, which is TMDB's OR. A badge uses the label when any of that service's ids appear in the title's flatrate list for the saved country.

## Architecture

The page reads and writes two preferences in `localStorage`:

- `watch-picker.services`: the checked provider ids
- `watch-picker.country`: an ISO country code, default `US`

Search and random both call TMDB discover, then the title watch-provider endpoint for the cards they show. The two search passes run in the browser. Random skips keyword extraction, runtime, media type, and the mood sort.

## Components

**Preferences.** Reads and writes the two keys above. A missing or unreadable country becomes `US`. Unreadable services become an empty selection. If storage throws, the same choices live in memory for the session and reset on refresh.

**Service picker.** One checkbox per label in the table above. Search and Random stay inactive until at least one is checked, and the page asks for a service.

**Country control.** A select whose only option is United States (`US`).

**Search form.** A sentence field, a movie / TV / either choice (default either), optional minimum and maximum runtime in minutes, a Search button, and a Random button. A filled form runtime field replaces only that bound from the sentence. The other bound still comes from the sentence when the form leaves it empty. Movie or TV on the form replaces a media type inferred from the sentence. Either leaves the sentence free to decide, and both are searched when the sentence names neither.

**Constraint parser.** A pure function from the sentence plus the form to `{ mediaType, runtimeMin, runtimeMax, genres, keywords, feelingWords }`.

**Catalog client.** Builds the TMDB discover request for movies, TV, or both, and loads watch providers for the cards that will be shown.

**Sentiment ranker.** A pure function. It scores each remaining title from `feelingWords` and the overview, using the mood list shipped with the app. Random never calls it.

**Result card.** Poster (`https://image.tmdb.org/t/p/w342` plus the TMDB poster path), title, year (`release_date` for a movie, `first_air_date` for a show), movie or show, runtime in minutes, the checked services that include it, and the first line of the overview. Each service badge links to `https://www.themoviedb.org/{movie|tv}/{id}/watch?locale={country}`. Search renders the first 12 cards after ranking. Random renders one card and a control that draws again. The results area always shows the JustWatch attribution.

## Data flow

### Parsing

The sentence is lowercased. Runtime phrases and the phrase `science fiction` are matched before the rest is split on whitespace and punctuation. Then:

1. Runtime phrases are removed and become minute bounds.
   - `under`, `less than`, or `shorter than` N minutes or hours sets the max. Hours are multiplied by 60.
   - `over`, `more than`, `longer than`, or `at least` N sets the min.
   - `between A and B` or `A-B` sets both bounds. The lower number is the min.
2. `movie` or `film`, and `show`, `series`, or `tv`, are always removed so they never become keywords. When the form media type is either, those words also choose movie or TV. If both kinds appear, the search stays on either. When the form is movie or TV, the form's choice is used and the sentence does not change it.
3. Genre words are removed and become genre filters. The recognized words are: action, adventure, animation, comedy, crime, documentary, drama, family, fantasy, history, horror, music, mystery, romance, science fiction, sci-fi, thriller, war, western.
4. Stopwords are removed: a, an, the, of, and, or, to, for, with, in, on, about, something, some, me, my, i, want, watch, like, feel, feeling.
5. Remaining tokens that appear in the mood list are `feelingWords`. Every other remaining token is a keyword. Feeling words are not required to appear in a title for it to pass the keyword filter.

The form then overwrites runtime bounds field by field, as described above.

Genre names map to TMDB genre ids per endpoint:

| Word | Movie id | TV id |
| --- | --- | --- |
| action, adventure | 28 for action, 12 for adventure | 10759 when either word is present |
| animation | 16 | 16 |
| comedy | 35 | 35 |
| crime | 80 | 80 |
| documentary | 99 | 99 |
| drama | 18 | 18 |
| family | 10751 | 10751 |
| fantasy | 14 | 10765 |
| history | 36 | none (history is not a TV genre filter) |
| horror | 27 | none |
| music | 10402 | none |
| mystery | 9648 | 9648 |
| romance | 10749 | none |
| science fiction, sci-fi | 878 | 10765 |
| thriller | 53 | none |
| war | 10752 | 10768 |
| western | 37 | 37 |

`action adventure` on TV contributes 10759 once. `fantasy` and `sci-fi` on TV both contribute 10765 once. A genre word with no id for an endpoint is treated as a keyword for titles from that endpoint, so a TV search for horror still requires "horror" in the title or overview.

### Search

1. Discover `movie`, `tv`, or both, based on media type. Movie and TV pages are combined before the keyword filter and the ranker.
   - `watch_region` is the saved country.
   - `with_watch_providers` is the checked ids joined by `|`.
   - `with_watch_monetization_types` is `flatrate`.
   - `with_genres` is the mapped ids joined by `|` when any exist.
   - `with_runtime.gte` and `with_runtime.lte` are sent when those bounds exist. For TV, TMDB applies this to episode runtime.
   - `sort_by` is `popularity.desc`.
   - At most the first 3 pages are requested. A later page that fails is ignored when an earlier page returned titles.
2. A title stays when there are no keywords, or when at least one keyword appears in the title or overview, case-insensitive. When a runtime bound is set, a title whose runtime is missing or zero is removed.
3. The ranker scores the survivors. A mood group matches when the sentence has a feeling word in that group and the overview contains any word from that group. The score is the number of distinct groups matched. Sort by score descending, then by TMDB popularity descending. When `feelingWords` is empty, popularity order is kept. An empty sentence with no form bounds skips keywords, genres, runtime, and mood, and returns the most popular subscription titles on the checked services.
4. The first 12 titles load `/movie/{id}/watch/providers` or `/tv/{id}/watch/providers`. The card lists the intersection of that country's `flatrate` providers with the checked services.

Mood groups and the words that define them:

| Group | Words |
| --- | --- |
| cozy | cozy, warm, comforting, wholesome, gentle |
| dark | dark, bleak, grim, disturbing |
| funny | funny, hilarious, witty |
| tense | tense, scary, suspenseful, creepy |
| sad | sad, tragic, heartbreaking, melancholy |
| romantic | romantic |
| exciting | exciting, thrilling, adventurous |

### Random

Random ignores the sentence and every form field, including media type and runtime. It requests the first discover page of movies and the first discover page of TV with only the checked providers, `flatrate`, and the saved country, sorted by popularity. It picks one title uniformly from that combined pool. Draw again picks again from the same pool and may repeat.

The chosen title's providers are loaded. If its flatrate providers do not intersect the checked services, it is removed from the pool and another title is drawn. The page shows the empty-pool message after three discarded draws, or sooner when the pool runs out. An empty discover pool shows that message immediately.

## Error handling

- No checked service: Search and Random stay inactive, and the page asks for at least one service.
- Missing country: use `US`.
- Missing key, rejected key, HTTP 429, or a network failure on the first page: show that the catalog could not be loaded. Cards from the last successful search or random stay visible. The first failure of a session shows the message and no cards. The user can try again.
- A failed discover page after a successful earlier page is ignored.
- The catalog returns titles and none survive filtering: say that nothing matched, and leave the sentence and the form unchanged. The search is not widened.
- A watch-provider request fails: the card still renders, and the service line says it could not be confirmed.
- Random's pool is empty, or three draws in a row fail the service overlap check: say that nothing is available on the checked services.
- Storage unavailable: keep the current choices in memory for the session.

## Testing

Automated tests mock TMDB. They do not call the network.

- Parser: minute, hour, and range phrases become the right bounds. Genre words become genre names and leave the keyword list. Stopwords are dropped. A filled form min or max replaces only that bound. Form movie or TV replaces the sentence. `movie` and `show` in the sentence apply only when the form is either. Mood-list tokens become feeling words and are not keywords.
- Filter: a title remains when one keyword is in the title or overview. No keywords leaves the set unchanged. A missing runtime is removed when a bound is set.
- Ranker: feeling words change order. An empty feeling list keeps popularity order. Equal scores fall back to popularity. A group match counts once for that group.
- Catalog client: discover parameters include only the active constraints. Random's request has providers, `flatrate`, and country, and omits keywords, runtime, genres, and media type from the sentence. Provider ids for Max include both 1899 and 384.
- Preferences: country defaults to `US`. Services survive a simulated reload. A storage failure keeps the choices only in memory.
- Failures: zero services does not request. An empty filtered set reports nothing matched and does not change the form. A first-page catalog error keeps prior cards. A failed provider lookup still yields a card. Random discards a non-overlapping title and stops after three draws.

The running app is checked by hand for a normal search, a random draw, an empty filtered search, and a failed catalog request.

## Non-goals

- Accounts, watch history, and continue-watching.
- Signing in to Netflix or any other service.
- Rent, buy, ads, or free titles.
- A country other than the United States in the control.
- A backend or a paid language model.
