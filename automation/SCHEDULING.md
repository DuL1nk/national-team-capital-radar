# Schedule delivery and recovery

The only data publisher remains `.github/workflows/daily-data.yml` on `main`.
All times below are Asia/Shanghai; cron is explicitly UTC:

| Trigger | Beijing time | Purpose |
| --- | --- | --- |
| `15 1 * * *` | 09:15 | Primary collection |
| `47 1,2 * * *` | 09:47, 10:47 | Staggered recovery if a delivery is delayed/dropped or collection failed |
| `45 3 * * *` | 11:45 | Final morning recovery |

Every scheduled attempt anonymously reads the date/mode and SHA-256 of the public homepage. A matching current report skips Python dependencies, collection, commit and deployment. A stale report, network error, HTTP error, malformed status, or hash mismatch runs the same fail-closed source/calculation pipeline. Manual dispatch intentionally performs real collection. Concurrency serializes all attempts; no second writer or new website is added.

Each started job records the event, cron expression, UTC runner start and freshness decision in its summary. A schedule that never creates a run has no runner log; these receipt records cannot diagnose GitHub's internal scheduler.

## 2026-11-17 investigation

At 10:12 Beijing the site was still report 11/16 / funds 11/13 / ratio 10/30. The workflow API returned active, repository Actions enabled, default branch main, no archive/fork/inactivity state, correct cron on main, and active DuL1nk as the last cron editor. The schedule-event run API returned zero runs, not a failed collection job. Manual collection had passed on 11/16. Thus the missing run is at the scheduled-delivery layer, not evidence that a data request failed or that a PC had to be on.

GitHub does not expose per-missed-event internal scheduler logs. Its official documentation allows delayed/dropped scheduled events. A status incident affecting workflow start times on 11/16 had already been marked resolved before the missed 11/17 event, so it is not proof of this run's cause. The exact internal cause remains unconfirmed. The mitigation renews the cron registration through a normal owner commit, explicitly ensures the existing workflow is enabled, and adds two idempotent recovery opportunities. It is not a guarantee that GitHub can never miss all scheduled attempts.

Official reference: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

Manually recover using `gh workflow run daily-data.yml -R DuL1nk/national-team-capital-radar --ref main -f publish=true`. Success requires actual latest public collection, calculation gates, deployment, and anonymous verification of the report date and all published HTML hashes. Merely accepting a dispatch or seeing a green build is insufficient.
