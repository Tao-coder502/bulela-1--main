# Liseli Parallel-Bemba Domain & Source Filtering Report

## Executive Summary

To protect Ba Yama's tutoring persona from adopting biblical or religious language patterns as its primary linguistic signal, this filtering phase discovers metadata domains and segregates ecclesiastical material.

- **Original Cleaned Rows:** 34,996
- **Excluded (Religious/JW) Rows:** 30,693 (87.70%)
- **Retained General Rows:** 4,303 (12.3%)

## Discovered Source Breakdown

| Source Label | Record Count | Disposition |
| :--- | :--- | :--- |
| `bible` | 30,693 | ❌ Excluded (Religious) |
| `ai-dictionary` | 3,884 | ✅ Retained (General) |
| `storybook` | 416 | ✅ Retained (General) |
| `community` | 2 | ✅ Retained (General) |
| `moe` | 1 | ✅ Retained (General) |

## Discovered Domain Breakdown

| Domain Label | Record Count | Disposition |
| :--- | :--- | :--- |
| `religion` | 30,693 | ❌ Excluded (Religious) |
| `education` | 4,303 | ✅ Retained (General) |

## Rows Removed by (Source / Domain) Combination

| Source / Domain Combination | Rows Removed |
| :--- | :--- |
| `bible / religion` | 30,693 |

## Notes & Next Steps

- Excluded records are quarantined in `training/bemba/processed/bemba-religious/` for auditability rather than deleted.
- General records are stored in `training/bemba/processed/bemba-general/` ready for Phase 6 instruction formatting.
