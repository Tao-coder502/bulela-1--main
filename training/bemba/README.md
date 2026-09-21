# Controlled Bemba Language-Data Pipeline

This directory (`training/bemba/`) contains a reproducible, auditable data engineering pipeline for downloading, inspecting, cleaning, filtering, and preparing English ↔ Bemba parallel language data for future **Ba Yama** fine-tuning.

---

## 🛑 Critical System Boundary: Separation from Mathematics RAG

> [!IMPORTANT]
> **Strict Isolation Notice:**
> - `data/` and `bulela.db` remain the **canonical mathematics RAG knowledge base** for Grade 8–9 Zambian curriculum.
> - `training/bemba/` is strictly for **linguistic pre-training and bilingual adaptation**.
> - **DO NOT** inject Liseli language sentences into `bulela.db` or the mathematics RAG retrieval engine.
> - **DO NOT** blindly dump translation pairs into `bulela_fine_tuning_dataset.json` without balanced multi-task weighting.

---

## 🎯 Motivation: Why Bemba is Being Added

The core persona for Bulela is **Ba Yama**—a wise, empathetic Zambian uncle and mathematics mentor for Grade 8 and 9 students. While primary mathematical terminology is taught in English for national examination (ECZ) readiness, Ba Yama relies heavily on **Chi-Zamblish (English mixed with CiBemba/ChiNyanja)** for:
1. **Conceptual Bridging:** Explaining abstract mathematical concepts using familiar everyday analogies.
2. **Affective Support & Encouragement:** Easing math anxiety and responding warmly to student frustration (*"Mwaiche, mwikalafye bwino, tulemone ifyo tulecitamo"*).
3. **Cultural Grounding:** Anchoring the student-tutor relationship in local warmth and respect.

Small language models (e.g., Gemma 7B) often exhibit brittle or calqued Bemba syntax out-of-the-box. This pipeline prepares clean, natural Bemba bilingual pairs to improve linguistic competence prior to pedagogical tuning.

---

## 📦 Dataset Provenance & Licensing

- **Dataset Name:** `GiJoeHansFranz/Liseli`
- **Configuration:** `parallel-bemba`
- **Split:** `train`
- **Source Repository:** [https://huggingface.co/datasets/GiJoeHansFranz/Liseli](https://huggingface.co/datasets/GiJoeHansFranz/Liseli)
- **License:** [Creative Commons Attribution-ShareAlike 4.0 International (CC-BY-SA-4.0)](https://creativecommons.org/licenses/by-sa/4.0/)

---

## 📂 Directory Layout

```text
training/bemba/
├── raw/
│   └── parallel-bemba/          # Raw download from Hugging Face (JSONL & Parquet)
├── processed/
│   ├── parallel_bemba_cleaned.jsonl     # Deduplicated, whitespace-normalized
│   ├── bemba-general/                   # Filtered non-religious domain data
│   ├── bemba-religious/                 # Quarantined ecclesiastical material (for audit)
│   └── language-instruction/            # Bidirectional translation instruction pairs
├── evaluation/
│   ├── eval_parallel_bemba.jsonl        # 500 held-out evaluation pairs (seed=42)
│   ├── train_parallel_bemba.jsonl       # Training subset parallel pairs
│   └── README.md                        # Evaluation benchmark documentation
├── metadata/
│   ├── raw_metadata.json                # Retrieval date, row count, schema, license
│   ├── INSPECTION_REPORT.md             # Detailed dataset profiling & anomaly report
│   ├── inspection_stats.json            # Machine-readable inspection metrics
│   ├── cleaning_stats.json              # Deduplication & normalization counts
│   ├── FILTERING_REPORT.md              # Domain breakdown & religious exclusions
│   ├── filtering_stats.json             # Filtering metrics
│   ├── split_stats.json                 # Train/eval split numbers and zero-leakage check
│   ├── COMPATIBILITY_REPORT.md          # Analysis vs bulela_fine_tuning_dataset.json
│   └── DATASET_CARD.md                  # Standard Hugging Face dataset card
├── scripts/
│   ├── download_parallel_bemba.py       # Phase 2: HF download script
│   ├── inspect_bemba.py                 # Phase 3: Profiling & anomaly detector
│   ├── clean_bemba.py                   # Phase 4: Conservative cleaner
│   ├── filter_bemba.py                  # Phase 5: Religious domain filter
│   └── prepare_bayama_language_data.py  # Phases 6 & 7: Instruction formatter & eval split
├── requirements.txt                     # Python dependencies (datasets, pyarrow, pandas)
└── README.md                            # This documentation file
```

---

## 🚀 Execution & Reproduction Guide

All commands are run from the **Bulela project root** using PowerShell:

### 1. Environment Setup
```powershell
# Create dedicated virtual environment
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install required dependencies
pip install -r training/bemba/requirements.txt
```

### 2. Run Pipeline Steps Sequentially
```powershell
# Phase 2: Download raw dataset and compile metadata
python training/bemba/scripts/download_parallel_bemba.py

# Phase 3: Inspect, profile, and detect anomalies
python training/bemba/scripts/inspect_bemba.py

# Phase 4: Conservative deduplication and normalization
python training/bemba/scripts/clean_bemba.py

# Phase 5: Filter ecclesiastical/JW domains based on discovered labels
python training/bemba/scripts/filter_bemba.py

# Phases 6 & 7: Format instruction pairs and create held-out evaluation benchmark
python training/bemba/scripts/prepare_bayama_language_data.py
```

---

## 🔬 Pipeline Stages Explained

### 1. Conservative Cleaning (`clean_bemba.py`)
- Removes exact duplicate `(english, translation)` pairs.
- Drops null or empty records.
- Normalizes multiple spaces and CRLF line endings.
- **Strict Linguistic Rule:** Preserves all Bemba characters, diacritics, and punctuation. No automated machine-translation or aggressive spell alteration.

### 2. Religious-Domain Filtering (`filter_bemba.py`)
- Discovers actual values of `source` and `domain` from dataset metadata.
- Excludes and quarantines religious, biblical, or Watchtower/JW-derived content.
- Ensures Ba Yama's primary language model learns modern general conversational Bemba rather than archaic liturgical syntax.

### 3. Language Instruction Formatting (`prepare_bayama_language_data.py`)
- Transforms general clean pairs into explicit translation tasks:
  - English → Bemba: `{"task": "translation", "direction": "en-bem", "instruction": "Translate the following English sentence into Bemba.", "input": "...", "output": "..."}`
  - Bemba → English: `{"task": "translation", "direction": "bem-en", "instruction": "Translate the following Bemba sentence into English.", "input": "...", "output": "..."}`
- Labeled specifically as **translation data**, distinct from **math tutoring data**.

### 4. Held-Out Evaluation Benchmark (`evaluation/`)
- A deterministic 500-sample test set split using `seed=42`.
- Zero overlap with any training splits.
- Standard reference benchmark for testing translation fidelity across Base Model vs Bemba-Adapted Model vs Ba Yama Fine-Tuned Model.

---

## 📊 Connecting to Future Ba Yama Fine-Tuning

When preparing the final unified training dataset for Ba Yama, use the multi-task balance recommended in [COMPATIBILITY_REPORT.md](metadata/COMPATIBILITY_REPORT.md):
- **70% Canonical Ba Yama Tutoring:** Math explanation, Socratic pedagogy, emotional resilience.
- **15% Conceptual Bridging Examples:** Zambian math terminology explained in CiBemba.
- **15% Subsampled Liseli Translation Pairs:** Preserving general grammatical fluency.
