/**
 * Comprehensive Regression & Quality Test Suite for Odia Language Support
 * Run with: node tests/odia.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { buildSystemPrompt } = require('../lib/helpers');
const { setActiveLanguage, langPrefix, toolImplementations } = require('../agent/tools');
const { smartGet, smartSet, normaliseText } = require('../agent/smartCache');
const { runAgentLoop, runParallelAgent } = require('../agent/agentLoop');
const { parseTutorResponse, parseQuizResponse } = require('../lib/parseJSON');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n--- Unit & Structural Regression Tests ---');

// 1. Language selector in index.html
test('index.html contains Odia option in language selector', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert(html.includes('<option value="Odia">ଓଡ଼ିଆ (Odia)</option>'), 'Odia option missing in index.html');
});

// 2. CSS font stacks include Odia fonts
test('variables.css includes Odia fonts in typography stack', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles', 'variables.css'), 'utf8');
  assert(css.includes('Noto Sans Oriya'), 'Noto Sans Oriya missing in variables.css');
  assert(css.includes('Noto Sans Odia'), 'Noto Sans Odia missing in variables.css');
  assert(css.includes('Kalinga'), 'Kalinga missing in variables.css');
});

// 3. Voice.js maps Odia to or-IN and has graceful fallback
test('voice.js contains or-IN mapping and language-not-supported handling', () => {
  const voiceJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'scripts', 'voice.js'), 'utf8');
  assert(voiceJs.includes("'Odia':       'or-IN'") || voiceJs.includes("'Odia': 'or-IN'"), 'Odia to or-IN mapping missing in voice.js');
  assert(voiceJs.includes('language-not-supported'), 'language-not-supported handling missing in voice.js');
});

// 4. buildSystemPrompt generates proper Odia directive
test('buildSystemPrompt generates detailed Odia instructions when Odia is selected', () => {
  const odiaPrompt = buildSystemPrompt('intermediate', 'Odia');
  assert(odiaPrompt.includes('CRITICAL ODIA TUTOR DIRECTIVE'), 'Missing Odia directive in system prompt');
  assert(odiaPrompt.includes('ଓଡ଼ିଆ'), 'Missing Odia script indicator in system prompt');
  assert(odiaPrompt.includes('Odisha'), 'Missing regional context in system prompt');

  // Verify English doesn't inject it
  const englishPrompt = buildSystemPrompt('intermediate', 'English');
  assert(!englishPrompt.includes('CRITICAL ODIA TUTOR DIRECTIVE'), 'English prompt should not contain Odia directive');

  // Verify other languages still work
  const hindiPrompt = buildSystemPrompt('intermediate', 'Hindi');
  assert(hindiPrompt.includes('CRITICAL: The student has requested to learn in Hindi'), 'Hindi prompt directive missing');
});

// 5. agent/tools.js langPrefix
test('agent/tools.js langPrefix injects Odia directive', () => {
  setActiveLanguage('Odia');
  const odiaPrefix = langPrefix();
  assert(odiaPrefix.includes('CRITICAL ODIA TUTOR DIRECTIVE'), 'Odia prefix missing');
  assert(odiaPrefix.includes('ଓଡ଼ିଆ'), 'Odia script missing in prefix');

  setActiveLanguage('English');
  assert.strictEqual(langPrefix(), '', 'English prefix should be empty');

  setActiveLanguage('Spanish');
  assert(langPrefix().includes('Spanish'), 'Spanish prefix missing');
});

// 6. smartCache Unicode and language key isolation
test('smartCache preserves Odia Unicode in normalization and isolates keys by language', () => {
  const odiaText = 'ଫଟୋସିନ୍ଥେସିସ୍ କ’ଣ';
  const norm = normaliseText(odiaText);
  assert(norm.length > 0, 'Odia text was stripped to empty string');
  assert(/[\u0b00-\u0b7f]/.test(norm), 'Odia characters not preserved in normalised text');

  const enValue = { text: 'Photosynthesis is plant food making' };
  const odiaValue = { text: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ହେଉଛି ଉଦ୍ଭିଦ ଖାଦ୍ୟ ପ୍ରକ୍ରିୟା' };

  smartSet('explain', 'photosynthesis', 'intermediate', enValue, 'English');
  smartSet('explain', 'photosynthesis', 'intermediate', odiaValue, 'Odia');

  const cachedEn = smartGet('explain', 'photosynthesis', 'intermediate', 'English');
  const cachedOdia = smartGet('explain', 'photosynthesis', 'intermediate', 'Odia');

  assert.deepStrictEqual(cachedEn.value, enValue, 'English cache returned wrong value');
  assert.deepStrictEqual(cachedOdia.value, odiaValue, 'Odia cache returned wrong value');
});

// 7. Language policy directives consistency
test('languagePolicy provides specialized Odia rules for quiz, concept map, and synthesis', () => {
  const { getLanguageDirective } = require('../lib/languagePolicy');
  const quizDir = getLanguageDirective('Odia', 'quiz');
  assert(quizDir.includes('QUIZ LOCALIZATION RULES'), 'Missing quiz localization rules');
  assert(quizDir.includes('ଓଡ଼ିଆ'), 'Missing Odia script in quiz directive');

  const mapDir = getLanguageDirective('Odia', 'concept_map');
  assert(mapDir.includes('CONCEPT MAP LOCALIZATION RULES'), 'Missing concept map rules');

  const synthDir = getLanguageDirective('Odia', 'agent_synthesis');
  assert(synthDir.includes('agentSummary'), 'Missing agentSummary directive in synthesis');
});

// 8. Odia validation layer tests (Phase 6)
test('validateOdiaContent and validateOdiaQuiz correctly reject non-Odia or malformed output', () => {
  const { validateOdiaContent, validateOdiaQuiz } = require('../lib/languagePolicy');
  
  // Valid Odia
  assert(validateOdiaContent('ଆଲୋକ ସଂଶ୍ଳେଷଣ (Photosynthesis) ଏକ ପ୍ରକ୍ରିୟା ଅଟେ।').valid, 'Valid Odia text failed validation');

  // English text (rejected)
  assert(!validateOdiaContent('This is entirely in English and should fail.').valid, 'English text unexpectedly passed Odia check');

  // Excessive English ratio (rejected)
  assert(!validateOdiaContent('ଅ photosynthesis is good and leaves are green today in the sun.').valid, 'Excessive English text unexpectedly passed');

  // Repetitive loop (rejected)
  const loopText = 'ଏହା ଏକ ପଦକ୍ଷେପ ଅଟେ। ଏହା ଏକ ପଦକ୍ଷେପ ଅଟେ। ଏହା ଏକ ପଦକ୍ଷେପ ଅଟେ। ଏହା ଏକ ପଦକ୍ଷେପ ଅଟେ।';
  assert(!validateOdiaContent(loopText).valid, 'Repetitive loop unexpectedly passed');

  // Quiz validation
  const validQuiz = [
    { question: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ କ’ଣ?', explanation: 'ଉଦ୍ଭିଦ ଖାଦ୍ୟ ତିଆରି କରେ।' },
    { question: 'ଜଳର ଭୂମିକା କ’ଣ?', explanation: 'ଜଳ ଆବଶ୍ୟକ।' }
  ];
  assert(validateOdiaQuiz(validQuiz).valid, 'Valid Odia quiz failed');

  const invalidQuiz = [
    { question: 'What is photosynthesis?', explanation: 'Plants make food.' },
    { question: 'What is water?', explanation: 'H2O.' }
  ];
  assert(!validateOdiaQuiz(invalidQuiz).valid, 'English quiz unexpectedly passed Odia quiz check');
});

// 9. Model configuration & missing model error check
test('checkModelAvailable reports clear error on non-installed model without silent fallback', async () => {
  const { checkModelAvailable } = require('../agent/models');
  const res = await checkModelAvailable('non_existent_model_xyz_123');
  assert.strictEqual(res.available, false, 'Non-existent model should not be reported available');
  assert(res.error.includes('ollama pull'), 'Error message must include installation instructions');
  assert(res.error.includes('OLLAMA_MODEL'), 'Error message must include configuration instructions');
});

console.log(`\nStructural tests completed: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
}

