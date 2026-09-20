# Follow-ups — deferred to v2 or later

Known, deliberately un-actioned work. Everything here was found during the 2026-09-19 and
2026-09-20 code reviews and the Phase 1–4 remediation that followed
(`tmp/implementation-plan.md`).

**Nothing on this list is a live bug.** Each item was left alone for a stated reason, and
each says what it would take to close. If you pick one up, check it still holds first —
several of these were written against a tree that later phases have since changed.

Scope changes belong in [`feature-scope.md`](feature-scope.md), not here. This file is
for debt and contract defects, not for features.

---

## 1. Decide the app's number-formatting policy

**Found:** Phase 2. **Reach:** app-wide.

The Correlation results header renders `11984`, not `11,984`.

This is not really about that header. The repo has **no number-formatting helper
anywhere** — no `toLocaleString`, no `DecimalPipe` outside generated code — and every
interpolated number in the app has the same property. Phase 2 followed the existing
pattern rather than inventing a one-off.

Closing it means introducing `DecimalPipe` and registering `de` locale data, then deciding
which numbers are user-facing quantities (counts, sample sizes) and which are identifiers
or statistics that should stay unformatted. That is a policy decision with app-wide reach,
which is why it is here and not a patch.

Related: `correlation-page.pom.ts` has a `resultsSummary` accessor that no spec asserts
on, deliberately — its text is locale-dependent, and asserting `"3 pair(s)"` would couple
an e2e to the `en` wording. Whatever policy lands should say how POMs assert on
locale-dependent text.

## 2. Migrate `api-spec/` to a proper pnpm project

**Found:** Phase 3. **Effort:** small.

`api-spec/package-lock.json` is a 45 KB **npm** lockfile sitting inside a pnpm workspace
member. Nothing reads it.

It is almost certainly what made the round-1 review believe the package had its own broken
dependency tree and needed a workaround
(`node node_modules/@typespec/compiler/cmd/tsp.js` instead of `pnpm run api:build`). That
workaround was never necessary.

The member already resolves correctly through the root: `pnpm-lock.yaml` has an
`api-spec:` importer block with all four devDependencies pinned, and
`pnpm-workspace.yaml` sets `nodeLinker: hoisted`, which is why the member legitimately has
**no `node_modules` of its own**. `pnpm run api:sync` runs clean and idempotent today.

Delete the npm lockfile, confirm `api:sync` still runs, and consider a note in
`api-spec/README.md` saying a missing member `node_modules` is expected under a hoisted
linker — otherwise the next reviewer re-derives the same wrong conclusion.

## 3. `Presets` is missing an input model

**Found:** Phase 3. **Effort:** small and mechanical. **Kind:** contract defect.

`Presets.create` / `Presets.update` in `api-spec/main.tsp` take the whole `Preset`
aggregate as their body, where `PresetRepository` takes a `PresetInput`. The generated
client is therefore `presetsCreate: (data: Preset, …)`, so the contract asks the caller to
supply the read-only `AggregateMeta` fields **and** `trackerVersion` — which
[ADR 0005](adr/0005-tracker-versioning.md) says the adapter resolves from the Tracker's
`currentVersion` itself.

`Entries` models this correctly with `EntryInput` (whose doc comment states the rule
outright) and `Trackers` with `TrackerCreateInput` / `TrackerMetaInput`. `Presets` is the
only namespace without one.

Not a live bug: `src/app/data/generated/api-client.ts` has zero importers.
`src/app/data/SPEC.md` documents the gap honestly rather than claiming a clean mirror.

Add a `PresetInput` model, point both operations at it, regenerate via
`pnpm run api:sync`, and correct `data/SPEC.md`.

## 4. The formatting pass

**Found:** Phase 1. **Effort:** small, but touches 14 files at once.

`prettier --check .` has never been clean on this tree. Two unrelated causes:

- **13 files are CRLF**, from a Windows checkout leaking in:
  `calendar-data-access.{ts,spec.ts}`, `data-transfer-data-access.ts`,
  `data-transfer-page.ts`, `entries-data-access.{ts,spec.ts}`, `entry-form-route.ts`,
  `settings-data-access.ts`, `settings-page.ts`, `tracker-designer-page.ts`,
  `trackers-data-access.{ts,spec.ts}`, `trackers-page.ts`.
  Fix with a `.gitattributes` carrying `* text=auto eol=lf`, then one `prettier --write`.
- **`src/app/ui/tokens.generated.ts` is a generator bug**, not CRLF.
  `scripts/generate-tokens.mjs` emits `'… \'Segoe UI\' …'` — single-quoted with escaped
  inner quotes — where Prettier wants `"… 'Segoe UI' …"`. Only the two font-stack tokens
  are affected. **Fix the generator and regenerate; never hand-edit the output.**

Note `.prettierignore` deliberately does *not* ignore `tokens.generated.ts`, on the stated
grounds that "its generator emits Prettier-clean output". That claim is currently false,
and fixing the generator is what makes it true again.

Kept as its own pass because reformatting 14 otherwise-untouched files inside another
change buries that change in noise.

## 5. Split `tracker-designer-page.ts`

**Found:** 2026-09-20 review, Standards axis. **Kind:** Divergent Change. **Effort:** large.

546 lines. One route component owns the Draft field editor *and* the entire Preset editor
lifecycle (`presetDraft` / `presetRoot` / `presetName` / `presetSaving`, plus `openPreset`
/ `addPresetChild` / `savePreset` / `deletePreset`). Two unrelated reasons to change. It
also splits the cohesive `PresetDraft` type back into three separate signals, which is a
Data Clumps smell in its own right.

Deliberately excluded from the Phase 6 cleanup because the Signal Forms migration
(Phase 5) already rewrites this file, and landing both at once would make the result
unreviewable — with no git in the container, there is no bisect to fall back on.

Do this **after** Phase 5 has settled, not before.

## 6. Manual screen-reader pass on the Series-scope notice

**Found:** Phase 4. **Effort:** minutes, but needs a human.

The Series-scope picker announces dropped selections through a `role="status"` live region
that is always present in the DOM (empty when there is nothing to say), so a screen reader
is already watching it when a drop happens.

Playwright can assert the text appears. It **cannot** assert it is announced. One manual
pass with a screen reader is the only way to confirm this works.

## 7. Promote the Maintenance facade to `data/`

**Found:** 2026-09-20 review, Standards axis. **Effort:** small. **Kind:** documented rule.

`MAINTENANCE_PORT` is now injected by **two** features:

- `src/app/features/settings/settings-data-access.ts:14`
- `src/app/features/data-transfer/data-transfer-data-access.ts:11`

Both work with an overlapping `RecordCounts` shape. `AGENTS.md` (*Data access*) is
explicit: a facade shape reused across ≥2 features is promoted to `data/` **on second
use**. This is the second use.

Not scheduled into Phase 6, whose brief was limited to migration-forced duplication plus
the two cases with an unambiguous home (`currentSchema` / `readExpansionDepthCap`, and the
three `localStorage` wrappers).

Note the counter-argument before acting: `data-transfer-data-access.ts` is mostly
pass-through to the port, and [ADR 0002](adr/0002-shared-data-access-layer.md) mandates the
facade boundary regardless — so the Middle Man smell there is suppressed by design. The
promotion is about the *shared shape*, not about removing a layer.

## 8. `playwright/gallery/scenario.ts`'s provider doc comment is now misleading

**Found:** Phase 1. **Effort:** one comment.

`playwright/gallery/scenario.ts:16-20` says:

> A facade declared `providedIn: 'root'` must be named here too, not just the ports it
> depends on: otherwise Angular builds it in the root injector, where the fakes are not
> visible, and it resolves the real tokens instead (or fails with NG0201).

That is **accurate** for genuinely root-provided `@Service()` facades (`UiLocaleService`,
`TrackerLookup`). It reads, however, as though it covers *all* facades — which is now
visibly untrue: under [ADR 0016](adr/0016-page-provided-dataaccess.md) a `DataAccess` is
page-provided, and Phase 1 deleted exactly those entries from
`settings-page.scenario.ts` and `calendar-page.scenario.ts` as dead weight.

Reword so it distinguishes the two cases. It is a `.ts` file, so this is `feature-dev`
work, not `spec-writer` work — which is why the Phase 1 prose sweep could not pick it up.

---

## Noted, not scheduled

**Repeated Switches on `field.dataType`** — the same cascade recurs across
`data/model/field-def.ts`, `data/model/field-values.ts`,
`features/correlation/series-naming.ts`, `features/correlation/series-extraction.ts`,
`features/trackers/draft-field-row.ts` and `ui/components/schema-fields/schema-fields.ts`.

A judgement call rather than a rule breach, and the sites genuinely differ in what they
produce (values, labels, extraction, form controls), so a single shared map may not fit.
Recorded so the next person who adds a seventh switch knows there are already six.
