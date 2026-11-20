# Schedule delivery and recovery

## 2026-11-20 ratio and institution disclosure checks

The report date alone no longer suppresses disclosure checks. Once today's
homepage date and SHA match, a missing or ≥1-hour-old `disclosure_checked_at`
selects `--disclosures-only` in the SAME serial publisher. It rechecks SSE
current/prior/missing monthly denominator releases and CNINFO daily announcement
catalogues, then downloads candidate original PDFs and applies strict identity,
date and unit rules. It does not re-download five years of ETF data. Existing
morning/hourly triggers and the same-platform watchdog are reused; no Cloudflare,
second publishing workflow or model service is introduced. Manual recovery can
request `publish=true, disclosures_only=true`.

The denominator **data date** can legitimately remain 2026-10-30 when the official
November response is empty; the page shows its actual **check time** separately.
No forward fill or index-return proxy is allowed. Institution 2026-11-16 was a
manual baseline, not the latest possible disclosure. The new PDF checks found
2026-11-19 Qianyuan and China Jushi disclosures. Explicit completed trades remain
separate from two-register holding net changes; amounts are not inferred.

CNINFO page counts use received catalogue rows (one announcement may have several
security listings), with separate unique-announcement counts, duplicate-page and
truncation checks. A 2-day overlap, durable document ledger and bounded PDF queue
allow later attempts to resume. Exact original hashes are retained; revisions,
unknown formats, scanned documents, partial coverage and source failures remain
visible. Access/rate denial stops that provider for the attempt. No-match is not
zero trading and the discovery scope is not a complete public-account ledger.
Unknown formats require evidence/rule review, not an automatic invented number.
Anonymous UI acceptance also detected differing all-market pagination membership
between local and hosted runs despite equal reported totals. Therefore known
baseline/watch holdings and newly matched institutions' issuers are queried
individually by security code each attempt, validating every returned secCode.
Verified original documents seed the initial remediation; they are not a
substitute for subsequent dated targeted discovery. All-market discovery is
explicitly non-exhaustive. Allocation/greenshoe/registration titles are included
as candidates, not automatically treated as completed purchases.

Partial retrieval/queue coverage opens or retains the same repository warning
Issue and retries after the bounded interval; supported new facts may publish
with that explicit partial status. A checked-with-pending status means source
discovery finished but specified original documents still need interpretation,
not that all institution holdings are current. Fund and ratio source/revision,
algorithm, display and anonymous-publication gates still apply.

## 2026-11-20 source-readiness and watchdog repair

The 02:23 Beijing delayed schedule attempted report 11/20 but all 137 tracked
SZSE products lacked 11/19 shares. HTTP 200 did not prove a complete workbook.
Compilation correctly stopped and Pages retained report 11/19 / funds 11/18.

- Automatic/recovery deliveries outside 09:00–23:59 Beijing now skip instead of
  allowing a delayed previous-day cron to create the next morning report at 02:00.
- Before the expensive NAV pass, official SZSE target-day coverage is checked.
  Incomplete successful responses are re-fetched after 2, 4 and 8 minutes (four
  fetches total). Lifecycle exits and pre-listing dates are excluded; no missing
  value is filled with zero. Access-denial/rate-limit, unknown events, directory
  changes and historical revisions are not bypassed. Exhaustion fails closed.
  The build timeout is 75 minutes: the real 11/20 successful build took 34m18s,
  so a 50-minute cap left almost no buffer for the bounded 14-minute readiness
  wait and network variation. This changes the safety budget, not data rules.
- `data-watchdog.yml` independently checks the public date AND homepage SHA at
  09:37–23:37 hourly. The publisher also has its own `always()` final health job,
  after both build and deploy finish, avoiding dependence on a separate completion
  webhook delivery (not observed after the real 11/20 run). If stale and no publisher
  is active, it dispatches the same serial `daily-data.yml` with `recovery=true`.
  At most three watchdog dispatches per Beijing day prevent recursive chains;
  normal scheduled attempts retain their own guard. This is a separate workflow
  on the SAME GitHub platform, not an independent external scheduling service.
  Only that final job may ignore its own already-finished publisher stages when
  checking active work; any other live publisher still blocks duplicate dispatch.
- The watchdog maintains one bot-created repository Issue on failure and closes
  it after anonymous current-date/hash verification. GitHub native notification
  settings control delivery; the workflow does not configure email recipients.
- The report has an inline status banner that makes staleness/failure visible,
  using anonymous GitHub API reads with a date-only fallback when unavailable.
- Only job-scoped `GITHUB_TOKEN` is used. No PAT, new account, paid runner or
  second publisher is configured. A cross-platform scheduler still requires an
  explicitly selected external account/provider and narrowly scoped authorization.

Tests cover source-not-ready→ready, bounded exhaustion, no retry after access
denial, midnight/09:00 boundary, active publisher deduplication, dispatch cap,
and existing freshness/hash gates. A successful skipped run is still not proof
of a new report. Real source collection, full validation, deploy and anonymous
verification remain required.

The only data publisher remains `.github/workflows/daily-data.yml` on `main`.
All times below are Asia/Shanghai; cron is explicitly UTC:

| Trigger | Beijing time | Purpose |
| --- | --- | --- |
| `15 1 * * *` | 09:15 | Primary collection |
| `47 1,2 * * *` | 09:47, 10:47 | Staggered recovery if a delivery is delayed/dropped or collection failed |
| `45 3 * * *` | 11:45 | Final morning recovery |
| `23 1-15 * * *` | Hourly 09:23-23:23 | Recover stale funds report; after verified publication, check disclosures when ≥1 hour old |

Every scheduled attempt anonymously reads the date/mode and SHA-256 of the public homepage. A matching current report with recent disclosure checks skips dependencies, collection, commit and deployment. A current report with a due disclosure check selects the lighter mode; stale/unverified publication runs the full source/calculation pipeline. Manual dispatch performs real collection unless explicitly selecting disclosure-only. Concurrency serializes all attempts; no second writer or new website is added. Trigger delivery remains GitHub best effort.

## 2026-11-18 hourly recovery extension

The first real `schedule` run was [44083536552](https://github.com/DuL1nk/national-team-capital-radar/actions/runs/44083536552): its receipt identifies UTC `45 3 * * *` (11:45 Beijing), but the run was only created at 20:28:59 Beijing on 11/17. It safely skipped the already-published 11/17 report. This proves real scheduled delivery and the skip guard, not on-time delivery or an automatic new-day refresh. At 10:17 Beijing on 11/18 no new scheduled run existed and the public report still showed 11/17. To reduce dependency on a single morning delivery window, the same workflow now includes an hourly 09:23-23:23 freshness check. It installs collection dependencies only when the public date/hash cannot prove a current report. This remains GitHub best effort, not an independent scheduler or a guarantee of timing. No data gate, access permission, second publisher, private credential, or site URL is changed.

Each started job records the event, cron expression, UTC runner start and freshness decision in its summary. A schedule that never creates a run has no runner log; these receipt records cannot diagnose GitHub's internal scheduler.

## 2026-11-17 investigation

At 10:12 Beijing the site was still report 11/16 / funds 11/13 / ratio 10/30. The workflow API returned active, repository Actions enabled, default branch main, no archive/fork/inactivity state, correct cron on main, and active DuL1nk as the last cron editor. The schedule-event run API returned zero runs, not a failed collection job. Manual collection had passed on 11/16. Thus the missing run is at the scheduled-delivery layer, not evidence that a data request failed or that a PC had to be on.

GitHub does not expose per-missed-event internal scheduler logs. Its official documentation allows delayed/dropped scheduled events. A status incident affecting workflow start times on 11/16 had already been marked resolved before the missed 11/17 event, so it is not proof of this run's cause. The exact internal cause remains unconfirmed. The mitigation renews the cron registration through a normal owner commit, explicitly ensures the existing workflow is enabled, and adds two idempotent recovery opportunities. It is not a guarantee that GitHub can never miss all scheduled attempts.

Official reference: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

Manually recover using `gh workflow run daily-data.yml -R DuL1nk/national-team-capital-radar --ref main -f publish=true`. Success requires actual latest public collection, calculation gates, deployment, and anonymous verification of the report date and all published HTML hashes. Merely accepting a dispatch or seeing a green build is insufficient.
