# Correlation — Feature Spec

## Purpose

Help the user find time-lagged relationships in their diary: extract **Series** from
diverse Trackers, align them into **Buckets**, run a client-side **Discovery scan** with
significance guardrails, and drill into any pair in a **Directed view**.

## User stories / flows

- I open Correlation, keep the default 90-day range and daily Buckets, leave all Trackers
  in scope, and press **Find correlations**. After a progress bar I get a ranked list:
  "Meal → Ingredient=Dairy  vs  Symptom=Bloating · lag +1d · point-biserial r 0.42 · n 63
  · significant".
- I open that row → Directed view: two Series on a shared zoomable time axis, plus
  a scatter; I change the lag slider and watch the coefficient update.
- I narrow scope to just "Sleep" and "Workout", switch Buckets to weekly, and rescan.
- I tighten guardrails (min n 20 → 40, p 0.05 → 0.01, BH correction on) in the panel;
  the list shrinks.
- I pick Trackers "Sleep" and "Workout" for a Series overlay, without running a scan — I
  see all their Series plotted together on the shared time axis, no coefficient
  computed; I toggle off a couple of Workout's less-relevant Series to declutter it.

## Domain terms used

Correlation, Series, Bucket, Lag, Discovery scan, Directed view, Series overlay,
Tracker, Tracker Version, Entry, Field, Child Entry, Tag, Fadeout. See
[`CONTEXT.md`](../../../../CONTEXT.md).

## Series extraction (v1)

From in-scope data, derive these Series kinds:

| Kind | Value per Bucket |
|---|---|
| Numeric Field | mean of the Field's values in the Bucket (integer/decimal) |
| Occurrence | count of Entries of a Tracker touching the Bucket |
| Boolean / select state | fraction of the Bucket's Entries where the Field = a given value (one Series per option; multi-select: per selected option) |
| Nested child Field | same as numeric/boolean but drawn from child Entries reached through reference Fields, to arbitrary depth (path shown in the Series name) |
| Tag presence | fraction of the Bucket's Entries (including child Entries, which carry independent Tags) carrying a given Tag |

An Entry contributes to every Bucket its resolved interval (placement + Fadeout) touches;
Fadeout contributes weighted membership, weight falling off linearly to 0 across the
Fadeout span. Day-bucketed Entries contribute weight 1 to their day's Bucket(s).

## Method

- numeric × numeric → **Spearman** rank correlation
- numeric × binary/fraction → **point-biserial** (Pearson with a 0..1 Series)
- Each result: effect size (−1..1), overlapping-Bucket count `n`, and a p-value.
- Cramér's V / categorical×categorical is **out of scope for v1** — every v1 Series kind
  reduces to a numeric mean or a [0,1] fraction per Bucket (even select Fields, which are
  decomposed into one fraction Series per option), so nothing produces the multi-category
  input Cramér's V needs. See `feature-scope.md` → Later.
- **Lag**: for each pair, scan every lag in the user's range (default −3…+3 Buckets),
  report the lag with the largest |effect size| plus the lag-0 result.

## Guardrails (user-configurable, defaults shown)

- minimum `n` overlapping Buckets to display a pair: **10**
- p-value threshold: **0.05**
- Benjamini–Hochberg correction across all scanned (pair × lag) tests: **on**; corrected-
  out results hidden unless "show all" is ticked
- A persistent caveat line: results show Correlation, not causation.

## UI

- The Correlation page is this feature's top-level (route) component — the only place
  here allowed to inject a facade or a `ui/` service.
- **Controls bar**: date range, Bucket size (hour/day/week/month), Series-scope picker
  (Trackers / specific Series, via `TrackerLookup`, `data/`'s shared facade), guardrail
  panel, **Find correlations** button.
- **Results list**: built on `ui/`'s **Table** (`cdk/table`, headless) — this feature
  owns the concrete column definitions (Series A, Series B, best lag, effect size, n,
  significance flag) and a hand-built clickable-header sort comparator (stable CDK ships
  no sort primitive — see ADR 0006). This is v1's only Table consumer; it stays here
  rather than in `ui/` until a second feature needs one (`ui/SPEC.md`'s promotion rule).
  Row → Directed view.
- **Directed view**: shared zoomable time-axis chart (two Series), scatter plot, lag
  slider, method + n + p-value readout, "add to pinned" .
- **Series overlay**: pick one or more Trackers via `TrackerLookup`, then toggle which of
  each Tracker's Series are active (default: all on); plotted together on the shared
  zoomable time axis — no scatter, no coefficient, no lag, no significance. This is the
  only way to view Series outside a Discovery-scan row; it does not compute a
  Correlation.
- Progress + cancel for the scan. Charts have text/table alternatives; axes and Series
  labelled; not colour-only; focus order follows the controls→results→chart flow.

## Data & API contract touched

- The Correlation page injects a feature-local `CorrelationStore` (a stateful Store,
  built on `@ngrx/signals`, ADR 0008 — never the raw port below directly) plus
  `TrackerLookup` (`data/`'s shared facade, for the Series-scope picker) — per ADR
  0002. `CorrelationStore` owns scan progress, cancellation, the ranked results list,
  pinned-pair preferences, and Series-overlay toggle state, all as patched state, and
  wraps:
- `CorrelationDataSource` port: `loadEntriesForScope(range, seriesScope)` returning
  Entries + needed children + the specific Tracker Versions each Entry references (not
  a Tracker's current schema — an old Entry's Series reads against its own pinned
  Version, per ADR 0005) + Tags, in one batch (adapter decides how).
- No writes except pinned-pair preferences and Series-overlay toggle state, both
  persisted to `localStorage` from `CorrelationStore`'s patched state.
- Pure modules (all framework-free, heavily tested):
  - `series-extraction` — Entries + schemas → named Series per Bucket, with
    Fadeout weighting; includes child Entries for Tag-presence and nested-Field Series
  - `bucketing` — interval → weighted Bucket memberships for hour/day/week/month
  - `correlation-stats` — Spearman, point-biserial, p-values
  - `lag-scan` — pair × lag-range → best lag + lag-0
  - `significance` — Benjamini–Hochberg over a test set
  - `discovery` — orchestrates scope → Series → pairs → lag-scan → guardrails → ranked
    list (runs off the main thread where possible)

## Test cases (Vitest — logic only)

- `bucketing`: a Point with no Fadeout → weight 1 in one Bucket; a 1h trailing Fadeout
  spanning a Bucket boundary → correct linear split; Period spanning 3 daily Buckets →
  proportional weights; week/month boundaries (incl. month lengths) correct.
- `series-extraction`: numeric mean per Bucket; occurrence count; select-fraction with
  0 matching Entries → 0 (not undefined); multi-select yields one Series per option;
  nested child path of depth 2 resolves; Tag fraction correct.
- `correlation-stats`: Spearman against known fixtures incl. ties; point-biserial equals
  Pearson on a 0/1 Series; p-values within tolerance of reference values; `n < 3` → no
  result, not a throw.
- Series overlay: toggling a Series off removes it from the chart without refetching;
  default state is every Series of a newly-added Tracker active; no coefficient, lag, or
  significance is ever computed for this view.
- `lag-scan`: a Series that is another shifted by +2 Buckets → best lag +2, |ρ|≈1;
  symmetric handling of negative lags; lag-0 always reported.
- `significance`: BH on a known p-vector matches reference; threshold 1.0 keeps all;
  empty input → empty output.
- `discovery`: pairs below min-n excluded; ranking by |effect size| after correction;
  scope filter limits the Series set; deterministic output for a fixed dataset;
  cancellation stops further work.

## Out of scope

- Automatic lag recommendation from the data (v1 uses the user's range + a static
  default).
- Partial correlation / controlling for confounders; multivariate models.
- Cramér's V / categorical×categorical correlation (no v1 Series kind produces the
  multi-category input it needs — see `feature-scope.md` → Later).
- A manual-pair flow that computes a coefficient for a hand-picked pair (superseded by
  the stats-free Series overlay).
- Server-side computation; caching scan results across sessions.
- Exporting results.
