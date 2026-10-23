# BOX Dashboard

Public, read-only dashboard for the BOX / Geometry V3 research family.

The public site shows aggregate research evidence and Forward-OOS observation only. Core strategy code, raw candidates, trade-level evidence, calibration data, and execution logic remain in the private `box-strategy-lab` repository.

## Observation chronology

- Historical observation: **2022-01-03 through 2026-03-31**
- Preserved research Forward: **2026-04-01 through 2026-10-09**
- Official prospective signal boundary: **2026-10-19**
- Earliest eligible prospective next-open entry: **2026-10-20**

The research-Forward window is diagnostic. Overlays discovered after inspecting that window are not relabeled as independent OOS.

## Six lanes

- FWD-01 — Geometry V3 RC1.1
- FWD-02 — + Capital Elasticity V1.1
- FWD-03 — + A2 Reclaim V1.1 Risk-Tiered
- FWD-04 — + Sync-High Shadow Governor V2
- FWD-05 — Full Sync-High Shadow + Deep-only A2R
- FWD-06 — 0.25% Sync-High real-risk probe + Deep-only A2R

Daily observation curves are stored under `data/history/FWD-01.json` through `FWD-06.json`. They are saved/replayed daily data, not endpoint interpolation.

## Prospective Forward

`data/robust_forward_live.json` is append-only prospective state. The dashboard stitches verified prospective EOD observations onto the saved observation curves only after official records exist; it does not fabricate missing Forward points.

## Deployment

GitHub Pages deploys automatically from `main`.
