# Bemba Language Evaluation Set

## Overview
This held-out evaluation set contains **500 sentence pairs** deterministically sampled from the `GiJoeHansFranz/Liseli` (`parallel-bemba`) general domain partition using `seed=42`.

### Zero Leakage Guarantee
- Strictly zero overlap with the training instruction set (`train_parallel_bemba.jsonl` and `bemba_language_instructions.jsonl`).
- Character-preserved and aligned English ↔ Bemba reference pairs.

## Evaluation Protocol

This benchmark evaluates language fluency and translation accuracy across three model checkpoints:

| Model Stage | Checkpoint Description | Evaluation Objective |
| :--- | :--- | :--- |
| **1. Base Model** | Base Gemma 7B Instruct | Baseline multilingual zero-shot Bemba translation ability. |
| **2. Bemba-Adapted Model** | Gemma 7B + Liseli Language Tuning | Improvement in Bemba vocabulary, syntax, and phrasing. |
| **3. Ba Yama Fine-Tuned Model** | Full Bulela Model (Math + Uncle Persona) | Verifies that math tutoring fine-tuning retains Bemba linguistic competence without catastrophic forgetting. |

## Metrics

1. **BLEU Score (SacreBLEU):** Measures n-gram precision against ground-truth Bemba reference translations.
2. **chrF++ Score:** Character n-gram F-score, particularly effective for agglutinative Bantu languages like Bemba with rich prefix and suffix morphology.
3. **Qualitative Audit:** Spot-check translations for natural Zambian phrasing vs wooden/calqued syntax.
