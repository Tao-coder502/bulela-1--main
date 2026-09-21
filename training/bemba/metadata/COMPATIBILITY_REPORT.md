# Ba Yama Fine-Tuning & Liseli Bemba Dataset Compatibility Report

## Executive Summary
This report analyzes the structural and semantic compatibility between the existing canonical **Ba Yama tutoring fine-tuning dataset** (`bulela_fine_tuning_dataset.json`) and the **Liseli Bemba parallel language dataset** (`GiJoeHansFranz/Liseli`, config `parallel-bemba`).

---

## 1. Current Ba Yama Dataset Format

- **File Location:** `bulela_fine_tuning_dataset.json`
- **Total Records:** 2,173 tutoring pairs
- **Format:** Alpaca-style JSON array with metadata tags
- **Primary Schema:**
  ```json
  {
    "instruction": "Teach me about Set for Grade 9 Mathematics.",
    "input": "",
    "output": "Iyee, my champion! Set is an essential part of our mathematics curriculum.\n\nA collection of well-defined objects or elements. Think of it like a basket of fruits from Chisokone market.\n\n**Everyday Analogy**: Think of it like this: A collection of well-defined objects or elements. Think of it like a basket of fruits from Chisokone market.\n\nLet us make sure we understand the foundation before jumping into complex equations. What part would you like to try first?",
    "tags": [
      "teaching",
      "concept_explanation",
      "zambian_analogy",
      "grade9"
    ]
  }
  ```
- **Pedagogical Function:**
  - Establishes the "Ba Yama" persona (empathetic elder/uncle, warm greeting e.g., *"Iyee, my champion!"*, *"Mwaiche"*).
  - Implements Socratic questioning rather than giving away full answers immediately.
  - Contextualizes mathematics with local Zambian analogies (Chisokone market, kantemba, nshima).
  - Aligned strictly to the Zambian Grade 8–9 mathematics syllabus.

---

## 2. Liseli Bemba Format

- **Source Dataset:** `GiJoeHansFranz/Liseli` (Hugging Face)
- **Configuration:** `parallel-bemba`
- **Raw Schema:**
  ```json
  {
    "english": "The boy went to school in the morning.",
    "translation": "Umulumendo aile ku sukulu ulucelo.",
    "language": "Bemba",
    "domain": "general",
    "source": "liseli-corpus",
    "concept_id": "...",
    "sentence_id": "..."
  }
  ```
- **Prepared Language-Instruction Schema:**
  ```json
  {
    "source": "Liseli",
    "task": "translation",
    "direction": "en-bem",
    "instruction": "Translate the following English sentence into Bemba.",
    "input": "The boy went to school in the morning.",
    "output": "Umulumendo aile ku sukulu ulucelo."
  }
  ```
- **Linguistic Function:**
  - Trains bilingual alignment and grammatical competence in CiBemba.
  - Exposes the model to correct prefix/suffix morphology, noun classes, and verb tenses.
  - Contains general domain prose, not mathematics or educational dialogue.

---

## 3. Can They Safely Be Combined Directly?

> [!CAUTION]
> **NO. They should NOT be directly merged at this stage.**

### Reasons for Separation:
1. **Persona Dilution / Catastrophic Forgetting:**
   If thousands of pure translation pairs are dumped into `bulela_fine_tuning_dataset.json`, the model will shift from an encouraging, Socratic mathematics mentor into a generic translation engine.
2. **Loss of Pedagogical Voice:**
   Liseli translations do not use Ba Yama's conversational style (*"Iyee, my champion!"*, *"Sure mukwai"*). Training on raw sentences would flatten Ba Yama's personality.
3. **Task Discrepancy:**
   Math questions require reasoning, LaTeX equations, and multi-turn scaffolding. Translation pairs require literal sentence-to-sentence mapping.

---

## 4. Required Transformation for Future Integration

When combining these datasets in a future fine-tuning phase, the following controlled strategy must be used:

### A. Multi-Task Instruction Mixing Ratio
A balanced training mixture should follow a strict ratio:
- **70% Canonical Ba Yama Tutoring** (Math explanation, Socratic hints, error correction, emotion awareness).
- **15% Conceptual Bridging Examples** (Explaining mathematical terms using Bemba vocabulary, e.g. *"Cinshi cifumo ca Set mu Cibemba?"*).
- **15% Subsampled Liseli General Translation Pairs** (To anchor general Bemba fluency without overwhelming the persona).

### B. Schema Harmonization
Liseli instruction records can be adapted to match the Alpaca schema by adding explicit tags:
```json
{
  "instruction": "Translate the following English sentence into Bemba.",
  "input": "The teacher wrote the problem on the board.",
  "output": "Kafundisha alembele ubwafya pa cipampa.",
  "tags": [
    "language_training",
    "translation",
    "bemba",
    "bilingual"
  ]
}
```

---

## 5. What Must Remain Strictly Separate

1. **Mathematics RAG Knowledge Base (`data/` and `bulela.db`):**
   - Liseli general sentences must **never** be injected into `bulela.db`'s FTS5 tables (`textbook_fts`). RAG retrieval must remain 100% focused on textbook curriculum chunks.
2. **Held-Out Evaluation Set (`training/bemba/evaluation/`):**
   - The 500 held-out evaluation pairs must **never** be included in any training set, ensuring an uncontaminated benchmark for measuring translation and fluency improvements.
