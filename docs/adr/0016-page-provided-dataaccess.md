# DataAccess is provided by the page component, not the root injector

## Context

Every `DataAccess` facade (ADR 0008) was declared `@Service()`, which makes it a root
singleton living for the whole app session. Each one caches reads in `resource()`, and a
`resource()` is reactive only to its own `params` — it cannot observe the store beneath
it. IndexedDB emits no change events either, so nothing can push an invalidation up from
the data layer. Cache invalidation was therefore entirely manual: a mutator called
`reload()` on every facade its write affected.

That works only while writes and reads live in the same feature. They often do not.
`TrackersDataAccess.overview` caches Entry counts, but Entries are written by the Entries
feature, which `AGENTS.md` forbids from importing another feature's facade — so it had no
legal way to invalidate the count. The result was a user-visible bug: log an Entry from
the Calendar, return to the Tracker list, and it still read "0 Entries" until a full page
reload.

Two screens had already hit this and worked around it independently, both by refreshing
on arrival in their constructors — `CalendarPage` (`lookup.reload()`, commented "refresh
it on arrival rather than trust that every screen which changed a Tracker remembered to")
and `CorrelationPage`. That is a convention held by discipline, written down nowhere, and
the Tracker list is proof it can be forgotten.

An audit of all ten cached reads found the Tracker list was the only screen actually
broken; the rest either refresh on arrival, read on demand, or are rebuilt per component.
So the mechanism was sound almost everywhere — what was missing was any structural reason
for it to stay sound.

## Decision

**A `DataAccess` is provided by the route component that uses it — `providers: [X]` on the
`@Component` — never by the root injector and never by a `Route`.** It is declared
`@Injectable()` with no `providedIn`, so the only way to obtain one is through a page that
provides it.

Angular destroys a component's node injector when the component is destroyed, and a route
component is destroyed on navigating away. A page therefore gets a brand-new `DataAccess`,
with brand-new empty `resource()` caches, every time the user arrives. Staleness across
visits becomes structurally impossible rather than something each screen must remember to
prevent.

**A `Store` (ADR 0008) stays root-provided.** `CorrelationStore` holds a Discovery scan's
ranked results, which are an explicitly requested artifact the user expects to still be
there after glancing at the Calendar. Its state is *meant* to outlive the route. The
dividing line is exactly ADR 0008's existing one: stateless DataAccess is a per-visit
cache, a stateful Store is app-lifetime state.

`TrackerLookup` is the one DataAccess that stays root, because it is genuinely shared
across four features and every writer of Tracker data already reloads it. It keeps the
refresh-on-arrival convention, now as a deliberate exception rather than an unwritten rule.

Within a single visit, a facade still reloads its own caches after its own writes —
creating a Tracker must update the list without a navigation. What this ADR removes is
cross-visit staleness, not same-visit invalidation.

## Considered options

- **Route-level `providers`** (`Route.providers`) was tried first and does not work.
  Angular creates a lazy route's `EnvironmentInjector` once and caches it on the route
  config, reusing it across activations; instrumentation showed the facade constructed
  once and never destroyed across repeated navigations. Route providers are per-config,
  not per-visit. Component providers are the only DI scope that tracks a visit.
- **Refresh on arrival everywhere** — codify the existing `reload()`-in-constructor
  convention in an ADR and add it to the screen that forgot. Cheapest change, and the
  audit showed the convention mostly holds. Rejected because it remains a rule enforced by
  memory: nothing fails when a new page omits it, and the failure is invisible in review
  and in tests that navigate with a full page load.
- **A write-version signal in `data/`** — bump a per-store counter on every write through
  `IdbEngine`, and have each resource name the stores it reads in its `params`. Genuinely
  reactive, and would invalidate across features without either side importing the other.
  Rejected as premature: it is a cross-cutting change to every facade to solve a problem
  that had produced exactly one bug, and it over-invalidates (any Entry write reloads every
  Entry-derived resource), which would matter against a syncing Storage Profile (ADR 0009).
  Worth revisiting if cross-visit freshness ever stops being enough.
- **Keep root singletons, read on demand instead of caching** — what `SettingsDataAccess`
  already does for its record counts. Correct but it gives up `resource()`'s loading
  signals and caching for every read, not just the ones where freshness is critical.

## Consequences

- A page pays one fresh read per visit. Against IndexedDB this is the same cost as the
  refresh-on-arrival call it replaces, so nothing regresses; against a future remote
  Storage Profile it is a real cost to revisit.
- `TrackersDataAccess` is provided by both `TrackersPage` and `TrackerDesignerPage`, so
  moving between the list and the designer also rebuilds it. Each hop re-reads, which is
  what both screens want anyway.
- The `resource({ injector: this.injector })` calls inside `designerFor()`,
  `presetsFor()` and `tagSuggestionsFor()` now resolve the *component's* injector rather
  than the root one, so those resources are destroyed with the page. Previously every
  designer visit and every Entry-form open leaked resources that lived until the tab
  closed.
- Unit specs must list the facade in `TestBed.configureTestingModule({ providers: [...] })`;
  it is no longer resolvable from root.
- Tests that navigate with a full page load (`page.goto`) cannot catch cross-visit
  staleness, because reloading rebuilds every injector. Coverage for it has to navigate
  in-app, which is why `tests/stories/trackers/tracker-list-counts.e2e.ts` says so in a
  comment.
- `TrackersDataAccess.reload()` had no callers left once the page stopped refreshing on
  arrival, and was removed.
