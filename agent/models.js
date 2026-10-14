// Single source of truth for Ollama model selection across the codebase.
//
// Dual-model local architecture:
// 1. default (qwen3:4b): English, Hindi, and all non-Odia languages
// 2. odia (dhee-odia / Dhee-NxtGen-Qwen3-Odia-v2 2B): Odia only
//
// All LLM generations route through getModelForLanguage().
// Offline support: local Ollama endpoint only, zero cloud dependencies.

const { isOdia, containsOdiaScript } = require('../lib/languagePolicy');

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_FALLBACK_MODEL = 'qwen3:4b';

const DEFAULT_MODEL = process.env.OLLAMA_DEFAULT_MODEL || process.env.OLLAMA_MODEL || DEFAULT_FALLBACK_MODEL;
const ODIA_MODEL = process.env.OLLAMA_ODIA_MODEL || 'dhee-odia';
const ODIA_FALLBACK = process.env.OLLAMA_ODIA_FALLBACK === 'true';

const MODELS = {
  default: DEFAULT_MODEL,
  odia: ODIA_MODEL,
};

const REASONING = MODELS.default;
const CLASSIFIER = process.env.OLLAMA_CLASSIFIER_MODEL || process.env.OLLAMA_MODEL || REASONING;
const SPECULATIVE_DRAFT = process.env.OLLAMA_DRAFT_MODEL || process.env.OLLAMA_MODEL || REASONING;

/**
 * Central model resolver based on effective language.
 * Odia -> Odia model (Dhee Odia)
 * English/Hindi/other -> Default model (qwen3:4b)
 */
function getModelForLanguage(language) {
  if (
    language &&
    (language === 'Odia' ||
      (typeof language === 'string' && language.toLowerCase() === 'odia') ||
      isOdia(language) ||
      containsOdiaScript(language))
  ) {
    return MODELS.odia;
  }
  return MODELS.default;
}

function isOdiaFallbackEnabled() {
  return ODIA_FALLBACK;
}

// Standard reasoning + speculative-decoding pair used by chat, quiz, vision, planning, synthesis
function reasoningWithDraft(languageOrModel) {
  const think = process.env.OLLAMA_THINK === 'true';
  let model = MODELS.default;
  if (languageOrModel) {
    if (languageOrModel === MODELS.default || languageOrModel === MODELS.odia) {
      model = languageOrModel;
    } else {
      model = getModelForLanguage(languageOrModel);
    }
  }

  // Odia model runs without speculative draft unless explicitly provided
  if (model === MODELS.odia) {
    const odiaDraft = process.env.OLLAMA_ODIA_DRAFT_MODEL;
    if (odiaDraft) {
      return { model, speculative_model: odiaDraft, think };
    }
    return { model, think };
  }

  return { model, speculative_model: SPECULATIVE_DRAFT, think };
}

// Classifier model used by dynamicTaxonomy
function classifier() {
  return { model: CLASSIFIER };
}

/**
 * Checks if the configured model is installed and available in Ollama.
 * If missing, returns details and instructions without silent fallback.
 */
async function checkModelAvailable(modelName = MODELS.default, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        return {
          available: false,
          model: modelName,
          installed: [],
          error: `Ollama returned status ${res.status}. Is Ollama running? Run: ollama serve`,
        };
      }

      const data = await res.json();
      const installedList = (data.models || []).map(m => m.name);

      // Check exact name or tag match (e.g., 'qwen3:4b', 'dhee-odia', 'dhee-odia:latest')
      const isInstalled = installedList.some(name =>
        name === modelName ||
        name.startsWith(`${modelName}:`) ||
        (modelName.includes(':') && name === modelName)
      );

      if (!isInstalled) {
        return {
          available: false,
          model: modelName,
          installed: installedList,
          error: `Configured model "${modelName}" is not installed in Ollama.\nInstalled models: ${installedList.join(', ') || 'none'}\n\nTo install "${modelName}", run:\n  ollama pull ${modelName}\n\nOr configure an installed model in environment:\n  OLLAMA_MODEL="${modelName}"\n  OLLAMA_DEFAULT_MODEL="qwen3:4b"\n  OLLAMA_ODIA_MODEL="${modelName}"\n`,
        };
      }

      return { available: true, model: modelName, installed: installedList };
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return {
        available: false,
        model: modelName,
        installed: [],
        error: `Could not connect to Ollama at ${OLLAMA_URL}: ${err.message}. Run: ollama serve`,
      };
    }
  }
}

/**
 * Validates availability for the target language's model.
 * If the Odia model is missing or fails:
 * - If OLLAMA_ODIA_FALLBACK is true, falls back to MODELS.default
 * - If false, returns a clear error without silent fallback
 */
async function resolveModelOrFallback(effectiveLanguage) {
  const targetModel = getModelForLanguage(effectiveLanguage);

  // If online provider is configured, online is available as primary provider
  const onlineConfigured = process.env.ONLINE_LLM_ENABLED === 'true' && Boolean(process.env.ONLINE_LLM_API_KEY && (process.env.ONLINE_LLM_MODEL || true));
  if (onlineConfigured) {
    return {
      available: true,
      model: targetModel,
      provider: 'online',
      fellBack: false,
      originalModel: targetModel,
      error: null
    };
  }

  if (targetModel === MODELS.odia) {
    const check = await checkModelAvailable(targetModel);
    if (!check.available) {
      if (ODIA_FALLBACK) {
        console.warn(`[LLM] Odia model "${targetModel}" not installed. Falling back to default "${MODELS.default}" (OLLAMA_ODIA_FALLBACK=true).`);
        return {
          available: true,
          model: MODELS.default,
          fellBack: true,
          originalModel: targetModel,
          error: null,
        };
      }
      return {
        available: false,
        model: targetModel,
        fellBack: false,
        originalModel: targetModel,
        error: `Configured Odia model "${targetModel}" is not installed in Ollama.`,
        errorDetail: check.error,
      };
    }
  }
  return {
    available: true,
    model: targetModel,
    fellBack: false,
    originalModel: targetModel,
    error: null,
  };
}

/**
 * Model-specific options generator.
 * Keeps existing qwen3:4b configuration unchanged while providing conservative
 * options confirmed to work with dhee-odia.
 */
function getModelOptions(modelOrLang, task = 'quiz', overrides = {}) {
  const model = (modelOrLang === MODELS.odia || modelOrLang === MODELS.default)
    ? modelOrLang
    : getModelForLanguage(modelOrLang);

  if (model === MODELS.odia) {
    // Conservative Ollama configuration confirmed to work with dhee-odia
    return {
      temperature: 0.2,
      top_p: 0.9,
      repeat_penalty: 1.1,
      num_ctx: 4096,
      ...overrides
    };
  }

  // qwen3:4b existing configuration
  return {
    temperature: 0.2,
    top_p: 0.9,
    repeat_penalty: 1.15,
    num_ctx: 4096,
    ...overrides
  };
}

module.exports = {
  MODELS,
  getModelForLanguage,
  isOdiaFallbackEnabled,
  resolveModelOrFallback,
  getModelOptions,
  REASONING,
  CLASSIFIER,
  SPECULATIVE_DRAFT,
  DEFAULT_FALLBACK_MODEL,
  OLLAMA_URL,
  reasoningWithDraft,
  classifier,
  checkModelAvailable,
};
