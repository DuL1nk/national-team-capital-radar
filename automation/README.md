# Cloud data pipeline (no model)

Active since 2026-11-16. Run [43803248291](https://github.com/DuL1nk/national-team-capital-radar/actions/runs/43803248291) completed real cloud collection, validation, durable-state commit, Pages deployment, and anonymous date/SHA checks of all historical/research HTML. Scheduled start 09:15 Asia/Shanghai (UTC 01:15), recovery 11:45 (UTC 03:45); a matching already-published daily report is skipped. The former local `09-15` writer is paused. The industry-research task is not changed.

This directory contains a deliberately selected public-data pipeline, not a copy of the desktop workspace. No personal GitHub credentials, model credentials, account data, browser state, or private watchlist are required by the cloud job. `GITHUB_TOKEN` is used only by the commit/deploy steps with job-scoped permissions.

Run `node automation/pipeline.mjs --offline` for audited-baseline calculation checks (never publishes), or `node automation/pipeline.mjs` for actual current public collection. The Actions workflow is `daily-data.yml`; manual runs default to a non-publishing cloud trial.

## Durable history

`state/baseline.json.gz` is a checksummed, versioned curated public-data baseline. It retains individual official share histories, same-day NAV, six price indices, precise corporate action factors and signed rounding, existing HS300 denominator and four-fund history. It is not the deploy artifact; only whitelisted HTML/status/audit files are served by Pages. No transient cache is the only copy of history.

The original calculation/chart/research code is under `vendor/` so metric definitions and UI remain the reviewed implementation. New orchestration parameterizes report date and complete trade cutoff. Every run compares overlapping historical shares/NAV/flows, reconciles fund→direction→pool, recomputes ranks and runs the original public-engine research oracle. Unknown events, metadata changes or candidate products requiring classification stop the run and keep the old public site. Monthly denominator absence is a disclosed lag, not a fetch failure and never forward-filled.

## Scope and boundaries

- Actual official SSE/SZSE directories and share observations; public NAV and unadjusted prices (B-grade aggregates). SZSE Python transport uses the official fund host, with the same official report on the www host only after a connection failure. No alternate transport is used after an access-denial/rate-limit response.
- New/unclassified broad/policy candidates require evidence review instead of a name-only addition. Excluded unrelated new products are recorded. Tracked exits/transformations/renames halt for review. Thus unattended publication is fail-closed, not a guarantee of a new report every day regardless of source quality.
- Institution confirmed quantities remain the explicitly dated human-reviewed snapshot. New CNINFO title metadata is a C-grade candidate list, not an automatically confirmed trade. Queries are not full-text exhaustive. Failures are visible. News/causal commentary and model calls are disabled.
- Full-direction HS300 ratio and fixed-four comparison retain different rank algorithms. Monthly disclosure lag, historical non-PIT and surviving-universe bias remain visible. No trading instructions.
- Data cutoff uses the latest completed index date before the Beijing report day; no intraday/current-day observations enter morning reports. Holiday/weekend runs may recheck the same trade cutoff.
- On publish success the bot commits durable state and date archives, then deploys only static artifacts to the same Pages URL and anonymously checks dates and SHA-256. Collection/validation failure never deploys; a deployment/verification failure is a failed Actions run and must not be described as successful synchronization.
- Existing archives are retained. Deployment is blocked before 900 MiB; archive/storage changes need a separate decision. GitHub scheduled triggers can be delayed/dropped and public-repository schedules may disable after 60 days of inactivity. Regular successful commits provide activity but are not a service-level guarantee.

## Operation

Use the Actions run page for logs, manual reruns and native failure notifications. No new credentials or paid compute configuration is added. The old local 09:15 publisher is paused after successful real end-to-end acceptance, preventing duplicate writers. Future human evidence reviews update the explicit baseline/config/template and must pass the same gates. Unattended execution publishes the website and repository watchlist, not files on a powered-off computer or new messages in the Codex conversation. Those local copies may be synchronized when the computer is running.
