# EHR codebase inventory

Audit of `/src` taken 2026-11-20 at commit `44952b5`. No behaviour was changed to produce this
document. It is maintained by hand after each later task — when a screen, field, store or hand-off
changes, the change is reflected here in the same PR.

Where something could not be confirmed in code it says **not found** rather than guessing.

---

## 1. Framework, routing, state and where data is persisted

### Stack

| Concern | What is used |
|---|---|
| UI | React 19 + TypeScript, Tailwind 4 |
| Build | Vite 7 (`vite dev` / `vite build`), `serve.mjs` for the built bundle |
| Routing | TanStack Router, file routes in `src/routes/` (10 routes) |
| State | Zustand 5 — **four independent stores**, see below |
| Persistence | localStorage + IndexedDB (`idb-keyval`) + Supabase (`user_data` table, fire-and-forget) |
| PDF | jsPDF (`utils/claimFormPdf.ts`, `claimPdf` helpers) |
| Auth / enrolment | Supabase (`access_requests` table), phone-number lookup |

### The four state systems — they do not share data

This is the single most important fact about the codebase today. A change made in one store is
invisible to the others unless a component explicitly bridges them.

1. **`store/pipelineStore.tsx` + `store/pipelineEncounter.ts`** — the RCM pipeline. One encounter per
   patient (`scribeNote`, `icdCodes`, `cptCodes`, `codingLines`, `claimForm`, `claimData`, `paData`,
   `stage`, `status`) plus global `deniedClaims`, `arCalls`, `paRecords`.
2. **`store/patientStore.tsx`** — patient chart DB (seed patients + identity/insurance written by
   Registration), `caseStates` (audit log, `modifier25Applied`, `billingStatus`, `paStatus`, routing
   notes, PA follow-ups). **Contains no `localStorage` call at all — in-memory only.**
3. **`store/ehrStore.ts`** (Zustand, persisted to IndexedDB) — user patients, appointments,
   `noteDrafts`, `encounters`, `dental`, `activity` log, working context. The only store Settings
   touches.
4. **Dental and graded cases** — `components/dental/DentalTrackStore.tsx` and
   `components/medical/MedicalCaseStore.tsx`, each with its own key.

### Storage keys and shapes

**`hh_userdata_<phone>`** — localStorage, the per-user blob written by `store/persistence.ts`,
debounced 400 ms, also pushed to Supabase `user_data` (upsert on `phone`).

```ts
{ v: 3, updatedAt: string,
  appointments?: Appointment[],
  caseStates?: Record<string, CaseState>,
  pipeline?: PipelineStoreState,
  currentRole?: Role,
  deniedClaims?: DeniedClaim[],
  arCalls?: ARCallRecord[],
  paRecords?: PARecordStore[],
  security?: AccountSecurityState }
```

Migrations: `v1 → v2` back-fills `pipeline.claimForm` from the legacy `claimData` box map;
`v2 → v3` turns the single encounter into a per-patient `encounters` map.

**IndexedDB `healthcare-hustlers`** via `idb-keyval` — the `ehrStore` envelope:
`{ app, schemaVersion, updatedAt, phone, user }`, debounced 300 ms, with its own `schemaVersion`
migration chain and a localStorage fallback. Exports and imports as JSON from Settings.

**Loose `hh_*` keys** outside both systems:

| Key | Written by | Holds |
|---|---|---|
| `hh_student_name` | login, scoring | display name |
| `hh_dark_mode` | `DarkModeToggle` (no longer rendered, 2026-11-25) | boolean — ignored; the app is light-only |
| `hh_coding_draft_<phone>` | `CodingQueue/codingDraft.ts` | unsubmitted ICD-10/CPT picks + per-line data, keyed by patient id; cleared on submit and by Settings › Reset (Patient chart group) |
| `hh_scores` | `utils/scoring.ts` | per-stage scores |
| `hh_streak`, `hh_challenges` | `GamificationHeader` | gamification state |
| `hh_custom_patients` | `ScenarioInjector` | injected scenario patients |
| `hh_scenario`, `hh_scenario_patient` | `ScenarioInjector` | active scenario |
| `hh_medical_case_<phone>` | `MedicalCaseStore` | graded medical case progress |
| `hh_dental_track_<phone>` | `DentalTrackStore` (v2) | the whole dental case |
| `hh_approved_phones` | login | cached approved numbers |

**Settings exports only `ehrStore`.** The pipeline blob, the dental track and the graded-case files
are neither counted, exported nor reset there — see §3.

---

## 2. Every screen, per role

### 2.0 Assembly

| Piece | Path |
|---|---|
| Main workspace (medical) | `src/routes/index.tsx` (~2,680 lines — the whole scribe/chart UI) |
| Student dashboard | `src/routes/dashboard.tsx` |
| Dental track | `src/routes/dental.tsx` → `components/dental/DentalCaseRunner.tsx` |
| Graded medical cases | `src/routes/medical-cases.tsx` → `components/medical/MedicalCaseRunner.tsx` |
| Settings | `src/routes/settings.tsx` |
| Login / access / admin / instructor / quiz | `routes/login.tsx`, `access.tsx`, `admin.tsx`, `instructor.tsx`, `quiz.tsx` |

### 2.1 Scribe / Provider

**Workspace tabs** (`TabsEpic/WorkspaceTabs.tsx`): Daily Schedule · Patient Chart Review ·
InBasket / Alert Center · Active Progress Note. InBasket badge is hard-coded to 3.

**Chart tabs** (`TabsEpic/TabsEpic.tsx`): Summary, Vitals, Medications, Problems, Labs & Results,
Orders, Imaging, Immunizations, Notes, Referrals. Badges hard-coded (Medications 5, Problems 4,
Orders 2, Notes 3) and unrelated to the data. There is **no Documents tab**.

**Summary tab** (`routes/index.tsx` ~245–700) — editable only when `currentRole === "scribe"`:
PCP, insurance, chief complaint, BP, HR, Temp, SpO2; problem list, medications, allergies,
immunizations, labs, orders, imaging, referrals — each with Add and remove buttons. Live validation
on BP/HR/temp/SpO2 ranges.

**Saved?** No. These write to React state in `Home` and a per-patient `useRef` map
(`patientDataStore`, ~line 1432). On reload the chart reverts to the seed patient; only the note text
survives. The Medications tab and Notes tab are read-only and render the **seed** record, so a
medication added in Summary never appears there.

**Six workflow stages** (left rail, `components/WorkflowAthena/`): registration → intake-vitals →
hpi → exam-ros → assessment-plan → sign-lock.

| Stage | Fields | Saved? |
|---|---|---|
| Registration | first, last, DOB, payer, subscriber ID, group #, payer ID, relationship, secondary payer block; fake licence and card images; a deliberate "Jonathon/Jonathan" trap | **Yes** — `updatePatientIdentity` + `updatePatientInsurance` into `ehrStore`, which is what fills claim boxes 1a/4/6/7/11 |
| Eligibility | "Verify Eligibility (270)" → 271 | **No.** 271 is hard-coded (copay $25, deductible $500 met, 20 % coinsurance) for every patient. Also not rendered in the medical pipeline — only the graded-case runner imports it |
| Intake Vitals / HPI / Exam ROS / Assessment & Plan | OLDCARTS, ROS/PE grids, smart phrases | Memory only, plus the note draft |
| Sign & Lock | Sign & Lock Note, Download SOAP PDF | Checklist hard-coded (one item always true, three always false); PDF prints DOB/MRN/vitals as "N/A" |

**The one durable scribe artefact** is the note draft: `saveNoteDraft(...)` into
`ehrStore.user.noteDrafts` every 5 s, on blur and on page hide; it stops once `submittedToCoding`.

**Daily Schedule** (`TabsEpic/DailySchedule.tsx`): month/week/day views, 12 seed appointments
(fixed 2026-07-02…07). New/Edit modal: patient search (name/MRN/DOB), inline register (first, last,
DOB, sex, phone — **no address, no insurance**), date, time, visit type, duration, provider, status,
notes. Buttons: Start Visit, Edit, Check In, Complete, No-Show, Cancel, Create/Update.
Appointments and self-registered patients persist in `ehrStore` with an auto-MRN.

**InBasket** (`TabsEpic/InBasket.tsx`): six fixed demo alerts, no actions, "Full InBasket coming
soon".

**Worklist** (`WorklistPanel.tsx`): the "Nd idle" labels come from a fixed `IDLE_DAYS` array indexed
by row position — fabricated, not computed.

### 2.2 Coder — `components/CodingQueue/CodingQueue.tsx`

Left pane read-only note; right pane ICD-10 / CPT / Conventions / E-M level.

- ICD-10 search + add; selected list with priority order and up/down arrows; remove.
- CPT search + add (shows RVU); per row: modifiers (free text, comma-split), place of service
  (free text, default `11`), units, charge, ICD linkage.
- E/M level table hard-coded (99202/99203/99204/99212/99213/99214).
- Conventions panel and one quiz question are static.
- Submit → PA interstitial or straight to Billing.

**Saved:** `submitToBilling(icdCodes, cptCodes, claimLines)` → `icdCodes`, `cptCodes`, `codingLines`
(persisted). Score → `utils/scoring.ts`.

**Defect:** on re-entry the codes restore but `cptDataMap` does not — modifiers, POS, units, charge
and ICD links are rebuilt as defaults (POS 11, units 1, charge 0, modifier 25 auto-added to office
E/M). Leaving and returning loses the per-line work even though `codingLines` still holds it.
`submitToBilling` also always writes `stage: "prior-auth"` even when the student skips PA.

### 2.3 Prior Auth — `components/PriorAuthPortal/PriorAuthPortal.tsx` (1,937 lines)

Nine tabs: Queue · Insurance Verif. · e-PA Form · Criteria · Documents · Step Therapy · Letter ·
Followup · Errors. Locked until coding is done.

- **Queue** — alert dashboard over `queueItems`; the quick-action buttons ("Check Status",
  "Appeal", "Upload Documents") have **no handlers**.
- **Insurance Verif.** — **fabricates identifiers on every render**: Member ID prints the MRN or
  `"MRN-1001"`, Group # prints `GRP-<random>` and changes each render. The real insurance record is
  available but not read.
- **e-PA Form** — patient block auto-filled; procedure and payer selects; "Verify Insurance" returns
  one of four canned strings at random after 1.5 s; ICD/CPT prefilled; justification; auth dates;
  ordering provider read-only. An 11-step timeline the student advances by clicking — no payer logic.
- **Criteria / Step Therapy** — checkbox lists in local state, % met.
- **Documents** — required-doc list; each opens the real teaching document (`paDocuments.ts`) in a
  reader with reference ranges and abnormal flags. "Attach" toggles local state only.
- **Letter** — template text and inputs; **no generate or copy button**.
- **Followup** — date, tracking #, rep, notes → `addFollowUp` into **patientStore** (in-memory,
  lost on reload).
- **Errors** — static teaching list.

**Saved:** `addPARecord({status:"submitted"})` + `submitPA(paData)` → encounter `paData`, stage →
`biller`. **Nothing ever moves a PA past `submitted`**: `updatePAStatus` exists but is never called,
and the Biller gate only counts PA records, so an unapproved PA satisfies it.

### 2.4 Biller — `components/BillingLedger/BillingLedger.tsx`

Tabs: CMS-1500 · Scrubber · Denials · References.

- **CMS-1500 (02/12)** — all 33 boxes from `data/claims/cms1500Layout.ts`, every box editable, each
  with a provenance tag (Chart / Coded / Typed / DEMO) and a demo value when nothing was captured.
  Identity boxes re-seeded per patient; the write-diff guard prevents the error-#185 render loop.
  Claim type (professional / institutional / dental) suggested from POS, overridable. Box 24 lines
  come from `claimAutoFill.buildServiceLines`, which prefers `pipeline.codingLines`.
- **Scrubber** — six checks. "Modifier check" only passes with ≤1 CPT; the diagnosis-support check
  passes whenever both lists are non-empty (self-referential).
- **Transmit** — simulated 837P. More than one CPT without `modifier25Applied` → denied CO-16 and
  status `DRAFT`; otherwise "paid", `CLEARED_AND_SENT`, `submitClaim(...)` → stage `ar-voice`.
- **Simulate Denial** → `handleDenial("CO-16 …")` → a `DeniedClaim` the AR ledger reads.
- **Payer** is a local control defaulting to `"Medicare"`; POS local `"11"`; the payment estimate uses
  a hard-coded `PAYER_FACTOR` table and a flat 20 % coinsurance (marked illustrative in comments).

### 2.5 AR Voice — `components/ARVoiceSimulator/ARVoiceSimulator.tsx`

Tabs: Aging Ledger · Claims · Call Scripts · Appeal Letters · Practice Scenarios · Carrier Info.

- **Aging Ledger** — genuinely derived from `deniedClaims` (0-30/31-60/61-90/90+). **Defect:**
  `resolveDenial` relabels but never removes, so "Resolve" changes no total.
- **Claims** — per-bucket list, call-outcome buttons → `addCallRecord` (persisted; `duration` is
  random, and `"no-answer"` is cast into an outcome union that does not contain it); Resolve /
  Escalate / Write Off → `resolveDenial`; "Read Claim" uses speech synthesis.
- **Call Scripts** — static per bucket, TTS.
- **Appeal Letters** — template + inputs + preview; "Copy Letter" to clipboard only, **nothing
  saved**; payer hard-coded.
- **Practice Scenarios** — static scenarios; the practice-notes textarea is discarded.
- **Carrier Info** — hard-coded carrier directory in `arData.ts`.
- `arScore` is never set, so the "AR Voice Score" block can never render.

### 2.6 "Pending"

**No screen, tab or route named "Pending" exists.** It appears only as state:
`WorkflowTracker.tsx` shows a final node labelled "Pending" when status is not
paid/denied/reprocessed. `paid` is only set by `completePipeline`, which nothing calls, and
`reprocessed` is never set — so the tracker stalls on "billed" and the "Pipeline Complete!" screen
is unreachable.

### 2.7 Settings — `src/routes/settings.tsx`

Device storage summary (registered patients, appointments, case files, dental saved), activity log
(last 50 entries), Export all data (JSON), Import (validates `schemaVersion`, migrates), Reset my
practice data with confirmation.

**Gap:** covers `ehrStore` only. The RCM pipeline blob, the dental track and graded-case files are not
counted, exported or reset. "Dental track saved" reads `ehrStore.user.dental` while the dashboard
reads `hh_dental_track_<phone>` — two sources for one fact.

### 2.8 Dental track — `routes/dental.tsx` → `DentalCaseRunner.tsx`

Ten stages: Case · Briefing · Plan · Predetermine · Coding · Claim · Claims · AR · Ledger · Debrief.
State in `hh_dental_track_<phone>` (v2), independent of the medical pipeline.

| Stage | What it does | Saves |
|---|---|---|
| Case | case cards from `DENTAL_CASE_SCENARIOS`, Begin, Reset | `caseId`, `stage` |
| Briefing | read-only patient, coverage, eligibility, paid history, notes | — |
| Plan | phased items (code, tooth, surfaces, quadrant, DOS, fee), accept per item | `txPlan` |
| Predetermine | request + verdict/estimate | `predeterminationScenarioId`, `predeterminationRequestedAt` |
| Coding | CDT search, tooth/surface/quadrant, prior placement, per-line DOS, fee, attachments | `lines` |
| Claim | ADA 2019 box-by-box | `adaForm`, `claimSubmitted` |
| Claims | created/sent/pending/settled stepper, per-line status, 835 render, denial debrief | reads only |
| AR | call log, per-line resolution (appeal/resubmit/bill patient/write-off/close) | `arCallLog`, `lineResolutions` |
| Ledger | post patient/insurance payment, post adjustment | `payments`, `adjustments` |
| Debrief | traps triggered + rubric | `trapsTriggered`, `rubricByCriterion` |

Data lives in `src/data/dental/` (teaching subsets with original wording). **Case count: the code
says seven graded cases; the business plan says nine.** Code is the source of truth here.

---

## 3. Which role's data reaches which

### Working links

| From → To | Mechanism |
|---|---|
| Scribe note → Coder | `handleSignAndLock` compiles the SOAP text → `submitToCoding(fullNote)` → `scribeNote`, stage `coder`; `CodingQueue` renders it |
| Coder → Biller claim | `submitToBilling` → `icdCodes`/`cptCodes`/`codingLines`; `buildClaimForm` reads them into box 21 and box 24 |
| Registration insurance → claim boxes 1a/4/6/7/11 | `updatePatientInsurance` → `insuranceRecord` → `buildClaimForm` |
| PA record → claim box 23 | last matching `paRecords` entry → `priorAuthNumber` |
| Coder modifier-25 flag → Biller denial | `cs?.modifier25Applied` drives the simulated CO-16 |
| Biller denial → AR ledger | `handleDenial` appends a `DeniedClaim`; AR buckets derive from it |
| Dental plan → coding → claim → AR → ledger | one store, one object |

### Broken or one-way

1. **PA never reaches "approved", and nothing needs it to.** `updatePAStatus` is never called; queue
   buttons are dead; the Biller gate counts records, not status.
2. **AR work never flows back.** Resolving a denial relabels it; no payment is posted, `paid` is
   never set, `completePipeline` is never called. The encounter never closes, so the owner's
   "pipeline completion rate" KPI cannot be measured today.
3. **The Coder's per-line data does not survive re-entry** (codes restore, `cptDataMap` does not).
4. **Scribe chart edits do not reach the next stage or a reload** — only the note text persists.
5. **`submittedToCoding` is not persisted**, so after reload the note returns but the encounter reads
   "Draft" while `stage` may still be `coder`.
6. **Stage and role diverge after coding** (`stage: "prior-auth"` even when PA is skipped).
7. **PA follow-ups and the audit log live in an unpersisted context** — lost on reload.
8. **Dental and medical share nothing** by design, but Settings and the dashboard disagree about the
   dental state.
9. **InBasket, the 271 response, PA insurance verification and worklist idle days are demo content
   that looks like data.**

---

## 4. Hard-coded and fabricated values

### On a newly created patient

`ehrStore.registerPatient` writes **no invented clinical values**: DOB blank, age 0, sex blank,
insurance string blank, empty vitals (0s), empty medications/allergies/labs/orders, MRN
`HH-000001`. The `id` is generated (`PAT-…`) and `isSeed` is `false`.

The fabricated values are **downstream**, in `src/data/claims/demoClaimData.ts`, each tagged with
its box and the stage that should have filled it:

| Box | Demo value | Stage named |
|---|---|---|
| 1a | `1EG4-TE5-MK72` | Registration & eligibility (insurance record) |
| 9 | `NONE — NO OTHER COVERAGE ON FILE` | Registration & eligibility (other coverage) |
| 11 | `MCB-4471` | Registration & eligibility (group number) |
| 11b | `RETIREE — MEDFORD CITY SCHOOLS` | Registration & eligibility (employer) |
| 11c | `MEDICARE PART B` | Registration & eligibility (plan name) |
| 15 | `2026-07-08` | Scribe / provider (date of first symptoms) |
| 16 | `2026-07-09` → `2026-07-13` | Scribe / provider (work status) |
| 17 | `CHEN, SARAH, MD` | Registration / front desk (referring provider) |

These are stripped for real patients by `stripFabricatedIds` and re-seeded per patient by
`backfillIdentityBoxes` / `reseedIdentityBoxes`.

### Fabricated data that is not tagged

| Where | What | File |
|---|---|---|
| PA portal, Insurance Verif. | Member ID = MRN or `"MRN-1001"`; Group # = `GRP-<random>`, re-randomised every render | `PriorAuthPortal.tsx` 677–678 |
| PA portal, e-PA form | "Verify Insurance" returns one of four canned strings at random | `PriorAuthPortal.tsx` 861–868 |
| PA portal, queue | three buttons with no handler | `PriorAuthPortal.tsx` 627–639 |
| Eligibility stage | 271: $25 copay, $500 deductible met, 20 % coinsurance, every patient | `EligibilityStage.tsx` 74–77 |
| Sign & Lock | checklist fixed true/false; PDF prints DOB/MRN/vitals "N/A" | `SignLockStage.tsx` 41–48, 105–116 |
| InBasket | six fixed alerts with fixed timestamps | `InBasket.tsx` 14–75 |
| Worklist | idle days from a fixed array by row index | `WorklistPanel.tsx` 18 |
| Chart / workspace tabs | fixed badges 3, 5, 4, 2, 3 | `TabsEpic.tsx` 37–92; `WorkspaceTabs.tsx` 52 |
| Daily Schedule | 12 seed appointments dated 2026-07-02…07 | `DailySchedule.tsx` 46–59 |
| Biller | `PAYER_FACTOR` table and flat 20 % coinsurance (marked illustrative) | `BillingLedger.tsx` 333–355 |
| Biller scrubber | "diagnosis supports procedure" passes whenever both lists are non-empty | `BillingLedger.tsx` 317 |
| AR Voice | random call `duration`; hard-coded carrier directory; appeal letters never saved; dead `arScore` | `ARVoiceSimulator.tsx` 61, 190, 196–207, 920–944 |
| Coder | hard-coded E/M level table | `CodingQueue.tsx` 84–91 |

---

## 5. Not found

- No screen, tab or route named **"Pending"**.
- No **Documents** tab in the chart; the document reader lives in the PA portal.
- No code path that sets a PA to approved/denied, or the pipeline to `paid`/`reprocessed`.
- No persistence for scribe chart edits, `patientStore.caseStates` (audit log, billing/PA/AR status,
  PA follow-ups), AR practice notes or appeal letters.
- No validation that the Biller's chosen payer matches the payer on the claim.
- No link between the free-form medical pipeline, the graded-case runner and the dental track.

---

## 6. Open issues this inventory raises

1. The fabricated Member ID and random Group # in the PA portal contradict the "no fabricated IDs"
   decision and are the strongest wrong-habit risk in the build.
2. Nothing closes the loop after AR — no payment posting, no `paid`, no completion, so pipeline
   completion rate is unmeasurable.
3. A reload loses most scribe work except the note text; to a paying student this reads as data loss.
4. Dental case count: seven in code, nine in the plan.
5. The Coder's per-line data loss on revisit undercuts the per-line POS/modifier capture.

---

## 7. Changes 2026-11-25 (PR #197, student-flow QA)

**New modules**
- `domain/mdm.ts` — AMA 2021 two-of-three MDM rule, data categories, office E/M code. Read by both
  `scribe/MDMWizard.tsx` and the Coding calculator.
- `utils/localDay.ts` — local calendar date (replaces `toISOString().slice(0, 10)` everywhere).
- `utils/actorLabel.ts` — shows "You" instead of the login phone on ledgers, timelines, note author.
- `scribe/dotPhraseQuery.ts` — dot phrases open only for a dot that starts a word.
- `CodingQueue/codingDraft.ts` — per-patient draft of unsubmitted codes.
- `data/medical/payerDirectory.ts` — booking payer list with EDI payer IDs.
- `domain/howToTutorials.ts` — six how-to guides, shown on the landing page and in Help.
- `components/landing/*` — `PublicLandingPage` (moved out of `routes/index.tsx`), `ClaimLifecycle`,
  `TutorialGuides`. Font: `@fontsource-variable/public-sans`.

**Hand-offs changed**
- Booking (`TabsEpic/DailySchedule.tsx`) now captures address and primary coverage
  (`updatePatientInsurance`, `cardIssued: true`); Check In → `arrived` and opens Registration;
  Start Visit → `in-progress`.
- `PatientInsurance.cardIssued` (optional, no migration needed): `false` when the student typed
  coverage at Registration with no card on file → `caseMismatch()` returns null.
- 271 `nameCheck: "mismatch"` → adjudication denies every line CO-31 (`AdjudicationInput.subscriberNameMismatch`)
  unless claim box 4 prints the payer's spelling.
- Allowance: case key → teaching fee schedule (RVU × $33.40 × plan-type factor) → billed.
  Tutorial 835 is now allowed $106.21 / CO-45 $118.79 / PR-1 $50 / PR-2 $11.24 / paid $44.97.
- AR patient-balance actions: `patient_statement`, `patient_payment` (was `write_off` only).
- Coding: Continue to Prior Auth is disabled until "Submit Coded Encounter to Billing".
- ROS writes a plain-language `ROS:` line to the Subjective; Objective holds the exam only.
- Sign & Lock checklist is computed from the note; required items gate signing.
- Financial Ledger panel reads the encounter's claim, 835 and ledger (mock charts removed).
- Dark mode: `@custom-variant dark` requires a `.dark` class that is never set; toggle removed.

**Open (owner decision)**: Tutorial PA shows "approved" for 99214 + 93000 on Medicare Part B;
British "authorisation" spelling across the UI (a grader matches on it).

## 8. Changes 2026-11-25 (login and enrollment redesign)

- `components/auth/AuthShell.tsx` — shared navy frame for `/login` and the `/admin` sign-in.
- `/login`: real `<form>` (Enter submits), "Checking your number…" while the lookup runs, Show/Hide on
  the masked login ID, "Try another number" on the pending and denied screens. `handleLogin` logic
  (server lookup, offline fallback, expiry, device limit) is unchanged.
- `/access`: three numbered steps (pay → send receipt → request) instead of six separate sections;
  payment-method buttons drive the form's "Paid with"; Copy buttons on account numbers; the Submit
  hint says what is still missing. Payment details, amounts and WhatsApp links are unchanged.
  Nothing on the page waits for a scroll-reveal animation any more.
- `/admin` sign-in: labels above fields, `<form>` submit; Supabase Auth call unchanged.

## 9. Interface consistency, part 1 — one header (2026-11-25)

- `shell/AppHeader.tsx` is the only header. Row 1 is identical on every signed-in screen (logo, Home,
  track switch, four links, patient search, save status, log out); the links never wrap. Row 2 is a
  slim toolbar drawn only when a page passes `roleLabel`, `extras` or `onToggleExamMode` (the
  encounter): role, clinic, Summary toggle, Exam. Phones hide row 2 (the summary pane is desktop-only)
  and show the exam timer as an icon in row 1.
- The encounter uses the shared `SummaryPaneToggle` instead of its own button.
- Deleted `TabsEpic/Header.tsx` (unused since the 19 Nov shell).

## 10. Interface consistency, part 2 — colors, buttons, font (2026-11-25)

- Public Sans is loaded once in `main.tsx` and set as the body font in `styles/app.css` (Inter was
  named but never loaded).
- Off-palette Tailwind colors (blue, indigo, sky, cyan, purple, violet — 461 uses in 70 files) map to
  the `brand-*` scale at the same shade. Exception: the SOAP Plan heading keeps purple (S/O/A/P color
  coding). Vitals chart series keep their distinct colors.
- Primary buttons are navy `brand-900` (hover `brand-800`), including `.btn-primary`; selected states
  (tabs, chips, toggles) stay royal `brand-600`.

## 11. Interface consistency, part 3 — readable text (2026-11-25)

- Minimum text size outside the claim paper is 11 px: `text-[8px]`/`text-[9px]` → `text-[11px]`,
  `text-[10px]` → `text-xs` (12 px) — 1,531 uses in 118 files. Exempt (they mimic the printed forms):
  `claims/ClaimPaper.tsx`, `claims/ClaimFormShell.tsx`, `BillingLedger/CMS1500Form.tsx`,
  `BillingLedger/Ub04Form.tsx`, `dental/ADAForm.tsx`, `medical/CaseClaimPaper.tsx`, `dental/Odontogram.tsx`.
- Table scroll wrappers are `relative overflow-x-auto` so absolutely positioned children (sr-only
  labels) stay inside them; `/patients` no longer scrolls sideways at 390 px.

## 12. Interface consistency, part 4 — titles and labels (2026-11-25)

- `shell/PageTitle.tsx` — the one page title block (24 px title, purpose line, optional meta and
  actions). Used by `RailPageFrame` (Claims, Payments, Denials and AR, Reports) and by Dashboard,
  Schedule, Patients, Charts, Reference, Practice Cases, Settings; the patient hub matches its size.
- All-caps tracked labels → sentence case (156 class strings in 49 files plus `.clinical-label`,
  `.clinical-table th`, `.data-table th`, `.section-header`). The claim paper keeps capitals like
  the printed forms; "BREAK GLASS" and "GOOD FAITH ESTIMATE" stay as written.
- Settings no longer prints the student's phone number in its title block.

## 13. Track switch and Practice Cases link (2026-11-25)

- The header's Medical/Dental switch only changes sides (`setActiveTrack`). Track-following pages stay
  put; track-bound pages (`trackBoundPath()` in `shell/AppHeader.tsx`: `/`, `/encounter/*`, `/charts`,
  `/cases/:track/...`, `/practice-ar`, `/dental`, `/medical-cases`) go to `/dashboard`. It no longer
  navigates to `/cases`.
- "Practice cases" is a fifth header link (`/cases`), highlighted on case pages and the practice AR bench
  (`headerNavForPath` returns `"cases"`).


## 14. Live view on the encounter (2026-11-25)

- `src/domain/liveTracker.ts` — pure rules: `liveMilestones()` (Checked in → Eligibility → Note signed → Coded → 837P sent → 277CA → 835 received → Posted → Closed, with done/current/todo/problem) and `liveMoney()` (billed, allowed, paid, adjusted, patient owes — dashes until a remittance is posted). Read-only: derives from appointments, eligibility, `pipelineStore` status events, ledger and AR items; stores nothing new.
- `src/components/live/LiveTracker.tsx` — strip under the encounter stepper: milestone pills with times, a "Next:" hint, money cells that flash when they change, Activity button.
- `src/components/live/LiveEventCard.tsx` — "What just happened" card for each new status event (bottom-left on desktop, top on phones; hides after 9 s; motion off under reduced motion).
- `src/components/live/ActivityDrawer.tsx` — side drawer with the full `StatusTimeline`.
- `src/components/live/EncounterLiveView.tsx` — wires the three into `routes/index.tsx`.
- The left-panel encounter timeline now shows for every role, not only the scribe.

## 15. Switching patients from a booked visit (2026-11-25)

- Bug: after Check In / Start Visit opened a newly booked patient at `/encounter/<id>/…`, clicking the Tutorial Patient (or anyone else) in the Inbox snapped straight back, so the banner, Registration (driver's license, card) and stages kept the booked patient.
- Fix: `routePickDecision()` in `src/domain/encounterRoute.ts` — the address picks its patient once per navigation; a later click in the list wins. Used by `routes/index.tsx`.
- `WorklistPanel` rows are now keyboard-reachable buttons (role, Tab, Enter/Space, `aria-current`).
