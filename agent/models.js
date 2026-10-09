// Single source of truth for Ollama model selection across the codebase.
//
// Three roles map to three model families:
//   REASONING        → gemma4:e4b   (chat, vision, planning, quiz gen, synthesis)
//   CLASSIFIER       → gemma3:4b    (lightweight topic classification — dynamicTaxonomy)
//   SPECULATIVE_DRAFT → gemma2:2b    (speculative-decoding draft for sub-second TTFT)
//
// Helpers below return the { model, speculative_model } pair callers send to
// the Ollama /api/chat endpoint, so a future model bump touches one file.

const REASONING         = 'gemma4:e4b';
const CLASSIFIER        = 'gemma3:4b';
const SPECULATIVE_DRAFT = 'gemma2:2b';

// Standard reasoning + speculative-decoding pair used by chat, quiz, vision,
// planning, synthesis, and most tools.
function reasoningWithDraft() {
  return { model: REASONING, speculative_model: SPECULATIVE_DRAFT };
}

// Classifier model used by dynamicTaxonomy (no speculative draft needed —
// classifier is small enough that draft overhead would hurt).
function classifier() {
  return { model: CLASSIFIER };
}

module.exports = {
  REASONING,
  CLASSIFIER,
  SPECULATIVE_DRAFT,
  reasoningWithDraft,
  classifier,
};
