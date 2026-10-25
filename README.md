# Construction Material Estimator — mobile-fixed app

This is the **complete app folder**, not a screenshot. Open `index.html` through a local web server or host the folder on an HTTPS site. **Keep `index.html` and the root JavaScript files together.** CSS is embedded directly in `index.html` so missing CSS files or a stale stylesheet cannot stretch the form on a phone. `assets/`, `src/`, `scripts/`, and `tests/` contain build sources and checks; keep them if you want to maintain the project.

## Quick start

```bash
cd material-estimator
python -m http.server 8000
```

Open `http://localhost:8000` on your computer. For a phone on the same Wi-Fi network, open `http://YOUR-COMPUTER-LAN-IP:8000`. For **Install app** / reliable offline use on a phone, deploy the entire folder to an HTTPS host (or use localhost on the device). A downloaded HTML file opened with `file://` cannot install a service worker.

## What changed in this revision

- **Session Results labels corrected (all calculators)**: *Description* → **Volume** in the blocks/bricks tables (it shows the wall volume in m³), *Mortar Cement* → **Cement** and *Mortar Sand* → **Sand** (clear names in every language), and the earthwork *Description* column → **Dimensions**. The cost inputs now say *Cement Cost/Bag* and *Sand Cost/m³*.
- **Typed values no longer hide behind the +/− buttons**: compact number fields use a Tailwind `!p-2` padding override that used to cancel the stepper space reservation (worst in Arabic/Kurdish RTL, where the caret and digits start on the stepper side). The reservation is now `!important`, so values always show clearly in every language.
- **"Total Volume" mode asks for the volume only**: the confusing *Wall thickness* and *Wall leaves* fields were removed from the blocks/bricks total-volume mode (total volume already contains the thickness). Blocks and bricks are counted directly from the block module (length × height × block depth), and the result matches the dimensions mode exactly. Dimensions mode still asks for width and leaves.
- **Zoom is locked**: pinch, double-tap, keyboard and trackpad zoom are disabled (`user-scalable=no`, `touch-action: pan-x pan-y`, and gesture guards). The UI always stays at its designed size; one-finger scrolling still works.
- **Project settings slimmed down**: only **General Material Wastage**, **Currency**, the **100 USD to IQD rate** and **Cement bag size** remain. The whole *Project information* block (project name, client, location, date, unit system, notes) was removed.
- **Project settings is its own screen**: tapping *Project settings* in the header now opens a dedicated settings view (back bar + bottom navigation) exactly like the calculators; closing it returns to the tool you were using (or home).
- Restored the missing `assets/app.css`, `manifest.webmanifest`, `icon.svg`, and `favicon.ico`. The compiled CSS and component styles are now **embedded together** in the HTML, so even if a deployed copy omits `assets/app.css`, the app layout remains intact.
- Made the language selector, visible **Dark mode** switch, settings, and history controls a tidy two-column phone toolbar. The same switch works inside calculators and remembers your choice.
- Matched the header logo to the supplied brick-wall app icons.
- Stacked narrow dimension/input rows instead of squeezing three steppers across a phone; fixed widths, RTL positioning, and bottom-nav/action-bar space. No page-width panning is required.
- Removed the desktop metric dashboard from the small-screen calculator view, so the form starts higher on the screen. Phone tabs live in the bottom navigation; tablet/desktop use the standard tabs and action buttons.
- Bottom navigation respects the device safe area, and the keyboard hides the fixed action bar while typing.
- Fixed the specific iPhone screenshot failure: universal `border-box` sizing, full-width constrained number-field wrappers, and no native duplicate spinners. The width and padding of numeric inputs now stay inside their cards, just like selects.
- Advanced the offline-cache version to v32 so previously installed copies can receive the corrected shell.

## Verification

`npm ci && npm run test:all && npm run test:ui && npm run test:audit`

Also checked actual Chromium and WebKit (Safari engine) mobile viewports at 320, 375, 390, 428, and 600 pixels. In both engines, all six form controls from the reported iPhone screenshot stayed inside the same card, including when **all external CSS requests were blocked**. All calculator tabs at 320 pixels in English, Badini, Sorani, and Arabic had no page-width overflow or page errors. Zoom in/out is disabled on purpose (the app UI must never scale); the layout fits the portrait screen without zooming or sideways scrolling.

Editable JavaScript is in `src/*.src.js`; use `npm run build` to regenerate the minified root scripts and re-embed CSS. The custom mobile layout source is `new-style.css`; after editing CSS alone, run `npm run embed:css`. If you have an older installed Home Screen copy, replace the deployed files, open the site online once, and reinstall/clear the previous site's data if it still shows the old layout.

Result layout revision (October 2026): after **Calculate**, the answer appears as one compact card — the big answer and total cost first, then small Save/CSV/PDF buttons, then the "What to order" shopping list with its Share list button. All further numbers (cement, sand, water, blocks/bricks, cost rows) and the full calculation trail are folded into one closed **See details** section that opens on tap. The Session Results table is folded away behind a small "Session Results" bar showing how many saved rows there are; tap the bar to expand or collapse the table. This keeps the first screen short and the answer unmissable on small phones; everything is still there, just one tap away.

Steel tool revision (October 2026): the rebar calculator was decluttered and extended. Lap-splice settings (standard bar length is now **"Bar length in shops (m)"** in the General section, and the lap factor) moved into a collapsed **"Lap splices (for long bars)"** line at the bottom of Element details — closed by default, open it to include laps. The numbered "1./2./3." step headings were removed from every tool. The element list gained **Custom bars**: add rows of diameter + number of bars + bar length for dowels, chairs and odd jobs (member count is hidden for it since the rows are absolute). Every diameter list now offers Ø8–Ø32 (8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32). The result is flat: the headline is always **Total Weight** with the grand total, "What to order" lists each diameter as shop bars (e.g. "Ø12 mm — 850 kg · 71 Bars × 12 m"), and the per-direction/per-row breakdown plus the calculation note sit in **See details**. Fixed: member count now multiplies footings, slabs and one-way runs too (before, only beams and columns counted it); session "Dimensions" column values are language-neutral ("3×2 m"); per-member amounts are labelled when the member count is over one.

Everyone's-guides revision (October 2026): four aids make the app usable without engineering knowledge. (1) **Field hints** — a small **?** next to every technical label (spacing, diameter, concrete cover, stirrups, lap factor, member count, mortar, truck capacity, swell, …) taps open a plain-language note in the current language. (2) **Fill typical values** — a button in the Steel "Element details" step fills the engineering assumptions (footing Ø12 @ 150 mm, slab Ø10 @ 150 mm, stirrups Ø8 @ 200 mm with 40 mm cover, one-way Ø10 @ 150 mm) while never touching your measured dimensions or bar counts. (3) **Sanity warnings** — unusual entries (a 30 m wall height, spacing over 300 mm) are flagged in a non-blocking amber note above the result ("looks unusual — please check (1–20 m)"); the calculation still runs. (4) **First-run guide** — a three-screen welcome (Measure → Enter → Order) shows once on first launch in all four languages and remembers dismissal.

Live language switching (October 2026): changing the language now re-labels **everything**, not just the form. An open result is quietly re-calculated in the new language (labels, "What to order", "See details", calculation notes — no duplicate session row, no page jump), and the Session Results table and History re-render their stored rows with the current language's wording (e.g. an English "12 bags" row shows "12 كيس" after switching to Arabic, and a steel "Footing" row shows "أساس").

Formula audit (October 2026): every formula in every calculator was checked against the standard engineering method and verified with hand calculations and live test vectors (`archive/formula-audit.md` has the full report). Concrete uses the absolute-volume method (1:2:4 → 7 bags, 0.44 m³ sand, 0.88 m³ gravel per m³); masonry uses the face-area method with joint allowance and a mortar-by-volume method; steel uses D²/162 with exact lap-splice algebra (splices = ceil((L−O)/(S−O))−1) and stirrup cutting lengths including 2×10d hooks; earthwork applies swell to the bank volume before counting truck loads. Three defects were found and fixed: the one-way steel result showed "(undefined)" as the element name, the English word "bags" was hardcoded in three result locations, and the blocks mortar trail did not reconcile net vs ordered mortar. Regression vectors pin all of these values in the test suite.

Language and font polish (October 2026): the language picker is ordered **ENGLISH · KURDISH BADINI · KURDISH SORANI · ARABIC** with those Latin names (the picker is now wide enough that "KURDISH SORANI" never clips). The Kurdish Badini word for a cement sack is consistently **کیسک** everywhere (Sorani keeps **کیسە**). The UI font for the Arabic-script languages is **Vazirmatn** (modern, full Sorani/Badini coverage — ڕ ڵ ێ ۆ), subsetted to the app's characters and **embedded inside index.html as a data URI**, so there is no font folder to upload and the face can never 404 or fall back to the device default.

Cost honesty, data backup and steel schedules (October 2026): an **empty price field no longer shows a fake 0.00 cost anywhere** — the result says "Cost not entered", the hero omits the cost line, and the grand total only appears once every price is filled in (a price you type as 0 is still a real, entered 0). **Project settings gained a "Data backup" card**: *Back up (JSON)* downloads one JSON file with language, theme, settings, projects, session rows and history; *Restore from file* puts all of it back (invalid files are rejected with a message). The steel result now includes a **bar-bending schedule** (a collapsed "Bar schedule" table: mark, diameter, shape — stirrups show their ring size like 220×420 mm —, number of bars, cutting length and total length per diameter) plus a schedule note covering anchorage and hooks, and the cutting lists remain grouped by diameter with 12 m shop-bar counts.

Job-site enhancements (October 2026): the steel tool gained **BRC welded wire mesh** as an element — pick rolls or sheets (defaults 2.0×20 m roll, 4.8×2.4 m sheet, both editable), enter the area, and the app counts pieces from the area plus an editable overlap/waste allowance (10% default), with an optional price per piece. Steel orders now read *"Ø12 mm — 850 kg ≈ 80 Bars (12 m)"* with a note that yards sell by standard 12 m commercial bars. The concrete mix-ratio list is labelled by grade — **C15 · Blinding (1:3:6)**, **C20 · Ordinary (1:2:4)**, **C25–C30 · High strength (1:1.5:3)** — each with its typical cement-per-m³ note. The blocks tool adds local **thermo-stone (60×20×20 / 60×20×15)** and **AAC** block shapes plus a **thin-bed adhesive** joint option: switch the joint type to glue and the mortar fields give way to glue per m² of wall (4 kg/m² default), bag size and price per bag. Earthwork has a **land area converter** (m² ↔ دونم/dunum 2,500 m² ↔ أولك/olak 100 m²). Every result now has a **Quote** button beside Save/CSV/PDF: it opens a printable A4 **Material Quote** with project, client, contractor and contact fields (remembered), an itemized table with editable agreed unit prices that compute line amounts and the grand total (prices remembered per line), notes, and contractor/client signature lines — *Print / Save as PDF* prints the quote alone.

Quote refinements (October 2026): the quote sheet gained a **Send to WhatsApp** button beside Print — it builds a clean pre-filled message (title, date, project, client, contractor, contact, itemized lines with quantities × unit price = amount, grand total, notes), copies it to the clipboard and opens WhatsApp ready to send. The land converter now recalculates on both typing and unit switching (m² / Dunum / Olak). Printing is now strictly separated in both directions: printing the quote prints only the quote sheet (never a stale #print-area), and the app's PDF print never includes the quote overlay. All new interface strings are fully translated in the four languages.

Kurdish terminology & bidi polish (October 2026): Sorani wording fixes — gross volume is **قەبارەی سەرجەم** (Badini: **قەبارێ گشتی**), wet volume is **قەبارەی تەڕ**, "ordered" is **داواکراو**, and **بەرگری** replaces the loanword in the mix-assumption notes. All ratios (1:2:4, 1:6, …) and diameters (Ø12, Ø8, …) are now wrapped in `<bdi dir="ltr">` wherever they render, so they never scramble inside Arabic-script text; label updates also preserve button icons.

Language picker hardening (October 2026): the language names are always Latin — **ENGLISH · KURDISH BADINI · KURDISH SORANI · ARABIC** — and the picker is now forced left-to-right (`dir="ltr"`) with non-breaking spaces inside the two-word names, so an RTL page can never reverse or scramble them (e.g. "BADINI KURDISH") on any phone. A regression test pins the exact four names, their order, and their survival across language switches.

No more truncated labels (October 2026): the result action row (Save / CSV / PDF / Quote) no longer squeezes buttons into equal-width columns that cut labels off ("Qu…") — buttons now size to their full text, keep their icons, and the row wraps to a second line on narrow screens. The quote toolbar (Close / Print / Save as PDF / Send to WhatsApp) wraps too. Every other title in the app was checked: the language picker, header actions, hero labels, table headers (in scroll containers), bottom-nav labels (two-line by design) and form labels all display fully.

Summary + single PDF (October 2026): the price document is now called **Summary** in all four languages (EN Summary · KU خولاسە · KS پوختە · AR ملخص) — button, window title, and WhatsApp message title all renamed. The two separate prints were merged into **one combined PDF**: the PDF button in the result card now prints the calculation **plus** the full summary sheet (items, remembered prices, amounts, grand total, notes, and both signature lines) in a single document. The separate "Print / Save as PDF" button inside the summary window was removed; its toolbar keeps Close and Send to WhatsApp. Regression tests cover the new name, the removed button, and the combined document contents.

Engineering-review fixes (October 2026): (1) honest naming — the steel tool's page title and home tile no longer say "Structural Steel" or promise "bar bending schedules"; English reads "Rebar Calculator" / "Rebar weight and cost by element" and "Select an element". (2) The steel hero is now explicitly pinned to the Total Weight row (`data-hero`), so it can never flip to bar counts; BRC keeps "Mesh to order". (3) The lab-style "Approved recipe per m³" concrete mode was removed entirely (UI, engine, translations, tests) — mixes are nominal ratios (1:2:4 etc.) plus one custom nominal ratio. (4) Printing is a single pure-CSS path: `#print-area` prints alone when filled, otherwise the app prints normally — never a blank page; the old `body.printing-quote` class toggling is gone. (5) All diameter dropdowns (including JS-built custom rows) share one list: 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32 mm. (6) Session descriptions use language-neutral "×" notation (e.g. 3×2×0.2 m). (7) Empty prices never render 0.00 — summary grand totals say "Cost not entered" until at least one price is typed. (8) Dead DOM removed (`.mobile-sticky-footer` bar, `.global-settings-placeholder` divs); the mobile Calculate/Reset buttons are created by app-ui and wired by delegation. (9) One stylesheet of record: compiled Tailwind utilities were merged into new-style.css (marked section) and assets/app.css deleted — embed-css.mjs embeds new-style.css once at build. Total-volume mode remains volume-only (no leaves/thickness inputs), now pinned by tests.

Phone-UX fixes (October 2026): the status-bar/browser-bar colour now tracks the app theme exactly (dark meta #0b1417 = the body background; manifest theme_color aligned to #f2f6f7 instead of teal). The session-table trash button asks for confirmation before deleting rows. Earthwork converter outputs (m²/dunum/olak) are visually distinct read-only fields (dashed muted style, no keyboard). Custom bar rows gained an optional note ("What are these bars for?") that flows into the result breakdown, the session description and the Summary line items. The Summary window keeps a "Print / Save as PDF" action that runs the exact same single combined document as the result card's PDF button. Orphan hidden translation spans removed; the rebar dropdown reads "One-way slab / strip" everywhere.

## v53

- iOS status bar: `apple-mobile-web-app-status-bar-style` = `default` (dark clock/battery, readable on the light app).
- Integer count fields (bars, number-len/wid, quantities, element counts) switch to `inputmode="numeric"` — whole items only on the mobile keypad.
- All three dialogs (history, summary sheet, first-run guide) are registered in `setupDialogs()`: Escape closes, focus is trapped and returned; the close matcher also recognises `#quote-close-btn` / `data-close-modal`.
- RTL-safe spacing: physical `mr-1` icon margins → logical `me-1` (helper added to the stylesheet) across the backup and summary toolbars.
- Labels: `#quote-notes` label wired with `for`, `#custom-currency` (hidden) gains an accessible name (`customCurrencyLabel`).
- Pinned: status-bar meta, numeric inputmodes, no `mr/ml-*`, label wiring, dialog registration (calculations.test.js); Escape-closes-summary runtime check (full-ui-check D12).

## v54

- Land area converter is a real app accordion: `.advanced-details` + `land-plot` icon + rotating `sd-chev` chevron (CSS extended so `sd-chev` also rotates inside `advanced-details`).
- Window vs. door openings now have distinct labels in every language (`windowWidth` / `windowHeight` / `doorWidth` / `doorHeight`, EN/KU/KS/AR) in Blocks and Bricks — no more identical "Opening width" rows in RTL.
- `npm run build:css` now updates the stylesheet of record: Tailwind compiles to a temp file, `scripts/merge-utilities.mjs` rewrites the utilities section of new-style.css between its markers, and embed-css re-embeds. `tailwind.config.js` scans index.html + all root scripts so JS-template classes generate. (No more writing to the deleted assets/app.css.)
- "Fill typical values" flashes `✓ Filled!` for 1.2 s so taps/double-taps are visible, then restores its translated label.
- Reset (sticky action bar + per-tool buttons) asks for confirmation before wiping a form that contains typed values; a pristine form resets silently. `confirmReset` in all four languages.
- Pinned in tests: accordion markup + icons, window/door label keys, build:css target, preset feedback and reset confirmation (D13 runtime), plus `confirm` stubs in all three JSDOM harnesses.

## v55

- Kurdish results cleanup: Badini «جی بەفیڕۆچوونێ» → «پێش بەفیڕۆچوون» (trailBeforeWaste, trailCementBeforeWaste, trailMaterialLine). The other documented artifacts (سەڵامە، ستڕێنگ، چرکە، کورد) verified already correct since v47 and pinned so they cannot return.
- Steel naming: home card now "Rebar weight, lengths, and bar counts by element" in all languages (EN title "Rebar Calculator" since v51; diameters Ø8/14/25/28/32 and the Total-Weight hero pinned since v51).
- Steel hero shows the two numbers the supplier needs: Total Weight (kg) **and** total commercial bars (12 m) — never a raw bar count as the headline.
- Project Grand Total (Project settings → "Open combined purchase order"): one overlay aggregating cement bags, sand, aggregate, adhesive, blocks, bricks, steel (kg + tonnes) with a per-diameter breakdown and 12 m bar counts, plus excavation volume and truck loads — across all five tools' session tables. Print/Save-as-PDF uses the single print path; Esc closes; empty state included. All strings ×4.
- Error box already smooth-scrolls into view on validation errors (`showError`) — now pinned against regression.
- Architecture: `npm run check:sync` + `pretest` hook + test assertion fail loudly if index.html's embedded CSS drifts from new-style.css. All eight shipped root JS files start with `/* AUTO-GENERATED - DO NOT EDIT DIRECTLY... */` (written by scripts/build.mjs).
- New tests: D14 (grand total: empty state, cement/sand/aggregate/steel aggregation, per-Ø bars, print, Esc) and static pins for all of the above.

## v56

- Project Grand Total gains **Send to WhatsApp**: one tap copies a clean purchase-order text (date + currency header, cement bags & tonnes, sand + aggregate m³, blocks/bricks/adhesive, steel kg + tonnes with per-diameter 12 m bar counts, excavation m³ + truck trips) and opens `api.whatsapp.com/send?text=…`.
- Form drafts: every tool's fields auto-save to `localStorage` (debounced 300 ms) and restore after a reload/tab discard; an explicit Reset clears that tool's draft. Dynamic custom-bar rows are not draft-saved.
- New Project button in Project settings: confirm, then wipes all five session tables in one tap (`confirmNewProject` ×4).
- Project Total is reachable from the mobile bottom nav (with live session-count badge), the desktop header quick actions, and by tapping the SESSION ITEMS metric card — not just buried in settings.
- `#grandtotal-overlay` now carries full dialog semantics (`modal-overlay`, `role="dialog"`, `aria-modal`, `aria-labelledby` → `h2#grandtotal-title`, present in empty state too).
- PWA update toast: `updatefound`/`controllerchange` show a discreet "Update available — [Reload]" bar; reload swaps in the new service worker without clearing site data.
- Earthwork adds **Backfill (compaction)** mode: `loose to order = required compacted volume ÷ (1 − shrink%)`, with swapped labels/hints (defaults 15%), its own result wording, and mode-aware trails. Excavation (swell) is unchanged and remains the default.
- Session metric/badge counts now only real session-table rows (cutting-list tables inside results no longer inflate the count).
- Tests: D15 (draft restore/save/reset-clear, WhatsApp order text, header/metric/nav access, dialog semantics, backfill math 4 m³ @15% → 4.71 m³ & 2 trips, new-project wipe) + static pins for all of the above.

## v57

- SVG sprite: added the missing `i-file-text`, `i-message-circle` (exact Lucide path), `i-shopping-cart`, `i-pencil-line`, `i-upload`, and `i-chevron-right` symbols — the WhatsApp button, Summary button, Project Total buttons, intro slides, Restore button and lap-splices chevron now render instead of blank boxes. `#new-project-btn` switched `trash` → `trash-2` (the sprite's real id).
- New regression sweep in tests: every `data-lucide` name and every `#i-…` reference across index.html + all sources must have a matching `<symbol>` — blank-box icons cannot return.
- CSS sync hardened to EXACT equality (embedded block ≡ new-style.css, both directions). Note: `.bn-badge` / `.metric-card-action` / `.update-toast` already lived in new-style.css — the copies in index.html are the build embed and were byte-identical; the real hole was the one-way subset comparison in check:sync, now closed.
- Mobile header toolbar: `#header-grandtotal-btn` spans both grid columns (accent styling) so the 5 items read as a balanced 2-1-2 layout.
- Earthwork Excavation/Backfill toggle now uses the app's segmented pill `role="radiogroup"` treatment like Concrete/Blocks/Bricks.
- Compaction math safety: the shrink input clamps to max 50 in backfill mode (100 for swell), and calc-earthwork carries a backstop (`>= 90 → 89`) so `bank / (1 − shrink)` can never divide by ~zero.

## v58 — Delete rows, dinar formatting, share, BRC dims, placeholders, RTL numbers

- **Per-row session delete.** Every session table row now carries a small ✕
  (tooltip + aria-label "Delete"). Deleting one row recalculates that table,
  the session count and the Project Total badge immediately — the rest of the
  table stays put (fix a single typo without wiping the table). Cells now show
  only real display values (no more `[object Object]` from engine data).
- **IQD money has no coins.** Dinar amounts print with thousands separators and
  zero decimals (14,850,000 د.ع). USD and other currencies keep two decimals
  ($1,250.50). Physical quantities still show 2 decimals (1.50 m³).
- **Share / Copy button** next to WhatsApp in both the Summary and Project
  Total toolbars. Uses the phone's native share sheet (Telegram, Viber, mail…)
  and falls back to clipboard copy where sharing is unavailable.
- **BRC wire mesh dims match the market.** Roll mode auto-fills 2.0 × 20.0 m
  rolls; sheet mode auto-fills 2.4 × 4.8 m commercial panels.
- **Earthwork placeholders follow the mode.** Backfill suggests
  `sand ~10, subbase ~15, soil ~20`; excavation suggests
  `sand ~12, gravel ~15, clay ~30, rock ~50`.
- **RTL number inputs type LTR.** In Kurdish/Arabic, numeric fields still read
  left-to-right with the cursor at the decimal end — no mirrored numbers.

Tests: D16 (row delete, dinar grouping, share fallback, BRC dims, placeholders)
plus money-format pins across the suites. All four suites green.

## v59 — Steel audit follow-through & unified dimension format

Most items from `archive/steel-audit.md` / `archive/NATIVE_REVIEW_STRINGS.md` were verified as
already live (member-quantity multiplies every element mode, hero is always
Total Weight, Ø8–32 diameter lists, lap splices in a collapsed "Lap splices
(for long bars)" block, "One-way slab / strip", "Rebar Calculator", order
breakdown by diameter with 12 m bar counts, member-quantity label in 4
languages, reviewed Sorani/Badini wording: قەبارەی تەڕ، بڕی داواکراو، بەرگری،
کیسک/کیسە). This round completed the rest:

- **Unified dimension format.** Session and result dimensions now read
  `3 × 2 m`, `5.0 × 3.0 × 2.0 m`, `220 × 420 mm` (spaces around ×) in every
  calculator, including the openings-deducted lines in all 4 languages —
  language-neutral on every screen.
- **Regression pins.** Slab and one-way member-quantity multipliers (previously
  only footing was pinned) and the Ø8–32 diameter completeness check.

sw.js → v59. All four suites green.

## v60 — Card headings without wizard numbers

The form cards no longer read like a numbered wizard on a single-screen layout:

- **Concrete**: "Dimensions & Quantity" · "Mix Specifications" · "Costing (Optional)"
- **Blocks & Bricks**: "Wall Dimensions" (or "Wall Volume" in volume mode) ·
  "Material Specifications" · "Costing (Optional)"
- **Steel**: "General Settings" · "Element Details" · "Costing (Optional)"
- **Earthwork**: "Excavation Details" · "Haulage & Soil"

Technical: the shared `step1Dimensions` / `step2Mix` keys that served several
different headings were split (`step1WallDims`, `step1WallVolume`,
`step2Material`) so each tool keeps its own wording in all 4 languages after a
language switch; English dict values were Title-Cased to match the markup.
Regression pin: no `[data-lang^="step"]` heading may start with "N.".

sw.js → v60. All four suites green.

## v61 — Local Material Prices (quick presets / memory) + audit docs closed

- **"Local Material Prices" card in Project settings.** Set your local rates
  once — cement (per bag), sand and aggregate (per m³), rebar (per kg), block
  and brick (per piece), glue (per bag), BRC mesh (per piece), formwork (per m²).
  Every calculator fills its empty price fields from these values across all
  five tabs, follows your edits, and re-fills after Reset.
- **Typed prices always win.** A price you type in a calculator is never
  overwritten by the memory; only empty or auto-filled fields follow it.
  Clearing a setting clears its auto-filled fields (typed ones stay).
- **Backup/restore carries prices** (`prices` key in the JSON, backward
  compatible with older backup files).
- **archive/steel-audit.md and archive/NATIVE_REVIEW_STRINGS.md are marked RESOLVED/CLOSED
  (v59)** with status headers — both describe issues already shipped in
  v55–v60 and are kept for historical reference only.

11 new translation keys × 4 languages. Regression suite D17 covers the memory
behavior. sw.js → v61. All suites green (`npm test`, `test:all`, `test:ui`,
`test:audit`).

## v62 (polish round: ordering guides, fallbacks, grouped counts)

- **Concrete (Total Volume mode):** the formwork cost input now **auto-hides**
  (row hidden) instead of merely disabling. The formwork dimension note is gone
  from that row (the cost scope line already explains it).
- **Openings summaries** (blocks/bricks) stay hidden until there is at least one
  window or door **and** the opening area/volume is > 0.
- **Earthwork truck capacity:** empty or invalid entries fall back strictly to
  the standard **4 m³** before any division (no more NaN/zero-path).
- **Sand & gravel order lines** show a real-world truck guide — e.g.
  `1.85 m³ (≈ ½ standard 4 m³ truck load)` (glyph fractions of a 4 m³ truck).
- **Mixing-water label** renamed with the exact wording
  (`Estimated batch mixing water (w/c ≈ 0.55–0.60)` + AR/KU/KS).
- **Stirrup rows** are suppressed when the checkbox is off (regression pinned —
  no empty "Stirrup/spacer" rows in the result or bar schedule).
- **Thousands separators** on whole-item counts and weights
  (`12,196 blocks`, `45,000 kg`, `1,483 pcs`) — volumes and money unchanged.
  Quote amount math now treats commas as thousands separators (not decimals).
- **Keyboard flow:** every card's fields carry `enterkeyhint="next"`, the last
  field `done`.
- **Quote export:** zero-quantity lines are dropped from the PDF summary and
  WhatsApp bill; the signature block never splits across printed pages
  (`break-inside: avoid`).
- Tests: new D18 suite (12 behaviours), boot hardened against timing flakes;
  `sw.js` CACHE = **v62**.

## v63 (architecture + site usability round)

- **CSS externalized (tech-debt fix):** the ~1000-line embedded style block and
  the base64 webfonts are gone from `index.html`. Styles now load from
  `new-style.css` via a normal `<link>`; the two Vazirmatn subsets live in
  `fonts/*.woff2` and are precached by the service worker. The embed/sync
  scripts (`embed-css.mjs`, `check-embed-sync.mjs`, `pretest`) were removed —
  edit `new-style.css` and refresh. Smaller HTML on every cold load, and the
  browser can cache CSS and fonts independently.
- **Phone header decluttered:** the top bar keeps only [logo + title] and
  [language chip] + [Menu ☰]. Language, Dark mode, Project settings, Recent
  calculations and Project Total moved into a slide-out menu drawer
  (Esc closes it, focus is trapped, tapping a tool closes it).
- **Quick picks:** concrete chips (Standard slab 15 cm / Standard footing 40 cm
  / Typical column 30 × 30 cm × 3 m), a soil-type picker for earthwork
  (Sandy +12% · Common +20% · Clay +30% · Rock +50% swell), and masonry wall
  chips (Partition 10/15 cm single leaf · Structural 20 cm double leaf).
- **Live SVG diagrams:** beam cross-section with main bars, stirrups and cover;
  footing/slab/one-way rebar grids; blocks/bricks wall elevations with the
  door/window openings drawn in. They update as you type.
- **Element groups (true BOQ phases):** tag any calculation with
  Substructure / Foundation, Ground Floor, Roof Slab, or Boundary Wall. Session
  rows show a phase badge and the Project Total (PDF + WhatsApp) splits into
  per-phase material lists — order the foundation first.
- **Export hardening:** CSVs keep the UTF-8 BOM for Excel on Arabic/Kurdish
  Windows; printing gets `@page` 10 mm margins, black-and-white high-contrast
  rules for job-site printers, and no URL footers.
- **Site micro-interactions:** stepper taps tick with `navigator.vibrate`,
  preset/default values select-on-focus for instant retyping, text fields get
  an inline clear (✕), and an "Offline Ready" pill appears once the app is
  cached (shown in the menu).
- Tests: new D19 suite; sprite gains `menu`/`languages`/`check-circle-2`;
  `sw.js` CACHE = **v63** (precache includes `new-style.css` + fonts).

## v64 (PDF export round: jsPDF, phase tags, summary export)

- **Real PDF export (jsPDF 2.5.2, vendored at `vendor/jspdf.umd.min.js`, MIT —
  works fully offline).** Two new "Download PDF" buttons: the quote-page
  toolbar exports that tab's Summary sheet (`Summary_<tab>.pdf`), and the
  Project Grand Total page exports a combined `project_total.pdf` grouped by
  phase. Both use an A4 points layout with repeated table headers on page
  breaks and contractor/client signature lines. Strings with Arabic script
  (Kurdish/Arabic) are drawn with the browser's own text engine onto a canvas
  and stamped into the PDF, so shaping, bidirectional text and digits are
  always correct; Latin/digit text stays selectable PDF text. If the library
  is missing, the button falls back to the print dialog.
- **Phase tags** (carried from v63): optional tag per result — Substructure,
  Ground Floor, Roof Slab, Boundary Wall — shown as a pill on the session row
  and as grouped sections in the grand total.
- **Summary export buttons** (carried from v63): "Save CSV" (Excel-safe UTF-8),
  "PDF" (print view) and "Summary" (WhatsApp/email list) on every quote page
  and the Project page.
- Tests: new D20 suite drives both PDF exports through a stubbed save
  (headers `%PDF-`, filenames, fallback); 15 calculation pins.
  `sw.js` CACHE = **v64** (precache adds `vendor/jspdf.umd.min.js`).

## v65 (declutter round: site tools, element presets, advanced volume)

- **Land area converter moved to a "Site Tools" popup.** The Dunum/Olak/m²
  converter no longer sits inside the excavation card — it lives in its own
  popup, opened from the app menu (Menu → Site Tools), with the same live
  conversions.
- **Concrete quick picks follow the element.** Slab presets (15 cm slab,
  40 cm footing) appear for Slab / Foundation, the column preset for Column,
  and a new "Typical beam · 30 × 50 cm × 4 m" preset for Beam — never the
  other elements' chips. Quick picks also hide in Total Volume mode. (The
  column preset now fills the 3 m side as the column height, matching the
  field labels.)
- **Masonry "Total Wall Volume" mode is advanced-only.** Blocks and bricks
  show Wall Dimensions (Length × Height × Thickness) as the only main form;
  a single collapsed "Advanced / Direct m³" toggle switches to direct volume
  entry for anyone who already knows the volume. The mode radios remain
  internally, so saved flows and formulas are unchanged.
- **Dev docs archived.** steel-audit.md, NATIVE_REVIEW_STRINGS.md,
  MOBILE_REVIEW.md, CHANGES_MOBILE_FIXES.md and formula-audit.md moved to
  `archive/`; only README.md stays at the production root.
- Tests: new D21 suite (preset filtering, advanced toggles, Site Tools popup
  placement); boot helper retries once when the shell/nav never builds.
  `sw.js` CACHE = **v65**.

## v66 (file-count round: one merged app.js)

- **All application JavaScript ships as one `app.js`** (250 KB). The eight
  separate files (`app-ui.js`, `concrete-calculations.js` and the five lazy
  `calc-*.js` calculator chunks) are merged at build time in their original
  load order — behavior is identical, and the calculator handlers register
  at startup so the lazy loader never needs to fetch. `src/*.src.js` remain
  the editable sources; `npm run build` minifies and merges them.
- Deploy set shrinks from ~23 files to **15**: index.html, app.js,
  new-style.css, sw.js, manifest.webmanifest, 7 icons, fonts/ (2 woff2),
  vendor/jspdf.umd.min.js. CSS/fonts/PDF library stay separate per the v63
  architecture rules.
- `sw.js` CACHE = **v66** (precache now lists the single app.js).
- Tests: smoke/nav harnesses inline the one bundle; deployment-asset and
  AUTO-GENERATED pins updated. Full chain green.

## v67 (clarity audit round: plain labels, correct hints, full localization)

Every screen and string was audited the way a first-time user meets it. Fixed:
- **Wrong help text:** the Concrete "Calculate By" (?) explained steel bar
  spacing (copy-paste from the steel tool). It now explains dimensions vs
  total volume; steel keeps its own hint.
- **Plain labels:** "Total Volume concrete (Quantities)" → "Total Volume";
  "Element group" → "Project phase" (the options are phases);
  "Number of Walls / Sections" → "Number of elements (same size)";
  "Select an element / -- Please Choose --" → "Element type / Choose
  element…"; table column "Qty" → "Quantity".
- **Two PDF buttons no longer compete:** "Print / Save as PDF" is now just
  "Print" — "Download PDF" is the button that saves a PDF file.
- **Full localization:** the custom-ratio placeholder, custom block/brick
  size placeholders, the soil-swell placeholder (both modes), and three
  screen-reader labels (earthwork mode, home screen, workspace status) were
  hardcoded English — all are dictionary-driven now (all four languages),
  and placeholders translate on language switch (new `data-lang-placeholder`
  pass).
- Tests: new guard pins; one radiogroup pin updated to the translatable
  markup. `sw.js` CACHE = **v67**.

## v68
Declutter round 2 (user request "delete it"): removed the three confusing
extras — the wall elevation preview (blocks/bricks), the Project phase picker
and ALL phase grouping (Project Total is now one flat list in the modal, the
WhatsApp text, and the project PDF), and every Quick-picks chip row
(concrete + blocks + bricks). Steel's rebar section diagram stays. The
calculators no longer write a `tag` key. Quick-picks/preset dict keys become
orphans (harmless). 6 new guard pins keep the removed UI gone.

## v69
Menu declutter (user's pick: Language row + Dark mode): the drawer keeps four
actions (Project settings · Recent calculations · Site Tools · Project Total).
The header language chip now opens a small language popup (same pinned
4-language select); Dark mode moved inside Project settings. Deep audit round
(`tests/deep-audit.mjs`): 4-language static scan, live language-switch probes,
and hand-verified formulas (concrete 1:2:4 dry-volume method, glue 4 kg/m²
25 kg bags, BRC overlap count, earthwork swell/truck loads). Fixed: stepper
+/− buttons and the bottom nav now have translated accessible names, "Clear
this table" title/aria follow the language, the steel diagram is decorative
for screen readers, and an open Quote sheet / Project Total re-render on a
language switch. Guard pins updated (drawer layout, chip popup, settings
theme, quote re-render).

## v70
Two deletions (user decision):
1. **Wall leaves gone** (blocks + bricks). The question "one leaf or two?"
   confused the flow — the wall width the user types already says how thick
   the wall is. Layers through the thickness are now derived automatically
   (wall width ÷ block width + joint), so length × width × height is all you
   enter. The thickness-mismatch error is gone with it. Double-thick walls
   still count correctly (a 40 cm wall of 20 cm blocks = 2 layers).
2. **Site Tools deleted entirely** (land area converter + popup + menu
   button). This reverses v65's "keep as popup" — the new word wins.
Guard pins updated: site tools / leaves must stay gone, handlers must derive
layers from the width. Full chain green incl. tests/deep-audit.mjs (0 findings).

## v71
One export place for the whole app (user decision: "this type of export one
 time on my app").
- The result card's 4-button row (Save / CSV / PDF / Summary), the shopping
  list's Share button, the Summary's Print/WhatsApp/Copy, and Project Total's
  4 toolbar buttons are all GONE from view — replaced by ONE "Share / Export"
  button that opens THE export sheet (bottom-sheet).
- The sheet: choose WHAT (this calculation / shopping list / priced summary /
  project) and HOW (Save / PDF / CSV / Print / WhatsApp / Copy) — each export
  type listed exactly once, with an enable/disable matrix per document.
- The old buttons remain as hidden plumbing the sheet dispatches to, so every
  existing export (PDF builder, CSV, WhatsApp text, print sheet) works unchanged.
- Project Total appears once (bottom nav + status card) — removed from the menu
  drawer (drawer = Project settings + Recent calculations).
- Fixed: bottom-nav "Project Total" label stayed English after a language
  switch (the count badge stole the label's slot — .bn-label now).
Full chain green incl. deep-audit (0 findings); export sheet tested per scope.

## v72
One price place for the whole app (user decision — delete one, keep the best).
- KEPT: the global "Local Material Prices" panel in Project settings (9
  material prices, set once). It already auto-fills every calculator.
- DELETED from view: the per-tool "Costing (Optional)" wizard step in
  concrete / blocks / bricks / steel, plus the stray inline price fields
  (glue bag price, BRC price each, formwork cost). Wizards are now 2 steps.
- The removed fields stay as hidden plumbing (auto-fill + formulas unchanged),
  so every result, cost row and "Cost not entered" behaviour works as before.
- Fixed at the root: wizard labels (Back / Next / Review & calculate / Step)
  fell back to English on phones because they have no [data-lang] carrier —
  t() now reads the live dictionary first.
- Guards: the 4 cost cards carry data-wizard-skip (wizard excludes them, but
  steel's conditionally-revealed step 2 still counts); pins assert the global
  panel exists and the cost UI stays gone. Full chain green incl. deep-audit
  (0 findings).

## v73
Stepper fix (user report: typed numbers hide under the +/− buttons on phones).
- Root cause class removed: the steppers used to float ON the input (absolute,
  with a 100px padding reservation that some compact Tailwind !p-2 fields
  could fight). Layout now places the +/− buttons BESIDE the field (flex row;
  row-reverse in RTL so they stay on the right) — a typed value can never be
  covered at any width, zoom level or language direction. Also covers
  non-.pro-input inputs (quote prices) that never got the old reservation.
- Guard pins assert .num-field stays flex and .num-stepper stays static.
Full chain green incl. deep-audit (0 findings).

## v74
Result cards show ZERO export buttons (user decision — exports live in
Project Total only).
- The 4 grey buttons (Save / CSV / PDF / Summary) were already supposed to be
  hidden plumbing since v71 but leaked through CSS: Tailwind's [hidden] rule
  lost to .btn's display. Fixed with [hidden] { display: none !important }.
- The green Share/Export opener is gone from all five results too. The export
  sheet now opens from Project Total alone (its "what" pills still cover this
  calculation / shopping list / priced summary / project — nothing is lost).
- The Summary VIEW keeps its own opener; results keep the hidden plumbing the
  sheet dispatches to (row auto-hidden when it holds only plumbing).
- Suite note: test:ui needs NODE_OPTIONS=--max-old-space-size=1536 on this
  2 GB host (a 4 GB cap causes swap-death OOM).
Full chain green incl. deep-audit (0 findings).
