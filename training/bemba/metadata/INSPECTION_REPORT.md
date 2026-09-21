# Liseli Parallel-Bemba Data Inspection Report

**Total Records Inspected:** 35,140

## 1. Column Inventory & Missing Values

| Column | Data Type | Null Count | Empty String Count |
| :--- | :--- | :--- | :--- |
| `english` | String | 0 | 0 |
| `translation` | String | 0 | 0 |
| `language` | String | 0 | 0 |
| `domain` | String | 0 | 0 |
| `source` | String | 0 | 0 |
| `concept_id` | String | 0 | 0 |
| `sentence_id` | String | 0 | 0 |

## 2. Duplicate Analysis

- **Unique (English, Bemba) Pairs:** 34,996
- **Exact Duplicate Rows:** 144 (0.41%)
- **Unique English Sentences:** 34,855
- **Unique Bemba Sentences:** 33,413

## 3. Sentence Length Statistics

| Metric | English (Chars) | Bemba (Chars) | English (Words) | Bemba (Words) |
| :--- | :--- | :--- | :--- | :--- |
| Min | 2 | 2 | 1 | 1 |
| Max | 495 | 610 | 86 | 99 |
| Mean | 113.56 | 103.59 | 21.68 | 15.32 |
| Median | 109.0 | 94.0 | 21.0 | 14.0 |

## 4. Anomalies & Quality Flags

- **Extremely Short Records (<2 words):** 3,936
- **Extremely Long Records (>150 words):** 0
- **Identical English & Bemba (Untranslated):** 0
- **HTML / Markup Artifacts:** 0
- **Extreme Character Length Ratio (>4:1 or <1:4):** 2,281

## 5. Domain Distribution

| Domain | Count | Percentage |
| :--- | :--- | :--- |
| `religion` | 30,837 | 87.75% |
| `education` | 4,303 | 12.25% |

## 6. Source Distribution

| Source | Count | Percentage |
| :--- | :--- | :--- |
| `bible` | 30,837 | 87.75% |
| `ai-dictionary` | 3,884 | 11.05% |
| `storybook` | 416 | 1.18% |
| `community` | 2 | 0.01% |
| `moe` | 1 | 0.00% |

## 7. Quality Findings & Recommendation

- **Preservation Policy:** Do not drop records based solely on heuristic flags.
- **Next Step:** Proceed to Phase 4 for conservative deduplication and whitespace normalization.
- **Domain Caution:** Review the Domain and Source tables above for religious or machine-generated tags before running Phase 5 filtering.
