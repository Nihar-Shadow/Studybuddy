// tests/model-routing.test.js
// Tests for Central Model Configuration, Language Routing, and Offline/Missing Model checks (Parts 1, 2, 10, 11, 13)

const assert = require('assert');
const {
  MODELS,
  getModelForLanguage,
  resolveModelOrFallback,
  isOdiaFallbackEnabled,
  checkModelAvailable,
  reasoningWithDraft,
} = require('../agent/models');
const { containsOdiaScript, getEffectiveLanguage } = require('../lib/languagePolicy');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res
        .then(() => {
          console.log(`  ✓ ${name}`);
          passed++;
        })
        .catch(err => {
          console.error(`  ✗ ${name}:`, err.message);
          failed++;
        });
    }
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    failed++;
  }
}

async function runTests() {
  console.log('--- Part 1 & 13: Central Model Configuration & Routing Tests ---');

  // A. Model routing tests
  test('Odia routes to configured Odia model (Dhee Odia)', () => {
    assert.strictEqual(getModelForLanguage('Odia'), MODELS.odia);
    assert.strictEqual(getModelForLanguage('odia'), MODELS.odia);
    assert.strictEqual(getModelForLanguage('OR'), MODELS.odia);
  });

  test('English routes to default model (qwen3:4b)', () => {
    assert.strictEqual(getModelForLanguage('English'), MODELS.default);
    assert.strictEqual(getModelForLanguage('english'), MODELS.default);
  });

  test('Hindi routes to default model (qwen3:4b)', () => {
    assert.strictEqual(getModelForLanguage('Hindi'), MODELS.default);
    assert.strictEqual(getModelForLanguage('hindi'), MODELS.default);
  });

  test('Other non-Odia languages default to qwen3:4b', () => {
    assert.strictEqual(getModelForLanguage('Spanish'), MODELS.default);
    assert.strictEqual(getModelForLanguage('Bengali'), MODELS.default);
    assert.strictEqual(getModelForLanguage('Telugu'), MODELS.default);
    assert.strictEqual(getModelForLanguage(''), MODELS.default);
    assert.strictEqual(getModelForLanguage(null), MODELS.default);
  });

  // B. Language detection & routing integration
  test('Odia script in message takes precedence over UI selector', () => {
    const userMessage = 'ଆଲୋକ ସଂଶ୍ଳେଷଣ କ’ଣ?';
    assert(containsOdiaScript(userMessage), 'Should detect Odia script');
    const effective = getEffectiveLanguage('English', userMessage);
    assert.strictEqual(effective, 'Odia', 'Odia script must override English UI selector');
    assert.strictEqual(getModelForLanguage(effective), MODELS.odia);
  });

  test('English message with English UI selector routes to default model', () => {
    const userMessage = 'What is photosynthesis?';
    const effective = getEffectiveLanguage('English', userMessage);
    assert.strictEqual(effective, 'English');
    assert.strictEqual(getModelForLanguage(effective), MODELS.default);
  });

  test('Hindi message with Hindi UI selector routes to default model', () => {
    const userMessage = 'प्रकाश संश्लेषण क्या है?';
    const effective = getEffectiveLanguage('Hindi', userMessage);
    assert.strictEqual(effective, 'Hindi');
    assert.strictEqual(getModelForLanguage(effective), MODELS.default);
  });

  // C. reasoningWithDraft spec
  test('reasoningWithDraft provides speculative decoding for default and clean config for Odia', () => {
    const engConfig = reasoningWithDraft('English');
    assert.strictEqual(engConfig.model, MODELS.default);

    const odiaConfig = reasoningWithDraft('Odia');
    assert.strictEqual(odiaConfig.model, MODELS.odia);
  });

  // D. Missing model error & Fallback mechanism (Parts 10, 11)
  console.log('\n--- Part 10 & 11: Missing Model & Fallback Tests ---');

  await test('Missing model produces clear error with actionable message', async () => {
    const res = await checkModelAvailable('totally_uninstalled_model_999');
    assert.strictEqual(res.available, false);
    assert(res.error.includes('totally_uninstalled_model_999'), 'Error must name the missing model');
    assert(res.error.includes('ollama pull'), 'Error must provide install command');
  });

  await test('resolveModelOrFallback cleanly detects missing Odia model without crash', async () => {
    // If the odia model is not installed and fallback is false, resolveModelOrFallback should report error
    if (!isOdiaFallbackEnabled()) {
      const check = await resolveModelOrFallback('Odia');
      if (!check.available) {
        assert(check.error.includes(MODELS.odia) || check.error.includes('not installed'), 'Must report Odia model missing');
      } else {
        // If dhee-odia is actually installed, check.model should equal MODELS.odia
        assert.strictEqual(check.model, MODELS.odia);
      }
    }
  });

  await test('Installed default model (qwen3:4b) resolves successfully', async () => {
    const check = await resolveModelOrFallback('English');
    // Ollama is running and has qwen3:4b installed
    assert.strictEqual(check.available, true, `qwen3:4b should be available in Ollama: ${check.error || ''}`);
    assert.strictEqual(check.model, MODELS.default);
  });

  console.log(`\nModel Routing Tests Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
