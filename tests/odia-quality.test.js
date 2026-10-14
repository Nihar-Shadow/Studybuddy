/**
 * Comprehensive Multi-Dimensional Odia Quality Benchmark
 * Tests 5 scenarios against the configured Ollama model:
 * 1. Photosynthesis explanation in Odia
 * 2. Water cycle explanation in Odia
 * 3. Newton's first law explanation in Odia
 * 4. Three-question multiple choice quiz in Odia
 * 5. Agent Mode tool execution & synthesis in Odia
 *
 * Evaluates:
 * - Structural Correctness (JSON schema validity)
 * - Language Compliance (Odia script, excessive English check, no repetition loops)
 * - Scientific Correctness (domain terminology presence)
 * - Human Review Guidance (clarity, natural grammar)
 *
 * Run with: node tests/odia-quality.test.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { buildSystemPrompt, ollamaOptions } = require('../lib/helpers');
const { toolImplementations, setActiveLanguage } = require('../agent/tools');
const { runParallelAgent } = require('../agent/agentLoop');
const { parseTutorResponse, parseQuizResponse } = require('../lib/parseJSON');
const { REASONING, reasoningWithDraft, checkModelAvailable } = require('../agent/models');
const { validateOdiaContent, validateOdiaQuiz, containsOdiaScript } = require('../lib/languagePolicy');

async function callChatModel(message, level = 'beginner') {
  const messages = [
    { role: 'system', content: buildSystemPrompt(level, 'Odia') },
    { role: 'user', content: message }
  ];

  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...reasoningWithDraft(),
      messages,
      stream: false,
      options: { ...ollamaOptions('json'), num_ctx: 4096 }
    })
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  const rawText = (data.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const structured = parseTutorResponse(rawText);
  return { rawText, structured };
}

function evaluateScenario(name, rawText, structured, domainKeywords = []) {
  const textBlob = `${structured.intro || ''} ${structured.steps?.map(s => `${s.title} ${s.text}`).join(' ') || ''} ${structured.answer || ''} ${structured.followup || ''}`;
  
  // 1. Structural Check
  const hasStructure = !!(structured.intro || structured.answer);
  const structuralScore = hasStructure ? 'PASSED' : 'FAILED';

  // 2. Language Compliance
  const odiaScript = containsOdiaScript(textBlob);
  const val = validateOdiaContent(textBlob, { minOdiaRatio: 0.25 });
  const languageScore = odiaScript && val.valid ? 'PASSED' : 'FAILED';
  const languageNotes = !odiaScript ? 'No Odia script found' : (!val.valid ? `Validation issue: ${val.reason}` : 'Compliant Odia script');

  // 3. Scientific Terminology Match
  const lowerBlob = textBlob.toLowerCase();
  const matchedKeywords = domainKeywords.filter(k => lowerBlob.includes(k.toLowerCase()));
  const scientificScore = matchedKeywords.length > 0 ? 'PASSED' : 'NEEDS_REVIEW';

  // 4. Human Review Guidance
  const humanReviewNotes = 'Automated checks confirm structure & script. Native speaker review recommended for Odia grammatical naturalness and nuances.';

  return {
    scenario: name,
    rawText,
    structured,
    evaluation: {
      structuralCorrectness: { score: structuralScore, valid: hasStructure },
      languageCompliance: { score: languageScore, odiaScript, details: languageNotes },
      scientificAccuracy: { score: scientificScore, matchedKeywords, expected: domainKeywords },
      humanReview: { status: 'PENDING_HUMAN_INSPECTION', notes: humanReviewNotes }
    },
    overallPassed: structuralScore === 'PASSED' && languageScore === 'PASSED'
  };
}

async function main() {
  console.log('=================================================================');
  console.log('       StudyBuddy Odia (ଓଡ଼ିଆ) Quality Benchmark       ');
  console.log('=================================================================\n');

  // Step 0: Check model installation
  console.log(`Checking configured model: "${REASONING}"...`);
  const modelCheck = await checkModelAvailable(REASONING);
  if (!modelCheck.available) {
    console.error(`\n❌ BENCHMARK BLOCKED: Configured model is unavailable.\n${modelCheck.error}`);
    const blockedReport = {
      model: REASONING,
      status: 'BLOCKED',
      reason: modelCheck.error,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(path.join(__dirname, 'odia_quality_results.json'), JSON.stringify(blockedReport, null, 2));
    process.exit(1);
  }
  console.log(`✓ Model "${REASONING}" is online and ready.\n`);

  const results = [];

  // 1. Photosynthesis
  console.log('Scenario 1: Photosynthesis ("ଫଟୋସିନ୍ଥେସିସ୍ କ’ଣ? ସହଜ ଭାଷାରେ ବୁଝାଅ।")');
  try {
    const q1 = await callChatModel('ଫଟୋସିନ୍ଥେସିସ୍ କ’ଣ? ସହଜ ଭାଷାରେ ବୁଝାଅ।', 'beginner');
    const eval1 = evaluateScenario(
      'Photosynthesis',
      q1.rawText,
      q1.structured,
      ['ଆଲୋକ', 'ପତ୍ର', 'photosynthesis', 'chlorophyll', 'ଶକ୍ତି', 'ଖାଦ୍ୟ']
    );
    console.log(`   - Structural: ${eval1.evaluation.structuralCorrectness.score}`);
    console.log(`   - Language:   ${eval1.evaluation.languageCompliance.score} (${eval1.evaluation.languageCompliance.details})`);
    console.log(`   - Scientific: ${eval1.evaluation.scientificAccuracy.score} (Matched: ${eval1.evaluation.scientificAccuracy.matchedKeywords.join(', ') || 'none'})`);
    console.log(`   - Sample Answer: ${q1.structured.answer || q1.structured.intro}`);
    results.push(eval1);
  } catch (err) {
    console.error('   ✗ Error:', err.message);
    results.push({ scenario: 'Photosynthesis', overallPassed: false, error: err.message });
  }

  // 2. Water Cycle
  console.log('\nScenario 2: Water Cycle ("ଜଳ ଚକ୍ର କିପରି କାମ କରେ?")');
  try {
    const q2 = await callChatModel('ଜଳ ଚକ୍ର କିପରି କାମ କରେ?', 'intermediate');
    const eval2 = evaluateScenario(
      'Water Cycle',
      q2.rawText,
      q2.structured,
      ['ଜଳ', 'ବାଷ୍ପ', 'ବର୍ଷା', 'water', 'cycle', 'ବାଷ୍ପୀଭବନ']
    );
    console.log(`   - Structural: ${eval2.evaluation.structuralCorrectness.score}`);
    console.log(`   - Language:   ${eval2.evaluation.languageCompliance.score} (${eval2.evaluation.languageCompliance.details})`);
    console.log(`   - Scientific: ${eval2.evaluation.scientificAccuracy.score} (Matched: ${eval2.evaluation.scientificAccuracy.matchedKeywords.join(', ') || 'none'})`);
    console.log(`   - Sample Answer: ${q2.structured.answer || q2.structured.intro}`);
    results.push(eval2);
  } catch (err) {
    console.error('   ✗ Error:', err.message);
    results.push({ scenario: 'Water Cycle', overallPassed: false, error: err.message });
  }

  // 3. Newton's First Law
  console.log('\nScenario 3: Newton\'s First Law ("ନ୍ୟୁଟନଙ୍କ ଗତିର ପ୍ରଥମ ନିୟମ ବୁଝାଅ।")');
  try {
    const q3 = await callChatModel('ନ୍ୟୁଟନଙ୍କ ଗତିର ପ୍ରଥମ ନିୟମ ବୁଝାଅ।', 'intermediate');
    const eval3 = evaluateScenario(
      'Newton First Law',
      q3.rawText,
      q3.structured,
      ['ନ୍ୟୁଟନ', 'ନିୟମ', 'ଗତି', 'ବଳ', 'newton', 'inertia', 'force']
    );
    console.log(`   - Structural: ${eval3.evaluation.structuralCorrectness.score}`);
    console.log(`   - Language:   ${eval3.evaluation.languageCompliance.score} (${eval3.evaluation.languageCompliance.details})`);
    console.log(`   - Scientific: ${eval3.evaluation.scientificAccuracy.score} (Matched: ${eval3.evaluation.scientificAccuracy.matchedKeywords.join(', ') || 'none'})`);
    console.log(`   - Sample Answer: ${q3.structured.answer || q3.structured.intro}`);
    results.push(eval3);
  } catch (err) {
    console.error('   ✗ Error:', err.message);
    results.push({ scenario: 'Newton First Law', overallPassed: false, error: err.message });
  }

  // 4. Odia Quiz
  console.log('\nScenario 4: 3-Question Odia Multiple Choice Quiz (Photosynthesis)');
  try {
    setActiveLanguage('Odia');
    const quizRes = await toolImplementations.generate_quiz({
      topic: 'Photosynthesis (ଆଲୋକ ସଂଶ୍ଳେଷଣ)',
      level: 'intermediate',
      numQuestions: 3,
      language: 'Odia'
    });
    const questions = quizRes.questions || [];
    const structPassed = quizRes.success && questions.length >= 2;
    const langVal = validateOdiaQuiz(questions);
    const langScore = langVal.valid ? 'PASSED' : 'FAILED';

    console.log(`   - Questions generated: ${questions.length}`);
    console.log(`   - Structural: ${structPassed ? 'PASSED' : 'FAILED'}`);
    console.log(`   - Language:   ${langScore} (${langVal.reason || 'Odia script verified in questions'})`);
    if (questions[0]) {
      console.log(`   - Sample Q1: ${questions[0].question}`);
      console.log(`   - Sample A1: ${questions[0].answer}`);
      console.log(`   - Sample Exp: ${questions[0].explanation}`);
    }

    results.push({
      scenario: 'Odia Quiz',
      structured: questions,
      evaluation: {
        structuralCorrectness: { score: structPassed ? 'PASSED' : 'FAILED', questionsCount: questions.length },
        languageCompliance: { score: langScore, details: langVal },
        humanReview: { status: 'PENDING_HUMAN_INSPECTION' }
      },
      overallPassed: structPassed && langVal.valid
    });
  } catch (err) {
    console.error('   ✗ Error:', err.message);
    results.push({ scenario: 'Odia Quiz', overallPassed: false, error: err.message });
  }

  // 5. Agent Mode
  console.log('\nScenario 5: Agent Mode with Odia Science Question ("ଜଳ ଚକ୍ର")');
  try {
    setActiveLanguage('Odia');
    const agentRes = await runParallelAgent('ଜଳ ଚକ୍ର ବିଷୟରେ ବୁଝାଅ', 'intermediate', [], 'Odia', 'student-test', 'Test Student');
    const s = agentRes.structured;
    const structPassed = agentRes.success && !!s?.explanation;
    const summaryVal = validateOdiaContent(s?.agentSummary || '');
    const noteVal = validateOdiaContent(s?.progressNote || '');
    const langPassed = summaryVal.valid || containsOdiaScript(s?.agentSummary);

    console.log(`   - Agent success:  ${agentRes.success}`);
    console.log(`   - Tools executed: ${s?.toolsUsed?.join(', ')}`);
    console.log(`   - Agent Summary:  ${s?.agentSummary}`);
    console.log(`   - Progress Note:  ${s?.progressNote}`);
    console.log(`   - Structural:     ${structPassed ? 'PASSED' : 'FAILED'}`);
    console.log(`   - Language:       ${langPassed ? 'PASSED' : 'FAILED'}`);

    results.push({
      scenario: 'Agent Mode',
      structured: s,
      evaluation: {
        structuralCorrectness: { score: structPassed ? 'PASSED' : 'FAILED', toolsUsed: s?.toolsUsed },
        languageCompliance: { score: langPassed ? 'PASSED' : 'FAILED', summaryVal, noteVal },
        humanReview: { status: 'PENDING_HUMAN_INSPECTION' }
      },
      overallPassed: structPassed && langPassed
    });
  } catch (err) {
    console.error('   ✗ Error:', err.message);
    results.push({ scenario: 'Agent Mode', overallPassed: false, error: err.message });
  }

  console.log('\n=================================================================');
  console.log('                     Benchmark Summary                           ');
  console.log('=================================================================');
  let passedCount = 0;
  for (const r of results) {
    const mark = r.overallPassed ? '✅ PASSED' : '❌ FAILED';
    console.log(`- ${r.scenario.padEnd(20)}: ${mark}`);
    if (r.overallPassed) passedCount++;
  }
  console.log(`\nScore: ${passedCount} / ${results.length} scenarios passed.`);
  console.log('NOTE: Automated passes check structure and language compliance.');
  console.log('Human review is required for authentic Odia grammar fluency.');
  console.log('=================================================================\n');

  const finalOutput = {
    model: REASONING,
    timestamp: new Date().toISOString(),
    passedCount,
    totalCount: results.length,
    results
  };

  fs.writeFileSync(path.join(__dirname, 'odia_quality_results.json'), JSON.stringify(finalOutput, null, 2));
}

main().catch(err => {
  console.error('Benchmark execution fatal error:', err);
  process.exit(1);
});
