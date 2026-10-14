const { stripOptionPrefix } = require('./parseJSON');

function isOdia(lang) {
  if (!lang || typeof lang !== 'string') return false;
  const l = lang.trim().toLowerCase();
  return l === 'odia' || l === 'oriya' || l === 'or' || l === 'or-in' || /[\u0b00-\u0b7f]/.test(l);
}

function containsOdiaScript(text) {
  return /[\u0b00-\u0b7f]/.test(text || '');
}

/**
 * Resolves the effective language.
 * Odia script in text takes precedence over the UI selector.
 */
function getEffectiveLanguage(uiLanguage, text = '') {
  if (isOdia(uiLanguage) || containsOdiaScript(text)) {
    return 'Odia';
  }
  return uiLanguage || 'English';
}

/**
 * Normalizes raw/verbose user text into a compact, clean topic label without using an LLM.
 * E.g., "A galaxy is a vast collection of stars, gas, dust, and invisible matter in space, held together by gravity"
 * -> "galaxies"
 */
function normalizeQuizTopic(rawTopic) {
  if (!rawTopic || typeof rawTopic !== 'string') return '';
  const trimmed = rawTopic.trim();
  if (trimmed.length === 0) return '';

  // Already a clean concise topic phrase
  if (trimmed.length <= 40 && !/[.!?]/.test(trimmed)) {
    return trimmed;
  }

  // Astrophysics: Galaxy descriptive sentences
  if (/galaxy|galaxies|ଛାୟାପଥ|ଆକାଶଗଙ୍ଗା/i.test(trimmed)) {
    return containsOdiaScript(trimmed) ? 'ଛାୟାପଥ' : 'galaxies';
  }

  // English definition pattern: "A/An/The <Noun Phrase> is/are/refers to/was/consists of..."
  const enDefMatch = trimmed.match(/^(?:a|an|the)\s+([a-z0-9\s-]{2,35}?)\s+(?:is|are|refers\s+to|means|consists\s+of|represents|describes)\b/i);
  if (enDefMatch) {
    const term = enDefMatch[1].trim();
    if (term.length > 0) return term;
  }

  // Odia definition pattern: "<Noun Phrase> କୁହାଯାଏ/ଅଟେ/ହେଉଛି"
  const odDefMatch = trimmed.match(/^([\u0b00-\u0b7f\s-]{2,35}?)\s+(?:ହେଉଛି|ଅଟେ|କୁହାଯାଏ|ବୋଲି)/);
  if (odDefMatch) {
    const term = odDefMatch[1].trim();
    if (term.length > 0) return term;
  }

  // Interrogative: "What is <Topic>?" / "<Topic> କଣ?"
  const whatIsMatch = trimmed.match(/^(?:what\s+is|what\s+are|explain)\s+(?:a|an|the\s+)?([a-z0-9\s-]{2,35}?)(?:\?|$)/i);
  if (whatIsMatch) {
    return whatIsMatch[1].trim();
  }

  // Sentence with punctuation: take first clause if it's a short topic
  const firstClause = trimmed.split(/[.?!;\n]/)[0].trim();
  if (firstClause.length > 0 && firstClause.length <= 40) {
    const innerMatch = firstClause.match(/^(?:a|an|the)\s+([a-z0-9\s-]{2,35}?)\s+(?:is|are)\b/i);
    if (innerMatch) return innerMatch[1].trim();
    return firstClause;
  }

  // Fallback: take first 4 words
  const words = trimmed.split(/\s+/).slice(0, 4).join(' ');
  return words || trimmed;
}


function odiaToNumber(str) {
  if (!str) return null;
  const odiaDigits = { '୦': 0, '୧': 1, '୨': 2, '୩': 3, '୪': 4, '୫': 5, '୬': 6, '୭': 7, '୮': 8, '୯': 9 };
  let numStr = '';
  for (const ch of String(str).trim()) {
    if (odiaDigits[ch] !== undefined) {
      numStr += odiaDigits[ch];
    } else if (/\d/.test(ch)) {
      numStr += ch;
    }
  }
  const n = parseInt(numStr, 10);
  return isNaN(n) ? null : n;
}

/**
 * Extracts an explicit question count requested in prompt text.
 * Strictly distinguishes question count from option count.
 *
 * Only interprets a numeral as question count when associated with:
 * - ପ୍ରଶ୍ନ / ପ୍ରଶ୍ନର
 * - MCQ / MCQs / mcq / mcqs
 * - questions / question
 * - quiz questions
 *
 * NEVER interprets numbers associated with:
 * - ବିକଳ୍ପ / options / choices / ଉତ୍ତର
 */
function extractQuestionCount(text) {
  if (!text || typeof text !== 'string') return null;

  const qKeywords = '(?:mcqs?|mcq|ପ୍ରଶ୍ନ(?:ର)?|questions?|quiz\\s+questions?)';

  // Pattern 1: <num> [ଟି] [adjective] <qKeyword> (e.g. ୧ଟି MCQ, ୩ଟି MCQ, ୫ଟି ପ୍ରଶ୍ନ, ୩ଟି ପ୍ରଶ୍ନର, 1 question)
  const qPattern1 = new RegExp(`([୧-୯୦-୯\\d]+)\\s*(?:ଟି|ta|ti)?\\s*(?:(?:ସହଜ|କଠିନ|କ୍ଷୁଦ୍ର|ନୂଆ|ସରଳ)\\s+)?${qKeywords}`, 'i');
  const m1 = text.match(qPattern1);
  if (m1) {
    const val = odiaToNumber(m1[1]);
    if (val && val >= 1 && val <= 10) return val;
  }

  // Pattern 2: <qKeyword> [ସଂଖ୍ୟା] <num> (e.g. MCQ: 3, questions: 5, ପ୍ରଶ୍ନ ସଂଖ୍ୟା ୧)
  const qPattern2 = new RegExp(`${qKeywords}\\s*(?:ସଂଖ୍ୟା\\s*[:=]?\\s*|[:=]\\s*)?([୧-୯୦-୯\\d]+)`, 'i');
  const m2 = text.match(qPattern2);
  if (m2) {
    const val = odiaToNumber(m2[1]);
    if (val && val >= 1 && val <= 10) return val;
  }

  return null;
}

/**
 * Extracts explicit option count per question requested in prompt text (e.g. ୪ଟି ବିକଳ୍ପ -> 4).
 * Returns integer (2-6) or default 4.
 */
function extractOptionCount(text) {
  if (!text || typeof text !== 'string') return 4;
  const match = text.match(/([୧-୯୦-୯\d]+)\s*(?:ଟି|ta|ti)?\s*(?:ବିକଳ୍ପ|options?|choices?)/i);
  if (match) {
    const val = odiaToNumber(match[1]);
    if (val && val >= 2 && val <= 6) return val;
  }
  return 4;
}

/**
 * Validates whether an Odia question is a grammatically usable, complete interrogative question,
 * rejecting sentence fragments, declarative statements, dangling labels, or incomplete clauses.
 */
function isCompleteOdiaQuestion(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();
  if (clean.length < 10) return false;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;

  // Reject dangling suffixes, prepositions, or incomplete connectors
  if (/(?:ଦ୍ୱାରା|ଏବଂ|ଓ|ସହିତ|ଯୋଗୁଁ)$/.test(clean.replace(/[।?.\s]+$/, ''))) {
    return false;
  }

  // Reject pure declarative statements without interrogatives (e.g. "ଅମ୍ଳଜାନ ସୃଷ୍ଟି ହେଉଛି")
  if (/(?:ସୃଷ୍ଟି\s+ହେଉଛି|ପ୍ରସ୍ତୁତ\s+ହୁଏ|ହୋଇଥାଏ)$/.test(clean.replace(/[।.\s]+$/, '')) && !clean.includes('?')) {
    const hasInterrogative = /(?:କଣ|କ’ଣ|କେଉଁ|କିପରି|କାହା|କାହିଁକି|କିଏ|କେଉଁଠି|କେଉଁଠାରେ|କେତେ|କେଉଁଥିରୁ|କେଉଁଟି|କାହାର|କେଉଁଥିପାଇଁ|କେଉଁଠୁ)/i.test(clean);
    if (!hasInterrogative) return false;
  }

  const hasQuestionMark = clean.includes('?');
  const hasInterrogativeWord = /(?:କଣ|କ’ଣ|କେଉଁ|କିପରି|କାହା|କାହିଁକି|କିଏ|କେଉଁଠି|କେଉଁଠାରେ|କେତେ|କେଉଁଥିରୁ|କେଉଁଟି|କି\?|କରେ\?|ହୁଏ\?|କାହାର|କେଉଁଥିପାଇଁ|କେଉଁଠୁ)/i.test(clean);
  const hasQuestionVerb = /(?:କୁହାଯାଏ|ହୋଇଥାଏ\?|କରିଥାଏ\?|ପ୍ରକ୍ରିୟା କଣ|ନିର୍ଣ୍ଣୟ କର|ଦର୍ଶାଅ|ବାଛ|ଚିହ୍ନଟ କର|ଉଲ୍ଲେଖ କର)/i.test(clean);

  if (!hasQuestionMark && !hasInterrogativeWord && !hasQuestionVerb) {
    return false;
  }

  return true;
}

/**
 * Detects topic category to prevent cross-topic hallucination and rule bleeding.
 */
function detectTopicType(topic = '') {
  const t = String(topic || '').toLowerCase();
  if (/photosynthesis|ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|ହରିତକଣ|ପତ୍ରହରିତ|ପତ୍ରରନ୍ଧ୍ର|chlorophyll/i.test(t)) {
    return 'photosynthesis';
  }
  if ((/ବାଷ୍ପୀଭବନ|evaporation/i.test(t) && /ଘନୀଭବନ|condensation/i.test(t)) || (/ପାର୍ଥକ୍ୟ/i.test(t) && (/ବାଷ୍ପୀଭବନ/i.test(t) || /ଘନୀଭବନ/i.test(t)))) {
    return 'evaporation_condensation';
  }
  if (/ବାଷ୍ପୀଭବନ|evaporation/i.test(t)) {
    return 'evaporation';
  }
  if (/ଘନୀଭବନ|condensation/i.test(t)) {
    return 'condensation';
  }
  if (/ମଣିଷ.*(?:ଶ୍ୱାସ|ଶ୍ୱାସକ୍ରିୟା|ପ୍ରଶ୍ୱାସ|ନିଃଶ୍ୱାସ)|ଶ୍ୱାସ\s*ନେବା|କେଉଁ\s*ଗ୍ୟାସ\s*ଗ୍ରହଣ.*ବାହାର|human\s*breathing|breathing/i.test(t)) {
    return 'human_breathing';
  }
  if (/(?:ଉଦ୍ଭିଦ|ଗଛ|plant).*(?:ଶ୍ୱସନ|respiration)|respiration\s*in\s*plants/i.test(t)) {
    return 'plant_respiration';
  }
  if (/ଜଳର\s*ଅବସ୍ଥା|ପାଣିର\s*ଅବସ୍ଥା|ତିନୋଟି\s*ଅବସ୍ଥା|୩ଟି\s*ଅବସ୍ଥା|states\s*of\s*water/i.test(t)) {
    return 'water_states';
  }
  if (/ପାଣି.*ଗରମ|ଜଳ.*ଗରମ|ଗରମ\s*କଲେ|ଅବସ୍ଥା.*ପରିବର୍ତ୍ତନ|ବାଷ୍ପ|ତରଳ.*ବାଷ୍ପ|water.*heat|heat.*water|state\s*change/i.test(t)) {
    return 'water_state_change';
  }
  if (/water\s*cycle|ଜଳ\s*ଚକ୍ର/i.test(t)) {
    return 'water_cycle';
  }
  if (/ସୂର୍ଯ୍ୟ\s*କ['’]?ଣ|sun\b|ସୌର/i.test(t) && !/photosynthesis|ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ/i.test(t)) {
    return 'sun';
  }
  if (/newton|ନ୍ୟୁଟନ|motion|ଗତି|inertia|ଜଡ଼ତା/i.test(t)) {
    return 'newton_motion';
  }
  if (/galaxy|galaxies|ଛାୟାପଥ|ଆକାଶଗଙ୍ଗା/i.test(t)) {
    return 'galaxies';
  }
  return 'general';
}

/**
 * Generates topic-scoped factual science rules.
 * Never bleeds photosynthesis rules into unrelated topics like water heating.
 */
function getTopicFactualRules(topic = '', language = 'English') {
  const isOd = isOdia(language) || containsOdiaScript(topic);
  const type = detectTopicType(topic);

  if (type === 'galaxies') {
    return isOd
      ? `FACTUAL SCIENCE RULES (MANDATORY):
- ଛାୟାପଥ (Galaxy) ହେଉଛି କୋଟି କୋଟି ନକ୍ଷତ୍ର, ଗ୍ୟାସ ଏବଂ ଧୂଳିକଣାର ଏକ ବିରାଟ ମହାଜାଗତିକ ସଂସ୍ଥା।
- ମାଧ୍ୟାକର୍ଷଣ ବଳ (Gravity) ଛାୟାପଥର ସମସ୍ତ ନକ୍ଷତ୍ର ଓ ପଦାର୍ଥକୁ ଏକତ୍ର ବାନ୍ଧି ରଖିଥାଏ।
- ଆମ ସୌରମଣ୍ଡଳ 'ଆକାଶଗଙ୍ଗା' (Milky Way) ଛାୟାପଥରେ ଅବସ୍ଥିତ।
- ଆଣ୍ଡ୍ରୋମେଡା (Andromeda) ଏବଂ ମିଲ୍କି ୱେ ହେଉଛି ଛାୟାପଥର ପ୍ରମୁଖ ଉଦାହରଣ।`
      : `FACTUAL SCIENCE RULES (MANDATORY):
- A galaxy is a vast system of billions of stars, stellar remnants, interstellar gas, dust, and dark matter.
- Gravity is the fundamental attractive force holding stars and matter together in a galaxy.
- The Milky Way and Andromeda are prominent examples of galaxies; our Solar System is in the Milky Way.`;
  }

  if (type === 'water_state_change') {
    return isOd
      ? `FACTUAL SCIENCE RULES (MANDATORY):
- Topic is Water Heating and State Change (ପାଣି/ଜଳ ଗରମ ଏବଂ ଅବସ୍ଥା ପରିବର୍ତ୍ତନ).
- Heating water (ପାଣି / ଜଳ) sufficiently causes it to change state from liquid (ତରଳ) to gas/water vapor/steam (ବାଷ୍ପ / ଜଳୀୟ ବାଷ୍ପ).
- The correct answer for state of water when heated is water vapor/steam (ବାଷ୍ପ / ଜଳୀୟ ବାଷ୍ପ).
- Cooling/freezing water turns it into ice/solid (ବରଫ / କଠିନ).
- Boiling point of water is 100°C (୧୦୦°C).
- Do NOT talk about photosynthesis, plants, chloroplasts, chlorophyll, or oxygen production. Stick 100% to water heating and state change.`
      : `FACTUAL SCIENCE RULES (MANDATORY):
- Topic is Water Heating and State Change.
- Heating liquid water sufficiently causes it to change state into water vapor / steam (gas).
- The correct answer is water vapor / steam.
- Freezing water turns it into ice (solid).
- Do NOT talk about photosynthesis, plants, or unrelated biology topics.`;
  }

  if (type === 'photosynthesis') {
    return isOd
      ? `FACTUAL SCIENCE RULES (MANDATORY):
- Sunlight (ସୂର୍ଯ୍ୟାଲୋକ) provides the primary energy source for photosynthesis.
- Plants use water (ଜଳ) and take in Carbon dioxide (ଅଙ୍ଗାରକାମ୍ଳ) from the air to make food.
- Plants release Oxygen (ଅମ୍ଳଜାନ) into the air during photosynthesis as a product.
- Chlorophyll (ପତ୍ରହରିତ) is the green pigment that absorbs light.
- Chloroplast (ହରିତକଣିକା) is the organelle site of photosynthesis, NOT the direct source of oxygen.
- Stomata (ପତ୍ରରନ୍ଧ୍ର) are microscopic pores in leaves for gas exchange (CO2 in, O2 out). Stomata do NOT transport water.
- Xylem (ଜାଇଲେମ) transports water and minerals from roots to leaves. Xylem does NOT transport carbon dioxide.
- Phloem (ଫ୍ଲୋଏମ) transports prepared food (glucose/sugars).
- Glucose is stored as starch (ଶ୍ୱେତସାର).
- NEGATIVE GUARDRAILS (CRITICAL):
  * Oxygen (ଅମ୍ଳଜାନ) MUST NOT be described as an input or absorbed gas.
  * Carbon dioxide (ଅଙ୍ଗାରକାମ୍ଳ) MUST NOT be described as an output or released gas.
  * Sunlight (ସୂର୍ଯ୍ୟାଲୋକ) MUST NOT be described as an atmospheric gas or substance.
  * Water (ଜଳ) MUST NOT be described as a gas in photosynthesis.
  * Photosynthesis MUST NOT be described as oxygen production alone; it is food synthesis.
  * Plants do NOT perform photosynthesis at night because sunlight is absent. Do NOT say plants store carbon dioxide at night as the reason photosynthesis stops.
- Use canonical textbook Odia terminology (e.g. ଆଲୋକ ସଂଶ୍ଳେଷଣ, ଅମ୍ଳଜାନ, ଅଙ୍ଗାରକାମ୍ଳ, ସୂର୍ଯ୍ୟାଲୋକ, ପତ୍ରହରିତ, ହରିତକଣିକା, ପତ୍ରରନ୍ଧ୍ର, ଜାଇଲେମ). Do NOT use English words or fabricated terms like "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ".`
      : `FACTUAL SCIENCE RULES (MANDATORY):
- Photosynthesis requires CO2 and water. Plants absorb CO2 and release oxygen.
- Sunlight provides the energy. Chlorophyll absorbs light.
- Oxygen must NOT be described as an input; Carbon dioxide must NOT be described as an output.`;
  }

  if (type === 'plant_respiration') {
    return isOd
      ? `FACTUAL SCIENCE RULES (MANDATORY):
- Plants respire (ଶ୍ୱସନ) continuously during BOTH day and night (ଦିନ ଓ ରାତି).
- Plant respiration uses Oxygen (ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ) and releases Carbon dioxide (ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରେ).
- Plants do NOT stop respiration at night, and do NOT store carbon dioxide at night for respiration.`
      : `FACTUAL SCIENCE RULES (MANDATORY):
- Plants respire day and night using oxygen and releasing carbon dioxide. Respiration does not stop at night.`;
  }

  if (type === 'human_breathing') {
    return isOd
      ? `FACTUAL SCIENCE RULES (MANDATORY):
- In human breathing (ଶ୍ୱାସକ୍ରିୟା), humans inhale Oxygen (ଅମ୍ଳଜାନ ଗ୍ରହଣ କରନ୍ତି / ପ୍ରଶ୍ୱାସରେ ନିଅନ୍ତି).
- Humans exhale Carbon dioxide (ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରନ୍ତି / ନିଃଶ୍ୱାସରେ ବାହାର କରନ୍ତି).
- NEVER reverse these gas relationships.`
      : `FACTUAL SCIENCE RULES (MANDATORY):
- Humans inhale oxygen and exhale carbon dioxide. Never reverse these gases.`;
  }

  if (type === 'water_states') {
    return isOd
      ? `FACTUAL SCIENCE RULES (MANDATORY):
- Water has three physical states: Solid = Ice (ବରଫ / କଠିନ), Liquid = Water (ଜଳ ବା ପାଣି / ତରଳ), Gas = Water vapour (ବାଷ୍ପ ବା ଜଳୀୟ ବାଷ୍ପ / ଗ୍ୟାସୀୟ).
- Water vapour is gaseous water, NOT oxygen or carbon dioxide.`
      : `FACTUAL SCIENCE RULES (MANDATORY):
- Water exists as solid (ice), liquid (water), and gas (water vapour).`;
  }

  if (type === 'evaporation_condensation') {
    return isOd
      ? `FACTUAL SCIENCE RULES (MANDATORY):
- Evaporation (ବାଷ୍ପୀଭବନ): Liquid water turns into water vapour (gas) due to heat (ତରଳ ଜଳ -> ଜଳୀୟ ବାଷ୍ପ).
- Condensation (ଘନୀଭବନ): Water vapour (gas) cools and turns back into liquid water (ଜଳୀୟ ବାଷ୍ପ -> ତରଳ ଜଳ).
- They are opposite physical processes. Never reverse their definitions.`
      : `FACTUAL SCIENCE RULES (MANDATORY):
- Evaporation is liquid turning into gas due to heat.
- Condensation is gas cooling into liquid. Never reverse these roles.`;
  }

  if (type === 'evaporation') {
    return isOd
      ? `FACTUAL SCIENCE RULES (MANDATORY):
- Evaporation (ବାଷ୍ପୀଭବନ) is the process where liquid water (ତରଳ ଜଳ) turns into water vapor (ଜଳୀୟ ବାଷ୍ପ) due to heat (ଉତ୍ତାପ).
- Sunlight or heat provides the energy causing liquid water to turn into vapor.
- Everyday example: ଖରାରେ ଓଦା ଲୁଗା ଶୁଖିବା (wet clothes drying in the sun).`
      : `FACTUAL SCIENCE RULES (MANDATORY):
- Evaporation is the process where liquid water turns into water vapor due to heat.
- Everyday example: wet clothes drying in the sun.`;
  }

  if (type === 'condensation') {
    return isOd
      ? `FACTUAL SCIENCE RULES (MANDATORY):
- Condensation (ଘନୀଭବନ) is the process where water vapour (gas) cools and turns into liquid water (ତରଳ ଜଳ).
- Example: water droplets forming on the outside of a cold glass.`
      : `FACTUAL SCIENCE RULES (MANDATORY):
- Condensation is the process where gas/water vapour cools into liquid.`;
  }

  if (type === 'water_cycle') {
    return isOd
      ? `FACTUAL SCIENCE RULES (MANDATORY):
- Water cycle sequence: Evaporation (liquid water to vapour) -> Condensation (vapour to clouds) -> Precipitation/Rain (water falls to Earth).`
      : `FACTUAL SCIENCE RULES (MANDATORY):
- Water cycle sequence is evaporation -> condensation -> precipitation.`;
  }

  if (type === 'sun') {
    return isOd
      ? `FACTUAL SCIENCE RULES (MANDATORY):
- The Sun (ସୂର୍ଯ୍ୟ) is a star (ନକ୍ଷତ୍ର) located at the center of our solar system (ସୌରମଣ୍ଡଳ).
- It provides light (ଆଲୋକ) and heat (ଉତ୍ତାପ) to the Earth.
- Without the Sun, life on Earth is not possible.`
      : `FACTUAL SCIENCE RULES (MANDATORY):
- The Sun is a star at the center of the solar system providing light and heat.`;
  }

  if (type === 'newton_motion') {
    return isOd
      ? `FACTUAL SCIENCE RULES (MANDATORY):
- Newton's 1st Law relates to Inertia (ଜଡ଼ତା) and unbalanced external force (ବାହ୍ୟ ବଳ).
- Newton's 2nd Law relates to Momentum (ସଂବେଗ) and force (F = ma).
- Newton's 3rd Law relates to Action and Reaction (କ୍ରିୟା ଓ ପ୍ରତିକ୍ରିୟା).`
      : `FACTUAL SCIENCE RULES (MANDATORY):
- Newton's 1st Law relates to Inertia and external forces.
- Newton's 2nd Law relates to Momentum and F = ma.
- Newton's 3rd Law relates to Action and Reaction.`;
  }

  return isOd
    ? `FACTUAL SCIENCE RULES (MANDATORY):
- Stick strictly to the specified topic: "${topic}".
- All questions and answers must be scientifically and factually accurate for "${topic}".
- Do NOT introduce unrelated scientific concepts like photosynthesis or plant biology unless requested.`
    : `FACTUAL SCIENCE RULES (MANDATORY):
- Stick strictly to the specified topic: "${topic}".
- All questions and answers must be scientifically and factually accurate for "${topic}".
- Do NOT introduce unrelated scientific concepts unless requested.`;
}

/**
 * Returns standardized language directives for model prompts.
 * context: 'tutor' | 'quiz' | 'concept_map' | 'agent_synthesis' | 'vision'
 */
function getLanguageDirective(language, context = 'tutor', topic = '') {
  if (!language || language.toLowerCase() === 'english') {
    return '';
  }

  if (isOdia(language)) {
    const baseOdiaDirective = `CRITICAL ODIA TUTOR DIRECTIVE:
You are StudyBuddy, a patient educational tutor for school students in Odisha.
- Respond in clear, natural, grammatically correct Odia (ଓଡ଼ିଆ) using the Odia script.
- Answer the student's question directly. Never repeat, parrot, or echo the student's question in "intro" or "answer".
- FOLLOW-UP QUESTIONS: When the student asks a follow-up question (e.g. asking about a specific subtopic like "ବାଷ୍ପୀଭବନ / Evaporation" after discussing "ଜଳ ଚକ୍ର / Water Cycle"), focus directly on the newly asked subtopic. Do NOT restart or rehash the previous high-level answer from scratch.
- CONCISE EXPLANATIONS & EXAMPLES: When asked to explain or give an example, provide a clear, concise explanation followed by a concrete, relatable everyday real-world example (e.g., ଖରାରେ ଓଦା ଲୁଗା ଶୁଖିବା (wet clothes drying in the sun) for evaporation).
- Avoid sentence duplication across "intro", "steps", and "answer". Each field must provide distinct, helpful content.
- Explain concepts step by step in age-appropriate, school-level language.
- Preserve factual and scientific accuracy.
- Preserve standard scientific terms in English in parentheses when helpful (e.g., ଆଲୋକ ସଂଶ୍ଳେଷଣ (Photosynthesis), ଜଡ଼ତା (Inertia), ମହାନଦୀ (Mahanadi), ବାଷ୍ପୀଭବନ (Evaporation), ଜଳ ଚକ୍ର (Water Cycle)).
- If the student asks in Odia, English, or mixed Odia-English, understand the question and answer strictly in Odia.
- Do not switch to English unless the student explicitly requests English.
- All student-facing content ("intro", "title", "text", "answer", "followup", "agentSummary", "progressNote") MUST be in Odia (ଓଡ଼ିଆ) script.
- Keep JSON keys ("mode", "intro", "steps", "title", "text", "emoji", "answer", "followup") strictly in English.

FACTUAL KNOWLEDGE BASE:
- Odisha Geography:
  * Capital of Odisha: Bhubaneswar (ଭୁବନେଶ୍ୱର).
  * Major rivers of Odisha: Mahanadi (ମହାନଦୀ), Brahmani (ବ୍ରାହ୍ମଣୀ), Baitarani (ବୈତରଣୀ), Subarnarekha (ସୁବର୍ଣ୍ଣରେଖା), and Rusikulya (ଋଷିକୂଲ୍ୟା).
- Physics — Newton's First Law:
  * Newton's First Law of Motion (ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ / ଜଡ଼ତା ନିୟମ - Law of Inertia): An object remains at rest or in uniform motion unless acted upon by an external net unbalanced force (କୌଣସି ବାହ୍ୟ ବଳ ପ୍ରୟୋଗ ନ ହେବା ପର୍ଯ୍ୟନ୍ତ ଏକ ସ୍ଥିର ବସ୍ତୁ ସ୍ଥିର ରହେ ଏବଂ ଏକ ଗତିଶୀଳ ବସ୍ତୁ ସରଳ ରେଖାରେ ସମଗତିରେ ଗତିଶୀଳ ରହିଥାଏ).
- Science — Water Cycle & Evaporation:
  * Water Cycle (ଜଳ ଚକ୍ର): The continuous circulation of water from Earth's surface to the atmosphere and back through evaporation, condensation, and precipitation.
  * Evaporation (ବାଷ୍ପୀଭବନ): The process where liquid water turns into water vapor (gas) due to heat (ସୂର୍ଯ୍ୟଙ୍କ ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ଜଳ ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହେବା ପ୍ରକ୍ରିୟା).
  * Everyday examples of evaporation: Wet clothes drying in sunlight (ଖରାରେ ଓଦା ଲୁଗା ଶୁଖିବା), water evaporating from roads or puddles after rain, boiling water turning to steam.
  * Condensation (ଘନୀଭବନ): Water vapor cools and turns back into liquid water droplets, forming clouds (ଜଳୀୟ ବାଷ୍ପ ଥଣ୍ଡା ହୋଇ ମେଘ ସୃଷ୍ଟି ହେବା).
  * Precipitation (ଅବକ୍ଷେପଣ / ବର୍ଷା): Water falling back to Earth as rain from clouds.`;

    if (context === 'quiz') {
      const topicLower = (topic || '').toLowerCase();
      let glossary = '';
      if (topicLower.includes('photosynthesis') || topicLower.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ') || topicLower.includes('ଖାଦ୍ୟ ପ୍ରସ୍ତୁତି')) {
        glossary = `MANDATORY GLOSSARY: Photosynthesis=ଆଲୋକ ସଂଶ୍ଳେଷଣ, Sunlight=ସୂର୍ଯ୍ୟାଲୋକ (never ସୂର୍ଯ୍ୟାସ୍ଥଳୀ), Chloroplast=ହରିତକଣିକା (never ଗୋଲାକ), Chlorophyll=ପତ୍ରହରିତ, CO2=ଅଙ୍ଗାରକାମ୍ଳ, Oxygen=ଅମ୍ଳଜାନ, Stomata=ପତ୍ରରନ୍ଧ୍ର, Starch=ଶ୍ୱେତସାର, Xylem=ଜାଇଲେମ.`;
      } else if (topicLower.includes('motion') || topicLower.includes('newton') || topicLower.includes('ଗତି') || topicLower.includes('ଜଡ଼ତା') || topicLower.includes('force') || topicLower.includes('ବଳ')) {
        glossary = `MANDATORY GLOSSARY: Force=ବଳ, Inertia=ଜଡ଼ତା, 1st Law=ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ, Rest=ସ୍ଥିତି, Motion=ଗତି, Friction=ଘର୍ଷଣ, Gravity=ମାଧ୍ୟାକର୍ଷଣ.`;
      } else if (topicLower.includes('water cycle') || topicLower.includes('ଜଳ ଚକ୍ର')) {
        glossary = `MANDATORY GLOSSARY: Evaporation=ବାଷ୍ପୀଭବନ, Condensation=ଘନୀଭବନ, Precipitation=ଅବକ୍ଷେପଣ, Water=ଜଳ.`;
      } else {
        glossary = `MANDATORY GLOSSARY: Use standard SCERT Odisha textbook science terms in Odia (ଓଡ଼ିଆ). English scientific terms in parentheses are permitted where helpful.`;
      }

      return `QUIZ LOCALIZATION RULES (MANDATORY):
Generate natural, grammatically correct school-level Odia (ଓଡ଼ିଆ) multiple choice questions.
${glossary}
All student-facing fields (questions, options, answer, explanation) MUST be in Odia (ଓଡ଼ିଆ) script. Keep JSON keys in English.\n\n`;
    }


    if (context === 'concept_map') {
      return `${baseOdiaDirective}

CONCEPT MAP LOCALIZATION RULES (MANDATORY):
- "central", node "label", node "description", and edge "label" MUST be in Odia (ଓଡ଼ିଆ) script with English terms in parentheses if helpful.
- JSON keys ("central", "nodes", "id", "label", "description", "edges", "from", "to") MUST remain in English.\n\n`;
    }

    if (context === 'agent_synthesis') {
      return `CRITICAL ODIA DIRECTIVE: The student requested Odia.
- The "agentSummary" and "progressNote" fields MUST be in natural, grammatically correct Odia (ଓଡ଼ିଆ) script with standard English scientific terms in parentheses where helpful.
- In "nextTopic", the "reason" field MUST be in Odia.
- Keep JSON keys strictly in English. Do NOT output English summaries.`;
    }

    if (context === 'vision') {
      return `${baseOdiaDirective}
Explain whatever is shown in the uploaded homework/diagram in clear Odia (ଓଡ଼ିଆ) with English scientific terms in parentheses where helpful.\n\n`;
    }

    return `${baseOdiaDirective}\n\n`;
  }

  // Other non-English languages
  if (context === 'quiz') {
    return `CRITICAL: Generate all questions, options, answers, and explanations in ${language}. Keep JSON keys in English.\n\n`;
  }
  if (context === 'agent_synthesis') {
    return `CRITICAL: The student requested ${language}. The "agentSummary" and "progressNote" fields MUST be in ${language}. Keep JSON keys in English.`;
  }
  return `CRITICAL: The student has requested to learn in ${language}. You MUST respond entirely in ${language}.\n\n`;
}

/**
 * Reusable validation layer for student-facing Odia responses.
 */
function validateOdiaContent(text, { minOdiaRatio = 0.2, allowEmpty = false } = {}) {
  if (!text || typeof text !== 'string') {
    return { valid: allowEmpty, reason: 'empty_text' };
  }
  const clean = text.trim();
  if (!clean) return { valid: allowEmpty, reason: 'empty_text' };

  // 1. Odia script presence
  const odiaMatches = clean.match(/[\u0b00-\u0b7f]/g) || [];
  if (odiaMatches.length === 0) {
    return { valid: false, reason: 'no_odia_script' };
  }

  // 2. Excessive English check (excluding short parenthesized English terms)
  const strippedParentheses = clean.replace(/\([A-Za-z0-9\s,.-]+\)/g, '');
  const latinMatches = strippedParentheses.match(/[a-zA-Z]/g) || [];
  
  if (odiaMatches.length > 0 && latinMatches.length > 0) {
    const odiaRatio = odiaMatches.length / (odiaMatches.length + latinMatches.length);
    if (odiaRatio < minOdiaRatio) {
      return { valid: false, reason: 'excessive_english', odiaRatio };
    }
  }

  // 3. Degenerate repetition check (e.g. same phrase repeated 4+ times)
  const phrases = clean.split(/[।.\n!?]/).map(p => p.trim()).filter(p => p.length > 8);
  const phraseCounts = {};
  for (const p of phrases) {
    phraseCounts[p] = (phraseCounts[p] || 0) + 1;
    if (phraseCounts[p] >= 4) {
      return { valid: false, reason: 'repetitive_loop', phrase: p };
    }
  }

  return { valid: true };
}

/**
 * Validates an array of quiz questions for Odia compliance.
 */
function validateOdiaQuiz(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, reason: 'no_questions' };
  }

  let odiaQuestionCount = 0;
  for (const q of questions) {
    const qValid = validateOdiaContent(q.question);
    const expValid = validateOdiaContent(q.explanation, { allowEmpty: true });
    if (qValid.valid || expValid.valid) {
      odiaQuestionCount++;
    }
  }

  // At least 60% of questions must contain valid Odia
  if (odiaQuestionCount / questions.length < 0.6) {
    return { valid: false, reason: 'quiz_mostly_english', odiaQuestionCount, total: questions.length };
  }

  return { valid: true };
}

const CANONICAL_ODIA_VOCAB = {
  photosynthesis: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ',
  sunlight: 'ସୂର୍ଯ୍ୟାଲୋକ',
  carbon_dioxide: 'ଅଙ୍ଗାରକାମ୍ଳ',
  oxygen: 'ଅମ୍ଳଜାନ',
  water: 'ଜଳ',
  chlorophyll: 'ପତ୍ରହରିତ',
  chloroplast: 'ହରିତକଣିକା',
  stomata: 'ପତ୍ରରନ୍ଧ୍ର',
  xylem: 'ଜାଇଲେମ',
  phloem: 'ଫ୍ଲୋଏମ',
  starch: 'ଶ୍ୱେତସାର',
  evaporation: 'ବାଷ୍ପୀଭବନ',
  condensation: 'ଘନୀଭବନ',
  water_cycle: 'ଜଳ ଚକ୍ର',
  water_vapor: 'ଜଳୀୟ ବାଷ୍ପ',
  sun: 'ସୂର୍ଯ୍ୟ'
};

const CORRUPTED_ODIA_VOCAB = [
  { bad: /ଉଦ୍ଭିଦ\s*ସଂଶ୍ଲେଷଣ|ଉଦ୍ଭିଦ\s*ସଂଶ୍ଳେଷଣ/i, replacement: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ (Photosynthesis)' },
  { bad: /ଗୋଲାକ\s*\(\s*chloroplast\s*\)/i, replacement: 'ହରିତକଣିକା (Chloroplast)' },
  { bad: /ସୂର୍ଯ୍ୟାସ୍ଥଳୀ/i, replacement: 'ସୂର୍ଯ୍ୟାଲୋକ (Sunlight)' },
  { bad: /ଉଦ୍ଭିଦ କାହାରେ/i, replacement: 'ଉଦ୍ଭିଦ କେଉଁ ଅଙ୍ଗିକାରେ / କେଉଁଠାରେ' },
  { bad: /(?:ପତ୍ରର\s*)?ମାଂସପେଶୀ/i, replacement: 'ପତ୍ରରନ୍ଧ୍ର (Stomata)' }
];

const ODIA_EDUCATIONAL_FALLBACKS = {
  photosynthesis: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ହେଉଛି ସବୁଜ ଉଦ୍ଭିଦ ନିଜର ଖାଦ୍ୟ ତିଆରି କରିବାର ଏକ ପ୍ରକ୍ରିୟା। ଏଥିପାଇଁ ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକର ଶକ୍ତି ବ୍ୟବହାର କରେ। ଉଦ୍ଭିଦ ମାଟିରୁ ଜଳ ଏବଂ ବାୟୁରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରି ଖାଦ୍ୟ ତିଆରି କରେ। ଏହି ପ୍ରକ୍ରିୟାରେ ଅମ୍ଳଜାନ ନିର୍ଗତ ହୁଏ।',
  photosynthesis_oxygen_source: 'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ନିର୍ଗତ ଅମ୍ଳଜାନ ଜଳରୁ ଆସିଥାଏ। ଆଲୋକ ପ୍ରକ୍ରିୟାରେ ଜଳ ଅଣୁର ବିଭାଜନ ଘଟି ଜଳରୁ ଅମ୍ଳଜାନ ମୁକ୍ତ ହୁଏ; ଏହା ଅଙ୍ଗାରକାମ୍ଳରୁ ଆସେ ନାହିଁ।',
  photosynthesis_night: 'ଗଛମାନେ ରାତିରେ ଆଲୋକ ସଂଶ୍ଳେଷଣ କରନ୍ତି ନାହିଁ। ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟା ପାଇଁ ସୂର୍ଯ୍ୟାଲୋକର ଶକ୍ତି ଏକାନ୍ତ ଆବଶ୍ୟକ। ରାତିରେ ସୂର୍ଯ୍ୟାଲୋକ ନ ଥିବାରୁ ଏହି ପ୍ରକ୍ରିୟା ସମ୍ପୂର୍ଣ୍ଣ ବନ୍ଦ ରହେ।',
  plant_respiration: 'ଉଦ୍ଭିଦମାନେ ଦିନ ଏବଂ ରାତି ଉଭୟ ସମୟରେ ନିରନ୍ତର ଶ୍ୱସନ କରନ୍ତି। ଶ୍ୱସନ ପ୍ରକ୍ରିୟାରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରେ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରେ।',
  human_breathing: 'ମଣିଷ ଶ୍ୱାସ ନେବା ସମୟରେ (ପ୍ରଶ୍ୱାସରେ) ବାୟୁରୁ ଅମ୍ଳଜାନ ଗ୍ୟାସ ଗ୍ରହଣ କରେ। ଶ୍ୱାସ ଛାଡ଼ିବା ସମୟରେ (ନିଃଶ୍ୱାସରେ) ଶରୀରରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ୟାସ ବାହାର କରିଥାଏ।',
  water_states: 'ଜଳର ତିନୋଟି ମୁଖ୍ୟ ଭୌତିକ ଅବସ୍ଥା ରହିଛି: କଠିନ ଅବସ୍ଥା (ବରଫ), ତରଳ ଅବସ୍ଥା (ଜଳ ବା ପାଣି), ଏବଂ ଗ୍ୟାସୀୟ ଅବସ୍ଥା (ଜଳୀୟ ବାଷ୍ପ ବା ବାଷ୍ପ)।',
  evaporation: 'ବାଷ୍ପୀଭବନ ହେଉଛି ଏକ ପ୍ରାକୃତିକ ପ୍ରକ୍ରିୟା ଯେଉଁଥିରେ ସୂର୍ଯ୍ୟଙ୍କ ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ଜଳ ଜଳୀୟ ବାଷ୍ପରେ (ଗ୍ୟାସରେ) ପରିଣତ ହୁଏ। ଉଦାହରଣ ସ୍ୱରୂପ, ଖରାରେ ଓଦା ଲୁଗା ଶୁଖିବା।',
  condensation: 'ଘନୀଭବନ ହେଉଛି ଏପରି ଏକ ପ୍ରକ୍ରିୟା ଯେଉଁଥିରେ ଜଳୀୟ ବାଷ୍ପ (ଗ୍ୟାସ) ଥଣ୍ଡା ହୋଇ ପୁନର୍ବାର ତରଳ ଜଳରେ ପରିଣତ ହୁଏ। ଉଦାହରଣ ସ୍ୱରୂପ, ଥଣ୍ଡା ପାଣି ବୋତଲ ବାହାରେ ପାଣି ଟୋପା ଜମିବା।',
  evaporation_condensation: 'ବାଷ୍ପୀଭବନ ଏବଂ ଘନୀଭବନ ପରସ୍ପର ବିପରୀତ ପ୍ରକ୍ରିୟା। ବାଷ୍ପୀଭବନରେ ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ଜଳ ବାଷ୍ପରେ (ଗ୍ୟାସରେ) ପରିଣତ ହୁଏ। ଅନ୍ୟପକ୍ଷରେ, ଘନୀଭବନରେ ଜଳୀୟ ବାଷ୍ପ ଥଣ୍ଡା ହୋଇ ତରଳ ଜଳରେ ପରିଣତ ହୁଏ।',
  water_cycle: 'ଜଳ ଚକ୍ରରେ ପ୍ରଥମେ ସୂର୍ଯ୍ୟଙ୍କ ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ଜଳ ବାଷ୍ପୀଭବନ ହୋଇ ବାୟୁମଣ୍ଡଳକୁ ଯାଏ। ସେଠାରେ ଘନୀଭବନ ହୋଇ ମେଘ ସୃଷ୍ଟି ହୁଏ ଏବଂ ଶେଷରେ ବର୍ଷା ଆକାରରେ ଜଳ ପୃଥିବୀକୁ ଫେରିଆସେ।',
  sun: 'ସୂର୍ଯ୍ୟ ହେଉଛି ଆମ ସୌରମଣ୍ଡଳର କେନ୍ଦ୍ରରେ ଥିବା ଏକ ଉଜ୍ଜ୍ୱଳ ନକ୍ଷତ୍ର। ଏହା ପୃଥିବୀକୁ ଆଲୋକ ଓ ଉତ୍ତାପ ପ୍ରଦାନ କରେ। ସୂର୍ଯ୍ୟଙ୍କ ଆଲୋକ ବିନା ପୃଥିବୀରେ ଜୀବନ ସମ୍ଭବ ନୁହେଁ।',
  water_state_change: 'ପାଣିକୁ ଯଥେଷ୍ଟ ଗରମ କଲେ ଏହା ତରଳ ଅବସ୍ଥାରୁ ବାଷ୍ପ ବା ଜଳୀୟ ବାଷ୍ପ (ଗ୍ୟାସୀୟ ଅବସ୍ଥା) ରେ ପରିବର୍ତ୍ତିତ ହୁଏ।',
  newton_motion: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ ବା ଜଡ଼ତା ନିୟମ ଅନୁସାରେ, କୌଣସି ବାହ୍ୟ ବଳ ପ୍ରୟୋଗ ନ ହେବା ପର୍ଯ୍ୟନ୍ତ ଏକ ସ୍ଥିର ବସ୍ତୁ ସ୍ଥିର ରହେ ଏବଂ ଏକ ଗତିଶୀଳ ବସ୍ତୁ ସରଳ ରେଖାରେ ସମଗତିରେ ଗତିଶୀଳ ରହେ।'
};

function getOdiaDeterministicFallback(topic = '', requestedConcepts = [], request = '') {
  const reqText = String(request || '');
  if (/(?:ଅମ୍ଳଜାନ|oxygen).*(?:କେଉଁଠାରୁ|କେଉଁଠୁ|ଉତ୍ସ|ଆସେ)|(?:କେଉଁଠାରୁ|କେଉଁଠୁ|ଉତ୍ସ).*(?:ଅମ୍ଳଜାନ|oxygen)|(?:ଏହା|ଏହାର|ତାହା)\s*(?:କେଉଁଠାରୁ|କେଉଁଠୁ)\s*ଆସେ/i.test(reqText) && (/ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ/i.test(reqText) || topic === 'photosynthesis')) {
    return ODIA_EDUCATIONAL_FALLBACKS.photosynthesis_oxygen_source;
  }
  if (/ରାତିରେ|ରାତି\s*ସମୟରେ|ଅନ୍ଧାରରେ/i.test(reqText) && (/ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ/i.test(reqText) || topic === 'photosynthesis')) {
    return ODIA_EDUCATIONAL_FALLBACKS.photosynthesis_night;
  }
  const type = detectTopicType(topic || reqText);
  if (type === 'human_breathing' || /ମଣିଷ.*(?:ଶ୍ୱାସ|ପ୍ରଶ୍ୱାସ|ନିଃଶ୍ୱାସ)|ଶ୍ୱାସ\s*ନେବା/i.test(reqText)) {
    return ODIA_EDUCATIONAL_FALLBACKS.human_breathing;
  }
  if (type === 'plant_respiration' || /(?:ଉଦ୍ଭିଦ|ଗଛ).*(?:ଶ୍ୱସନ|respiration)/i.test(reqText)) {
    return ODIA_EDUCATIONAL_FALLBACKS.plant_respiration;
  }
  if (type === 'evaporation_condensation' || (/ବାଷ୍ପୀଭବନ/i.test(reqText) && /ଘନୀଭବନ/i.test(reqText))) {
    return ODIA_EDUCATIONAL_FALLBACKS.evaporation_condensation;
  }
  if (type === 'condensation' || /ଘନୀଭବନ/i.test(reqText)) {
    return ODIA_EDUCATIONAL_FALLBACKS.condensation;
  }
  if (type === 'water_states' || /ଜଳର\s*ଅବସ୍ଥା|ପାଣିର\s*ଅବସ୍ଥା|ତିନୋଟି\s*ଅବସ୍ଥା|୩ଟି\s*ଅବସ୍ଥା/i.test(reqText)) {
    return ODIA_EDUCATIONAL_FALLBACKS.water_states;
  }
  if (type === 'water_cycle' || /ଜଳ\s*ଚକ୍ର/i.test(reqText)) {
    return ODIA_EDUCATIONAL_FALLBACKS.water_cycle;
  }
  if (type === 'photosynthesis' || (requestedConcepts && requestedConcepts.some(c => c.en === 'photosynthesis' || c.en === 'oxygen'))) {
    return ODIA_EDUCATIONAL_FALLBACKS.photosynthesis;
  }
  if (type === 'evaporation') {
    return ODIA_EDUCATIONAL_FALLBACKS.evaporation;
  }
  if (type === 'sun') {
    return ODIA_EDUCATIONAL_FALLBACKS.sun;
  }
  if (type === 'water_state_change') {
    return ODIA_EDUCATIONAL_FALLBACKS.water_state_change;
  }
  if (type === 'newton_motion') {
    return ODIA_EDUCATIONAL_FALLBACKS.newton_motion;
  }
  return null;
}

/**
 * Extracts requested concepts and structured requirements from an Odia user tutor prompt.
 */
function extractOdiaContentPlan(message = '') {
  const text = String(message || '').trim();
  const topicType = detectTopicType(text);

  let sentenceCount = null;
  const rangeMatch = text.match(/([୧-୯୦-୯\d]+)\s*[–\-—to]+\s*([୧-୯୦-୯\d]+)\s*(?:ଟି|ta)?\s*(?:ବାକ୍ୟ|sentences?)/i);
  if (rangeMatch) {
    const min = odiaToNumber(rangeMatch[1]);
    const max = odiaToNumber(rangeMatch[2]);
    if (min && max) sentenceCount = { min, max };
  } else {
    const singleMatch = text.match(/([୧-୯୦-୯\d]+)\s*(?:ଟି|ta)?\s*(?:ବାକ୍ୟ|sentences?)/i);
    if (singleMatch) {
      const n = odiaToNumber(singleMatch[1]);
      if (n) sentenceCount = { min: n, max: n };
    }
  }

  const requestedConcepts = [];
  const conceptsMap = new Set();

  if (/ସୂର୍ଯ୍ୟାଲୋକ|ସୂର୍ଯ୍ୟଙ୍କ\s*ଆଲୋକ|sunlight/i.test(text)) {
    requestedConcepts.push({
      name: 'ସୂର୍ଯ୍ୟାଲୋକ',
      en: 'sunlight',
      role: 'ପ୍ରାଥମିକ ଶକ୍ତିର ଉତ୍ସ (primary energy source)'
    });
    conceptsMap.add('sunlight');
  }

  if (/ଜଳ|ପାଣି|water/i.test(text) && !/ବାଷ୍ପୀଭବନ/i.test(text)) {
    requestedConcepts.push({
      name: 'ଜଳ',
      en: 'water',
      role: 'ଉଦ୍ଭିଦ ଦ୍ୱାରା ବ୍ୟବହୃତ (used by plants)'
    });
    conceptsMap.add('water');
  }

  if (/ଅଙ୍ଗାରକାମ୍ଳ|carbon\s*dioxide|co2/i.test(text)) {
    requestedConcepts.push({
      name: 'ଅଙ୍ଗାରକାମ୍ଳ',
      en: 'carbon_dioxide',
      role: 'ବାୟୁମଣ୍ଡଳରୁ ଗ୍ରହଣ କରାଯାଏ (absorbed from air)'
    });
    conceptsMap.add('carbon_dioxide');
  }

  if (/ଅମ୍ଳଜାନ|oxygen|o2/i.test(text)) {
    requestedConcepts.push({
      name: 'ଅମ୍ଳଜାନ',
      en: 'oxygen',
      role: 'ବାୟୁମଣ୍ଡଳକୁ ନିର୍ଗତ ଉପ-ଉତ୍ପାଦ (released product)'
    });
    conceptsMap.add('oxygen');
  }

  if (/ବାଷ୍ପୀଭବନ|evaporation/i.test(text)) {
    requestedConcepts.push({
      name: 'ବାଷ୍ପୀଭବନ',
      en: 'evaporation',
      role: 'ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ଜଳ ବାଷ୍ପରେ ପରିଣତ ହେବା (liquid water turning to vapor due to heat)'
    });
    conceptsMap.add('evaporation');
  }

  if (/ସୂର୍ଯ୍ୟ\s*କ['’]?ଣ|sun\b/i.test(text) && !conceptsMap.has('sunlight')) {
    requestedConcepts.push({
      name: 'ସୂର୍ଯ୍ୟ',
      en: 'sun',
      role: 'ସୌରମଣ୍ଡଳର କେନ୍ଦ୍ରସ୍ଥ ନକ୍ଷତ୍ର, ଆଲୋକ ଓ ଉତ୍ତାପର ମୁଖ୍ୟ ଉତ୍ସ (star at center of solar system, source of light and heat)'
    });
    conceptsMap.add('sun');
  }

  return {
    topic: topicType,
    sentenceCount,
    requestedConcepts,
    conceptsMap
  };
}

/**
 * Builds a dedicated natural Odia tutor prompt without JSON formatting constraints.
 */
function buildOdiaTutorPrompt(level = 'beginner', message = '', contentPlan = null, class9Knowledge = null) {
  const plan = contentPlan || extractOdiaContentPlan(message);
  const levelText = level === 'advanced' ? 'ଉଚ୍ଚ ବିଦ୍ୟାଳୟ ଛାତ୍ର' : 'ବିଦ୍ୟାଳୟ ଛାତ୍ର';

  let conceptsSection = '';
  if (plan.requestedConcepts && plan.requestedConcepts.length > 0) {
    conceptsSection = `\nଆବଶ୍ୟକ ଧାରଣା (MANDATORY CONCEPTS TO EXPLAIN):\n${plan.requestedConcepts.map((c, i) => `${i + 1}. ${c.name} (${c.en}): ${c.role}`).join('\n')}\n`;
  }

  let sentenceRule = 'ସଂକ୍ଷିପ୍ତ ଓ ସ୍ପଷ୍ଟ ହୁଅ (୩–୫ଟି ପୂର୍ଣ୍ଣ ବାକ୍ୟ)।';
  if (plan.sentenceCount) {
    sentenceRule = `ଅନୁରୋଧ ଅନୁଯାୟୀ ଠିକ୍ ${plan.sentenceCount.min}–${plan.sentenceCount.max}ଟି ପୂର୍ଣ୍ଣ ବାକ୍ୟରେ ଉତ୍ତର ଦିଅ।`;
  }

  let class9Section = '';
  if (class9Knowledge && Array.isArray(class9Knowledge.verifiedFacts) && class9Knowledge.verifiedFacts.length > 0) {
    const factsList = class9Knowledge.verifiedFacts.map((f, i) => `${i + 1}. ${f}`).join('\n');
    let secFacts = '';
    if (class9Knowledge.secondaryKnowledge && Array.isArray(class9Knowledge.secondaryKnowledge.verifiedFacts)) {
      secFacts = `\nSECONDARY CONTEXT FACTS (${class9Knowledge.secondaryKnowledge.englishName}):\n${class9Knowledge.secondaryKnowledge.verifiedFacts.slice(0, 4).map((f, i) => `${i + 1}. ${f}`).join('\n')}\n`;
    }
    class9Section = `\nVERIFIED CLASS 9 EDUCATIONAL FACTS (MANDATORY):\n${factsList}\n${secFacts}
You are explaining verified educational facts.
Do not introduce new scientific facts.
Do not contradict the supplied facts.
Use simple Odia appropriate for a Class 9 student.
Do not output JSON.
Do not mention the knowledge base.\n`;
  }

  const factualRules = class9Knowledge ? '' : getTopicFactualRules(plan.topic || message, 'Odia');

  return `ତୁମେ StudyBuddy, ଓଡ଼ିଶାର ଜଣେ ଆଦର୍ଶ ଶିକ୍ଷକ (${levelText}ଙ୍କ ପାଇଁ)।

ମୁଖ୍ୟ ନିୟମାବଳୀ (MANDATORY RULES):
1. ସମ୍ପୂର୍ଣ୍ଣ ପ୍ରାକୃତିକ ଓ ସହଜ ଓଡ଼ିଆ ଭାଷାରେ ଉତ୍ତର ଦିଅ।
2. ଛାତ୍ରଟି ସହଜରେ ବୁଝିପାରିବା ଭଳି ସରଳ ଭାଷା ବ୍ୟବହାର କର।
3. କେବଳ ସଠିକ୍ ପାଠ୍ୟପୁସ୍ତକ ବୈଜ୍ଞାନିକ ଶବ୍ଦାବଳୀ ବ୍ୟବହାର କର (ଆଲୋକ ସଂଶ୍ଳେଷଣ, ସୂର୍ଯ୍ୟାଲୋକ, ଅଙ୍ଗାରକାମ୍ଳ, ଅମ୍ଳଜାନ, ଜଳ, ପତ୍ରହରିତ, ହରିତକଣିକା, ବାଷ୍ପୀଭବନ)। କଦାପି "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ" ଭଳି ଭୁଲ ଶବ୍ଦ ବ୍ୟବହାର କରିବ ନାହିଁ।
4. ଛାତ୍ରର ପ୍ରଶ୍ନର ସିଧାସଳଖ ଉତ୍ତର ଦିଅ। ପ୍ରଶ୍ନଟିକୁ ପୁନରାବୃତ୍ତି କରିବ ନାହିଁ।
5. କୌଣସି JSON ଫର୍ମାଟ୍ ବା କୋଡ୍ ବ୍ୟବହାର କର ନାହିଁ। କେବଳ ସାଧାରଣ ଟେକ୍ସଟ୍ (plain text) ରେ ଉତ୍ତର ଲେଖ।
6. ନିଜର ଭିତର ଚିନ୍ତାଧାରା (internal reasoning ବା <think>) ଆଦୌ ଲେଖ ନାହିଁ।
7. ଇଂରାଜୀ ଶବ୍ଦ କେବଳ ଆବଶ୍ୟକ ସ୍ଥଳେ ବନ୍ଧନୀ ମଧ୍ୟରେ ଥରେ ଲେଖିପାରିବ (ଯଥା: ଆଲୋକ ସଂଶ୍ଳେଷଣ (Photosynthesis))।
8. ବାକ୍ୟ ଖଣ୍ଡ (incomplete fragments) ଲେଖ ନାହିଁ; ପ୍ରତ୍ୟେକ ବାକ୍ୟ ଏକ ପୂର୍ଣ୍ଣ ବାକ୍ୟ ହେବା ଉଚିତ।
9. ଗୋଟିଏ ବାକ୍ୟକୁ ବାରମ୍ବାର ଦୋହରାଅ ନାହିଁ।
10. ଅପ୍ରାସଙ୍ଗିକ କଳ୍ପନା କର ନାହିଁ।
11. ପୂର୍ବ କଥୋପକଥନର ପରବର୍ତ୍ତୀ ପ୍ରଶ୍ନ (follow-up question) ହୋଇଥିଲେ କେବଳ ନୂତନ ପ୍ରଶ୍ନର ନିର୍ଦ୍ଦିଷ୍ଟ ଉତ୍ତର ଦିଅ, ପୂର୍ବ ଉତ୍ତରକୁ ଅଯଥା ପୁନରାବୃତ୍ତି କର ନାହିଁ।

ଉତ୍ତର ଗଠନ କ୍ରମ:
୧. ସିଧାସଳଖ ଉତ୍ତର (Direct answer).
୨. ସଂକ୍ଷିପ୍ତ ସରଳ ବୁଝାମଣା (Short explanation).
୩. ପ୍ରଶ୍ନରେ ମଗାଯାଇଥିବା ପ୍ରତ୍ୟେକ ଧାରଣାର ସ୍ପଷ୍ଟ ଭୂମିକା।
୪. ଆବଶ୍ୟକ ସ୍ତର ପୂରଣ ହେବା ମାତ୍ରେ ଲେଖା ବନ୍ଦ କର।

${sentenceRule}
${conceptsSection}
${class9Section}
${factualRules}

କେବଳ ଚୂଡ଼ାନ୍ତ ଉତ୍ତରଟି ସରଳ ଓଡ଼ିଆରେ ଲେଖ:`;
}

const FACTUAL_REPAIR_INSTRUCTIONS = {
  rule1_photosynthesis_night_co2_storage: 'CRITICAL FACT CHECK: Plants do NOT perform photosynthesis at night because sunlight is absent (ସୂର୍ଯ୍ୟାଲୋକ ନ ଥାଏ). Plants do NOT store carbon dioxide at night as the reason. State clearly that sunlight is absent at night.',
  rule1_photosynthesis_oxygen_input: 'CRITICAL FACT CHECK: In photosynthesis, Oxygen (ଅମ୍ଳଜାନ) is NEVER an input. Plants take in Carbon dioxide (ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରନ୍ତି) and release Oxygen (ଅମ୍ଳଜାନ ନିର୍ଗତ କରନ୍ତି).',
  rule1_photosynthesis_oxygen_from_co2: 'CRITICAL FACT CHECK: In photosynthesis, the released oxygen comes from the splitting of water molecules (ଜଳର ବିଭାଜନରୁ ଅମ୍ଳଜାନ ମୁକ୍ତ ହୁଏ), NOT from carbon dioxide (CO2). Carbon dioxide is used to form carbohydrates.',
  rule1_photosynthesis_oxygen_energy_source: 'CRITICAL FACT CHECK: Sunlight (ସୂର୍ଯ୍ୟାଲୋକ) is the energy source for photosynthesis, NOT Oxygen. Oxygen is released as a by-product.',
  rule1_photosynthesis_oxygen_release_missing: 'CRITICAL FACT CHECK: In photosynthesis, Oxygen (ଅମ୍ଳଜାନ) is released (ନିର୍ଗତ ହୁଏ) into the air as a by-product.',
  rule1_photosynthesis_co2_output: 'CRITICAL FACT CHECK: In photosynthesis, Carbon dioxide (ଅଙ୍ଗାରକାମ୍ଳ) is NEVER an output. Plants release Oxygen, not Carbon dioxide.',
  rule1_photosynthesis_water_main_product: 'CRITICAL FACT CHECK: The main product of photosynthesis is food/glucose (ଶ୍ୱେତସାର/ଗ୍ଲୁକୋଜ୍), NOT water.',
  rule1_photosynthesis_sunlight_food: 'CRITICAL FACT CHECK: Sunlight (ସୂର୍ଯ୍ୟାଲୋକ) is an energy source (ଶକ୍ତିର ଉତ୍ସ), NOT food or physical matter absorbed as food.',
  rule1_photosynthesis_night_reason_missing: 'CRITICAL FACT CHECK: State clearly that photosynthesis cannot happen at night due to the absence of sunlight (ସୂର୍ଯ୍ୟାଲୋକର ଅନୁପସ୍ଥିତି).',
  rule2_plant_respiration_night_stop: 'CRITICAL FACT CHECK: Plants respire (ଶ୍ୱସନ) continuously during BOTH day and night (ଦିନ ଓ ରାତି). Respiration does NOT stop at night.',
  rule2_plant_respiration_night_co2_storage: 'CRITICAL FACT CHECK: Plants do NOT store carbon dioxide at night for respiration.',
  rule2_plant_respiration_reversed_gases: 'CRITICAL FACT CHECK: Plant respiration uses Oxygen (ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ) and releases Carbon dioxide (ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରେ). Never reverse.',
  rule3_human_breathing_reversed: 'CRITICAL FACT CHECK: Humans inhale Oxygen (ପ୍ରଶ୍ୱାସରେ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରନ୍ତି) and exhale Carbon dioxide (ନିଃଶ୍ୱାସରେ ଅଙ୍ଗାରକାମ୍ଳ ବାହାର କରନ୍ତି). Never reverse.',
  rule3_human_breathing_missing_or_reversed: 'CRITICAL FACT CHECK: Must clearly specify both gases: inhale Oxygen (ଅମ୍ଳଜାନ ଗ୍ରହଣ) and exhale Carbon dioxide (ଅଙ୍ଗାରକାମ୍ଳ ବାହାର).',
  rule4_water_states_gas_confusion: 'CRITICAL FACT CHECK: Water vapour (ବାଷ୍ପ / ଜଳୀୟ ବାଷ୍ପ) is gaseous water, NOT oxygen or carbon dioxide.',
  rule4_water_heating_produces_wrong_gas: 'CRITICAL FACT CHECK: Heating water turns liquid into water vapour/steam. It does NOT produce oxygen or carbon dioxide.',
  rule4_water_heating_state_change_missing: 'CRITICAL FACT CHECK: Heating water turns liquid water into water vapour / steam (ତରଳରୁ ଜଳୀୟ ବାଷ୍ପ / ଗ୍ୟାସରେ ପରିଣତ ହୁଏ). Explain this state change clearly.',
  rule4_water_states_reversed: 'CRITICAL FACT CHECK: Solid is Ice (ବରଫ), Liquid is Water (ଜଳ), Gas is Water vapour (ବାଷ୍ପ). Never swap them.',
  rule5_evaporation_reversed: 'CRITICAL FACT CHECK: Evaporation (ବାଷ୍ପୀଭବନ) is liquid turning into gas/vapour (ତରଳରୁ ବାଷ୍ପ), NOT gas turning into liquid.',
  rule6_condensation_reversed: 'CRITICAL FACT CHECK: Condensation (ଘନୀଭବନ) is gas/vapour cooling into liquid (ବାଷ୍ପରୁ ତରଳ), NOT liquid turning into gas.',
  rule5_6_evap_cond_difference: 'CRITICAL FACT CHECK: Evaporation is liquid water turning to vapour due to heat (ତରଳରୁ ବାଷ୍ପ). Condensation is vapour cooling into liquid (ବାଷ୍ପରୁ ତରଳ). Explain both accurately.',
  rule7_newton_inertia_confusion: 'CRITICAL FACT CHECK: Newton\'s 1st Law relates to Inertia (ଜଡ଼ତା) and unbalanced external force. Do not confuse with action-reaction (3rd Law).',
  rule8_water_cycle_reversed: 'CRITICAL FACT CHECK: In the water cycle, rain falls from clouds to Earth (precipitation). Preserve natural cycle order.',
  rule10_semantic_contradiction_photosynthesis: 'CRITICAL FACT CHECK: Contradiction detected. In photosynthesis, Oxygen is released, and CO2 is taken in. Only respiration takes in Oxygen and releases CO2.'
};

/**
 * Strong deterministic factual relationship validation layer (Rules 1 - 10).
 * Validates scientific concepts and relationships rather than simple keyword matches.
 */
function validateFactualRelationships(answer = '', request = '', contentPlan = null) {
  if (!answer || typeof answer !== 'string') {
    return { valid: false, reason: 'empty_answer', detail: 'Empty answer text' };
  }
  const clean = answer.trim();
  const plan = contentPlan || extractOdiaContentPlan(request);
  const topic = (plan?.topic || detectTopicType(request || clean)).toLowerCase();
  const reqText = String(request || '').trim().toLowerCase();
  const cleanLower = clean.toLowerCase();
  const combined = `${reqText} ${cleanLower}`;

  // Break answer into individual sentences for contextual analysis
  const sentences = clean
    .split(/[।!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 3);

  // ── RULE 1 & 10: PHOTOSYNTHESIS & CONTRADICTION CHECK ──
  const isPhotosynthesisTopic = topic === 'photosynthesis' || /ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|photosynthesis/i.test(combined);
  const isNightPhotosynthesis = (/ରାତିରେ|ରାତି\s*ସମୟରେ|ଅନ୍ଧାରରେ|at night/i.test(reqText) && isPhotosynthesisTopic) ||
                                (/ରାତିରେ.*ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ.*ରାତିରେ/i.test(cleanLower));

  if (isNightPhotosynthesis) {
    // Reject claiming plants store CO2 at night as the explanation
    const claimsNightCO2Storage = /(?:ଅଙ୍ଗାରକାମ୍ଳ|co2|କାର୍ବନ).*(?:ସଞ୍ଚୟ|ସାଇତି|store|ଜମା)|(?:ସଞ୍ଚୟ|ସାଇତି|store|ଜମା).*(?:ଅଙ୍ଗାରକାମ୍ଳ|co2)/i.test(cleanLower);
    if (claimsNightCO2Storage) {
      return {
        valid: false,
        reason: 'factual_error_photosynthesis_night_co2_storage',
        failedFactRule: 'rule1_photosynthesis_night_co2_storage',
        detail: 'Rejected: claims plants store carbon dioxide at night as reason for stopping photosynthesis.'
      };
    }
    // If the prompt asked why plants don't do photosynthesis at night:
    const asksWhyNight = /କାହିଁକି|why/i.test(reqText);
    if (asksWhyNight) {
      const mentionsSunlightAbsent = /(?:ସୂର୍ଯ୍ୟାଲୋକ|ସୂର୍ଯ୍ୟଙ୍କ\s*ଆଲୋକ|ଆଲୋକ|sunlight).*(?:ନ\s*ଥାଏ|ନ\s*ଥିବା|ଅନୁପସ୍ଥିତି|ନ\s*ମିଳିବା|ବିନା|absence|lack|not present|ଅଭାବ)/i.test(cleanLower) ||
                                     /(?:ରାତିରେ|ଅନ୍ଧାରରେ).*(?:ସୂର୍ଯ୍ୟାଲୋକ|ଆଲୋକ).*(?:ନ\s*ଥାଏ|ନ\s*ଥିବା|ଅଭାବ|ଅନୁପସ୍ଥିତି)/i.test(cleanLower);
      if (!mentionsSunlightAbsent) {
        return {
          valid: false,
          reason: 'factual_error_photosynthesis_night_reason_missing',
          failedFactRule: 'rule1_photosynthesis_night_reason_missing',
          detail: 'Must explain that photosynthesis cannot happen at night due to lack of sunlight (ସୂର୍ଯ୍ୟାଲୋକର ଅନୁପସ୍ଥିତି).'
        };
      }
    }
  }

  if (isPhotosynthesisTopic) {
    // 1. Sunlight absorbed as food / matter
    if (/(?:ସୂର୍ଯ୍ୟାଲୋକ|ସୂର୍ଯ୍ୟଙ୍କ\s*ଆଲୋକ).*(?:ଖାଦ୍ୟ\s*ଭାବରେ|ପଦାର୍ଥ\s*ଭାବରେ|ଖାଦ୍ୟ\s*ରୂପେ\s*ଶୋଷଣ)|(?:ଖାଦ୍ୟ\s*ଭାବରେ|ଖାଦ୍ୟ\s*ରୂପେ).*(?:ସୂର୍ଯ୍ୟାଲୋକ|ସୂର୍ଯ୍ୟଙ୍କ\s*ଆଲୋକ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'factual_error_sunlight_food',
        failedFactRule: 'rule1_photosynthesis_sunlight_food',
        detail: 'Sunlight is an energy source, not food or physical matter absorbed by plants.'
      };
    }

    // 2. Water described as main product
    if (/(?:ଜଳ|ପାଣି).*(?:ମୁଖ୍ୟ\s*ଉତ୍ପାଦ|ପ୍ରମୁଖ\s*ଉତ୍ପାଦ)|(?:ମୁଖ୍ୟ\s*ଉତ୍ପାଦ|ପ୍ରମୁଖ\s*ଉତ୍ପାଦ).*(?:ଜଳ|ପାଣି)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'factual_error_water_main_product',
        failedFactRule: 'rule1_photosynthesis_water_main_product',
        detail: 'Water is an input for photosynthesis, not the main produced output.'
      };
    }

    // 3. Sentence-level contradiction analysis (Rule 1 & Rule 10)
    for (const sentence of sentences) {
      const sentLower = sentence.toLowerCase();
      const hasRespiration = /ଶ୍ୱସନ|respiration/i.test(sentLower);

      // If the sentence does NOT describe respiration:
      if (!hasRespiration) {
        // Oxygen intake:
        const o2IntakeLinked = /ଅମ୍ଳଜାନ\s*(?:ଗ୍ୟାସ\s*)?(?:ଗ୍ରହଣ|ନିଏ|ନିଅନ୍ତି|ବ୍ୟବହାର\s*କରେ|ବ୍ୟବହାର\s*କରି|ଆବଶ୍ୟକ|ଶୋଷଣ)|(?:ଗ୍ରହଣ\s*କରେ|ଗ୍ରହଣ\s*କରନ୍ତି|ନିଏ|ନିଅନ୍ତି|ଶୋଷଣ\s*କରେ)\s*(?:ହେଉଛି\s*)?ଅମ୍ଳଜାନ/i.test(sentLower);
        const o2IntakeNegated = /ଅମ୍ଳଜାନ.*(?:ଗ୍ରହଣ\s*କରେ\s*ନାହିଁ|ନିଏ\s*ନାହିଁ|ନିଅନ୍ତି\s*ନାହିଁ|ଆବଶ୍ୟକ\s*ହୁଏ\s*ନାହିଁ)|(?:ଗ୍ରହଣ\s*କରେ\s*ନାହିଁ|ନିଏ\s*ନାହିଁ).*ଅମ୍ଳଜାନ/i.test(sentLower);
        if (o2IntakeLinked && !o2IntakeNegated) {
          return {
            valid: false,
            reason: 'factual_error_oxygen_input',
            failedFactRule: 'rule1_photosynthesis_oxygen_input',
            detail: `Contradiction: Oxygen described as input for photosynthesis without respiration context: "${sentence}"`
          };
        }

        // CO2 output:
        const co2OutputLinked = /ଅଙ୍ଗାରକାମ୍ଳ\s*(?:ଗ୍ୟାସ\s*)?(?:ନିର୍ଗତ|ତ୍ୟାଗ|ବାହାର\s*କରେ|ବାହାରିଥାଏ|ଉତ୍ପାଦ)|(?:ନିର୍ଗତ\s*ହୁଏ|ତ୍ୟାଗ\s*କରେ|ବାହାର\s*କରେ)\s*(?:ହେଉଛି\s*)?ଅଙ୍ଗାରକାମ୍ଳ/i.test(sentLower);
        const co2OutputNegated = /ଅଙ୍ଗାରକାମ୍ଳ.*(?:ନିର୍ଗତ\s*ହୁଏ\s*ନାହିଁ|ତ୍ୟାଗ\s*କରେ\s*ନାହିଁ|ବାହାର\s*କରେ\s*ନାହିଁ)|(?:ନିର୍ଗତ\s*ହୁଏ\s*ନାହିଁ|ତ୍ୟାଗ\s*କରେ\s*ନାହିଁ).*ଅଙ୍ଗାରକାମ୍ଳ/i.test(sentLower);
        if (co2OutputLinked && !co2OutputNegated) {
          return {
            valid: false,
            reason: 'factual_error_co2_output',
            failedFactRule: 'rule1_photosynthesis_co2_output',
            detail: `Contradiction: Carbon dioxide described as output of photosynthesis without respiration context: "${sentence}"`
          };
        }

        // Oxygen from CO2 misconception:
        const claimsO2FromCO2 = /(?:ଅମ୍ଳଜାନ|oxygen)\s*(?:ଗ୍ୟାସ\s*)?(?:co2|co₂|ଅଙ୍ଗାରକାମ୍ଳ|କାର୍ବନ\s*ଡାଇଅକ୍ସାଇଡ)[^।]*?(?:ରୁ|ଦ୍ୱାରା)\s*(?:ଆସେ|ମିଳେ|ନିର୍ଗତ|ମୁକ୍ତ|ବାହାରେ|ଉତ୍ପନ୍ନ|ସୃଷ୍ଟି)|(?:co2|co₂|ଅଙ୍ଗାରକାମ୍ଳ|କାର୍ବନ\s*ଡାଇଅକ୍ସାଇଡ)[^।]*?(?:ରୁ|ଦ୍ୱାରା)\s*(?:ଅମ୍ଳଜାନ|oxygen)[^।]*?(?:ଆସେ|ମିଳେ|ନିର୍ଗତ|ମୁକ୍ତ|ବାହାରେ|ଉତ୍ପନ୍ନ|ସୃଷ୍ଟି)/i.test(sentLower);
        const o2FromCO2Negated = /(?:co2|co₂|ଅଙ୍ଗାରକାମ୍ଳ)[^।]*?(?:ରୁ\s*ନୁହେଁ|ରୁ\s*ଆସେ\s*ନାହିଁ|ରୁ\s*ମିଳେ\s*ନାହିଁ|ରୁ\s*ନିର୍ଗତ\s*ହୁଏ\s*ନାହିଁ|ରୁ\s*ମୁକ୍ତ\s*ହୁଏ\s*ନାହିଁ)|(?:ନାହିଁ|ନୁହେଁ)[^।]*?(?:co2|co₂|ଅଙ୍ଗାରକାମ୍ଳ)/i.test(sentLower);
        if (claimsO2FromCO2 && !o2FromCO2Negated) {
          return {
            valid: false,
            reason: 'factual_error_oxygen_from_co2',
            failedFactRule: 'rule1_photosynthesis_oxygen_from_co2',
            detail: `Contradiction: Oxygen claimed to come from carbon dioxide in photosynthesis: "${sentence}"`
          };
        }
      }
    }
  }

  // ── RULE 2: PLANT RESPIRATION ──
  const isPlantRespirationContext = topic === 'plant_respiration' ||
    (/(?:ଉଦ୍ଭିଦ|ଗଛ|plants?).*(?:ଶ୍ୱସନ|respiration)|(?:ଶ୍ୱସନ|respiration).*(?:ଉଦ୍ଭିଦ|ଗଛ|plants?)/i.test(combined));

  if (isPlantRespirationContext) {
    // 1. Claim plants stop respiration at night
    if (/(?:ରାତିରେ|ଅନ୍ଧାରରେ|night).*(?:ଶ୍ୱସନ).*(?:ବନ୍ଦ|କରନ୍ତି\s*ନାହିଁ|ରୋକିଦିଅନ୍ତି|stop)|(?:ଶ୍ୱସନ).*(?:ରାତିରେ\s*ବନ୍ଦ|ରାତିରେ\s*କରନ୍ତି\s*ନାହିଁ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'factual_error_plant_respiration_night_stop',
        failedFactRule: 'rule2_plant_respiration_night_stop',
        detail: 'Rejected: claims plants stop respiration at night. Plants respire continuously day and night.'
      };
    }

    // 2. Claim plants store CO2 at night as explanation for respiration/photosynthesis
    if (/ରାତିରେ.*ଅଙ୍ଗାରକାମ୍ଳ.*(?:ସଞ୍ଚୟ|ସାଇତି)|(?:ସଞ୍ଚୟ|ସାଇତି).*ଅଙ୍ଗାରକାମ୍ଳ/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'factual_error_plant_respiration_night_co2_storage',
        failedFactRule: 'rule2_plant_respiration_night_co2_storage',
        detail: 'Rejected: claims plants store carbon dioxide at night.'
      };
    }

    // 3. Reversed gases in plant respiration
    for (const sentence of sentences) {
      const sentLower = sentence.toLowerCase();
      if (/ଶ୍ୱସନ|respiration/i.test(sentLower)) {
        if (/ଅଙ୍ଗାରକାମ୍ଳ\s*(?:ଗ୍ୟାସ\s*)?(?:ଗ୍ରହଣ|ନିଏ|ବ୍ୟବହାର\s*କରେ)|(?:ଗ୍ରହଣ\s*କରେ|ନିଏ|ବ୍ୟବହାର\s*କରେ)\s*ଅଙ୍ଗାରକାମ୍ଳ|ଅମ୍ଳଜାନ\s*(?:ଗ୍ୟାସ\s*)?(?:ନିର୍ଗତ|ତ୍ୟାଗ|ବାହାର\s*କରେ|ଛାଡ଼)|(?:ନିର୍ଗତ\s*ହୁଏ|ତ୍ୟାଗ\s*କରେ|ବାହାର\s*କରେ)\s*ଅମ୍ଳଜାନ/i.test(sentLower)) {
          return {
            valid: false,
            reason: 'factual_error_plant_respiration_reversed_gases',
            failedFactRule: 'rule2_plant_respiration_reversed_gases',
            detail: 'Plant respiration uses oxygen and releases carbon dioxide; cannot be reversed.'
          };
        }
      }
    }
  }

  // ── RULE 3: HUMAN BREATHING ──
  const isHumanBreathingContext = topic === 'human_breathing' ||
    (/(?:ମଣିଷ|ମାନବ|humans?|people).*(?:ଶ୍ୱାସ|ପ୍ରଶ୍ୱାସ|ନିଃଶ୍ୱାସ|breathing)|ଶ୍ୱାସ\s*ନେବା/i.test(combined));

  if (isHumanBreathingContext) {
    // 1. Reversal: Carbon dioxide inhaled / taken in
    if (/ଅଙ୍ଗାରକାମ୍ଳ\s*(?:ଗ୍ୟାସ\s*)?(?:ଗ୍ରହଣ\s*କରେ|ଗ୍ରହଣ\s*କରନ୍ତି|ନିଏ|ନିଅନ୍ତି|ପ୍ରଶ୍ୱାସରେ\s*ନିଏ)|(?:ଗ୍ରହଣ\s*କରେ|ଗ୍ରହଣ\s*କରନ୍ତି|ପ୍ରଶ୍ୱାସରେ\s*ନିଏ)\s*ଅଙ୍ଗାରକାମ୍ଳ/i.test(cleanLower)) {
      if (!/ଅଙ୍ଗାରକାମ୍ଳ\s*ଗ୍ରହଣ\s*କରେ\s*ନାହିଁ|ଅଙ୍ଗାରକାମ୍ଳ\s*ନିଏ\s*ନାହିଁ/i.test(cleanLower)) {
        return {
          valid: false,
          reason: 'factual_error_breathing_co2_inhaled',
          failedFactRule: 'rule3_human_breathing_reversed',
          detail: 'Reversed relationship: humans inhale oxygen, not carbon dioxide.'
        };
      }
    }

    // 2. Reversal: Oxygen exhaled / released
    if (/ଅମ୍ଳଜାନ\s*(?:ଗ୍ୟାସ\s*)?(?:ତ୍ୟାଗ\s*କରେ|ତ୍ୟାଗ\s*କରନ୍ତି|ନିଃଶ୍ୱାସରେ\s*ବାହାର|ବାହାର\s*କରେ|ଛାଡ଼େ)|(?:ତ୍ୟାଗ\s*କରେ|ନିଃଶ୍ୱାସରେ\s*ବାହାର\s*କରେ|ଛାଡ଼େ)\s*ଅମ୍ଳଜାନ/i.test(cleanLower)) {
      if (!/ଅମ୍ଳଜାନ\s*ତ୍ୟାଗ\s*କରେ\s*ନାହିଁ|ଅମ୍ଳଜାନ\s*ବାହାର\s*କରେ\s*ନାହିଁ/i.test(cleanLower)) {
        return {
          valid: false,
          reason: 'factual_error_breathing_oxygen_exhaled',
          failedFactRule: 'rule3_human_breathing_reversed',
          detail: 'Reversed relationship: humans exhale carbon dioxide, not oxygen.'
        };
      }
    }

    // 3. Direct question checking both gases (Case B)
    const asksBothGases = /କେଉଁ\s*ଗ୍ୟାସ\s*ଗ୍ରହଣ.*କେଉଁ\s*ଗ୍ୟାସ\s*ବାହାର|କେଉଁ\s*ଗ୍ୟାସ.*ଗ୍ରହଣ.*ବାହାର/i.test(reqText);
    if (asksBothGases) {
      const hasO2In = /ଅମ୍ଳଜାନ.*(?:ଗ୍ରହଣ|ନିଏ|ପ୍ରଶ୍ୱାସ)|(?:ଗ୍ରହଣ|ପ୍ରଶ୍ୱାସ).*ଅମ୍ଳଜାନ/i.test(cleanLower);
      const hasCO2Out = /ଅଙ୍ଗାରକାମ୍ଳ.*(?:ବାହାର|ତ୍ୟାଗ|ଛାଡ଼େ|ନିଃଶ୍ୱାସ)|(?:ବାହାର|ତ୍ୟାଗ|ନିଃଶ୍ୱାସ).*ଅଙ୍ଗାରକାମ୍ଳ/i.test(cleanLower);
      if (!hasO2In || !hasCO2Out) {
        return {
          valid: false,
          reason: 'factual_error_breathing_both_gases_required',
          failedFactRule: 'rule3_human_breathing_missing_or_reversed',
          detail: 'Must state oxygen is taken in (ଗ୍ରହଣ) and carbon dioxide is expelled (ବାହାର କରେ).'
        };
      }
    }
  }

  // ── RULE 4: WATER STATES & HEATING ──
  const isWaterStatesContext = topic === 'water_states' || topic === 'water_state_change' ||
    /ଜଳର\s*ଅବସ୍ଥା|ପାଣିର\s*ଅବସ୍ଥା|ତିନୋଟି\s*ଅବସ୍ଥା|ପାଣିକୁ\s*ଗରମ|ଜଳକୁ\s*ଗରମ|water\s*states/i.test(combined);

  if (isWaterStatesContext) {
    // Water vapour described as oxygen or carbon dioxide
    if (/(?:ବାଷ୍ପ|ଜଳୀୟ\s*ବାଷ୍ପ).*(?:ହେଉଛି|ଅଟେ|ଭାବରେ)\s*(?:ଅମ୍ଳଜାନ|ଅଙ୍ଗାରକାମ୍ଳ)|(?:ଅମ୍ଳଜାନ|ଅଙ୍ଗାରକାମ୍ଳ).*(?:ହେଉଛି|ଅଟେ)\s*(?:ବାଷ୍ପ|ଜଳୀୟ\s*ବାଷ୍ପ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'factual_error_vapour_gas_confusion',
        failedFactRule: 'rule4_water_states_gas_confusion',
        detail: 'Water vapour is gaseous water, not oxygen or carbon dioxide.'
      };
    }

    // Heating water described as producing oxygen or carbon dioxide
    if (/(?:ପାଣି|ଜଳ).*(?:ଗରମ|ଉତ୍ତାପ).*(?:ଅମ୍ଳଜାନ|ଅଙ୍ଗାରକାମ୍ଳ)\s*(?:ସୃଷ୍ଟି|ନିର୍ଗତ|ବାହାର|ଉତ୍ପନ୍ନ)|(?:ଗରମ|ଉତ୍ତାପ).*(?:ପାଣି|ଜଳ).*(?:ଅମ୍ଳଜାନ|ଅଙ୍ଗାରକାମ୍ଳ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'factual_error_water_heating_wrong_gas',
        failedFactRule: 'rule4_water_heating_produces_wrong_gas',
        detail: 'Heating water does not produce oxygen or carbon dioxide; it produces water vapour.'
      };
    }

    // Direct 3-states question validation if asked
    if (/ତିନୋଟି\s*ଅବସ୍ଥା|୩ଟି\s*ଅବସ୍ଥା|three\s*states/i.test(reqText)) {
      if (/ବରଫ\s*(?:ହେଉଛି|ଅଟେ|ଏକ)?\s*(?:ଗ୍ୟାସ|ବାଷ୍ପ)|ଗ୍ୟାସ\s*(?:ହେଉଛି|ଅଟେ)\s*ବରଫ|(?:ବାଷ୍ପ|ଜଳୀୟ\s*ବାଷ୍ପ)\s*(?:ହେଉଛି|ଅଟେ|ଏକ)?\s*କଠିନ|କଠିନ\s*(?:ହେଉଛି|ଅଟେ)\s*(?:ବାଷ୍ପ|ଜଳୀୟ\s*ବାଷ୍ପ)/i.test(cleanLower)) {
        return {
          valid: false,
          reason: 'factual_error_water_states_reversed',
          failedFactRule: 'rule4_water_states_reversed',
          detail: 'Reversed states of water: solid is ice, liquid is water, gas is water vapour.'
        };
      }
    }
  }

  // ── RULE 5 & 6: EVAPORATION & CONDENSATION ──
  const isEvaporationCondensationContext = topic === 'evaporation_condensation' || topic === 'evaporation' || topic === 'condensation' ||
    /ବାଷ୍ପୀଭବନ|ଘନୀଭବନ|evaporation|condensation/i.test(combined);

  if (isEvaporationCondensationContext) {
    for (const sentence of sentences) {
      const sentLower = sentence.toLowerCase();
      // Evaporation check:
      if (/ବାଷ୍ପୀଭବନ|evaporation/i.test(sentLower) && !/ଘନୀଭବନ/i.test(sentLower)) {
        if (/(?:ବାଷ୍ପ(?!ୀଭବନ)|ଜଳୀୟ\s*ବାଷ୍ପ|ଗ୍ୟାସ)[^।]*?(?:ତରଳ|ଜଳ(?!ୀୟ)|ପାଣି)[^।]*?(?:ପରିଣତ|ହେବାକୁ|କୁହାଯାଏ)/i.test(sentLower)) {
          return {
            valid: false,
            reason: 'factual_error_evaporation_reversed',
            failedFactRule: 'rule5_evaporation_reversed',
            detail: 'Evaporation is liquid turning into gas/vapour, not gas turning into liquid.'
          };
        }
      }
      // Condensation check:
      if (/ଘନୀଭବନ|condensation/i.test(sentLower) && !/ବାଷ୍ପୀଭବନ/i.test(sentLower)) {
        if (/(?:ତରଳ|ଜଳ(?!ୀୟ)|ପାଣି)[^।]*?(?:ବାଷ୍ପ(?!ୀଭବନ)|ଜଳୀୟ\s*ବାଷ୍ପ|ଗ୍ୟାସ)[^।]*?(?:ପରିଣତ|ହେବାକୁ|କୁହାଯାଏ)/i.test(sentLower)) {
          return {
            valid: false,
            reason: 'factual_error_condensation_reversed',
            failedFactRule: 'rule6_condensation_reversed',
            detail: 'Condensation is gas/vapour turning into liquid, not liquid turning into gas.'
          };
        }
      }
    }

    // Case D: differential question "ବାଷ୍ପୀଭବନ ଏବଂ ଘନୀଭବନ ମଧ୍ୟରେ ପାର୍ଥକ୍ୟ କ'ଣ?"
    const isDiffQuestion = /ବାଷ୍ପୀଭବନ.*ଘନୀଭବନ.*ପାର୍ଥକ୍ୟ|ପାର୍ଥକ୍ୟ.*ବାଷ୍ପୀଭବନ.*ଘନୀଭବନ/i.test(reqText);
    if (isDiffQuestion) {
      const evapCorrect = /ବାଷ୍ପୀଭବନ.*(?:ତରଳ.*(?:ବାଷ୍ପ|ଗ୍ୟାସ)|ଜଳ.*ବାଷ୍ପ)|(?:ତରଳ.*(?:ବାଷ୍ପ|ଗ୍ୟାସ)).*ବାଷ୍ପୀଭବନ/i.test(cleanLower);
      const condCorrect = /ଘନୀଭବନ.*(?:ବାଷ୍ପ.*(?:ତରଳ|ଜଳ)|ଗ୍ୟାସ.*(?:ତରଳ|ଜଳ))|(?:ବାଷ୍ପ.*(?:ତରଳ|ଜଳ)).*ଘନୀଭବନ/i.test(cleanLower);
      if (!evapCorrect || !condCorrect) {
        return {
          valid: false,
          reason: 'factual_error_evap_cond_difference_invalid',
          failedFactRule: 'rule5_6_evap_cond_difference',
          detail: 'Must correctly explain evaporation (liquid to gas) and condensation (gas to liquid).'
        };
      }
    }
  }

  // ── RULE 7: INERTIA (NEWTON'S FIRST LAW) ──
  const isInertiaContext = topic === 'newton_motion' || /ଜଡ଼ତା|inertia|ନ୍ୟୁଟନ.*ପ୍ରଥମ|newton.*first/i.test(combined);
  if (isInertiaContext) {
    if (/କ୍ରିୟା.*ପ୍ରତିକ୍ରିୟା|action.*reaction/i.test(cleanLower) && !/ତୃତୀୟ|third/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'factual_error_inertia_newton3_confusion',
        failedFactRule: 'rule7_newton_inertia_confusion',
        detail: "Newton's First Law relates to Inertia, not Action and Reaction."
      };
    }
  }

  // ── RULE 8: RAINFALL / WATER CYCLE ──
  const isWaterCycleContext = topic === 'water_cycle' || /ଜଳ\s*ଚକ୍ର|water\s*cycle/i.test(combined);
  if (isWaterCycleContext) {
    if (/ବର୍ଷା.*(?:ପୃଥିବୀରୁ\s*ମେଘ|ଭୂପୃଷ୍ଠରୁ\s*ମେଘ|ଉପରକୁ\s*ଯାଏ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'factual_error_water_cycle_reversed',
        failedFactRule: 'rule8_water_cycle_reversed',
        detail: 'Rain falls from clouds to Earth; water cycle direction cannot be reversed.'
      };
    }
  }

  return { valid: true };
}

/**
 * Builds compact repair prompt for single-shot targeted repair (no conversation history).
 */
function buildOdiaRepairPrompt(rawReply = '', message = '', contentPlan = null, validationIssue = null, class9Knowledge = null) {
  const reqConcepts = contentPlan?.requestedConcepts || [];
  const conceptsList = reqConcepts.length > 0
    ? `Must explain each concept:\n${reqConcepts.map((c, i) => `${i + 1}. ${c.name} — ${c.role}`).join('\n')}`
    : `Must accurately answer: "${message}"`;

  const sentenceReq = contentPlan?.sentenceCount
    ? `exactly ${contentPlan.sentenceCount.min}–${contentPlan.sentenceCount.max} complete sentences`
    : '3–5 complete sentences';

  const failedRule = validationIssue?.failedFactRule;
  const factualCorrection = (failedRule && FACTUAL_REPAIR_INSTRUCTIONS[failedRule])
    ? `\n${FACTUAL_REPAIR_INSTRUCTIONS[failedRule]}\n`
    : '';

  // Topic-specific canonical terminology section (never blindly inject all terms)
  const topicKey = class9Knowledge?.id || contentPlan?.topic || '';
  const isPhotosynthesis = topicKey === 'photosynthesis' || /photosynthesis|ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|ଉଦ୍ଭିଦ\s*ସଂଶ୍ଲେ|chlorophyll|chloroplast|stomata|ପତ୍ରରନ୍ଧ୍ର|ପତ୍ରହରିତ|ହରିତକଣିକା/i.test(`${message} ${rawReply} ${topicKey}`);

  let terminologySection = '';
  if (isPhotosynthesis) {
    terminologySection = `\nCANONICAL SCIENTIFIC TERMINOLOGY (MANDATORY):
photosynthesis = ଆଲୋକ ସଂଶ୍ଳେଷଣ
sunlight = ସୂର୍ଯ୍ୟାଲୋକ
chloroplast = ହରିତକଣିକା
chlorophyll = ପତ୍ରହରିତ
oxygen = ଅମ୍ଳଜାନ
carbon dioxide = ଅଙ୍ଗାରକାମ୍ଳ
stomata = ପତ୍ରରନ୍ଧ୍ର

Use these canonical Odia terms exactly.
Do not use English transliterations such as stomata.
Do not invent alternate Odia terminology.\n`;
  } else if (class9Knowledge?.terminology && Array.isArray(class9Knowledge.terminology) && class9Knowledge.terminology.length > 0) {
    const termLines = class9Knowledge.terminology.map(t => `${t.english || t.concept} = ${t.canonical}`).join('\n');
    terminologySection = `\nCANONICAL SCIENTIFIC TERMINOLOGY (MANDATORY):
${termLines}

Use these canonical Odia terms exactly.
Do not use English transliterations.
Do not invent alternate Odia terminology.\n`;
  }

  let class9Section = '';
  if (class9Knowledge && Array.isArray(class9Knowledge.verifiedFacts) && class9Knowledge.verifiedFacts.length > 0) {
    const factsList = class9Knowledge.verifiedFacts.map((f, i) => `${i + 1}. ${f}`).join('\n');
    class9Section = `\nVERIFIED CLASS 9 EDUCATIONAL FACTS (MANDATORY):\n${factsList}\n
You are explaining verified educational facts.
Do not introduce new scientific facts.
Do not contradict the supplied facts.
Use simple Odia appropriate for a Class 9 student.
Do not output JSON.
Do not mention the knowledge base.\n`;
  }

  return `Rewrite the answer in natural, simple Odia.

Topic: ${class9Knowledge?.englishName || contentPlan?.topic || message}

${conceptsList}
${terminologySection}
${class9Section}
${factualCorrection}
Requirements:
- ${sentenceReq}
- simple student-friendly Odia
- use canonical textbook scientific terms exactly as listed above
- no unrelated information
- do not repeat the question
- do not use English transliterations like "ଷ୍ଟୋମାଟା" (use "ପତ୍ରରନ୍ଧ୍ର")
- do not use corrupted scientific terminology like "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ" (use "ଆଲୋକ ସଂଶ୍ଳେଷଣ")
- plain text only, no JSON, no markdown code fences, no internal thinking

Reason for rewrite: ${validationIssue?.detail || validationIssue?.reason || 'Answer quality check failed'}

Return ONLY the final plain-text answer in Odia:`;
}

/**
 * Validates Odia tutor answer quality, factual accuracy, terminology, and structural completeness.
 */
function validateOdiaTutorAnswer(answer, request = '', contentPlan = null) {
  if (!answer || typeof answer !== 'string') {
    return { valid: false, reason: 'empty_answer', detail: 'Empty answer text' };
  }
  const clean = answer.trim();
  if (clean.length < 15) {
    return { valid: false, reason: 'answer_too_short', detail: 'Answer is too short' };
  }

  // Safe fallback / apology responses are valid safety boundaries
  if (/ଏହି\s*ପ୍ରଶ୍ନର\s*ନିଶ୍ଚିତ\s*ଉତ୍ତର\s*ଦେବାରେ\s*ମୋତେ\s*ଅସୁବିଧା\s*ହେଉଛି/i.test(clean)) {
    return { valid: true, isSafeFallback: true };
  }

  // A. Language
  const odiaChars = clean.match(/[\u0b00-\u0b7f]/g) || [];
  if (odiaChars.length < 10) {
    return { valid: false, reason: 'insufficient_odia', detail: 'Answer lacks sufficient Odia script' };
  }
  if (clean.startsWith('{') || clean.includes('"mode":') || clean.includes('"intro":') || clean.includes('"answer":')) {
    return { valid: false, reason: 'raw_json_output', detail: 'Answer contains raw JSON formatting' };
  }
  if (/<think>|<\/think>|\[LLM\]|\[Diagnostic/i.test(clean)) {
    return { valid: false, reason: 'internal_metadata_leaked', detail: 'Answer leaked internal metadata' };
  }
  const strippedParentheses = clean.replace(/\([A-Za-z0-9\s,.-]+\)/g, '');
  const latinChars = strippedParentheses.match(/[a-zA-Z]/g) || [];
  if (latinChars.length > odiaChars.length) {
    return { valid: false, reason: 'excessive_english', detail: 'Answer is dominated by English text' };
  }

  // B. Structure
  const sentences = clean
    .split(/[।!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  if (sentences.length < 1) {
    return { valid: false, reason: 'no_complete_sentences', detail: 'No complete sentences found' };
  }

  const seenSentences = new Set();
  for (const s of sentences) {
    if (seenSentences.has(s)) {
      return { valid: false, reason: 'repeated_sentence', detail: `Repeated sentence: "${s}"` };
    }
    seenSentences.add(s);
  }

  const plan = contentPlan || extractOdiaContentPlan(request);

  if (plan.sentenceCount) {
    const { min, max } = plan.sentenceCount;
    if (sentences.length < Math.max(2, min - 1) || sentences.length > (max + 2)) {
      return { valid: false, reason: 'sentence_count_mismatch', detail: `Requested ${min}-${max} sentences, got ${sentences.length}` };
    }
  }

  // C. Terminology check
  if (/ଉଦ୍ଭିଦ\s*ସଂଶ୍ଲେଷଣ|ଉଦ୍ଭିଦ\s*ସଂଶ୍ଳେଷଣ/i.test(clean)) {
    return { valid: false, reason: 'corrupted_terminology', failedFactRule: 'canonical_terminology_violation', detail: 'Used corrupted term "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ" instead of canonical "ଆଲୋକ ସଂଶ୍ଳେଷଣ"' };
  }
  if (/ଷ୍ଟୋମାଟା/i.test(clean)) {
    return { valid: false, reason: 'corrupted_terminology', failedFactRule: 'canonical_terminology_violation', detail: 'Used transliteration "ଷ୍ଟୋମାଟା" instead of canonical "ପତ୍ରରନ୍ଧ୍ର"' };
  }

  // D. Comprehensive Deterministic Factual Validation (Rules 1 - 10)
  const factualValidation = validateFactualRelationships(clean, request, plan);
  if (!factualValidation.valid) {
    return factualValidation;
  }

  // E. Relevance & Requested Concepts Presence
  if (plan.topic === 'photosynthesis') {
    if (!/ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ/i.test(clean)) {
      return { valid: false, reason: 'missing_main_topic', detail: 'Must mention photosynthesis (ଆଲୋକ ସଂଶ୍ଳେଷଣ)' };
    }

    if (plan.conceptsMap?.has('sunlight')) {
      const hasSun = /ସୂର୍ଯ୍ୟାଲୋକ|ସୂର୍ଯ୍ୟଙ୍କ\s*ଆଲୋକ|ସୂର୍ଯ୍ୟ/i.test(clean);
      const hasEnergy = /ଶକ୍ତି|ଆଲୋକ/i.test(clean);
      if (!hasSun || !hasEnergy) {
        return { valid: false, reason: 'missing_concept_sunlight', detail: 'Must explain sunlight as energy source' };
      }
    }

    if (plan.conceptsMap?.has('water')) {
      const hasWater = /ଜଳ|ପାଣି/i.test(clean);
      const hasWaterRole = /ବ୍ୟବହାର|ଆବଶ୍ୟକ|ନିଏ|ମାଟି|ଚେର|ଶୋଷଣ/i.test(clean);
      if (!hasWater || !hasWaterRole) {
        return { valid: false, reason: 'missing_concept_water', detail: 'Must explain water being used by the plant' };
      }
    }

    if (plan.conceptsMap?.has('carbon_dioxide')) {
      const hasCO2 = /ଅଙ୍ଗାରକାମ୍ଳ/i.test(clean);
      const hasCO2Role = /ଗ୍ରହଣ|ନିଏ|ନିଅନ୍ତି|ବାୟୁ|ଆବଶ୍ୟକ|ବ୍ୟବହାର/i.test(clean);
      if (!hasCO2 || !hasCO2Role) {
        return { valid: false, reason: 'missing_concept_co2', detail: 'Must explain carbon dioxide being taken in by the plant' };
      }
    }

    if (plan.conceptsMap?.has('oxygen')) {
      const hasO2 = /ଅମ୍ଳଜାନ/i.test(clean);
      const hasO2Role = /ନିର୍ଗତ|ଛାଡ଼|ତ୍ୟାଗ|ଉପ-ଉତ୍ପାଦ|ବାହାର|ସୃଷ୍ଟି|ଉତ୍ପନ୍ନ|ଜଳ|ପାଣି|ଆସେ|ଉତ୍ସ/i.test(clean);
      if (!hasO2 || !hasO2Role) {
        return { valid: false, reason: 'missing_concept_oxygen', detail: 'Must explain oxygen being released/produced' };
      }
    }
  }

  if (plan.topic === 'evaporation') {
    const mentionsEvap = /ବାଷ୍ପୀଭବନ|ବାଷ୍ପ/i.test(clean);
    const mentionsHeatWater = (/ଉତ୍ତାପ|ଗରମ|ସୂର୍ଯ୍ୟ/i.test(clean) && /ଜଳ|ପାଣି|ତରଳ/i.test(clean)) || /ବାଷ୍ପରେ\s*ପରିଣତ/i.test(clean);
    if (!mentionsEvap || !mentionsHeatWater) {
      return { valid: false, reason: 'missing_evaporation_concept', detail: 'Must explain evaporation of water due to heat' };
    }
  }

  if (plan.topic === 'sun') {
    const mentionsSun = /ସୂର୍ଯ୍ୟ/i.test(clean);
    const mentionsStarOrLight = /ନକ୍ଷତ୍ର|ଆଲୋକ|ଶକ୍ତି|ଉତ୍ତାପ|ତାରା|କେନ୍ଦ୍ର/i.test(clean);
    if (!mentionsSun || !mentionsStarOrLight) {
      return { valid: false, reason: 'missing_sun_concept', detail: 'Must explain the Sun as a star/source of light and heat' };
    }
  }

  return { valid: true };
}

/**
 * Deterministic factual & educational quality verification for quiz questions.
 * Checks known science rules (photosynthesis inputs/outputs, Newton's 1st law, etc.),
 * verifies non-repetitive explanations, distinct distractors, and catches corrupted vocabulary.
 */
function validateQuizFactualCorrectness(questions, topic = '') {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, reason: 'no_questions' };
  }

  const corruptedVocab = CORRUPTED_ODIA_VOCAB;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || typeof q !== 'object') {
      return { valid: false, reason: 'invalid_question_object', index: i };
    }

    const qText = String(q.question || '').trim();
    const explanation = String(q.explanation || '').trim();
    const answer = String(q.answer || '').trim();
    const options = Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [];

    if (qText.length < 5) {
      return { valid: false, reason: 'question_too_short', index: i };
    }

    // Sentence fragment rejection (Odia questions must be complete sentences)
    if (containsOdiaScript(qText) && !isCompleteOdiaQuestion(qText)) {
      return {
        valid: false,
        reason: 'sentence_fragment',
        index: i,
        detail: `Question "${qText}" appears to be an incomplete sentence fragment or missing interrogative structure.`
      };
    }

    // 1. Options quality check: exactly 4 unique options
    if (options.length !== 4) {
      return { valid: false, reason: 'options_count_not_four', index: i, count: options.length };
    }
    const cleanOptions = options.map(o => stripOptionPrefix(o).toLowerCase());
    const uniqueOptions = new Set(cleanOptions);
    if (uniqueOptions.size < 4) {
      return { valid: false, reason: 'duplicate_options', index: i };
    }

    // 2. Corrupted vocabulary check
    for (const { bad, replacement } of corruptedVocab) {
      if (bad.test(qText) || options.some(o => bad.test(o)) || bad.test(explanation)) {
        return { valid: false, reason: 'corrupted_vocabulary', index: i, replacement };
      }
    }

    // 3. Explanation quality: must not merely echo the question or answer
    const qClean = qText.replace(/^[0-9.?।\s]+|[?।\s]+$/g, '').trim().toLowerCase();
    const expClean = explanation.replace(/^[0-9.?।\s]+|[?।\s]+$/g, '').trim().toLowerCase();
    const ansClean = stripOptionPrefix(answer).toLowerCase();

    if (explanation.length < 5) {
      return { valid: false, reason: 'explanation_too_short', index: i };
    }

    if (expClean === qClean || expClean === ansClean) {
      return { valid: false, reason: 'explanation_echoes_question_or_answer', index: i };
    }

    // 4. Deterministic Factual Checks:
    const qLower = qText.toLowerCase();
    const ansLower = answer.toLowerCase();
    const expLower = explanation.toLowerCase();

    // Check 4G: Topic Drift & Water Heating State Change
    const topicType = detectTopicType(topic);
    if (topicType === 'water_state_change') {
      const combined = `${qLower} ${ansLower} ${expLower}`;
      if (/photosynthesis|ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|ଉଦ୍ଭିଦ\s*ସଂଶ୍ଲେ|ପତ୍ରହରିତ|ହରିତକଣିକା|ପତ୍ରରନ୍ଧ୍ର|ଜାଇଲେମ|ଫ୍ଲୋଏମ/i.test(combined)) {
        return {
          valid: false,
          reason: 'topic_drift_photosynthesis',
          index: i,
          detail: 'Question drifted to photosynthesis or plant biology when requested topic is water heating and state change.'
        };
      }
      if (/ଅମ୍ଳଜାନ\s*ସୃଷ୍ଟି|ଅଙ୍ଗାରକାମ୍ଳ\s*ଗ୍ରହଣ/i.test(combined)) {
        return {
          valid: false,
          reason: 'topic_drift_photosynthesis',
          index: i,
          detail: 'Question drifted to plant gas exchange when topic is water heating.'
        };
      }
      const asksHeatingChange = (/ଗରମ|heat|boil/i.test(qLower) || /ଗରମ|heat|boil/i.test(topic.toLowerCase())) &&
                                (/ଅବସ୍ଥା|state|ପରିବର୍ତ୍ତନ|change|ପରିଣତ/i.test(qLower) || /ଅବସ୍ଥା|state/i.test(topic.toLowerCase()));
      if (asksHeatingChange) {
        const answerRepresentsSteam = /ବାଷ୍ପ|ଜଳୀୟ\s*ବାଷ୍ପ|ବାଷ୍ପୀୟ|ଗ୍ୟାସ|ଗ୍ୟାସୀୟ|vapor|steam|gas/i.test(ansLower);
        if (!answerRepresentsSteam) {
          return {
            valid: false,
            reason: 'factual_error_water_heating_state',
            index: i,
            detail: 'Heating water turns it into water vapor / steam (ବାଷ୍ପ / ଜଳୀୟ ବାଷ୍ପ), not solid or ice.'
          };
        }
      }
    }

    // Check 4A: Photosynthesis gas release / output
    // If asking what gas is released/given out in photosynthesis:
    const isPhotosynthesisRelease =
      (qLower.includes('photosynthesis') || qLower.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ') || qLower.includes('ଖାଦ୍ୟ ପ୍ରସ୍ତୁତି')) &&
      (qLower.includes('release') || qLower.includes('gives out') || qLower.includes('ନିର୍ଗତ') || qLower.includes('ତ୍ୟାଗ') || qLower.includes('ବାହାରେ') || qLower.includes('ଉତ୍ପାଦ'));

    if (isPhotosynthesisRelease) {
      // Must NOT be Carbon dioxide (CO2 / ଅଙ୍ଗାରକାମ୍ଳ)
      if (ansLower.includes('carbon dioxide') || ansLower.includes('co2') || ansLower.includes('ଅଙ୍ଗାରକାମ୍ଳ')) {
        return { valid: false, reason: 'factual_error_photosynthesis_release_co2', index: i, detail: 'Plants release oxygen, not carbon dioxide during photosynthesis.' };
      }
      // If Oxygen option exists, answer must be Oxygen
      const hasOxygenOption = options.some(o => /ଅମ୍ଳଜାନ|oxygen|o2/i.test(o));
      if (hasOxygenOption && !(ansLower.includes('ଅମ୍ଳଜାନ') || ansLower.includes('oxygen') || ansLower.includes('o2'))) {
        return { valid: false, reason: 'factual_error_photosynthesis_release_not_oxygen', index: i, detail: 'Correct answer for gas released in photosynthesis must be Oxygen.' };
      }
    }

    // Check 4B: Photosynthesis gas intake / input
    // If asking what gas is absorbed/taken in/required:
    const isPhotosynthesisIntake =
      (qLower.includes('photosynthesis') || qLower.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ') || qLower.includes('ଖାଦ୍ୟ ପ୍ରସ୍ତୁତି')) &&
      (qLower.includes('gas') || qLower.includes('ଗ୍ୟାସ')) &&
      (qLower.includes('take') || qLower.includes('absorb') || qLower.includes('require') || qLower.includes('ଗ୍ରହଣ') || qLower.includes('ଆବଶ୍ୟକ') || qLower.includes('ବ୍ୟବହାର'));

    if (isPhotosynthesisIntake && !isPhotosynthesisRelease) {
      // Must NOT be Oxygen (O2 / ଅମ୍ଳଜାନ)
      if (ansLower.includes('oxygen') || ansLower.includes('o2') || ansLower.includes('ଅମ୍ଳଜାନ')) {
        return { valid: false, reason: 'factual_error_photosynthesis_intake_oxygen', index: i, detail: 'Plants take in carbon dioxide, not oxygen for photosynthesis.' };
      }
      // If CO2 option exists, answer must be CO2
      const hasCO2Option = options.some(o => /ଅଙ୍ଗାରକାମ୍ଳ|carbon dioxide|co2/i.test(o));
      if (hasCO2Option && !(ansLower.includes('ଅଙ୍ଗାରକାମ୍ଳ') || ansLower.includes('carbon dioxide') || ansLower.includes('co2'))) {
        return { valid: false, reason: 'factual_error_photosynthesis_intake_not_co2', index: i, detail: 'Correct answer for gas taken in for photosynthesis must be Carbon dioxide.' };
      }
    }

    // Check 4C: Newton's First Law / Inertia
    const isNewtonFirstLaw =
      (qLower.includes('newton') || qLower.includes('ନ୍ୟୁଟନ')) &&
      (qLower.includes('first') || qLower.includes('1st') || qLower.includes('ପ୍ରଥମ'));

    if (isNewtonFirstLaw) {
      if (ansLower.includes('action-reaction') || ansLower.includes('କ୍ରିୟା-ପ୍ରତିକ୍ରିୟା')) {
        return { valid: false, reason: 'factual_error_newton_law_confusion', index: i, detail: "Newton's First Law relates to Inertia, not Action-Reaction." };
      }
    }

    // Check 4D: Stomata vs Water Transport (Stomata do NOT transport water; Xylem does)
    const stomataMentioned = /stomata|ପତ୍ରରନ୍ଧ୍ର/i.test(ansLower) || /stomata|ପତ୍ରରନ୍ଧ୍ର/i.test(qLower);
    const waterTransportMentioned = (/water|ଜଳ/i.test(qLower) || /water|ଜଳ/i.test(ansLower)) &&
                                   (/transport|ପରିବହନ/i.test(qLower) || /transport|ପରିବହନ/i.test(ansLower) || /transport|ପରିବହନ/i.test(expLower));
    if (stomataMentioned && waterTransportMentioned && (/stomata|ପତ୍ରରନ୍ଧ୍ର/i.test(ansLower) || /ପତ୍ରରନ୍ଧ୍ର.*ଜଳ|stomata.*water/i.test(`${qLower} ${expLower}`))) {
      return { valid: false, reason: 'factual_error_stomata_water_transport', index: i, detail: 'Stomata are pores involved in gas exchange; they do NOT transport water. Xylem transports water.' };
    }

    // Check 4E: Xylem vs Carbon Dioxide (Xylem transports water/minerals, NOT carbon dioxide)
    const xylemMentioned = /xylem|ଜାଇଲେମ/i.test(ansLower) || /xylem|ଜାଇଲେମ/i.test(qLower);
    const co2TransportMentioned = (/carbon dioxide|co2|ଅଙ୍ଗାରକାମ୍ଳ/i.test(qLower) || /carbon dioxide|co2|ଅଙ୍ଗାରକାମ୍ଳ/i.test(ansLower)) &&
                                  (/transport|ପରିବହନ/i.test(qLower) || /transport|ପରିବହନ/i.test(ansLower) || /transport|ପରିବହନ/i.test(expLower));
    if (xylemMentioned && co2TransportMentioned && (/xylem|ଜାଇଲେମ/i.test(ansLower) || /ଜାଇଲେମ.*ଅଙ୍ଗାରକାମ୍ଳ|xylem.*carbon dioxide/i.test(`${qLower} ${expLower}`))) {
      return { valid: false, reason: 'factual_error_xylem_co2_transport', index: i, detail: 'Xylem transports water and minerals from roots; it does NOT transport carbon dioxide.' };
    }

    // Check 4F: Chloroplast as source of oxygen (Oxygen comes from water photolysis; Chloroplast is the site/organelle)
    const asksOxygenSource = (/ଅମ୍ଳଜାନ|oxygen/i.test(qLower) || /ଅମ୍ଳଜାନ|oxygen/i.test(ansLower)) &&
                             (/ଉତ୍ପନ୍ନ|ଉତ୍ପାଦନ|source|origin|ଉତ୍ସ|କାହାରୁ|କେଉଁଥିରୁ/i.test(qLower) || /ଉତ୍ପନ୍ନ|ଉତ୍ପାଦନ/i.test(expLower));
    const answersChloroplast = /chloroplast|ହରିତକଣିକା/i.test(ansLower) || /ହରିତକଣିକାରୁ ଅମ୍ଳଜାନ|chloroplast.*source.*oxygen/i.test(`${qLower} ${expLower}`);
    if (asksOxygenSource && answersChloroplast) {
      return { valid: false, reason: 'factual_error_chloroplast_oxygen_source', index: i, detail: 'Chloroplast is the organelle site of photosynthesis; it is not the substance source of oxygen. Oxygen is produced from the splitting of water.' };
    }
  }

  return { valid: true };
}

/**
 * Creates a structured topic coverage plan dividing the topic into distinct concepts.
 * Handles Photosynthesis, Motion/Newton's Laws, Water Cycle, and general school subjects.
 * Transparently broadens narrow topics if needed to support the requested count.
 */
function getTopicCoveragePlan(topic = '', count = 3, language = 'English') {
  const isOd = isOdia(language) || containsOdiaScript(topic);
  const topicLower = topic.toLowerCase();
  const n = Math.max(1, parseInt(count, 10) || 3);

  let concepts = [];
  let isBroadened = false;
  let broadeningNote = null;

  const topicType = detectTopicType(topic);

  // 1. Water Heating / State Change
  if (topicType === 'water_state_change') {
    concepts = [
      {
        id: 'water_heating_state_change',
        nameEn: 'State change of water when heated (liquid to water vapor / steam)',
        nameOd: 'ପାଣିକୁ ଗରମ କଲେ ତରଳରୁ ବାଷ୍ପ ବା ଜଳୀୟ ବାଷ୍ପରେ ଅବସ୍ଥା ପରିବର୍ତ୍ତନ'
      },
      {
        id: 'boiling_point',
        nameEn: 'Boiling point of water (100°C)',
        nameOd: 'ଜଳର ସ୍ଫୁଟନାଙ୍କ (୧୦୦°C)'
      },
      {
        id: 'evaporation_vs_boiling',
        nameEn: 'Evaporation and steam formation',
        nameOd: 'ବାଷ୍ପୀଭବନ ଓ ବାଷ୍ପ ସୃଷ୍ଟି'
      }
    ];
  } else if (topicLower.includes('photosynthesis') || topicLower.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ') || topicLower.includes('ଖାଦ୍ୟ ପ୍ରସ୍ତୁତି')) {
    concepts = [
      {
        id: 'sunlight',
        nameEn: 'Sunlight as primary energy source for photosynthesis',
        nameOd: 'ସୂର୍ଯ୍ୟାଲୋକ ଶକ୍ତିର ଉତ୍ସ (ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ପ୍ରାଥମିକ ଶକ୍ତିର ଉତ୍ସ)'
      },
      {
        id: 'co2_requirement',
        nameEn: 'Carbon dioxide requirement (gas absorbed/taken in from air for photosynthesis)',
        nameOd: 'ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ (ବାୟୁମଣ୍ଡଳରୁ ଗ୍ରହଣ କରାଯାଉଥିବା ଆବଶ୍ୟକୀୟ ଗ୍ୟାସ)'
      },
      {
        id: 'stomata',
        nameEn: 'Stomata (leaf pores for gas exchange: CO2 in, O2 out)',
        nameOd: 'ପତ୍ରରନ୍ଧ୍ର ଦ୍ୱାରା ଗ୍ୟାସ ବିନିମୟ (ପତ୍ରରେ ଥିବା କ୍ଷୁଦ୍ର ରନ୍ଧ୍ର ଯାହା ଦେଇ ଗ୍ୟାସ ବିନିମୟ ହୁଏ)'
      },
      {
        id: 'oxygen_release',
        nameEn: 'Oxygen release (by-product gas released into air during photosynthesis)',
        nameOd: 'ଅମ୍ଳଜାନ ନିର୍ଗମନ (ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ବାୟୁମଣ୍ଡଳକୁ ନିର୍ଗତ ଉପ-ଉତ୍ପାଦ ଗ୍ୟାସ)'
      },
      {
        id: 'chlorophyll',
        nameEn: 'Chlorophyll (green pigment that absorbs light energy)',
        nameOd: 'ପତ୍ରହରିତ (ସୌର ଆଲୋକ ଶୋଷଣ କରୁଥିବା ସବୁଜ ବର୍ଣ୍ଣକଣିକା)'
      },
      {
        id: 'water_transport',
        nameEn: 'Water and mineral transport from roots via xylem tissue',
        nameOd: 'ଜାଇଲେମ ଦ୍ୱାରା ଚେରରୁ ଜଳ ଓ ଖଣିଜ ଲବଣ ପରିବହନ'
      },
      {
        id: 'stored_food',
        nameEn: 'Glucose formation and starch storage as stored food',
        nameOd: 'ଶ୍ୱେତସାର ସଞ୍ଚୟ (ପ୍ରସ୍ତୁତ ଖାଦ୍ୟ ଗ୍ଲୁକୋଜରୁ ଶ୍ୱେତସାରରେ ସଞ୍ଚିତ ହେବା)'
      },
      {
        id: 'leaves_site',
        nameEn: 'Role of leaves & chloroplasts (food factory and site of photosynthesis)',
        nameOd: 'ପତ୍ର ଓ ହରିତକଣିକା (ଉଦ୍ଭିଦର ଖାଦ୍ୟ ପ୍ରସ୍ତୁତି କେନ୍ଦ୍ର ବା କାରଖାନା)'
      }
    ];
  } else if (topicLower.includes('first law') || topicLower.includes('1st law') || topicLower.includes('inertia') || topicLower.includes('ପ୍ରଥମ ଗତି') || topicLower.includes('ଜଡ଼ତା')) {
    concepts = [
      { id: 'rest_vs_motion', nameEn: "Fundamental statement of Newton's First Law (state of rest or uniform motion)", nameOd: "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ନିୟମର ମୂଳ ସୂତ୍ର (ସ୍ଥିର ଅବସ୍ଥା ବା ସମଗତି)" },
      { id: 'inertia_newton1', nameEn: "Inertia as resistance to change in motion and relation to mass", nameOd: "ଜଡ଼ତା: ଗତି ପରିବର୍ତ୍ତନର ପ୍ରତିରୋଧ ଓ ବସ୍ତୁତ୍ୱ ସହ ସମ୍ପର୍କ" },
      { id: 'inertia_real_world', nameEn: "Everyday manifestations of inertia (passengers lurching when car stops)", nameOd: "ଜଡ଼ତାର ବାସ୍ତବ ଉଦାହରଣ (ଗାଡ଼ି ଅଟକିଲେ ଯାତ୍ରୀ ଆଗକୁ ଝୁଙ୍କିବା)" },
      { id: 'net_force_zero', nameEn: "Zero net external force implies zero acceleration and constant velocity", nameOd: "ନିଟ୍ ବାହ୍ୟ ବଳ ଶୂନ ହେଲେ ତ୍ୱରଣ ଶୂନ ଓ ବେଗ ଅପରିବର୍ତ୍ତିତ" },
      { id: 'safety_inertia', nameEn: "Vehicle safety applications of Newton's First Law (seatbelts and airbags)", nameOd: "ଯାନବାହାନ ସୁରକ୍ଷା ଉପକରଣରେ ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ନିୟମ (ସିଟବେଲ୍ଟ ଓ ଏୟାରବ୍ୟାଗ)" }
    ];
  } else if (topicLower.includes('newton') || topicLower.includes('ନ୍ୟୁଟନ') || topicLower.includes('motion') || topicLower.includes('ଗତି') || topicLower.includes('force') || topicLower.includes('ବଳ')) {
    concepts = [
      { id: 'inertia_newton1', nameEn: "Newton's 1st Law and concept of Inertia", nameOd: "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ ଓ ଜଡ଼ତା ଧାରଣା" },
      { id: 'rest_vs_motion', nameEn: "State of rest vs uniform motion in a straight line", nameOd: "ସ୍ଥିର ଅବସ୍ଥା ବନାମ ସରଳ ରୈଖିକ ସମଗତି" },
      { id: 'external_force', nameEn: "Unbalanced external force causing change in motion", nameOd: "ଅସନ୍ତୁଳିତ ବାହ୍ୟ ବଳ ଓ ଗତିର ପରିବର୍ତ୍ତନ" },
      { id: 'friction_gravity', nameEn: "Frictional and gravitational resistance", nameOd: "ଘର୍ଷଣ ବଳ ଏବଂ ମାଧ୍ୟାକର୍ଷଣ ବଳ" },
      { id: 'momentum_newton2', nameEn: "Momentum and rate of change of momentum (2nd Law)", nameOd: "ସଂବେଗ ଏବଂ ନ୍ୟୁଟନଙ୍କ ଦ୍ୱିତୀୟ ନିୟମ" },
      { id: 'action_reaction', nameEn: "Action and Reaction pairs (3rd Law)", nameOd: "କ୍ରିୟା ଏବଂ ପ୍ରତିକ୍ରିୟା ଯୋଡ଼ି (ତୃତୀୟ ନିୟମ)" }
    ];
  } else if (topicLower.includes('water cycle') || topicLower.includes('ଜଳ ଚକ୍ର')) {
    concepts = [
      { id: 'evaporation', nameEn: 'Evaporation of water by solar heat', nameOd: 'ସୂର୍ଯ୍ୟଙ୍କ ଉତ୍ତାପ ଯୋଗୁଁ ଜଳର ବାଷ୍ପୀଭବନ' },
      { id: 'condensation', nameEn: 'Condensation of water vapor into clouds', nameOd: 'ବାଷ୍ପ ଘନୀଭୂତ ହୋଇ ମେଘ ସୃଷ୍ଟି (ଘନୀଭବନ)' },
      { id: 'precipitation', nameEn: 'Precipitation (rain/snow) returning water to Earth', nameOd: 'ବର୍ଷା ଆକାରରେ ଭୂପୃଷ୍ଠକୁ ଜଳ ପ୍ରତ୍ୟାବର୍ତ୍ତନ (ଅବକ୍ଷେପଣ)' },
      { id: 'transpiration', nameEn: 'Plant transpiration contributing to atmospheric moisture', nameOd: 'ଉଦ୍ଭିଦ ଦ୍ୱାରା ଉତ୍ସ୍ୱେଦନ ପ୍ରକ୍ରିୟା' },
      { id: 'groundwater', nameEn: 'Collection, infiltration and groundwater recharge', nameOd: 'ଜଳ ସଂଗ୍ରହ ଓ ଭୂତଳ ଜଳ ପୁନର୍ଭରଣ' }
    ];
  } else if (topicLower.includes('galaxy') || topicLower.includes('galaxies') || topicLower.includes('ଛାୟାପଥ') || topicLower.includes('ଆକାଶଗଙ୍ଗା')) {
    concepts = [
      {
        id: 'galaxy_definition',
        nameEn: 'Definition and structure of a galaxy (vast collection of stars, gas, and dust bound by gravity)',
        nameOd: 'ଛାୟାପଥର ସଂଜ୍ଞା ଓ ସ୍ୱରୂପ (କୋଟି କୋଟି ନକ୍ଷତ୍ର, ଗ୍ୟାସ ଓ ଧୂଳିକଣାର ବିରାଟ ସମୂହ)'
      },
      {
        id: 'gravitational_binding',
        nameEn: 'Gravitational force holding galaxies and stars together',
        nameOd: 'ଛାୟାପଥକୁ ଏକତ୍ର ବାନ୍ଧି ରଖୁଥିବା ମାଧ୍ୟାକର୍ଷଣ ବଳ'
      },
      {
        id: 'galaxy_components_examples',
        nameEn: 'Galaxy examples and components (Milky Way, Andromeda, spiral galaxies)',
        nameOd: 'ଛାୟାପଥର ଉଦାହରଣ (ଆକାଶଗଙ୍ଗା / ମିଲ୍କି ୱେ ଏବଂ ଆଣ୍ଡ୍ରୋମେଡା)'
      },
      {
        id: 'galaxy_types_structure',
        nameEn: 'Types and shapes of galaxies (spiral, elliptical, and irregular)',
        nameOd: 'ଛାୟାପଥର ପ୍ରକାରଭେଦ (କୁଣ୍ଡଳୀୟ, ଅଣ୍ଡାକାର ଓ ଅନିୟମିତ)'
      },
      {
        id: 'solar_system_location',
        nameEn: 'Location of our Solar System within the Milky Way galaxy',
        nameOd: 'ଆକାଶଗଙ୍ଗାରେ ଆମ ସୌରମଣ୍ଡଳର ଅବସ୍ଥିତି'
      }
    ];
  } else if (topicLower.includes('respirat') || topicLower.includes('ଶ୍ୱାସକ୍ରିୟା') || topicLower.includes('ଶ୍ୱାସତନ୍ତ୍ର') || topicLower.includes('lungs') || topicLower.includes('breathing')) {
    concepts = [
      {
        id: 'respiratory_system_function',
        nameEn: 'Primary fundamental function of the human respiratory system (gas exchange: taking in oxygen and expelling carbon dioxide)',
        nameOd: 'ମାନବ ଶ୍ୱାସତନ୍ତ୍ରର ମୁଖ୍ୟ କାର୍ଯ୍ୟ (ଗ୍ୟାସ ବିନିମୟ: ଅମ୍ଳଜାନ ଗ୍ରହଣ ଓ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ)'
      },
      {
        id: 'gas_exchange_structure',
        nameEn: 'Alveoli and lung structures responsible for actual gas exchange between air and blood',
        nameOd: 'ଫୁସଫୁସରେ ଗ୍ୟାସ ବିନିମୟ ପାଇଁ ଉଦ୍ଦିଷ୍ଟ କୂପିକା (Alveoli) ର ଭୂମିକା'
      },
      {
        id: 'respiration_during_exercise',
        nameEn: 'Regulation of breathing rate and oxygen demand during intense physical exercise',
        nameOd: 'ବ୍ୟାୟାମ ସମୟରେ ଶ୍ୱାସକ୍ରିୟା ହାର ବୃଦ୍ଧି ଏବଂ ଅମ୍ଳଜାନର ଚାହିଦା'
      },
      {
        id: 'carbon_monoxide_transport',
        nameEn: 'Impact of carbon monoxide on hemoglobin and oxygen transport efficiency',
        nameOd: 'କାର୍ବନ ମନୋକ୍ସାଇଡ ଯୋଗୁଁ ହିମୋଗ୍ଲୋବିନ ଓ ଅମ୍ଳଜାନ ପରିବହନରେ ବାଧା'
      },
      {
        id: 'breathing_mechanism_diaphragm',
        nameEn: 'Mechanism of inhalation, exhalation, and the role of the diaphragm',
        nameOd: 'ପ୍ରଶ୍ୱାସ-ନିଃଶ୍ୱାସ ପ୍ରକ୍ରିୟା ଏବଂ ମଧ୍ୟଚ୍ଛଦା (Diaphragm) ର ଭୂମିକା'
      }
    ];
  } else {
    // General curriculum fallback
    concepts = [
      { id: 'definition_core', nameEn: `Basic definition and fundamental principle of ${topic}`, nameOd: `${topic} ର ମୌଳିକ ସଂଜ୍ଞା ଓ ଧାରଣା` },
      { id: 'key_components', nameEn: `Key components and working mechanism of ${topic}`, nameOd: `${topic} ର ମୁଖ୍ୟ ଉପାଦାନ ଓ କାର୍ଯ୍ୟପଦ୍ଧତି` },
      { id: 'real_world_examples', nameEn: `Real-world examples and everyday applications of ${topic}`, nameOd: `${topic} ର ବାସ୍ତବ ଉଦାହରଣ ଓ ଦୈନନ୍ଦିନ ପ୍ରୟୋଗ` },
      { id: 'cause_effect', nameEn: `Causes, scientific effects, and relationships in ${topic}`, nameOd: `${topic} ର କାରଣ ଏବଂ ବୈଜ୍ଞାନିକ ପ୍ରଭାବ` },
      { id: 'importance_impact', nameEn: `Environmental/scientific importance of ${topic}`, nameOd: `${topic} ର ବୈଜ୍ଞାନିକ ତଥା ପରିବେଶୀୟ ମହତ୍ତ୍ୱ` }
    ];
  }

  // Handle narrow topic condition: if requested count > available concepts
  if (n > concepts.length) {
    isBroadened = true;
    broadeningNote = isOd
      ? `ପ୍ରସଙ୍ଗ '${topic}' ରେ ଅନୁରୋଧିତ ${n} ଟି ପ୍ରଶ୍ନ ପାଇଁ ସମ୍ପର୍କିତ ଉପ-ବିଷୟଗୁଡ଼ିକୁ ବିସ୍ତାର କରାଗଲା।`
      : `Topic '${topic}' was broadened to related curriculum subtopics to provide ${n} distinct concepts.`;
  }

  const selectedConcepts = concepts.slice(0, Math.min(n, concepts.length));

  return {
    topic,
    requestedCount: n,
    plannedCount: selectedConcepts.length,
    broadened: isBroadened,
    broadeningNote,
    concepts: selectedConcepts.map((c, i) => ({
      index: i + 1,
      id: c.id,
      description: isOd ? c.nameOd : c.nameEn
    }))
  };
}

/**
 * Classifies a question into a distinct educational concept ID.
 * Distinguishes top-level topic from tested subskill/concept.
 * Supports metadata tags (q.concept / q.skill) and falls back to cognitive intent + answer fingerprint.
 */
function classifyQuestionConcept(q, topic = '') {
  if (!q || typeof q !== 'object') return 'unknown_concept';

  // 0. Explicit concept / subskill metadata from question object
  if (q.concept && typeof q.concept === 'string' && q.concept.trim().length > 1) {
    let c = q.concept.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (c === 'galaxy_classification') c = 'galaxy_types_structure';
    if (c === 'galaxy_examples' || c === 'galaxy_example') c = 'galaxy_components_examples';
    return c;
  }
  if (q.skill && typeof q.skill === 'string' && q.skill.trim().length > 1) {
    let s = q.skill.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (s === 'galaxy_classification') s = 'galaxy_types_structure';
    if (s === 'galaxy_examples' || s === 'galaxy_example') s = 'galaxy_components_examples';
    return s;
  }

  let ans = '';
  if (typeof q.answer === 'number' && Array.isArray(q.options) && q.options[q.answer] !== undefined) {
    ans = String(q.options[q.answer]).toLowerCase();
  } else if (q.answer !== undefined && q.answer !== null) {
    ans = String(q.answer).toLowerCase();
    // If answer is a numeric index ("0", "1", "2", "3")
    if (/^[0-3]$/.test(ans.trim()) && Array.isArray(q.options) && q.options[parseInt(ans.trim(), 10)] !== undefined) {
      ans = String(q.options[parseInt(ans.trim(), 10)]).toLowerCase();
    } else if (/^[a-d][).\s]*$/i.test(ans.trim()) && Array.isArray(q.options)) {
      const letter = ans.trim().charAt(0).toUpperCase();
      const opt = q.options.find(o => String(o).trim().toUpperCase().startsWith(letter));
      if (opt) ans = String(opt).toLowerCase();
    }
  }
  const qText = String(q.question || '').toLowerCase();
  const text = `${qText} ${ans} ${q.explanation || ''}`.toLowerCase();
  const normTopic = normalizeQuizTopic(topic);
  const cleanAnsText = stripOptionPrefix(ans).trim().toLowerCase();

  // 1. Astrophysics / Galaxies domain (evaluated before general motion to avoid friction_gravity collision)
  const isGalaxyTopic = /galaxy|galaxies|ଛାୟାପଥ|ଆକାଶଗଙ୍ଗା/i.test(topic) ||
                        /galaxy|galaxies|ଛାୟାପଥ|ଆକାଶଗଙ୍ଗା/i.test(normTopic) ||
                        /galaxy|galaxies|ଛାୟାପଥ|ଆକାଶଗଙ୍ଗା/i.test(text);

  if (isGalaxyTopic) {
    // 1a. Gravitational binding: check if force / binding is asked or gravity is the target answer
    const isGravityAnswer = /^(?:gravity|gravitational force|force of gravity|ମାଧ୍ୟାକର୍ଷଣ|ମାଧ୍ୟାକର୍ଷଣ ବଳ)$/i.test(cleanAnsText) ||
                           (/gravity|gravitational|ମାଧ୍ୟାକର୍ଷଣ/i.test(cleanAnsText) && !/collection|system|stars|gas|dust|ସମୂହ/i.test(cleanAnsText));
    if (isGravityAnswer || /hold.*together|keeps?.*together|bound.*by|force.*keeps|holding the stars|କେଉଁ ବଳ|ବାନ୍ଧି\s*ରଖ|ଧରି\s*ରଖ|ଆବଦ୍ଧ/i.test(qText)) {
      return 'gravitational_binding';
    }

    // 1b. Solar System location in relation to Milky Way / Galaxy (Must precede general Milky Way example check)
    if (/solar system|sun.*located|earth.*galaxy|where is our solar system|location.*milky way|relation to the milky way|ସୌରମଣ୍ଡଳ/i.test(text)) {
      return 'solar_system_location';
    }

    // 1c. Types / Shapes / Classification of galaxies (spiral, elliptical, irregular)
    // Inspected on question stem or answer list to avoid false matches from incidental words in explanations
    if (/classification|classified|shape|shapes|morphological|types of galax|standard classification|ପ୍ରକାରଭେଦ|ଆକୃତି/i.test(qText) ||
        /^(?:[a-d][).\s]+)?(?:spiral|elliptical|irregular|କୁଣ୍ଡଳୀୟ|ଅଣ୍ଡାକାର|ଅନିୟମିତ)/i.test(cleanAnsText)) {
      return 'galaxy_types_structure';
    }

    // 1d. Examples of galaxies (Andromeda, Milky Way as an example rather than solar system host)
    if (/example|examples|prominent example|which.*(?:is|are|pairs).*(?:a\s+)?galax|andromeda|ଆଣ୍ଡ୍ରୋମେଡା/i.test(qText) ||
        (/andromeda|ଆଣ୍ଡ୍ରୋମେଡା|milky way|ଆକାଶଗଙ୍ଗା/i.test(cleanAnsText) && !/solar system|earth|sun/i.test(qText)) ||
        (/andromeda|ଆଣ୍ଡ୍ରୋମେଡା/i.test(text))) {
      return 'galaxy_components_examples';
    }

    // 1e. Definition and fundamental structure of a galaxy
    if (/what is (?:a\s+)?galaxy|define.*galaxy|definition.*galaxy|structure of (?:a\s+)?galaxy|fundamental structure|ଛାୟାପଥ କ[’']?ଣ|ଛାୟାପଥ କାହାକୁ କୁହାଯାଏ|ଛାୟାପଥର ସଂଜ୍ଞା|ଛାୟାପଥର ସ୍ୱରୂପ/i.test(qText)) {
      return 'galaxy_definition';
    }
    if (/definition|define|vast collection|collection of stars|stars.*gas.*dust|ସଂଜ୍ଞା/i.test(text) || (/galaxy|ଛାୟାପଥ/i.test(cleanAnsText) && /stars|gas|dust|system/i.test(text))) {
      return 'galaxy_definition';
    }
  }

  // 2. Photosynthesis: Target answer and question inspection
  const isPhotosynthesisTopic = /photosynthesis|ଆଲୋକ ସଂଶ୍ଳେଷଣ|chloroplast|ହରିତକଣ/i.test(topic) ||
                               /photosynthesis|ଆଲୋକ ସଂଶ୍ଳେଷଣ/i.test(normTopic) ||
                               /photosynthesis|ଆଲୋକ ସଂଶ୍ଳେଷଣ|chloroplast|stomata|ପତ୍ରରନ୍ଧ୍ର|ପତ୍ରହରିତ/i.test(text);

  if (isPhotosynthesisTopic) {
    if (/oxygen|ଅମ୍ଳଜାନ/i.test(ans)) return 'oxygen_release';
    if (/sunlight|ସୂର୍ଯ୍ୟାଲୋକ/i.test(ans)) return 'sunlight';
    if (/chlorophyll|ପତ୍ରହରିତ|କ୍ଲୋରୋଫିଲ|ହରିତକଣ(?!ିକା)/i.test(ans)) return 'chlorophyll';
    if (/stomata|ପତ୍ରରନ୍ଧ୍ର/i.test(ans)) return 'stomata';
    if (/xylem|ଜାଇଲେମ/i.test(ans)) return 'water_transport';
    if (/phloem|ଫ୍ଲୋଏମ/i.test(ans)) return 'phloem_transport';
    if (/starch|ଶ୍ୱେତସାର|glucose|ଗ୍ଲୁକୋଜ୍/i.test(ans)) return 'stored_food';
    if (/carbon dioxide|co2|ଅଙ୍ଗାରକାମ୍ଳ|କାର୍ବନ ଡାଇଅକ୍ସାଇଡ/i.test(ans)) return 'co2_requirement';
    if (/water|ଜଳ/i.test(ans) && (/transport|ପରିବହନ|ଚେର|root/i.test(text))) return 'water_transport';
    if (/water|ଜଳ/i.test(ans)) return 'co2_requirement';
    if ((/(^|[^ର])(leaf|leaves|ପତ୍ର)([^ର]|$)/i.test(ans) && !/ପତ୍ରରନ୍ଧ୍ର|ପତ୍ରହରିତ/i.test(ans)) || /chloroplast|ହରିତକଣିକା/i.test(ans)) return 'leaves_site';

    // Photosynthesis: Question text inspection
    if ((/release|gives out|ନିର୍ଗତ|ନିର୍ଗମନ|ତ୍ୟାଗ|ବାହାର|ଛାଡ଼|ମୁକ୍ତ|ଉପ-ଉତ୍ପାଦ/i.test(qText)) && /ଅମ୍ଳଜାନ|oxygen|o2|ଗ୍ୟାସ/i.test(text)) {
      return 'oxygen_release';
    }
    if (/କେଉଁ ସବୁଜ ରଙ୍ଗର ବର୍ଣ୍ଣକଣିକା|ବର୍ଣ୍ଣକଣିକା|ସବୁଜ କଣିକା|କ୍ଲୋରୋଫିଲ|ହରିତକଣ(?!ିକା)|ଆଲୋକ ଶୋଷଣ|captures?\s+sunlight/i.test(qText)) return 'chlorophyll';
    if (/ଶକ୍ତିର ଉତ୍ସ|ଶକ୍ତି ଉତ୍ସ|କେଉଁ ଶକ୍ତି|energy source|source of energy|କେଉଁଠାରୁ ଶକ୍ତି|ପ୍ରାଥମିକ ଉତ୍ସ/i.test(qText) && /ସୂର୍ଯ୍ୟ|sun/i.test(text)) return 'sunlight';
    if (/ଜଳ ପରିବହନ|କେଉଁ ଟିସୁ ଦ୍ୱାରା ପରିବହନ|water transport/i.test(qText) || /ଜାଇଲେମ|xylem/i.test(text)) return 'water_transport';
    if (/କେଉଁ କ୍ଷୁଦ୍ର ରନ୍ଧ୍ର|କେଉଁ କ୍ଷୁଦ୍ର ଛିଦ୍ର|ଗ୍ୟାସ ବିନିମୟ|pores|gas exchange/i.test(qText) || /ପତ୍ରରନ୍ଧ୍ର|stomata/i.test(text)) return 'stomata';
    if (/ସଞ୍ଚିତ|ଶ୍ୱେତସାର|ଗ୍ଲୁକୋଜ୍|glucose|starch/i.test(qText)) return 'stored_food';
    if (/ଖାଦ୍ୟ ତିଆରି କାରଖାନା|ଖାଦ୍ୟ ପ୍ରସ୍ତୁତିର ମୁଖ୍ୟ କେନ୍ଦ୍ର|site of photosynthesis/i.test(qText)) return 'leaves_site';
    if ((/absorb|take in|intake|require|use|input|ଗ୍ରହଣ|ଆବଶ୍ୟକ|ବ୍ୟବହାର|ପ୍ରଯୋଗ/i.test(qText)) && /ଅଙ୍ଗାରକାମ୍ଳ|carbon dioxide|co2|କାର୍ବନ ଡାଇଅକ୍ସାଇଡ/i.test(text)) {
      return 'co2_requirement';
    }
  }

  // 3. Respiratory System / Human Respiration domain
  const isRespiratoryTopic = /respirat|breathing|lung|lungs|alveoli|ଶ୍ୱାସ|ଫୁସଫୁସ/i.test(topic) ||
                             /respirat|breathing|lung|lungs|alveoli|ଶ୍ୱାସ|ଫୁସଫୁସ/i.test(normTopic) ||
                             /respirat|breathing rate|lungs|alveoli|trachea|bronch|ଶ୍ୱାସକ୍ରିୟା|ଶ୍ୱାସତନ୍ତ୍ର|ଫୁସଫୁସ/i.test(text);

  if (isRespiratoryTopic) {
    // 3a. Carbon monoxide / toxic gas effect on oxygen transport / hemoglobin
    if (/carbon monoxide|carboxyhemoglobin|hemoglobin.*oxygen|binds? to hemoglobin|ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ୟାସ \(co\)|କାର୍ବନ ମନୋକ୍ସାଇଡ/i.test(text) ||
        /carbon monoxide|କାର୍ବନ ମନୋକ୍ସାଇଡ/i.test(cleanAnsText)) {
      return 'carbon_monoxide_transport';
    }

    // 3b. Respiration rate during exercise / physical activity
    if (/exercise|physical (?:activity|exertion)|breathing rate.*increase|increase.*breathing rate|running|କସରତ|ବ୍ୟାୟାମ|ଶ୍ୱାସ ହାର ବୃଦ୍ଧି/i.test(text)) {
      return 'respiration_during_exercise';
    }

    // 3c. Alveoli / gas exchange structure in lungs
    if (/alveoli|alveolus|structure.*exchange|exchange.*structure|air sacs|କୂପିକା|ବାୟୁକୋଷ/i.test(text) ||
        /alveoli|alveolus|କୂପିକା|ବାୟୁକୋଷ/i.test(cleanAnsText)) {
      return 'gas_exchange_structure';
    }

    // 3d. Primary fundamental function of the respiratory system / gas exchange mechanism
    if (/function.*respiratory|respiratory.*function|fundamental function|primary.*function|gas exchange.*blood|exchange of gases|ଶ୍ୱାସତନ୍ତ୍ରର କାର୍ଯ୍ୟ|କାର୍ଯ୍ୟ/i.test(text)) {
      return 'respiratory_system_function';
    }
  }

  // 4. Physics / Newton's Laws / Motion domain
  const isNewtonOrMotionTopic = /newton|laws of motion|first law|1st law|second law|2nd law|third law|3rd law|inertia|force and motion|motion|ଗତି|ଜଡ଼ତା|ବଳ/i.test(topic) ||
                                /newton|laws of motion|first law|1st law|inertia|motion|ଗତି|ଜଡ଼ତା/i.test(normTopic) ||
                                /newton.*(?:first|1st|2nd|3rd|law)|inertia|seatbelt|airbag|passenger|lurch|net.*force|zero.*acceleration|rest.*motion|ଜଡ଼ତା|ପ୍ରଥମ ଗତି/i.test(text);

  if (isNewtonOrMotionTopic) {
    // 4a. Third Law: Action-reaction pairs
    if (/action|reaction|କ୍ରିୟା|ପ୍ରତିକ୍ରିୟା/i.test(ans) || /3rd law|third law|ତୃତୀୟ/i.test(qText)) {
      return 'action_reaction';
    }

    // 4b. Second Law: Momentum and rate of change of momentum
    if (/momentum|ସଂବେଗ/i.test(ans) || /2nd law|second law|ଦ୍ୱିତୀୟ/i.test(qText)) {
      return 'momentum_newton2';
    }

    // 4c. Safety features: seatbelts, airbags, vehicle safety designs
    if (/seat\s*belt|air\s*bag|safety feature|vehicle safety|safety design|headrest|crash|collision.*occupant|protect.*occupant|prevent.*injury|ସିଟ୍\s*ବେଲ୍ଟ|ଏୟାର\s*ବ୍ୟାଗ|ସୁରକ୍ଷା/i.test(text)) {
      return 'safety_inertia';
    }

    // 4d. Real-world everyday inertia manifestations (passengers lurching, sudden stop/start, jerk, stumble)
    if (/passenger|lurch|stumble|fall(?:ing)?\s*(?:forward|backward)|moving (?:car|bus|vehicle|train).*(?:stop|start|brak)|sudden(?:ly)?\s*(?:stop|start)|jerk|carpet.*dust|coin.*(?:card|cup)|ଯାତ୍ରୀ|ଝୁଙ୍କି|ହଠାତ୍\s*ଅଟକି|ହଠାତ୍\s*ଗତି|କମ୍ବଳ.*ଧୂଳି/i.test(text)) {
      return 'inertia_real_world';
    }

    // 4e. Net force = zero, zero acceleration, constant velocity
    if (/net (?:external )?force.*(?:acceleration|zero|constant velocity)|zero (?:net )?force|zero acceleration|net force is zero|relationship between.*net (?:external )?force.*acceleration|net force.*acceleration|balanced force.*acceleration|ନିଟ୍ ବଳ|ନିଟ୍ ବାହ୍ୟ ବଳ|ସନ୍ତୁଳିତ ବଳ|ତ୍ୱରଣ ଶୂନ/i.test(text)) {
      return 'net_force_zero';
    }

    // 4f. Friction & Gravity (resistive forces)
    if (/friction|gravity|ଘର୍ଷଣ|ମାଧ୍ୟାକର୍ଷଣ/i.test(text) && !/first law|1st law|inertia/i.test(qText)) {
      return 'friction_gravity';
    }

    // 4g. Fundamental statement of Newton's First Law (state of rest or uniform straight-line motion)
    if (/rest.*(?:uniform )?motion|uniform motion|constant velocity.*straight line|straight line.*constant (?:speed|velocity)|state of rest|fundamental principle stated by newton|stated by newton.*first law|statement of (?:newton.*)?first law|ପ୍ରଥମ ଗତି ନିୟମର ମୂଳ ସୂତ୍ର|ସ୍ଥିର ଅବସ୍ଥା.*ସମଗତି|ସରଳ ରୈଖିକ/i.test(text)) {
      return 'rest_vs_motion';
    }

    // 4h. Inertia: resistance to change in motion, measured by mass
    if (/resistance to change|resists? (?:a\s+)?change|tendency.*resist|measure of inertia|mass.*measure|mass.*inertia|property.*resists|ଜଡ଼ତା|ପ୍ରତିରୋଧ/i.test(text) ||
        /^(?:[a-d][).\s]+)?(?:inertia|mass|ଜଡ଼ତା|ବସ୍ତୁତ୍ୱ)$/i.test(cleanAnsText) ||
        /inertia|ଜଡ଼ତା/i.test(ans) ||
        (/1st law|first law|ପ୍ରଥମ ଗତି/i.test(qText) && /property|tendency|mass/i.test(text))) {
      return 'inertia_newton1';
    }

    // 4i. Unbalanced external force causing change in motion
    if (/unbalanced force|external force.*causes?.*change|change in motion.*external force|ଅସନ୍ତୁଳିତ ବାହ୍ୟ ବଳ/i.test(text)) {
      return 'external_force';
    }

    // 4j. Friction / Gravity fallback if present
    if (/friction|gravity|ଘର୍ଷଣ|ମାଧ୍ୟାକର୍ଷଣ/i.test(text)) {
      return 'friction_gravity';
    }
  }

  // 5. Water Cycle
  if (/evaporation|ବାଷ୍ପୀଭବନ/i.test(ans) || /ବାଷ୍ପରେ ପରିଣତ/i.test(qText)) {
    return 'evaporation';
  }
  if (/condensation|ଘନୀଭବନ/i.test(ans) || /ବାଷ୍ପ ଘନୀଭୂତ|ମେଘ/i.test(qText)) {
    return 'condensation';
  }
  if (/precipitation|ଅବକ୍ଷେପଣ/i.test(ans) || /ବର୍ଷା/i.test(qText)) {
    return 'precipitation';
  }

  // 6. Water Heating & State Change
  if (/ବାଷ୍ପ|ଜଳୀୟ\s*ବାଷ୍ପ|vapor|steam/i.test(ans) || /ବାଷ୍ପରେ ପରିଣତ|ତରଳରୁ ବାଷ୍ପ/i.test(text)) {
    return 'water_heating_state_change';
  }

  // Fallback: Cognitive intent + non-topic answer & stem tokens
  const topicWords = (normTopic || topic)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
  const topicRegex = topicWords.length > 0 ? new RegExp(`\\b(?:${topicWords.join('|')})\\b`, 'gi') : null;

  let intent = 'concept';
  if (/what is|define|definition|meaning of|କଣ|ସଂଜ୍ଞା|କାହାକୁ କୁହାଯାଏ/i.test(qText)) {
    intent = 'definition';
  } else if (/why|cause|force|how does|keeps|holds|reason|କାହିଁକି|କାରଣ|ବଳ|ପ୍ରକ୍ରିୟା/i.test(qText)) {
    intent = 'cause_force';
  } else if (/which of (?:these|the following)|example|instance|such as|type|ଉଦାହରଣ|ପ୍ରକାର/i.test(qText)) {
    intent = 'example_type';
  } else if (/composed of|contain|made of|parts|components|ଅଂଶ|ଉପାଦାନ/i.test(qText)) {
    intent = 'components';
  }

  let cleanAns = ans.replace(/[^\p{L}\p{N}\s]/gu, '');
  if (topicRegex) cleanAns = cleanAns.replace(topicRegex, '');
  const ansTokens = cleanAns
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .sort()
    .slice(0, 3)
    .join('_');

  let cleanStem = qText.replace(/[^\p{L}\p{N}\s]/gu, '');
  if (topicRegex) cleanStem = cleanStem.replace(topicRegex, '');
  const stemTokens = cleanStem
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .sort()
    .slice(0, 3)
    .join('_');

  return `${intent}_${ansTokens || stemTokens || 'general_concept'}`;
}


/**
 * Validates that every question in a quiz tests a distinct concept.
 */
function validateQuizDiversity(questions, topic = '') {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, reason: 'no_questions' };
  }

  const conceptUsage = new Map(); // conceptId -> array of question indices
  const qClassifications = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const conceptId = classifyQuestionConcept(q, topic);
    qClassifications.push({ question: q.question, concept: conceptId });
    if (!conceptUsage.has(conceptId)) {
      conceptUsage.set(conceptId, []);
    }
    conceptUsage.get(conceptId).push(i);
  }

  // Check for duplicates
  for (const [conceptId, indices] of conceptUsage.entries()) {
    if (indices.length > 1) {
      console.log('\n[Quiz Diversity Debug]');
      for (let i = 0; i < questions.length; i++) {
        console.log(`Q${i + 1}:\nquestion=${questions[i].question}\ntopic=${topic}\nconcept=${qClassifications[i].concept}\nfingerprint=${qClassifications[i].concept}\n`);
      }
      const qx = `Q${indices[0] + 1}`;
      const qy = `Q${indices[1] + 1}`;
      console.log(`duplicate_pair=${qx},${qy}`);
      console.log(`duplicate_reason=Both questions were classified as concept "${conceptId}". Each question must test a distinct concept.\n`);

      return {
        valid: false,
        reason: 'duplicate_concept',
        concept: conceptId,
        duplicateIndices: indices,
        detail: `Multiple questions (Q${indices.map(idx => idx + 1).join(', Q')}) test the same concept ("${conceptId}"). Each question must test a distinct concept.`
      };
    }
  }

  return {
    valid: true,
    uniqueConceptsCount: conceptUsage.size,
    totalQuestions: questions.length,
    conceptDiversityScore: 1.0,
    repeatedConceptRate: 0.0
  };
}

/**
 * Combined quality, factual, and diversity validator for generated quiz questions.
 */
function validateQuizQuality(questions, topic = '', language = 'English') {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, reason: 'no_questions' };
  }

  // 1. Odia compliance
  if (isOdia(language) || containsOdiaScript(topic)) {
    const odiaCheck = validateOdiaQuiz(questions);
    if (!odiaCheck.valid) return odiaCheck;
  }

  // 2. Factual accuracy
  const factualCheck = validateQuizFactualCorrectness(questions, topic);
  if (!factualCheck.valid) return factualCheck;

  // 3. Concept diversity
  return validateQuizDiversity(questions, topic);
}

/**
 * Formats precise, question-level validation failures to pass to the corrective retry prompt.
 */
function formatQuizValidationFailures(questions, qualityCheck, topic = '') {
  const failures = [];

  if (!questions || questions.length === 0) {
    failures.push('- question_count: No valid questions were parsed from output.');
    return failures;
  }

  // 1. Concept diversity failures
  const diversityCheck = validateQuizDiversity(questions, topic);
  if (!diversityCheck.valid && diversityCheck.duplicateIndices) {
    const qLabels = diversityCheck.duplicateIndices.map(idx => `Q${idx + 1}`).join(' and ');
    failures.push(`- duplicate_concept: ${qLabels} both test concept "${diversityCheck.concept}". Each question must test a distinct concept.`);
  }

  // 2. Question-by-question factual and formatting checks
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const factual = validateQuizFactualCorrectness([q], topic);
    if (!factual.valid) {
      failures.push(`- factual_error: Q${i + 1} (${factual.detail || factual.reason})`);
    }

    const opts = Array.isArray(q.options) ? q.options : [];
    if (opts.length !== 4) {
      failures.push(`- malformed_options: Q${i + 1} has ${opts.length} options instead of exactly 4.`);
    } else {
      const cleanOpts = opts.map(o => stripOptionPrefix(o).toLowerCase());
      if (new Set(cleanOpts).size < 4) {
        failures.push(`- duplicate_options: Q${i + 1} contains duplicate or repetitive options.`);
      }
    }
  }

  // 3. Odia script check
  const odiaCheck = validateOdiaQuiz(questions);
  if (!odiaCheck.valid) {
    failures.push(`- language_policy: Questions must be in natural Odia (ଓଡ଼ିଆ) script using correct school science vocabulary.`);
  }

  if (failures.length === 0 && qualityCheck && !qualityCheck.valid) {
    failures.push(`- validation_failure: ${qualityCheck.detail || qualityCheck.reason}`);
  }

  return failures;
}

const CONCEPT_FACTS = {
  galaxy_definition: 'A galaxy is a vast system of billions of stars, stellar remnants, interstellar gas, dust, and dark matter bound together by gravity.',
  gravitational_binding: 'Gravity is the fundamental force that holds stars, gas, and celestial bodies together within a galaxy.',
  galaxy_components_examples: 'The Milky Way and Andromeda are prominent examples of galaxies in the universe.',
  galaxy_types_structure: 'Galaxies exist in spiral, elliptical, and irregular shapes.',
  solar_system_location: 'Our Solar System is located in the Milky Way galaxy.',
  sunlight: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ଶକ୍ତିର ମୁଖ୍ୟ ଉତ୍ସ ସୂର୍ଯ୍ୟାଲୋକ।',
  co2_requirement: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ଉଦ୍ଭିଦ ବାୟୁମଣ୍ଡଳରୁ ଅଙ୍ଗାରକାମ୍ଳ (CO2) ଗ୍ରହଣ କରେ।',
  stomata: 'ପତ୍ରରେ ଥିବା କ୍ଷୁଦ୍ର ରନ୍ଧ୍ର (ପତ୍ରରନ୍ଧ୍ର) ଦ୍ୱାରା ଗ୍ୟାସ ବିନିମୟ ହୁଏ। ପତ୍ରରନ୍ଧ୍ର ଜଳ ପରିବହନ କରେ ନାହିଁ।',
  oxygen_release: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ଉଦ୍ଭିଦ ବାୟୁମଣ୍ଡଳକୁ ଅମ୍ଳଜାନ (Oxygen) ଗ୍ୟାସ ନିର୍ଗତ କରେ।',
  chlorophyll: 'ପତ୍ରରେ ଥିବା ସବୁଜ ବର୍ଣ୍ଣକଣିକା ପତ୍ରହରିତ (Chlorophyll) ସୌର ଆଲୋକ ଶୋଷଣ କରେ।',
  water_transport: 'ଚେରରୁ ଜଳ ଓ ଖଣିଜ ଲବଣ ଜାଇଲେମ (Xylem) ଟିସୁ ଦ୍ୱାରା ପରିବହନ ହୁଏ। ଜାଇଲେମ ଅଙ୍ଗାରକାମ୍ଳ ପରିବହନ କରେ ନାହିଁ।',
  stored_food: 'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ପ୍ରସ୍ତୁତ ଗ୍ଲୁକୋଜ ଶ୍ୱେତସାର (Starch) ଭାବରେ ସଞ୍ଚିତ ହୁଏ।',
  leaves_site: 'ପତ୍ର ଏବଂ ହରିତକଣିକା (Chloroplast) ଆଲୋକ ସଂଶ୍ଳେଷଣର କାର୍ଯ୍ୟସ୍ଥଳୀ ଅଟେ।',
  inertia_newton1: 'କୌଣସି ବାହ୍ୟ ବଳ ପ୍ରୟୋଗ ନହେବା ପର୍ଯ୍ୟନ୍ତ ସ୍ଥିର ବସ୍ତୁ ସ୍ଥିର ରହେ (ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ / ଜଡ଼ତା)।',
  evaporation: 'ସୂର୍ଯ୍ୟଙ୍କ ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ଜଳ ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହେବାକୁ ବାଷ୍ପୀଭବନ କୁହାଯାଏ।',
  water_heating_state_change: 'ପାଣିକୁ ଯଥେଷ୍ଟ ଗରମ କଲେ ଏହା ତରଳ ଅବସ୍ଥାରୁ ବାଷ୍ପ ବା ଜଳୀୟ ବାଷ୍ପ (ଗ୍ୟାସୀୟ ଅବସ୍ଥା) ରେ ପରିବର୍ତ୍ତିତ ହୁଏ।',
  boiling_point: 'ଜଳର ସ୍ଫୁଟନାଙ୍କ ୧୦୦°C ଅଟେ।',
  evaporation_vs_boiling: 'ପାଣିକୁ ଗରମ କଲେ ଏହା ବାଷ୍ପରେ ପରିଣତ ହୁଏ।',
  respiratory_system_function: 'The primary fundamental function of the human respiratory system is gas exchange (taking in oxygen and expelling carbon dioxide).',
  gas_exchange_structure: 'Alveoli (air sacs in the lungs) are the specific structures responsible for actual gas exchange between air and blood.',
  respiration_during_exercise: 'Breathing rate increases during intense physical exercise to supply more oxygen to muscles and remove excess carbon dioxide.',
  carbon_monoxide_transport: 'Carbon monoxide binds strongly to hemoglobin, severely impairing oxygen transport efficiency in the blood.',
  breathing_mechanism_diaphragm: 'Inhalation and exhalation are powered by the contraction and relaxation of the diaphragm and intercostal muscles.',
  rest_vs_motion: 'An object continues in its state of rest or uniform motion in a straight line unless acted upon by a net external unbalanced force (Newton\'s First Law).',
  inertia_real_world: 'When a moving vehicle stops suddenly, passengers lurch forward because their bodies tend to stay in motion due to inertia.',
  net_force_zero: 'When the net external force on an object is zero, its acceleration is zero and it maintains a constant velocity or stays at rest.',
  safety_inertia: 'Vehicle safety features like seatbelts and airbags safely apply an external restraining force to protect passengers from their own inertia during collisions.'
};

const CONCEPT_FALLBACK_QUESTIONS = {
  galaxy_definition: {
    question: 'What is a galaxy?',
    options: ['A vast system of stars, gas, and dust bound by gravity', 'A single burning planet orbiting the Sun', 'A small cloud of ice in Earth\'s atmosphere', 'A group of twelve stars'],
    answer: 0,
    explanation: 'A galaxy is a massive collection of billions of stars, gas, and dust held together by gravity.',
    topic: 'galaxies',
    concept: 'galaxy_definition',
    skill: 'definition'
  },
  gravitational_binding: {
    question: 'What fundamental force holds stars and matter together in a galaxy?',
    options: ['Gravity', 'Magnetic force', 'Electrostatic repulsion', 'Atmospheric friction'],
    answer: 0,
    explanation: 'Gravity is the attractive force that keeps all stars, gas, and dust bound within a galaxy.',
    topic: 'galaxies',
    concept: 'gravitational_binding',
    skill: 'gravitational_structure'
  },
  galaxy_components_examples: {
    question: 'Which of the following is a prominent example of a galaxy in the universe?',
    options: ['Andromeda', 'Jupiter', 'Sirius', 'Halley\'s Comet'],
    answer: 0,
    explanation: 'Andromeda is a major spiral galaxy near our Milky Way.',
    topic: 'galaxies',
    concept: 'galaxy_components_examples',
    skill: 'examples'
  },
  galaxy_types_structure: {
    question: 'Which of the following is a recognized classification shape of galaxies?',
    options: ['Spiral', 'Square', 'Octagonal', 'Cubic'],
    answer: 0,
    explanation: 'Galaxies are primarily classified by shape into spiral, elliptical, and irregular galaxies.',
    topic: 'galaxies',
    concept: 'galaxy_types_structure',
    skill: 'classification'
  },
  solar_system_location: {
    question: 'Where is our Solar System located in relation to the Milky Way galaxy?',
    options: ['In one of its spiral arms (Orion Arm)', 'At the exact galactic core', 'Outside the galaxy entirely', 'Inside a central black hole'],
    answer: 0,
    explanation: 'Our Solar System is located within the Orion Arm of the Milky Way galaxy.',
    topic: 'galaxies',
    concept: 'solar_system_location',
    skill: 'location'
  },
  water_heating_state_change: {
    question: 'ପାଣିକୁ ଗରମ କଲେ ଏହା କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତନ ହୁଏ?',
    options: ['ବାଷ୍ପ (ଜଳୀୟ ବାଷ୍ପ)', 'ବରଫ', 'କଠିନ', 'ମାଟି'],
    answer: 0,
    explanation: 'ପାଣିକୁ ଯଥେଷ୍ଟ ଗରମ କଲେ ଏହା ତରଳ ଅବସ୍ଥାରୁ ବାଷ୍ପ ବା ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହୁଏ।'
  },
  boiling_point: {
    question: 'ସାଧାରଣ ଚାପରେ ଜଳର ସ୍ଫୁଟନାଙ୍କ କେତେ?',
    options: ['୧୦୦°C', '୦°C', '୫୦°C', '୨୦୦°C'],
    answer: 0,
    explanation: 'ସାଧାରଣ ବାୟୁମଣ୍ଡଳୀୟ ଚାପରେ ଜଳ ୧୦୦°C ତାପମାତ୍ରାରେ ଫୁଟି ବାଷ୍ପ ହୁଏ।'
  },
  sunlight: {
    question: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ପ୍ରାଥମିକ ଶକ୍ତିର ଉତ୍ସ କଣ?',
    options: ['ସୂର୍ଯ୍ୟାଲୋକ', 'ଅଙ୍ଗାରକାମ୍ଳ', 'ପତ୍ରରନ୍ଧ୍ର', 'ଜଳ'],
    answer: 0,
    explanation: 'ସୂର୍ଯ୍ୟାଲୋକ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ପ୍ରାଥମିକ ଶକ୍ତି ପ୍ରଦାନ କରେ।'
  },
  co2_requirement: {
    question: 'ଉଦ୍ଭିଦମାନେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ବାୟୁମଣ୍ଡଳରୁ କେଉଁ ଗ୍ୟାସ ଗ୍ରହଣ କରନ୍ତି?',
    options: ['ଅଙ୍ଗାରକାମ୍ଳ', 'ଅମ୍ଳଜାନ', 'ଯବକ୍ଷାରଜାନ', 'ହାଇଡ୍ରୋଜେନ'],
    answer: 0,
    explanation: 'ଉଦ୍ଭିଦ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ବାୟୁରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ୟାସ ଗ୍ରହଣ କରେ।'
  },
  stomata: {
    question: 'ପତ୍ରରେ ଥିବା କେଉଁ କ୍ଷୁଦ୍ର ରନ୍ଧ୍ର ଦେଇ ଗ୍ୟାସ ବିନିମୟ ହୁଏ?',
    options: ['ପତ୍ରରନ୍ଧ୍ର', 'ଚେର', 'କାଣ୍ଡ', 'ଫୁଲ'],
    answer: 0,
    explanation: 'ପତ୍ରରନ୍ଧ୍ର (Stomata) ମାଧ୍ୟମରେ ଉଦ୍ଭିଦରେ ଗ୍ୟାସ ବିନିମୟ ହୁଏ।'
  },
  oxygen_release: {
    question: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ଉଦ୍ଭିଦ କେଉଁ ଗ୍ୟାସ ବାୟୁମଣ୍ଡଳକୁ ନିର୍ଗତ କରେ?',
    options: ['ଅମ୍ଳଜାନ', 'ଅଙ୍ଗାରକାମ୍ଳ', 'ଯବକ୍ଷାରଜାନ', 'ହିଲିୟମ'],
    answer: 0,
    explanation: 'ଜଳର ଆଲୋକ ବିଭାଜନ ଫଳରେ ଅମ୍ଳଜାନ ଗ୍ୟାସ ଉପ-ଉତ୍ପାଦ ଭାବରେ ନିର୍ଗତ ହୁଏ।'
  },
  chlorophyll: {
    question: 'ପତ୍ରରେ ସୂର୍ଯ୍ୟାଲୋକ ଶୋଷଣ କରୁଥିବା ସବୁଜ ବର୍ଣ୍ଣକଣିକା କିଏ?',
    options: ['ପତ୍ରହରିତ', 'ହିମୋଗ୍ଲୋବିନ', 'କାରୋଟିନ', 'ଜଳ'],
    answer: 0,
    explanation: 'ପତ୍ରହରିତ (Chlorophyll) ସୌର ଶକ୍ତି ଶୋଷଣ କରିବାରେ ସାହାଯ୍ୟ କରେ।'
  },
  respiratory_system_function: {
    question: 'What is the primary fundamental function of the human respiratory system?',
    options: ['Gas exchange (taking in oxygen and releasing carbon dioxide)', 'Pumping blood to body organs', 'Digesting nutrients for energy', 'Filtering waste from urine'],
    answer: 0,
    explanation: 'The primary function of the respiratory system is the intake of oxygen and release of carbon dioxide through gas exchange.',
    topic: 'respiratory system',
    concept: 'respiratory_system_function',
    skill: 'function'
  },
  gas_exchange_structure: {
    question: 'Which specific structure within the lungs is responsible for the actual exchange of gases between air and blood?',
    options: ['Alveoli', 'Trachea', 'Bronchi', 'Larynx'],
    answer: 0,
    explanation: 'Alveoli are microscopic air sacs in the lungs surrounded by capillaries where oxygen and carbon dioxide are exchanged.',
    topic: 'respiratory system',
    concept: 'gas_exchange_structure',
    skill: 'structure'
  },
  respiration_during_exercise: {
    question: 'Why does a person\'s breathing rate increase significantly during intense physical exercise?',
    options: ['To supply more oxygen to active muscles and expel excess carbon dioxide', 'To decrease heart rate and blood flow', 'To cool down the respiratory tract', 'To reduce lactic acid in the stomach'],
    answer: 0,
    explanation: 'During exercise, active muscles require more oxygen and generate more carbon dioxide, triggering an increase in breathing rate.',
    topic: 'respiratory system',
    concept: 'respiration_during_exercise',
    skill: 'regulation'
  },
  carbon_monoxide_transport: {
    question: 'How does the presence of carbon monoxide in the air affect the efficiency of the human respiratory system?',
    options: ['It binds tightly to hemoglobin, reducing oxygen transport to tissues', 'It increases oxygen absorption in the lungs', 'It paralyzes the vocal cords immediately', 'It destroys the bronchial tubes directly'],
    answer: 0,
    explanation: 'Carbon monoxide has a much higher affinity for hemoglobin than oxygen, preventing hemoglobin from delivering oxygen to tissues.',
    topic: 'respiratory system',
    concept: 'carbon_monoxide_transport',
    skill: 'cause_effect'
  },
  breathing_mechanism_diaphragm: {
    question: 'Which muscle plays the primary role in the mechanism of human breathing by contracting during inhalation?',
    options: ['Diaphragm', 'Cardiac muscle', 'Biceps', 'Pectoral muscle'],
    answer: 0,
    explanation: 'The diaphragm contracts and moves downward during inhalation, expanding the chest cavity and drawing air into the lungs.',
    topic: 'respiratory system',
    concept: 'breathing_mechanism_diaphragm',
    skill: 'mechanism'
  },
  rest_vs_motion: {
    question: "What is the fundamental principle stated by Newton's First Law of Motion?",
    options: ["An object remains at rest or in uniform straight-line motion unless acted upon by a net external force", "Force equals mass multiplied by acceleration", "For every action there is an equal and opposite reaction", "Total energy in an isolated system is conserved"],
    answer: 0,
    explanation: "Newton's First Law states that an object continues in its state of rest or uniform motion in a straight line unless an unbalanced external force acts on it.",
    topic: "Newton's First Law of Motion",
    concept: "rest_vs_motion",
    skill: "principle"
  },
  inertia_newton1: {
    question: "Which physical property determines an object's resistance to changes in its state of motion according to Newton's First Law?",
    options: ["Inertia (quantified by mass)", "Velocity", "Volume", "Weight"],
    answer: 0,
    explanation: "Inertia is the natural tendency of an object to resist changes in its motion, and mass is the quantitative measure of inertia.",
    topic: "Newton's First Law of Motion",
    concept: "inertia_newton1",
    skill: "property"
  },
  inertia_real_world: {
    question: "Why do passengers lurch forward when a moving car suddenly stops?",
    options: ["Due to inertia of motion, their bodies tend to continue moving forward", "Because a mysterious forward force pushes them", "Because gravity increases when braking", "Due to air pressure changes inside the car"],
    answer: 0,
    explanation: "Passengers possess inertia of motion; when the car stops, their upper bodies continue moving forward until restrained.",
    topic: "Newton's First Law of Motion",
    concept: "inertia_real_world",
    skill: "real_world_application"
  },
  net_force_zero: {
    question: "What is the relationship between the net external force on an object and its acceleration as implied by Newton's First Law?",
    options: ["When the net external force is zero, the acceleration is zero", "When the net external force is zero, acceleration is maximized", "Net force and acceleration are completely unrelated", "Zero net force causes continuous change in velocity"],
    answer: 0,
    explanation: "According to Newton's First Law, without a net external force, there is no change in velocity, which means acceleration is zero.",
    topic: "Newton's First Law of Motion",
    concept: "net_force_zero",
    skill: "force_acceleration_relationship"
  },
  safety_inertia: {
    question: "Why is understanding Newton's First Law crucial for the design of vehicle safety features like seatbelts and airbags?",
    options: ["They provide an external restraining force to safely stop occupants whose inertia would otherwise propel them forward", "They eliminate the force of gravity on the car", "They prevent the engine from stalling", "They reduce friction with the road"],
    answer: 0,
    explanation: "Seatbelts and airbags apply an external force to safely decelerate passengers who would otherwise continue moving forward due to inertia.",
    topic: "Newton's First Law of Motion",
    concept: "safety_inertia",
    skill: "safety_design"
  }
};

const CONCEPT_FALLBACK_QUESTIONS_OD = {
  galaxy_definition: {
    question: 'ଛାୟାପଥ (Galaxy) କାହାକୁ କୁହାଯାଏ?',
    options: ['ମାଧ୍ୟାକର୍ଷଣ ଦ୍ୱାରା ଏକତ୍ର ଥିବା କୋଟି କୋଟି ନକ୍ଷତ୍ର, ଗ୍ୟାସ ଓ ଧୂଳିକଣାର ବିଶାଳ ସମୂହ', 'ସୂର୍ଯ୍ୟ ଚାରିପାଖରେ ଘୂରୁଥିବା ଏକମାତ୍ର ଉଜ୍ଜ୍ୱଳ ଗ୍ରହ', 'ବାୟୁମଣ୍ଡଳରେ ଭାସୁଥିବା ବରଫ ଖଣ୍ଡ', 'କେବଳ ବାରଟି ନକ୍ଷତ୍ରର ଏକ ଛୋଟ ଦଳ'],
    answer: 0,
    explanation: 'ମାଧ୍ୟାକର୍ଷଣ ବଳ ଦ୍ୱାରା ଏକତ୍ର ବାନ୍ଧି ହୋଇ ରହିଥିବା ନକ୍ଷତ୍ର, ଗ୍ୟାସ ଏବଂ ଧୂଳିକଣାର ବିରାଟ ସଂସ୍ଥାକୁ ଛାୟାପଥ କୁହାଯାଏ।',
    topic: 'ଛାୟାପଥ',
    concept: 'galaxy_definition',
    skill: 'definition'
  },
  gravitational_binding: {
    question: 'କେଉଁ ବଳ ଛାୟାପଥର ନକ୍ଷତ୍ର, ଗ୍ୟାସ ଏବଂ ଧୂଳିକଣାକୁ ଏକତ୍ର ଧରି ରଖିଥାଏ?',
    options: ['ମାଧ୍ୟାକର୍ଷଣ ବଳ', 'ଚୁମ୍ବକୀୟ ବିକର୍ଷଣ', 'ସ୍ଥିର ବୈଦ୍ୟୁତିକ ବଳ', 'ବାୟୁମଣ୍ଡଳୀୟ ଚାପ'],
    answer: 0,
    explanation: 'ମାଧ୍ୟାକର୍ଷଣ ବଳ (Gravity) ଛାୟାପଥର ସମସ୍ତ ପଦାର୍ଥକୁ ପରସ୍ପର ସହିତ ଆବଦ୍ଧ କରି ରଖିଥାଏ।',
    topic: 'ଛାୟାପଥ',
    concept: 'gravitational_binding',
    skill: 'gravitational_structure'
  },
  galaxy_components_examples: {
    question: 'ନିମ୍ନଲିଖିତ ମଧ୍ୟରୁ କେଉଁଟି ଏକ ପ୍ରମୁଖ ଛାୟାପଥ (Galaxy) ର ଉଦାହରଣ?',
    options: ['ଆଣ୍ଡ୍ରୋମେଡା (Andromeda)', 'ବୃହସ୍ପତି', 'ଲୁବ୍ଧକ (Sirius)', 'ହ୍ୟାଲିଙ୍କ ଧୂମକେତୁ'],
    answer: 0,
    explanation: 'ଆଣ୍ଡ୍ରୋମେଡା ଏବଂ ଆକାଶଗଙ୍ଗା ମହାକାଶରେ ଥିବା ପ୍ରମୁଖ ଛାୟାପଥର ଉଦାହରଣ ଅଟନ୍ତି।',
    topic: 'ଛାୟାପଥ',
    concept: 'galaxy_components_examples',
    skill: 'examples'
  },
  galaxy_types_structure: {
    question: 'ନିମ୍ନଲିଖିତ ମଧ୍ୟରୁ କେଉଁଟି ଛାୟାପଥର ଏକ ମୁଖ୍ୟ ଆକାର ବା ଶ୍ରେଣୀବିଭାଗ ଅଟେ?',
    options: ['କୁଣ୍ଡଳୀୟ (Spiral)', 'ଚତୁର୍ଭୁଜ', 'ତ୍ରିକୋଣାକାର', 'ଘନକ'],
    answer: 0,
    explanation: 'ଛାୟାପଥଗୁଡ଼ିକ ମୁଖ୍ୟତଃ କୁଣ୍ଡଳୀୟ, ଅଣ୍ଡାକାର ଏବଂ ଅନିୟମିତ ଆକୃତିର ହୋଇଥାଏ।',
    topic: 'ଛାୟାପଥ',
    concept: 'galaxy_types_structure',
    skill: 'classification'
  },
  solar_system_location: {
    question: 'ଆମ ସୌରମଣ୍ଡଳ କେଉଁ ଛାୟାପଥ (Galaxy) ରେ ଅବସ୍ଥିତ?',
    options: ['ଆକାଶଗଙ୍ଗା (Milky Way)', 'ଆଣ୍ଡ୍ରୋମେଡା', 'ସୂର୍ଯ୍ୟଙ୍କ ଗର୍ଭ', 'ଅନ୍ତର୍ନକ୍ଷତ୍ରୀୟ ଶୂନ୍ୟସ୍ଥାନ'],
    answer: 0,
    explanation: 'ଆମ ସୌରମଣ୍ଡଳ ଆକାଶଗଙ୍ଗା (Milky Way) ନାମକ କୁଣ୍ଡଳୀୟ ଛାୟାପଥରେ ଅବସ୍ଥିତ।',
    topic: 'ଛାୟାପଥ',
    concept: 'solar_system_location',
    skill: 'location'
  },
  respiratory_system_function: {
    question: 'ମାନବ ଶ୍ୱାସତନ୍ତ୍ରର ପ୍ରାଥମିକ ମୌଳିକ କାର୍ଯ୍ୟ କଣ?',
    options: ['ଗ୍ୟାସ ବିନିମୟ (ଅମ୍ଳଜାନ ଗ୍ରହଣ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ)', 'ଶରୀରକୁ ରକ୍ତ ପମ୍ପ କରିବା', 'ଖାଦ୍ୟ ହଜମ କରିବା', 'ରକ୍ତରୁ ବର୍ଜ୍ୟବସ୍ତୁ ଛାଣିବା'],
    answer: 0,
    explanation: 'ଶ୍ୱାସତନ୍ତ୍ରର ମୁଖ୍ୟ କାର୍ଯ୍ୟ ହେଉଛି ବାୟୁମଣ୍ଡଳରୁ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରିବା ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରିବା।',
    topic: 'ଶ୍ୱାସତନ୍ତ୍ର',
    concept: 'respiratory_system_function',
    skill: 'function'
  },
  gas_exchange_structure: {
    question: 'ଫୁସଫୁସ ମଧ୍ୟରେ କେଉଁ ନିର୍ଦ୍ଦିଷ୍ଟ ଅଂଶରେ ବାୟୁ ଓ ରକ୍ତ ମଧ୍ୟରେ ଗ୍ୟାସ ବିନିମୟ ହୋଇଥାଏ?',
    options: ['କୂପିକା (Alveoli)', 'ଶ୍ୱାସନଳୀ (Trachea)', 'ଶ୍ୱାସନଳୀକା', 'ସ୍ୱରପେଟିକା'],
    answer: 0,
    explanation: 'ଫୁସଫୁସର କୂପିକା (Alveoli) ରେ ବାୟୁ ଓ ରକ୍ତକେଶିକା ମଧ୍ୟରେ ଅମ୍ଳଜାନ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳର ବିନିମୟ ହୁଏ।',
    topic: 'ଶ୍ୱାସତନ୍ତ୍ର',
    concept: 'gas_exchange_structure',
    skill: 'structure'
  },
  respiration_during_exercise: {
    question: 'କଠିନ ବ୍ୟାୟାମ ସମୟରେ ଜଣେ ବ୍ୟକ୍ତିଙ୍କ ଶ୍ୱାସକ୍ରିୟା ହାର କାହିଁକି ବୃଦ୍ଧି ପାଏ?',
    options: ['ମାଂସପେଶୀକୁ ଅଧିକ ଅମ୍ଳଜାନ ଯୋଗାଇବା ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ନିଷ୍କାସନ ପାଇଁ', 'ହୃଦସ୍ପନ୍ଦନ କମାଇବା ପାଇଁ', 'ଶ୍ୱାସନଳୀକୁ ଥଣ୍ଡା ରଖିବା ପାଇଁ', 'ପାକସ୍ଥଳୀରେ ଅମ୍ଳ କମାଇବା ପାଇଁ'],
    answer: 0,
    explanation: 'ବ୍ୟାୟାମ ସମୟରେ ମାଂସପେଶୀଗୁଡ଼ିକୁ ଅଧିକ ଅମ୍ଳଜାନ ଆବଶ୍ୟକ ହୁଏ ଏବଂ ଅଧିକ ଅଙ୍ଗାରକାମ୍ଳ ସୃଷ୍ଟି ହୁଏ, ଯାହା ଫଳରେ ଶ୍ୱାସ ହାର ବଢ଼ିଯାଏ।',
    topic: 'ଶ୍ୱାସତନ୍ତ୍ର',
    concept: 'respiration_during_exercise',
    skill: 'regulation'
  },
  carbon_monoxide_transport: {
    question: 'ବାୟୁରେ କାର୍ବନ ମନୋକ୍ସାଇଡ (CO) ର ଉପସ୍ଥିତି ମାନବ ଶ୍ୱାସକ୍ରିୟା ଉପରେ କି ପ୍ରଭାବ ପକାଏ?',
    options: ['ଏହା ହିମୋଗ୍ଲୋବିନ ସହିତ ଶକ୍ତ ଭାବରେ ଯୋଡ଼ି ହୋଇ ଅମ୍ଳଜାନ ପରିବହନ ବନ୍ଦ କରେ', 'ଏହା ଫୁସଫୁସରେ ଅମ୍ଳଜାନ ଗ୍ରହଣ ବୃଦ୍ଧି କରେ', 'ଏହା ସ୍ୱରପେଟିକାକୁ ନଷ୍ଟ କରେ', 'ଏହା ଶ୍ୱାସନଳୀକୁ ସଫା କରେ'],
    answer: 0,
    explanation: 'କାର୍ବନ ମନୋକ୍ସାଇଡ ହିମୋଗ୍ଲୋବିନ ସହିତ ଅମ୍ଳଜାନ ଅପେକ୍ଷା ଶୀଘ୍ର ବାନ୍ଧିହୋଇ କାର୍ବୋକ୍ସିହିମୋଗ୍ଲୋବିନ ସୃଷ୍ଟି କରେ, ଫଳରେ ଅମ୍ଳଜାନ ପରିବହନ ବାଧାପ୍ରାପ୍ତ ହୁଏ।',
    topic: 'ଶ୍ୱାସତନ୍ତ୍ର',
    concept: 'carbon_monoxide_transport',
    skill: 'cause_effect'
  },
  breathing_mechanism_diaphragm: {
    question: 'ପ୍ରଶ୍ୱାସ ସମୟରେ କେଉଁ ମାଂସପେଶୀ ସଂକୁଚିତ ହୋଇ ଶ୍ୱାସକ୍ରିୟାରେ ପ୍ରମୁଖ ଭୂମିକା ଗ୍ରହଣ କରେ?',
    options: ['ମଧ୍ୟଚ୍ଛଦା (Diaphragm)', 'ହୃତ୍ପିଣ୍ଡ ପେଶୀ', 'ହାତ ପେଶୀ', 'କଣ୍ଠ ପେଶୀ'],
    answer: 0,
    explanation: 'ପ୍ରଶ୍ୱାସ ସମୟରେ ମଧ୍ୟଚ୍ଛଦା (Diaphragm) ସଂକୁଚିତ ହୋଇ ତଳକୁ ଖସେ, ଯାହା ଫଳରେ ବକ୍ଷଗହ୍ୱର ପ୍ରସାରିତ ହୋଇ ବାୟୁ ଫୁସଫୁସରେ ପ୍ରବେଶ କରେ।',
    topic: 'ଶ୍ୱାସତନ୍ତ୍ର',
    concept: 'breathing_mechanism_diaphragm',
    skill: 'mechanism'
  },
  rest_vs_motion: {
    question: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ ଅନୁସାରେ କୌଣସି ବାହ୍ୟ ବଳ ପ୍ରୟୋଗ ନହେଲେ ବସ୍ତୁର ଅବସ୍ଥା କିପରି ରହେ?',
    options: ['ସ୍ଥିର ବସ୍ତୁ ସ୍ଥିର ରହେ ଏବଂ ଗତିଶୀଳ ବସ୍ତୁ ସରଳ ରେଖାରେ ସମଗତିରେ ଗତି କରେ', 'ବସ୍ତୁଟି ତୁରନ୍ତ ଅଟକିଯାଏ', 'ବସ୍ତୁର ବେଗ ଦୁଇଗୁଣ ବଢ଼ିଯାଏ', 'ବସ୍ତୁର ବସ୍ତୁତ୍ୱ ବଦଳିଯାଏ'],
    answer: 0,
    explanation: 'କୌଣସି ଅସନ୍ତୁଳିତ ବାହ୍ୟ ବଳ ପ୍ରୟୋଗ ନହେବା ପର୍ଯ୍ୟନ୍ତ ସ୍ଥିର ବସ୍ତୁ ସ୍ଥିର ରହେ ଏବଂ ଗତିଶୀଳ ବସ୍ତୁ ସମବେଗରେ ସରଳ ପଥରେ ଗତି କରେ।',
    topic: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ',
    concept: 'rest_vs_motion',
    skill: 'principle'
  },
  inertia_newton1: {
    question: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ନିୟମ ଅନୁଯାୟୀ ବସ୍ତୁର ଗତି ଅବସ୍ଥାର ପରିବର୍ତ୍ତନକୁ ପ୍ରତିରୋଧ କରୁଥିବା ଗୁଣକୁ କଣ କୁହାଯାଏ?',
    options: ['ଜଡ଼ତା (Inertia)', 'ତ୍ୱରଣ', 'ଚାପ', 'ଶକ୍ତି'],
    answer: 0,
    explanation: 'ବସ୍ତୁର ନିଜ ଗତି ଅବସ୍ଥା ବଜାୟ ରଖିବା ଏବଂ ପରିବର୍ତ୍ତନକୁ ପ୍ରତିରୋଧ କରିବାର ପ୍ରବୃତ୍ତିକୁ ଜଡ଼ତା କୁହାଯାଏ।',
    topic: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ',
    concept: 'inertia_newton1',
    skill: 'property'
  },
  inertia_real_world: {
    question: 'ଗତିଶୀଳ ଗାଡ଼ି ହଠାତ୍ ଅଟକି ଗଲେ ଯାତ୍ରୀମାନେ କାହିଁକି ଆଗକୁ ଝୁଙ୍କି ପଡ଼ନ୍ତି?',
    options: ['ଗତିଜ ଜଡ଼ତା (Inertia of motion) ଯୋଗୁଁ', 'ସ୍ଥିତିଜ ଜଡ଼ତା ଯୋଗୁଁ', 'ମାଧ୍ୟାକର୍ଷଣ ବଳ ବଢ଼ିଯିବା ଯୋଗୁଁ', 'ବାୟୁ ଚାପ ହ୍ରାସ ଯୋଗୁଁ'],
    answer: 0,
    explanation: 'ଗାଡ଼ି ଅଟକି ଗଲେ ଶରୀରର ଉପର ଭାଗ ଜଡ଼ତା ଯୋଗୁଁ ପୂର୍ବ ଗତି ବଜାୟ ରଖିବାକୁ ଚେଷ୍ଟା କରି ଆଗକୁ ଝୁଙ୍କି ପଡ଼େ।',
    topic: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ',
    concept: 'inertia_real_world',
    skill: 'real_world_application'
  },
  net_force_zero: {
    question: 'କୌଣସି ବସ୍ତୁ ଉପରେ କାର୍ଯ୍ୟକାରୀ ନିଟ୍ ବାହ୍ୟ ବଳ ଶୂନ (Zero net force) ହେଲେ ତାର ତ୍ୱରଣ କେତେ ହେବ?',
    options: ['ତ୍ୱରଣ ଶୂନ ହେବ (ସମବେଗରେ ଗତି କରିବ ବା ସ୍ଥିର ରହିବ)', 'ତ୍ୱରଣ ସର୍ବାଧିକ ହେବ', 'ତ୍ୱରଣ କ୍ରମାଗତ ବୃଦ୍ଧି ପାଇବ', 'ବେଗ ଶୂନ ହୋଇଯିବ'],
    answer: 0,
    explanation: 'ନିଟ୍ ବାହ୍ୟ ବଳ ଶୂନ ହେଲେ କୌଣସି ବେଗ ପରିବର୍ତ୍ତନ ହୁଏ ନାହିଁ, ଅର୍ଥାତ୍ ତ୍ୱରଣ ଶୂନ ହୁଏ।',
    topic: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ',
    concept: 'net_force_zero',
    skill: 'force_acceleration_relationship'
  },
  safety_inertia: {
    question: 'ଗାଡ଼ିରେ ସିଟ୍ ବେଲ୍ଟ (Seatbelt) ଓ ଏୟାରବ୍ୟାଗ୍ ବ୍ୟବହାର ନ୍ୟୁଟନଙ୍କ କେଉଁ ନିୟମ ସହିତ ପ୍ରତ୍ୟକ୍ଷ ଭାବରେ ସମ୍ପର୍କିତ?',
    options: ['ପ୍ରଥମ ଗତି ନିୟମ (ଜଡ଼ତା ପ୍ରଭାବରୁ ଯାତ୍ରୀଙ୍କୁ ରକ୍ଷା କରିବା)', 'ତୃତୀୟ ଗତି ନିୟମ', 'ମାଧ୍ୟାକର୍ଷଣ ନିୟମ', 'ଆର୍କିମିଡିସ୍ ନୀତି'],
    answer: 0,
    explanation: 'ଦୁର୍ଘଟଣା ସମୟରେ ଜଡ଼ତା ଯୋଗୁଁ ଯାତ୍ରୀ ଆଗକୁ ଫୋପାଡ଼ି ହୋଇଯିବାକୁ ଅଟକାଇବା ପାଇଁ ସିଟ୍ ବେଲ୍ଟ ଓ ଏୟାରବ୍ୟାଗ୍ ବାହ୍ୟ ବଳ ପ୍ରଦାନ କରେ।',
    topic: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ',
    concept: 'safety_inertia',
    skill: 'safety_design'
  }
};

/**
 * Returns precise validation failure details for each question slot to enable single-slot retry.
 */
function getQuestionValidationIssues(questions, topic = '', effectiveLanguage = 'English', coveragePlan = null) {
  const issues = [];
  if (!Array.isArray(questions)) return issues;

  const isOd = isOdia(effectiveLanguage) || containsOdiaScript(topic);

  // Track concept usage across the quiz
  const conceptUsage = new Map();
  for (let i = 0; i < questions.length; i++) {
    const concept = classifyQuestionConcept(questions[i], topic);
    if (!conceptUsage.has(concept)) conceptUsage.set(concept, []);
    conceptUsage.get(concept).push(i);
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const targetPlanConcept = coveragePlan?.concepts?.[i] || null;
    const assignedConceptId = targetPlanConcept?.id || null;
    const classifiedId = classifyQuestionConcept(q, topic);

    let issue = null;
    // 1. Structural / format check
    if (!q || typeof q !== 'object') {
      issue = { valid: false, reason: 'invalid_object', detail: 'Invalid question object' };
    } else if (!q.question || q.question.trim().length < 5) {
      issue = { valid: false, reason: 'question_too_short', detail: 'Question text too short' };
    } else if (containsOdiaScript(q.question) && !isCompleteOdiaQuestion(q.question)) {
      issue = { valid: false, reason: 'sentence_fragment', detail: `Question is an incomplete sentence fragment: "${q.question}"` };
    } else if (!Array.isArray(q.options) || q.options.length !== 4) {
      issue = { valid: false, reason: 'options_count_not_four', detail: 'Options count is not 4' };
    } else if (new Set((q.options || []).map(o => stripOptionPrefix(String(o)).toLowerCase())).size < 4) {
      issue = { valid: false, reason: 'duplicate_options', detail: 'Contains duplicate options' };
    }

    // 2. Factual check
    if (!issue) {
      const factual = validateQuizFactualCorrectness([q], topic);
      if (!factual.valid) {
        issue = { valid: false, reason: factual.reason, detail: factual.detail || factual.reason };
      }
    }

    // 3. Duplicate concept check
    if (!issue && conceptUsage.get(classifiedId)?.length > 1) {
      const dups = conceptUsage.get(classifiedId);
      if (dups[0] !== i) {
        issue = { valid: false, reason: 'duplicate_concept', detail: `Duplicates concept "${classifiedId}" with Q${dups[0] + 1}` };
      }
    }

    // 4. Assigned concept match check if plan exists
    if (!issue && assignedConceptId && classifiedId !== assignedConceptId && classifiedId !== 'general_concept' && !classifiedId.startsWith('concept_')) {
      const isKnownMismatch = (assignedConceptId.startsWith('galaxy_') && !classifiedId.startsWith('galaxy_')) ||
                              (assignedConceptId === 'sunlight' && classifiedId !== 'sunlight') ||
                              (assignedConceptId === 'oxygen_release' && classifiedId !== 'oxygen_release');
      if (isKnownMismatch) {
        issue = { valid: false, reason: 'concept_mismatch', detail: `Expected concept "${assignedConceptId}", got "${classifiedId}"` };
      }
    }

    const key = assignedConceptId || classifiedId;
    let fallback = CONCEPT_FALLBACK_QUESTIONS[key] || null;
    if (isOd && CONCEPT_FALLBACK_QUESTIONS_OD[key]) {
      fallback = CONCEPT_FALLBACK_QUESTIONS_OD[key];
    }

    issues.push({
      index: i,
      valid: !issue,
      reason: issue?.reason || null,
      detail: issue?.detail || null,
      conceptId: key,
      targetConcept: targetPlanConcept?.description || topic,
      expectedFact: CONCEPT_FACTS[key] || null,
      fallbackQuestion: fallback,
    });
  }

  return issues;
}

module.exports = {
  isOdia,
  containsOdiaScript,
  getEffectiveLanguage,
  extractQuestionCount,
  isCompleteOdiaQuestion,
  getLanguageDirective,
  validateOdiaContent,
  validateOdiaQuiz,
  validateQuizFactualCorrectness,
  validateQuizDiversity,
  classifyQuestionConcept,
  getTopicCoveragePlan,
  validateQuizQuality,
  formatQuizValidationFailures,
  extractOptionCount,
  detectTopicType,
  getTopicFactualRules,
  CONCEPT_FACTS,
  CONCEPT_FALLBACK_QUESTIONS,
  CONCEPT_FALLBACK_QUESTIONS_OD,
  getQuestionValidationIssues,
  normalizeQuizTopic,
  CANONICAL_ODIA_VOCAB,
  CORRUPTED_ODIA_VOCAB,
  ODIA_EDUCATIONAL_FALLBACKS,
  extractOdiaContentPlan,
  buildOdiaTutorPrompt,
  validateOdiaTutorAnswer,
  buildOdiaRepairPrompt,
  getOdiaDeterministicFallback,
  validateFactualRelationships,
  FACTUAL_REPAIR_INSTRUCTIONS,
};


