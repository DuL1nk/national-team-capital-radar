# Schedule delivery and recovery

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
- `data-watchdog.yml` independently checks the public date AND homepage SHA at
  09:37–23:37 hourly, and on completion of the publisher. If stale and no publisher
  is active, it dispatches the same serial `daily-data.yml` with `recovery=true`.
  At most three watchdog dispatches per Beijing day prevent recursive chains;
  normal scheduled attempts retain their own guard. This is a separate workflow
  on the SAME GitHub platform, not an independent external scheduling service.
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
| `23 1-15 * * *` | Hourly 09:23-23:23 | Keep recovering a stale report beyond the morning; skip a verified current report |

Every scheduled attempt anonymously reads the date/mode and SHA-256 of the public homepage. A matching current report skips Python dependencies, collection, commit and deployment. A stale report, network error, HTTP error, malformed status, or hash mismatch runs the same fail-closed source/calculation pipeline. Manual dispatch intentionally performs real collection. Concurrency serializes all attempts; no second writer or new website is added.

## 2026-11-18 hourly recovery extension

The first real `schedule` run was [44083536552](https://github.com/DuL1nk/national-team-capital-radar/actions/runs/44083536552): its receipt identifies UTC `45 3 * * *` (11:45 Beijing), but the run was only created at 20:28:59 Beijing on 11/17. It safely skipped the already-published 11/17 report. This proves real scheduled delivery and the skip guard, not on-time delivery or an automatic new-day refresh. At 10:17 Beijing on 11/18 no new scheduled run existed and the public report still showed 11/17. To reduce dependency on a single morning delivery window, the same workflow now includes an hourly 09:23-23:23 freshness check. It installs collection dependencies only when the public date/hash cannot prove a current report. This remains GitHub best effort, not an independent scheduler or a guarantee of timing. No data gate, access permission, second publisher, private credential, or site URL is changed.

Each started job records the event, cron expression, UTC runner start and freshness decision in its summary. A schedule that never creates a run has no runner log; these receipt records cannot diagnose GitHub's internal scheduler.

## 2026-11-17 investigation

At 10:12 Beijing the site was still report 11/16 / funds 11/13 / ratio 10/30. The workflow API returned active, repository Actions enabled, default branch main, no archive/fork/inactivity state, correct cron on main, and active DuL1nk as the last cron editor. The schedule-event run API returned zero runs, not a failed collection job. Manual collection had passed on 11/16. Thus the missing run is at the scheduled-delivery layer, not evidence that a data request failed or that a PC had to be on.

GitHub does not expose per-missed-event internal scheduler logs. Its official documentation allows delayed/dropped scheduled events. A status incident affecting workflow start times on 11/16 had already been marked resolved before the missed 11/17 event, so it is not proof of this run's cause. The exact internal cause remains unconfirmed. The mitigation renews the cron registration through a normal owner commit, explicitly ensures the existing workflow is enabled, and adds two idempotent recovery opportunities. It is not a guarantee that GitHub can never miss all scheduled attempts.

Official reference: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

Manually recover using `gh workflow run daily-data.yml -R DuL1nk/national-team-capital-radar --ref main -f publish=true`. Success requires actual latest public collection, calculation gates, deployment, and anonymous verification of the report date and all published HTML hashes. Merely accepting a dispatch or seeing a green build is insufficient.
