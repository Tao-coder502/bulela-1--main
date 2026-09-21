---
language:
- bem
- en
license: cc-by-sa-4.0
size_categories:
- 10K<n<100K
task_categories:
- translation
pretty_name: Liseli Parallel Bemba for Bulela
tags:
- zambia
- bemba
- translation
- education
- bulela
- ba-yama
---

# Dataset Card for Liseli (Parallel-Bemba)

## Dataset Summary
This dataset component provides English ↔ Bemba (CiBemba) parallel sentence pairs extracted from the `GiJoeHansFranz/Liseli` repository on Hugging Face. It serves as an isolated language data pipeline for linguistic adaptation and bilingual competence in the Bulela offline AI math tutor project.

- **Primary Language:** CiBemba (Bantu language, Zambia)
- **Secondary Language:** English
- **License:** Creative Commons Attribution-ShareAlike 4.0 International (CC-BY-SA-4.0)
- **Source Repository:** [GiJoeHansFranz/Liseli](https://huggingface.co/datasets/GiJoeHansFranz/Liseli)
- **Configuration:** `parallel-bemba`
- **Split:** `train`

---

## Intended Use & Scope

### Primary Use Case
- Training bilingual alignment and grammatical understanding of Bemba morphology, syntax, and phrasing.
- Evaluating base models and fine-tuned checkpoints on translation fidelity using held-out benchmarks.

### Out of Scope
- **NOT for Direct Tutoring:** This parallel data contains literal translations, not Socratic math explanations or Ba Yama uncle persona dialogue.
- **NOT for Mathematics RAG:** These general sentences must not be ingested into Bulela's SQLite mathematics textbook database (`bulela.db`).

---

## Dataset Structure

### Columns
| Column | Type | Description |
| :--- | :--- | :--- |
| `english` | `string` | Source sentence in English |
| `translation` | `string` | Parallel translation in CiBemba |
| `language` | `string` | Target language identifier (`Bemba`) |
| `domain` | `string` | Domain category (e.g. general, news, educational) |
| `source` | `string` | Attribution source of the text |
| `concept_id` | `string` | Alignment identifier |
| `sentence_id` | `string` | Unique record sequence identifier |

---

## Pipeline Processing Stages

1. **Raw (`raw/`):** Original unedited Hugging Face download in JSONL and Parquet formats.
2. **Cleaned (`processed/parallel_bemba_cleaned.jsonl`):** Deduplicated, whitespace-normalized, UTF-8 character preserved.
3. **General Domain (`processed/bemba-general/`):** Filtered to exclude religious, ecclesiastical, and JW-dominated texts to keep the language model neutral.
4. **Instruction Format (`processed/language-instruction/`):** Formatted into bidirectional translation tasks (`Translate the following English sentence into Bemba.`).
5. **Evaluation Set (`evaluation/eval_parallel_bemba.jsonl`):** Held-out ~500 record benchmark deterministically split (`seed=42`) with zero training overlap.

---

## Attribution & Citation
If you use this data or derivatives, please cite the original Liseli dataset curators:
```bibtex
@misc{liseli2024,
  author = {GiJoeHansFranz},
  title = {Liseli: A Comprehensive Zambian Languages NLP Corpus},
  year = {2024},
  publisher = {Hugging Face},
  howpublished = {\url{https://huggingface.co/datasets/GiJoeHansFranz/Liseli}}
}
```
License: [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)
