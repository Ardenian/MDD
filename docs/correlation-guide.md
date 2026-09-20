# Getting Good Results From Correlation Scans

A practical guide to designing Trackers and Fields so the **Correlation** page has
something real to find.

This page is for everybody. It is written in plain language and assumes no statistics
and no code — if a term looks like jargon, it is defined where it first appears. Domain
words like *Tracker*, *Entry*, *Field*, *Series* and *Bucket* mean exactly what
[`CONTEXT.md`](../CONTEXT.md) says they mean. Developers will find a map from every rule
here to the module that implements it in [Appendix: where these rules live](#appendix-where-these-rules-live).

The short version, if you read nothing else:

> **Log something every day, even when nothing happened. Use numbers for anything that
> has an order. Use separate checkboxes for things that can happen together. Scan a few
> Trackers at a time, not all of them.**

---

## 1. How your diary becomes numbers

You never see this step, but knowing it explains every recommendation below.

When you press **Find correlations**, the app does three things:

1. **Cuts time into Buckets.** A Bucket is one slot on the timeline — an hour, a day, a
   week or a month, whichever you picked. Ninety days at daily Buckets gives you ninety
   slots.
2. **Turns your Entries into Series.** A **Series** is one measurement read across every
   Bucket — "average grams of protein per day", "how often I ticked *hot flashes*", "how
   many Workout Entries there were". One Tracker usually produces several Series: one per
   Field, one per select option, plus a count of its Entries.
3. **Compares every pair of Series**, at every time shift you asked for, and ranks what
   comes out.

Two details about step 2 matter enormously, and they are where most disappointing scans
go wrong.

### Empty is not the same as zero

For every Bucket, a Series holds either a number or **nothing at all**.

- **Nothing at all** means *"I have no information about this slot."* The app skips it.
  It does not guess, and it does not draw a line across the gap on a chart.
- **Zero** means *"I looked, and the answer was none."* That is real information and it
  is used.

A day where you simply did not open the app is *nothing*. A day where you logged your
check-in and left every box unticked is a row of real **zeros**. These look similar in
your diary and are worlds apart to a scan. Section 2 is entirely about this — including
how to tell the app that, for one particular Field, *nothing* should be read as a
specific answer after all.

### An Entry can be spread across several Buckets

An Entry is not a dot on a single slot. It contributes to every Bucket its placement
touches, and **Points and Periods are weighted differently on purpose**:

- A **Point** is an event. It always spends **one unit of weight in total**. Adding a
  Fadeout — the uncertainty margin for "around three o'clock, give or take an hour" —
  spreads that one unit across neighbouring Buckets instead of shrinking it. Being vaguer
  about *when* never makes an event count for less.
- A **Period** and a **Day-bucketed** Entry are coverage. Each Bucket gets the share of
  itself that the Entry occupies. A Period covering half a day weighs 0.5 in that daily
  Bucket. A Day-bucketed Entry fills a daily Bucket completely, and takes one seventh of
  a weekly one.

Where a Series is an average, that average is **weighted**: an Entry only half-present in
a Bucket gets half a say in it.

---

## 2. The golden rule: log on a rhythm, not only on bad days

This is the single highest-value habit in the whole app, and it costs nothing to adopt.

Checkbox and select Fields are read as **"out of the times I logged this Tracker in this
Bucket, what share had this value?"** The denominator is *your Entries*, not *days*.

So imagine a Tracker called *Health issue* with boxes for hot flashes, fever and sore
throat, and imagine you only create an Entry when you actually feel ill. Then:

| Day | What the app sees |
|---|---|
| A day you felt ill and ticked *fever* | fever = 1 |
| A day you felt fine and logged nothing | *nothing at all* |

The *fever* Series is now 1 on every Bucket it has any information about, and blank
everywhere else. It never varies. A measurement that never changes cannot line up or
fail to line up with anything, so it will never appear in a result — no matter how strong
the real-world effect is.

**The fix is a daily check-in.** One Entry a day, every day, with the boxes you did not
tick left unticked. An unticked box is stored as a real *no*, not as a blank — in this
app, unchecked is an answer, not an absence. That turns the same Series into a clean run
of zeros and ones with something to compare.

**If a daily check-in isn't how you work, tell the app what silence means instead.** On a
checkbox or number Field you can set a **baseline**: the value to read for a Bucket where
you logged nothing at all. Set *fever*'s baseline to unticked and the days you never
opened the app stop being blanks and become real *no*s — same clean run of zeros and
ones, no change to how you log.

Two things to be honest about. The app never guesses this for you: `false` is the calm
answer for a box called *fever*, but the alarming one for a box called *no fever*, and
`0` is a sensible baseline for grams while being an impossible worst score on a 1–5
rating. And a baseline really is an assumption — a day you had a fever but forgot to log
now counts as a day without one. Set it where you genuinely believe "if I didn't log it,
it didn't happen"; leave it alone where you don't. A Field with no baseline behaves
exactly as it always has.

Baselines only fill Buckets inside the stretch where you were actually keeping that
Tracker — never before your first Entry for it or after your last.

Two useful exceptions:

- **Counting Series behave better.** Every Tracker also produces a Series counting its
  Entries per Bucket, and that one does fill in genuine zeros for the quiet stretches
  between your first and last Entry for it. So for a plain *"did it happen, and how
  often?"* question, a Tracker with no Fields at all — logged once per occurrence — is
  already a well-behaved counter. (It deliberately stays blank *before* your first Entry
  ever. Otherwise two Trackers you happened to start in the same week would look perfectly
  matched purely on the emptiness they shared beforehand.)
- **Things that genuinely happen at a time** — meals, workouts, migraines — should stay
  event-logged as Points. Keep the daily rhythm for the slow-moving measures: mood,
  energy, sleep, symptoms.

---

## 3. Choosing a Field type

| Field type | What the scan gets from it | Use it for |
|---|---|---|
| **Integer / Decimal** | One Series: the weighted average per Bucket — plus a second, the Bucket's total, if you turn that on for the Field | Anything measurable, and anything with an order |
| **Boolean** (checkbox) | One Series: the share that were ticked | A yes/no fact that can co-occur with others |
| **Single-select** | One Series **per option** | Genuinely unordered categories |
| **Multi-select** | One Series **per option** | Unordered categories where several apply at once |
| **Reference** | Nothing itself — the child Entries it holds produce their own Series | Structure, e.g. Meal → Ingredients |
| **Text / Long text** | **Nothing. Never scanned.** | Notes for your eyes only |

None of these is a second-class choice. Select Fields in particular are a designed,
first-class path — the app's own worked example, *Meal → Ingredient = Dairy* against
*Symptom = Bloating*, is built entirely out of select options. What follows is about
picking the shape that gives a true effect the best chance of surfacing.

### Numbers: an average by default, a total only if you ask

A numeric Series is the **average per Bucket** unless you say otherwise.

If you log protein per meal and scan at daily Buckets, you get *average grams per meal* —
not grams per day. Three small meals and one large one can produce the same average on
wildly different intake, so a real effect of total intake can hide completely.

If daily total is what you care about, **turn on *Also total this* for that Field** when
editing the Tracker. The Field then produces a second Series — the Bucket's total
alongside its average — and both are labelled, so a result row always says which one it
is. Nothing about how you log changes; the total is read from the Entries you already
made.

It is off by default on purpose. Every extra Series is another comparison in every scan,
and the bar a finding has to clear rises with the number of comparisons (see section 7) —
so a Field nobody wanted a total for shouldn't cost everyone else a result. Turn it on
where "how much altogether?" is a question you actually have.

### Things with an order: use a number, not a single-select

`Energy = low / middle / high` feels like the natural shape, and it is the weaker one.

Split into three options, the app sees three separate yes/no-style measurements and the
*ordering is gone* — it has no idea that "middle" sits between the other two. Worse, a
smooth real relationship ("more protein, more energy") gets chopped into three weaker
fragments instead of one clear trend, and each fragment costs a test (see section 7).

`Energy` as an **integer from 1 to 5** gives one Series compared by a method that works on
**rankings** — it detects "more of this goes with more of that" without needing the
relationship to be a neat straight line. One measurement, full strength, ordering intact.

The same applies to pain, mood, sleep quality, stress, appetite — anything you would
describe with *low / medium / high* or *worse / better*.

Keep single-select for categories with no order at all: meal type, location, weather.

### Things that happen together: separate checkboxes, not one multi-select

This one is genuinely surprising, so it is worth stating plainly.

**Options belonging to the same Field are never compared with each other.** That rule
exists for a good reason: in a single-select `Energy`, "low" and "high" are opposites by
arithmetic — when one goes up the other must come down, whatever your diary says. Reporting
that as a discovery would bury every real finding under noise.

But the rule applies to multi-select too, where the options are *not* opposites and their
co-occurrence is exactly the interesting part.

So: a multi-select `Symptoms = [hot flashes, fever, sore throat]` can tell you whether hot
flashes track with your sleep, your food, or anything else in your diary — but it can
**never** tell you whether hot flashes track with fever, because those are two options of
one Field.

- Want to know how your checkboxes relate **to each other**? Make them **separate boolean
  Fields**. Each one then stands on its own and all the pairs get compared.
- Only interested in how they relate to **other Trackers**? A multi-select is fine, and
  keeps the Entry form tidier.

### Keep option lists short, and options common

An option you pick four times in ninety days produces a Series that is zero almost
everywhere. There is barely any variation in it to match against anything, so it is
unlikely to produce a trustworthy result — while still costing a test. A twelve-option
Field spends twelve tests to teach you about two or three options.

Prefer a handful of options you use regularly, and fold the long tail into "other".

### Free text is invisible — use Tags instead

Text and long-text Fields produce **no Series at all**. Free writing has no ordering or
categories to compare, and the app does not try to guess any. They are for reading back
later, and that is a perfectly good reason to have them.

If you want something free-form to take part in scans, use a **Tag**. Tags are free text
with autocomplete, attached per Entry, and each distinct Tag becomes its own Series —
"what share of my Entries carried this Tag". Different Tags *are* compared with each other.

Two honest quirks:

- A Tag's share is measured against **every Entry in the Bucket, from every Tracker**. So
  in a week where you simply logged more of everything, all your Tag Series dip a little
  without anything real having changed. Treat Tag findings with a little more suspicion
  than Field findings.
- Tag text is matched exactly. `migraine` and `Migraine` are two unrelated Series. Let the
  autocomplete pick the existing spelling rather than retyping.

### Reference Fields and Child Entries

A reference Field produces nothing on its own; the **Child Entries** inside it produce
their own Series, named by the path that leads to them — for example
`Meal → Ingredients: Ingredient`. Children sit at their parent's placement, so they land
in the same Buckets.

Mind the denominator here too. `Meal → Ingredients: Ingredient = Dairy` means *"what share
of the ingredients I logged were dairy"* — a question about composition. If your question
is *"did I eat any dairy that day"*, put a checkbox or a multi-select option on the Meal
itself; that one is measured against meals, which is what you meant.

### One Tracker referenced from more than one parent

A Tracker can be a reference target for more than one other Tracker — a Protein Tracker
might be a child of both a Meal Tracker and a Snack Tracker, say. Each parent produces
its own Series (`Meal → Protein: grams`, `Snack → Protein: grams`), and the app never
combines them: an average from one can't be added to an average from the other, and
scanning both against a third Tracker tests two separate, weaker comparisons instead of
the one you actually meant.

To read the child on its own — one combined `Protein: grams`, regardless of which parent
it came through — scope the scan to that child Tracker alone, with **every one of its
parent Trackers switched off**. With no parent Tracker in scope, there's no ancestor to
name the Series after, so it falls back to the Tracker's own name.

You can't get both readings from the same scan. Run one scan scoped to the child alone
for the combined question ("how much protein did I eat, from any source"), and a
separate scan scoped to a parent for the compositional question ("how much of what I ate
at meals was protein") — which is exactly the "narrow the scope, run several focused
scans" habit from section 7 anyway.

---

## 4. Do not rename things mid-study

Every Entry is read against the exact Tracker Version it was created under, and Series are
identified by the names in it. That keeps old Entries rendering correctly forever, but it
has one consequence worth planning around:

**Renaming a Field, or renaming one of its select options, splits its history into two
unrelated Series** — one for the old name, one for the new. Each holds half the data, and
each is half as likely to clear the minimum amount of data a result needs.

- Renaming a **Field** splits it. ✗
- Renaming a **select option** splits it. ✗
- Renaming a **reference Field** splits everything below it. ✗
- Renaming the **Tracker itself** is completely safe. ✓
- **Adding** a new option is safe — it simply starts collecting from now on. ✓

Settle your vocabulary in the first week, before there is history worth keeping. (Stitching
a renamed Field's history back together is a known future feature, not something v1 can do.)

---

## 5. Placement, Fadeout and honest timing

- Log events as **Points**, at the time they happened.
- When you are unsure of the time, add a **Fadeout** rather than inventing a Period. "3pm
  give or take an hour" is a Point with a one-hour Fadeout — it still counts as one full
  event, just smeared across the uncertainty. A fake 2–4pm Period, by contrast, is read as
  *coverage* and counts for less in each Bucket it touches.
- Use a **Period** when something genuinely lasted — a sleep, a shift, a hike. **You get
  its length for free**: every Period Entry produces a *Length* Series from its own start
  and end, with no Field to fill in and nothing extra to log. So "does more protein go
  with shorter sleep?" is answerable without ever typing an hours figure. (Points have no
  length, and a Day-bucketed Entry is always exactly one day long, so neither produces
  one — a measurement that never varies can't line up with anything.)
- Use **Day-bucketed** when you honestly do not know or do not care about the time. At
  daily Buckets this costs you nothing at all; it only matters if you scan by hour.

Accurate placement is what makes **Lag** work — see below.

---

## 6. Range, Bucket size and Lag

**Bucket size** is the resolution of the question you are asking.

- **Daily** is the right default for almost everything: food, sleep, mood, symptoms.
- **Hourly** only pays off if you log precise times and want within-day effects ("coffee
  at 4pm, poor sleep that night").
- **Weekly or monthly** smooths out day-to-day noise and suits slow effects — but watch
  the arithmetic below.

**A result needs enough Buckets to stand on.** By default a pair is only shown if the two
Series overlap in at least **10** Buckets. Ninety days gives you 90 daily Buckets — plenty
— but only about 13 weekly ones, which is barely above the floor. **Widen the date range
before you coarsen the Bucket.**

**Lag** is a time shift applied to one Series before comparing, so a cause that comes
before an effect can be spotted. You give a range — the default is −3 to +3 Buckets — and
the scan reports both the strongest shift it found and the no-shift result for comparison.

A shift eats data: pushing one Series three days forward loses three days of overlap at
each end. Shifts that would leave fewer Buckets than the minimum are skipped entirely,
because a handful of leftover points will happily line up perfectly by pure chance. Scan a
lag range that matches a plausible real delay — a few days, not a few weeks.

---

## 7. Why scanning everything makes everything worse

It is tempting to leave every Tracker in scope and let the app find whatever is there.
This actively costs you findings, and the reason is worth understanding.

Every comparison the app makes is a lottery ticket. Compare two unrelated measurements and
there is a small chance they line up impressively by luck. Compare thousands of pairs and
some *will*, guaranteed. The app defends against this with a correction that **raises the
bar in proportion to how many comparisons were made** — which is exactly right, and means
a scan of everything holds every genuine finding to a far harsher standard than a focused
scan does.

The arithmetic escalates quickly, because Series multiply:

- each Tracker: one Entry-count Series
- plus one per numeric Field, one per checkbox
- plus **one per option** of every select Field

Sixty Series is around 1,700 pairs, and with a seven-step lag range that is roughly
**12,000 comparisons** in one scan. A real effect has to shout to be heard over that.

**So: narrow the Series scope to the handful of Trackers you are actually asking about.**
It makes the scan faster, and it materially improves the chance a true finding survives.
Run several focused scans rather than one enormous one.

---

## 8. Reading a result without a statistics degree

A result row says something like:

> Meal → Ingredient = Dairy **vs** Symptom = Bloating · lag +1d · r 0.42 · n 63 · significant

- **Effect size** (`r`, between −1 and +1) — how tightly the two move together. Positive:
  they rise together. Negative: one rises as the other falls. Roughly: below 0.2 is faint,
  0.2–0.4 is modest, above 0.5 is strong for diary data. **A negative result is as
  interesting as a positive one**, which is why the list is ranked by strength regardless
  of direction.
- **n** — how many Buckets the two actually overlapped in. This is your sample. Small `n`
  means a fragile result even when `r` looks impressive.
- **Lag** — the time shift that fit best. `+1d` means the second measure lines up best with
  the first one *shifted by a day*. Suggestive of a delay, never proof of one.
- **p-value** — the probability that a result this strong could turn up by chance if there
  were no real relationship at all. Lower is better; the default cutoff is 0.05.
- **significant** — the result cleared the cutoff *after* the correction for how many
  comparisons the scan made. Results that did not clear it are hidden unless you tick
  *show all*, which shows them flagged rather than dropped.

The three guardrails — minimum `n`, the p-value cutoff, and the multiple-comparison
correction — are all yours to adjust. Tighten them when you are drowning in results,
loosen them when exploring, but understand that loosening trades certainty for volume.

And the standing caveat, which the page repeats for good reason: **this is correlation,
not causation.** The scan finds things that move together. Why they move together is your
job, and "both are caused by something else entirely" is very often the answer.

---

## 9. A worked setup

Say you want to connect energy, food, and a cluster of physical symptoms.

**Tracker: Daily check-in** — Day-bucketed, one Entry every day, no exceptions.

| Field | Type | Why |
|---|---|---|
| Energy | Integer 1–5 | Ordered, so a number beats *low/middle/high* |
| Sleep quality | Integer 1–5 | Same reason |
| Hot flashes | Boolean | Separate Field, so it can be compared against fever |
| Fever | Boolean | Same |
| Sore throat | Boolean | Same |
| Notes | Long text | For you; invisible to the scan, and that is fine |

**Tracker: Meal** — Point placement, logged as you eat, Fadeout when unsure of the time.

| Field | Type | Why |
|---|---|---|
| Protein (g) | Decimal | Averaged per Bucket — turn on *Also total this* if daily intake is the question |
| Meal type | Single-select: breakfast / lunch / dinner / snack | Truly unordered |
| Ingredients | Multi-select: dairy / gluten / … | Fine here: you want these against *symptoms*, not against each other |

This gives clean daily zeros-and-ones for the symptoms, proper ordered numbers for energy
and sleep, a meals-per-day count for free, and per-ingredient Series to scan against all
of it.

**Then:** scan *Daily check-in* and *Meal* together, 90 days, daily Buckets, lag −3 to +3.
Leave the other Trackers out until you have a question about them.

---

## 10. Checklist

- [ ] One Entry a day for slow-moving measures, including days when nothing happened
- [ ] Unticked boxes left unticked, not left blank — that is your zero
- [ ] Or, where a daily rhythm isn't realistic, a **baseline** set on the Field so an
      unlogged Bucket reads as the answer you'd have given
- [ ] *Also total this* turned on for the numeric Fields where "how much altogether?" is
      the real question — and left off everywhere else
- [ ] Ordered things (energy, pain, mood, sleep) stored as integers, not select options
- [ ] Checkboxes that can co-occur kept as separate Fields, not one multi-select
- [ ] Option lists short, each option used regularly
- [ ] Free-form information you want scanned stored as Tags, not text Fields
- [ ] Field and option names settled early, then left alone
- [ ] Events logged as Points with a Fadeout when the time is uncertain
- [ ] Date range wide enough for at least 10 Buckets — much more if scanning weekly
- [ ] A handful of Trackers in scope per scan, not all of them

---

## Appendix: where these rules live

For developers. Everything below is in
[`src/app/features/correlation/`](../src/app/features/correlation/); the feature's own
contract is [`SPEC.md`](../src/app/features/correlation/SPEC.md).

| Rule in this guide | Implemented in |
|---|---|
| Entries → named Series per Bucket | `series-extraction.ts` → `extractSeries` |
| Blank vs zero; a Series with nothing to say is dropped | `series-extraction.ts` → `SeriesBuilder.valuesOf`, `build` |
| Count Series fill zeros only between first and last Entry | `series-extraction.ts` → `valuesOf`, the `occurrence` branch |
| Checkbox/select denominators are Entries of that path | `series-extraction.ts` → `contributeField` |
| Unticked checkbox is a recorded `false`, never absent | [`data/model/field-values.ts`](../src/app/data/model/field-values.ts) → `emptyValueFor`, `isEmptyValue` |
| Numeric Series are weighted means | `series-extraction.ts` → `contributeField`, integer/decimal branch |
| A declared Field also yields a total; the same numerator, undivided | `series-extraction.ts` → `contributeField` (`sum` branch), `valuesOf` ([ADR 0017](adr/0017-field-declarations-are-tracker-metadata.md)) |
| A declared baseline fills Entry-less Buckets, inside the active window only | `series-extraction.ts` → `valuesOf`, `baselineValueOf` |
| Declarations are Tracker metadata, so setting one mints no Tracker Version | [`data/model/field-declaration.ts`](../src/app/data/model/field-declaration.ts); `TrackerRepository.setFieldDeclaration` ([ADR 0017](adr/0017-field-declarations-are-tracker-metadata.md)) |
| A Period Entry's own length, with no Field to fill in | `series-extraction.ts` → `contributeDuration` |
| Average / Sum / Length said in words beside a Series | `series-label.ts`; `ui/components/badge/badge.ts` |
| Excluding a parent Tracker from scope collapses its children to a standalone reading | `data/adapters/indexeddb/correlation-data-source.ts` → `scopeEntries`; `series-extraction.ts` → `pathOf` ([ADR 0015](adr/0015-scope-dependent-child-series-identity.md)) |
| Text, long text and reference Fields yield no Series | `series-extraction.ts` → `contributeField`, final branch |
| Tag Series share one denominator: every Entry in the Bucket | `series-extraction.ts` → `SeriesBuilder.addDenominator` |
| Series identity from the pinned Tracker Version's names; renames split history | `series-extraction.ts` → `extractSeries`, `pathOf` ([ADR 0005](adr/0005-tracker-versioning.md)) |
| Point = one unit of weight; Period/Day-bucketed = coverage share | `bucketing.ts` → `bucketWeights` |
| Options of one Field are never paired | `discovery.ts` → `candidatePairs` (`Series.source`) |
| Spearman for count/numeric pairs, point-biserial otherwise | `discovery.ts` → `methodFor`; `correlation-stats.ts` |
| Lags below the minimum sample size are not scanned; deterministic tie-breaking | `lag-scan.ts` → `scanLags` |
| Benjamini–Hochberg across every (pair × lag) test | `significance.ts`; applied in `discovery.ts` → `rank` |
| Guardrail defaults (min n 10, p 0.05, correction on) | [`data/model/settings.ts`](../src/app/data/model/settings.ts) |
| Ranking by magnitude, so −0.8 ranks with +0.8 | `discovery.ts` → `rank`; `results-sort.ts` |
