'use strict';

const {
  validateOdiaTutorAnswer,
  validateFactualRelationships,
  isOdia,
  containsOdiaScript
} = require('./languagePolicy');
const {
  validateAgainstClass9Knowledge,
  getClass9Knowledge
} = require('./class9Knowledge');

/**
 * Detects whether the student prompt requests a structured conceptual/multi-step explanation
 * versus a quick definition or simple single-fact answer.
 */
function isStructuredExplanationRequested(message = '', language = 'English') {
  if (!message || typeof message !== 'string') return false;
  const msg = message.trim();
  const msgLower = msg.toLowerCase();

  // 1. Guard against simple yes/no questions unless asking for explanation/analogy/steps
  const isYesNoOd = /(?:କରେ\s*କି|ହୁଏ\s*କି|ଅଟେ\s*କି|ଥାଏ\s*କି)\??$/i.test(msg);
  if (isYesNoOd && !/(?:ଉଦାହରଣ|ବୁଝାଅ|କିପରି|ସୋପାନ|ପାହାଚ)/.test(msg)) return false;

  const isYesNoEn = /^(?:does|do|is|are|can|will)\s+.*(?:\?|$)/i.test(msg);
  if (isYesNoEn && !/(?:explain|example|analogy|village|step by step|how|why)/i.test(msgLower)) return false;

  // 2. Positive triggers: core conceptual / biological / physical processes that require multi-step explanation
  const coreProcessesEn = [
    'reproduction', 'human reproduction', 'photosynthesis', 'water cycle',
    'respiration', 'cellular respiration', 'laws of motion', 'states of matter',
    'cell division', 'phase change', 'evaporation', 'condensation'
  ];
  const coreProcessesOd = [
    'ପ୍ରଜନନ', 'ମାନବ ପ୍ରଜନନ', 'ଆଲୋକ ସଂଶ୍ଳେଷଣ', 'ଆଲୋକସଂଶ୍ଳେଷଣ', 'ଜଳ ଚକ୍ର', 'ଜଳଚକ୍ର',
    'ଶ୍ୱସନ', 'ଶ୍ୱାସକ୍ରିୟା', 'ବାଷ୍ପୀଭବନ', 'ଘନୀଭବନ', 'ଗତିର ନିୟମ', 'କୋଷ ବିଭାଜନ',
    'ପଦାର୍ଥର ଅବସ୍ଥା'
  ];

  if (coreProcessesEn.some(k => msgLower.includes(k))) return true;
  if (coreProcessesOd.some(k => msg.includes(k))) return true;

  // 3. Positive triggers: explicit request for explanation, steps, analogy, village example, how/why
  const complexTriggersEn = [
    'explain', 'describe', 'step by step', 'steps', 'how does', 'how do', 'how is',
    'why does', 'why do', 'example', 'analogy', 'village', 'village life', 'field',
    'process', 'in detail', 'compare', 'difference between'
  ];
  if (complexTriggersEn.some(trigger => msgLower.includes(trigger))) {
    return true;
  }

  const complexTriggersOd = [
    'ବୁଝାଅ', 'ବୁଝାଇ ଦିଅ', 'ବୁଝାଇଦିଅ', 'ଉଦାହରଣ', 'କିପରି', 'କେମିତି', 'କାହିଁକି',
    'ପ୍ରକ୍ରିୟା', 'ସୋପାନ', 'ପର୍ଯ୍ୟାୟ', 'ପାହାଚ', 'ବର୍ଣ୍ଣନା', 'ଗାଁ', 'କ୍ଷେତ',
    'ବିଲ', 'ଧାନ', 'ତୁଳନା', 'ପାର୍ଥକ୍ୟ'
  ];
  if (complexTriggersOd.some(trigger => msg.includes(trigger))) {
    return true;
  }

  // 4. Guard against simple definitions: "what is X?", "define X", "ଅମ୍ଳଜାନ କ'ଣ?", etc.
  const isSimpleDefEn = /^(?:what is|what's|define|who is|name the)\s+([a-zA-Z0-9_\-\s]+)\??$/i.test(msg);
  if (isSimpleDefEn) return false;

  const isSimpleDefOd = /^(?:[^\s]+|[^\s]+\s+[^\s]+)\s+(?:କ['’]?ଣ|କାହାକୁ\s*କୁହନ୍ତି|କାହାକୁ\s*କୁହାଯାଏ)\??$/i.test(msg);
  if (isSimpleDefOd && !/(?:ଉଦାହରଣ|ବୁଝାଅ|କିପରି|କେମିତି|ପ୍ରକ୍ରିୟା)/.test(msg)) return false;

  return false;
}

/**
 * Returns a deterministic, verified structured educational explanation in Odia
 * with 3 canonical learning steps, intro, final summary, and follow-up question.
 */
function getDeterministicStructuredFallback(topic = 'photosynthesis', message = '', class9Knowledge = null) {
  const msgLower = (message || '').toLowerCase();
  const isVillageAnalogy = /village|ଗାଁ|ଚାଷ|କ୍ଷେତ|ବିଲ|ଧାନ|ପଲ୍ଲୀ/i.test(message);
  const topicId = (class9Knowledge?.id || topic || 'photosynthesis').toLowerCase();

  const isReproduction = /reproduction|ପ୍ରଜନନ|ଜନନ/i.test(message) || topicId.includes('reproduction') || topicId.includes('ପ୍ରଜନନ');
  if (isReproduction) {
    return {
      mode: 'THINKING-MODE',
      intro: 'ଚାଲ, ମାନବ ପ୍ରଜନନ ଏବଂ ନୂତନ ଜୀବନ ସୃଷ୍ଟିର ଜୈବିକ ପ୍ରକ୍ରିୟା ବିଷୟରେ ବୁଝିବା।',
      steps: [
        {
          title: 'ପ୍ରାଥମିକ ଧାରଣା (Start with basics)',
          text: 'ପ୍ରଜନନ ହେଉଛି ଏକ ଜୈବିକ ପ୍ରକ୍ରିୟା ଯେଉଁଥିରେ ପିତା ଓ ମାତାଙ୍କ ଜନନ କୋଷ (ଶୁକ୍ରାଣୁ ଓ ଡିମ୍ବାଣୁ) ର ମିଳନ ଘଟେ।',
          explanation: 'ପ୍ରଜନନ ହେଉଛି ଏକ ଜୈବିକ ପ୍ରକ୍ରିୟା ଯେଉଁଥିରେ ପିତା ଓ ମାତାଙ୍କ ଜନନ କୋଷ (ଶୁକ୍ରାଣୁ ଓ ଡିମ୍ବାଣୁ) ର ମିଳନ ଘଟେ।',
          emoji: '🧬'
        },
        {
          title: 'ମୁଖ୍ୟ ପ୍ରକ୍ରିୟା (Key process explanation)',
          text: 'ଲିଙ୍ଗୀୟ ପ୍ରଜନନରେ ନିଷେଚନ ଦ୍ୱାରା ଯୁଗ୍ମଜ ଗଠନ ହୁଏ ଏବଂ ଏଥିରୁ ନୂତନ ଜୀବର ବିକାଶ ଆରମ୍ଭ ହୁଏ।',
          explanation: 'ଲିଙ୍ଗୀୟ ପ୍ରଜନନରେ ନିଷେଚନ ଦ୍ୱାରା ଯୁଗ୍ମଜ ଗଠନ ହୁଏ ଏବଂ ଏଥିରୁ ନୂତନ ଜୀବର ବିକାଶ ଆରମ୍ଭ ହୁଏ।',
          emoji: '🔬✨'
        }
      ],
      answer: 'ମାନବ ପ୍ରଜନନ ଏକ ଜୈବିକ ପ୍ରକ୍ରିୟା ଯାହା ମାଧ୍ୟମରେ ନୂତନ ସନ୍ତାନ ସୃଷ୍ଟି ହୋଇ ଜୀବଜଗତର ନିରନ୍ତରତା ବଜାୟ ରହେ।',
      summary: 'ମାନବ ପ୍ରଜନନ ଏକ ଜୈବିକ ପ୍ରକ୍ରିୟା ଯାହା ମାଧ୍ୟମରେ ନୂତନ ସନ୍ତାନ ସୃଷ୍ଟି ହୋଇ ଜୀବଜଗତର ନିରନ୍ତରତା ବଜାୟ ରହେ।',
      followup: 'ଲିଙ୍ଗୀୟ ପ୍ରଜନନରେ ଜନନ କୋଷଗୁଡ଼ିକର ଭୂମିକା ବିଷୟରେ ଆଗକୁ ଜାଣିବାକୁ ଚାହୁଁଛ କି?',
      followUp: 'ଲିଙ୍ଗୀୟ ପ୍ରଜନନରେ ଜନନ କୋଷଗୁଡ଼ିକର ଭୂମିକା ବିଷୟରେ ଆଗକୁ ଜାଣିବାକୁ ଚାହୁଁଛ କି?',
      _parseMethod: 'odia_deterministic_structured_fallback'
    };
  }

  if (topicId.includes('photosynthesis') || topicId.includes('ଆଲୋକ')) {
    if (isVillageAnalogy) {
      return {
        mode: 'THINKING-MODE',
        intro: 'ଚାଲ, ଗାଁର ଧାନ କ୍ଷେତ ଏବଂ ପ୍ରକୃତିର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାକୁ ସହଜରେ ବୁଝିବା।',
        steps: [
          {
            title: "ଗଛକୁ ବଢ଼ିବା ପାଇଁ କ'ଣ ଦରକାର",
            text: 'ଗଛକୁ ବଢ଼ିବା ଏବଂ ଖାଦ୍ୟ ତିଆରି ପାଇଁ ସୂର୍ଯ୍ୟାଲୋକ (ପ୍ରାଥମିକ ଶକ୍ତିର ଉତ୍ସ), ମାଟିରୁ ଚେର ଦ୍ୱାରା ଜଳ ଏବଂ ବାୟୁମଣ୍ଡଳରୁ ପତ୍ରରନ୍ଧ୍ର ଦ୍ୱାରା ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ୟାସ ଆବଶ୍ୟକ ହୁଏ।',
            explanation: 'ଗଛକୁ ବଢ଼ିବା ଏବଂ ଖାଦ୍ୟ ତିଆରି ପାଇଁ ସୂର୍ଯ୍ୟାଲୋକ (ପ୍ରାଥମିକ ଶକ୍ତିର ଉତ୍ସ), ମାଟିରୁ ଚେର ଦ୍ୱାରା ଜଳ ଏବଂ ବାୟୁମଣ୍ଡଳରୁ ପତ୍ରରନ୍ଧ୍ର ଦ୍ୱାରା ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ୟାସ ଆବଶ୍ୟକ ହୁଏ।',
            emoji: '☀️🌱💧'
          },
          {
            title: 'ଗାଁର ଧାନ କ୍ଷେତ ଉଦାହରଣ',
            text: 'ଗାଁରେ ଚାଷୀ ଯେପରି ଚୁଲିରେ ରୋଷେଇ କରିବା ପାଇଁ ଜାଳେଣି କାଠ, ପାଣି ଓ ଚାଉଳ ବ୍ୟବହାର କରେ, ସେହିପରି ଧାନ ଗଛର ସବୁଜ ପତ୍ର ହେଉଛି ତାର ରୋଷେଇଶାଳା, ଯେଉଁଠି ସୂର୍ଯ୍ୟାଲୋକର ଶକ୍ତିରେ ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ ହୁଏ।',
            explanation: 'ଗାଁରେ ଚାଷୀ ଯେପରି ଚୁଲିରେ ରୋଷେଇ କରିବା ପାଇଁ ଜାଳେଣି କାଠ, ପାଣି ଓ ଚାଉଳ ବ୍ୟବହାର କରେ, ସେହିପରି ଧାନ ଗଛର ସବୁଜ ପତ୍ର ହେଉଛି ତାର ରୋଷେଇଶାଳା, ଯେଉଁଠି ସୂର୍ଯ୍ୟାଲୋକର ଶକ୍ତିରେ ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ ହୁଏ।',
            emoji: '🌾🧑‍🌾🍲'
          },
          {
            title: 'ଗଛ କିପରି ଖାଦ୍ୟ ତିଆରି କରେ',
            text: 'ପତ୍ରରେ ଥିବା ପତ୍ରହରିତ ସୂର୍ଯ୍ୟାଲୋକ ଶୋଷଣ କରେ। ଏହି ଶକ୍ତିରେ ଜଳ ଓ ଅଙ୍ଗାରକାମ୍ଳ ସାହାଯ୍ୟରେ ଗ୍ଲୁକୋଜ୍ (ଶ୍ୱେତସାର) ପ୍ରସ୍ତୁତ ହୁଏ। ଜଳ ଅଣୁର ବିଭାଜନ ଘଟି ଅମ୍ଳଜାନ ବାୟୁମଣ୍ଡଳକୁ ନିର୍ଗତ ହୁଏ।',
            explanation: 'ପତ୍ରରେ ଥିବା ପତ୍ରହରିତ ସୂର୍ଯ୍ୟାଲୋକ ଶୋଷଣ କରେ। ଏହି ଶକ୍ତିରେ ଜଳ ଓ ଅଙ୍ଗାରକାମ୍ଳ ସାହାଯ୍ୟରେ ଗ୍ଲୁକୋଜ୍ (ଶ୍ୱେତସାର) ପ୍ରସ୍ତୁତ ହୁଏ। ଜଳ ଅଣୁର ବିଭାଜନ ଘଟି ଅମ୍ଳଜାନ ବାୟୁମଣ୍ଡଳକୁ ନିର୍ଗତ ହୁଏ।',
            emoji: '🍃✨💨'
          }
        ],
        answer: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ହେଉଛି ଏକ ପ୍ରକ୍ରିୟା ଯେଉଁଥିରେ ସବୁଜ ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକ, ଜଳ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ବ୍ୟବହାର କରି ନିଜ ପାଇଁ ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରେ ଏବଂ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ।',
        summary: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ହେଉଛି ଏକ ପ୍ରକ୍ରିୟା ଯେଉଁଥିରେ ସବୁଜ ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକ, ଜଳ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ବ୍ୟବହାର କରି ନିଜ ପାଇଁ ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରେ ଏବଂ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ।',
        followup: 'ଯଦି ଗାଁର ଧାନ କ୍ଷେତରେ ଅନେକ ଦିନ ଧରି ସୂର୍ଯ୍ୟାଲୋକ ପଡ଼ିବ ନାହିଁ, ତେବେ ଗଛର ଖାଦ୍ୟ ତିଆରିରେ କ’ଣ ପ୍ରଭାବ ପଡ଼ିବ?',
        followUp: 'ଯଦି ଗାଁର ଧାନ କ୍ଷେତରେ ଅନେକ ଦିନ ଧରି ସୂର୍ଯ୍ୟାଲୋକ ପଡ଼ିବ ନାହିଁ, ତେବେ ଗଛର ଖାଦ୍ୟ ତିଆରିରେ କ’ଣ ପ୍ରଭାବ ପଡ଼ିବ?',
        _parseMethod: 'odia_deterministic_structured_fallback'
      };
    }

    return {
      mode: 'THINKING-MODE',
      intro: 'ଚାଲ, ସବୁଜ ଉଦ୍ଭିଦ କିପରି ଆଲୋକ ସଂଶ୍ଳେଷଣ ମାଧ୍ୟମରେ ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରେ ତାହା ସରଳ ଭାବରେ ବୁଝିବା।',
      steps: [
        {
          title: "ଗଛକୁ କ'ଣ ଆବଶ୍ୟକ",
          text: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ସୂର୍ଯ୍ୟାଲୋକ ହେଉଛି ପ୍ରାଥମିକ ଶକ୍ତିର ଉତ୍ସ। ଉଦ୍ଭିଦ ଚେର ଦ୍ୱାରା ମାଟିରୁ ଜଳ ଏବଂ ପତ୍ରରନ୍ଧ୍ର ଦ୍ୱାରା ବାୟୁରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ।',
          explanation: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ସୂର୍ଯ୍ୟାଲୋକ ହେଉଛି ପ୍ରାଥମିକ ଶକ୍ତିର ଉତ୍ସ। ଉଦ୍ଭିଦ ଚେର ଦ୍ୱାରା ମାଟିରୁ ଜଳ ଏବଂ ପତ୍ରରନ୍ଧ୍ର ଦ୍ୱାରା ବାୟୁରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ।',
          emoji: '☀️💧🌿'
        },
        {
          title: 'ପତ୍ରହରିତର ଭୂମିକା',
          text: 'ପତ୍ରରେ ଥିବା ସବୁଜ ବର୍ଣ୍ଣକଣିକା ପତ୍ରହରିତ (Chlorophyll) ସୂର୍ଯ୍ୟାଲୋକକୁ ଶୋଷଣ କରେ ଏବଂ ହରିତକଣିକାରେ ଏହି ପ୍ରକ୍ରିୟା ସମ୍ପାଦିତ ହୁଏ।',
          explanation: 'ପତ୍ରରେ ଥିବା ସବୁଜ ବର୍ଣ୍ଣକଣିକା ପତ୍ରହରିତ (Chlorophyll) ସୂର୍ଯ୍ୟାଲୋକକୁ ଶୋଷଣ କରେ ଏବଂ ହରିତକଣିକାରେ ଏହି ପ୍ରକ୍ରିୟା ସମ୍ପାଦିତ ହୁଏ।',
          emoji: '🍃🔬✨'
        },
        {
          title: 'ଖାଦ୍ୟ ତିଆରି ଓ ଅମ୍ଳଜାନ ନିର୍ଗମନ',
          text: 'ଜଳ ଓ ଅଙ୍ଗାରକାମ୍ଳ ସାହାଯ୍ୟରେ ଗ୍ଲୁକୋଜ୍ ବା ଶ୍ୱେତସାର ତିଆରି ହୁଏ। ଜଳ ଅଣୁର ବିଭାଜନ ଘଟି ଅମ୍ଳଜାନ ଗ୍ୟାସ ବାୟୁମଣ୍ଡଳକୁ ନିର୍ଗତ ହୁଏ।',
          explanation: 'ଜଳ ଓ ଅଙ୍ଗାରକାମ୍ଳ ସାହାଯ୍ୟରେ ଗ୍ଲୁକୋଜ୍ ବା ଶ୍ୱେତସାର ତିଆରି ହୁଏ। ଜଳ ଅଣୁର ବିଭାଜନ ଘଟି ଅମ୍ଳଜାନ ଗ୍ୟାସ ବାୟୁମଣ୍ଡଳକୁ ନିର୍ଗତ ହୁଏ।',
          emoji: '🌾💨🌱'
        }
      ],
      answer: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ସବୁଜ ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକ, ଜଳ ଓ ଅଙ୍ଗାରକାମ୍ଳ ବ୍ୟବହାର କରି ଖାଦ୍ୟ ତିଆରି କରେ ଏବଂ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ।',
      summary: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ସବୁଜ ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକ, ଜଳ ଓ ଅଙ୍ଗାରକାମ୍ଳ ବ୍ୟବହାର କରି ଖାଦ୍ୟ ତିଆରି କରେ ଏବଂ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ।',
      followup: 'ରାତିରେ ସୂର୍ଯ୍ୟାଲୋକ ନ ଥିଲେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟା ଚାଲିପାରିବ କି?',
      followUp: 'ରାତିରେ ସୂର୍ଯ୍ୟାଲୋକ ନ ଥିଲେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟା ଚାଲିପାରିବ କି?',
      _parseMethod: 'odia_deterministic_structured_fallback'
    };
  }

  if (topicId.includes('respiration') || topicId.includes('ଶ୍ୱସନ') || topicId.includes('ଶ୍ୱାସକ୍ରିୟା')) {
    return {
      mode: 'THINKING-MODE',
      intro: 'ଚାଲ, ଜୀବଜଗତରେ ଶ୍ୱାସକ୍ରିୟା ଏବଂ ଶ୍ୱସନ ପ୍ରକ୍ରିୟା କିପରି କାର୍ଯ୍ୟ କରେ ତାହା ସହଜରେ ବୁଝିବା।',
      steps: [
        {
          title: 'ମଣିଷର ଶ୍ୱାସକ୍ରିୟା',
          text: 'ମଣିଷ ଶ୍ୱସନ ଓ ଶ୍ୱାସକ୍ରିୟା ସମୟରେ (ପ୍ରଶ୍ୱାସରେ) ବାୟୁରୁ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ ଏବଂ ଶ୍ୱାସ ଛାଡ଼ିବା ସମୟରେ (ନିଃଶ୍ୱାସରେ) ଅଙ୍ଗାରକାମ୍ଳ ବାହାର କରିଥାଏ।',
          explanation: 'ମଣିଷ ଶ୍ୱସନ ଓ ଶ୍ୱାସକ୍ରିୟା ସମୟରେ (ପ୍ରଶ୍ୱାସରେ) ବାୟୁରୁ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ ଏବଂ ଶ୍ୱାସ ଛାଡ଼ିବା ସମୟରେ (ନିଃଶ୍ୱାସରେ) ଅଙ୍ଗାରକାମ୍ଳ ବାହାର କରିଥାଏ।',
          emoji: '🫁💨'
        },
        {
          title: 'ଗଛର ନିରନ୍ତର ଶ୍ୱସନ',
          text: 'ଉଦ୍ଭିଦମାନେ ଦିନ ଏବଂ ରାତି ଉଭୟ ସମୟରେ ନିରନ୍ତର ଶ୍ୱସନ କରନ୍ତି। ଶ୍ୱସନରେ ଗଛ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରେ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରେ।',
          explanation: 'ଉଦ୍ଭିଦମାନେ ଦିନ ଏବଂ ରାତି ଉଭୟ ସମୟରେ ନିରନ୍ତର ଶ୍ୱସନ କରନ୍ତି। ଶ୍ୱସନରେ ଗଛ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରେ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରେ।',
          emoji: '🌳🌙☀️'
        },
        {
          title: 'ଶକ୍ତି ମୁକ୍ତି ପ୍ରକ୍ରିୟା',
          text: 'କୋଷୀୟ ଶ୍ୱସନ ମାଇଟୋକଣ୍ଡ୍ରିଆରେ ସମ୍ପାଦିତ ହୋଇ ଖାଦ୍ୟ (ଗ୍ଲୁକୋଜ୍) ରୁ ଜୀବନ ଧାରଣ ପାଇଁ ଶକ୍ତି (ATP) ମୁକ୍ତ କରେ।',
          explanation: 'କୋଷୀୟ ଶ୍ୱସନ ମାଇଟୋକଣ୍ଡ୍ରିଆରେ ସମ୍ପାଦିତ ହୋଇ ଖାଦ୍ୟ (ଗ୍ଲୁକୋଜ୍) ରୁ ଜୀବନ ଧାରଣ ପାଇଁ ଶକ୍ତି (ATP) ମୁକ୍ତ କରେ।',
          emoji: '⚡🔋'
        }
      ],
      answer: 'ଶ୍ୱସନ ହେଉଛି ଏକ ଜୈବିକ ପ୍ରକ୍ରିୟା ଯେଉଁଥିରେ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରି ଖାଦ୍ୟରୁ ଶକ୍ତି ଉତ୍ପନ୍ନ ହୁଏ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ନିର୍ଗତ ହୁଏ।',
      summary: 'ଶ୍ୱସନ ହେଉଛି ଏକ ଜୈବିକ ପ୍ରକ୍ରିୟା ଯେଉଁଥିରେ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରି ଖାଦ୍ୟରୁ ଶକ୍ତି ଉତ୍ପନ୍ନ ହୁଏ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ନିର୍ଗତ ହୁଏ।',
      followup: 'ଦିନବେଳେ ଗଛରେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ଓ ଶ୍ୱସନ କିପରି ଏକାସାଙ୍ଗରେ ଚାଲେ?',
      followUp: 'ଦିନବେଳେ ଗଛରେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ଓ ଶ୍ୱସନ କିପରି ଏକାସାଙ୍ଗରେ ଚାଲେ?',
      _parseMethod: 'odia_deterministic_structured_fallback'
    };
  }

  if (topicId.includes('states_of_matter') || topicId.includes('water_state_change') || topicId.includes('ବାଷ୍ପୀଭବନ')) {
    return {
      mode: 'THINKING-MODE',
      intro: 'ଚାଲ, ପଦାର୍ଥର ଅବସ୍ଥା ପରିବର୍ତ୍ତନ ଏବଂ ଜଳର ବିଭିନ୍ନ ରୂପ ବିଷୟରେ ବୁଝିବା।',
      steps: [
        {
          title: 'ପଦାର୍ଥର ତିନୋଟି ଅବସ୍ଥା',
          text: 'ଜଳ ତିନୋଟି ଭୌତିକ ଅବସ୍ଥାରେ ରହିପାରେ: କଠିନ (ବରଫ), ତରଳ (ଜଳ), ଏବଂ ଗ୍ୟାସୀୟ (ଜଳୀୟ ବାଷ୍ପ)।',
          explanation: 'ଜଳ ତିନୋଟି ଭୌତିକ ଅବସ୍ଥାରେ ରହିପାରେ: କଠିନ (ବରଫ), ତରଳ (ଜଳ), ଏବଂ ଗ୍ୟାସୀୟ (ଜଳୀୟ ବାଷ୍ପ)।',
          emoji: '🧊💧💨'
        },
        {
          title: 'ବାଷ୍ପୀଭବନ ପ୍ରକ୍ରିୟା',
          text: 'ପାଣିକୁ ଉତ୍ତପ୍ତ କଲେ ଏହା ତରଳରୁ ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହୁଏ। ସାଧାରଣ ଚାପରେ ଜଳର ସ୍ଫୁଟନାଙ୍କ ୧୦୦°C ଅଟେ।',
          explanation: 'ପାଣିକୁ ଉତ୍ତପ୍ତ କଲେ ଏହା ତରଳରୁ ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହୁଏ। ସାଧାରଣ ଚାପରେ ଜଳର ସ୍ଫୁଟନାଙ୍କ ୧୦୦°C ଅଟେ।',
          emoji: '🔥♨️'
        },
        {
          title: 'ଘନୀଭବନ ପ୍ରକ୍ରିୟା',
          text: 'ବାଷ୍ପ ଥଣ୍ଡା ହୋଇ ତରଳ ଜଳରେ ପରିଣତ ହେବା ପ୍ରକ୍ରିୟାକୁ ଘନୀଭବନ କୁହାଯାଏ।',
          explanation: 'ବାଷ୍ପ ଥଣ୍ଡା ହୋଇ ତରଳ ଜଳରେ ପରିଣତ ହେବା ପ୍ରକ୍ରିୟାକୁ ଘନୀଭବନ କୁହାଯାଏ।',
          emoji: '🌧️🔄'
        }
      ],
      answer: 'ଜଳ ଉତ୍ତାପ ଯୋଗୁଁ ତରଳରୁ ଜଳୀୟ ବାଷ୍ପ (ଗ୍ୟାସ) ରେ ଏବଂ ଥଣ୍ଡା ହେଲେ ବାଷ୍ପରୁ ତରଳରେ ପରିଣତ ହୁଏ।',
      summary: 'ଜଳ ଉତ୍ତାପ ଯୋଗୁଁ ତରଳରୁ ଜଳୀୟ ବାଷ୍ପ (ଗ୍ୟାସ) ରେ ଏବଂ ଥଣ୍ଡା ହେଲେ ବାଷ୍ପରୁ ତରଳରେ ପରିଣତ ହୁଏ।',
      followup: '୧୦୦ ଡିଗ୍ରୀ ଉତ୍ତାପରେ ଜଳ କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତିତ ହୁଏ?',
      followUp: '୧୦୦ ଡିଗ୍ରୀ ଉତ୍ତାପରେ ଜଳ କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତିତ ହୁଏ?',
      _parseMethod: 'odia_deterministic_structured_fallback'
    };
  }

  const isMotion = /motion|ଗତି/i.test(message) || topicId.includes('motion') || topicId.includes('ଗତି');
  if (isMotion) {
    return {
      mode: 'THINKING-MODE',
      intro: 'ଚାଲ, ପଦାର୍ଥ ବିଜ୍ଞାନରେ ଗତିର ଧାରଣା ଏବଂ ଏହାର ଗୁରୁତ୍ୱ ବିଷୟରେ ବୁଝିବା।',
      steps: [
        {
          title: 'ମୌଳିକ ସଂଜ୍ଞା (Basic definition)',
          text: 'ସମୟ ସହିତ କୌଣସି ବସ୍ତୁର ସ୍ଥାନ ପରିବର୍ତ୍ତନକୁ ଗତି କୁହାଯାଏ।',
          explanation: 'ସମୟ ସହିତ କୌଣସି ବସ୍ତୁର ସ୍ଥାନ ପରିବର୍ତ୍ତନକୁ ଗତି କୁହାଯାଏ।',
          emoji: '🏃‍♂️🚗'
        },
        {
          title: 'ପ୍ରମୁଖ ବୈଶିଷ୍ଟ୍ୟ (Key characteristics)',
          text: 'ଗତି ସର୍ବଦା ଆପେକ୍ଷିକ ଅଟେ; ପାରିପାର୍ଶ୍ୱିକ ସ୍ଥିର ବସ୍ତୁ ବା ନିରୀକ୍ଷକ ତୁଳନାରେ ଏହାର ପରିମାପ କରାଯାଏ।',
          explanation: 'ଗତି ସର୍ବଦା ଆପେକ୍ଷିକ ଅଟେ; ପାରିପାର୍ଶ୍ୱିକ ସ୍ଥିର ବସ୍ତୁ ବା ନିରୀକ୍ଷକ ତୁଳନାରେ ଏହାର ପରିମାପ କରାଯାଏ।',
          emoji: '🚌📍'
        }
      ],
      answer: 'ସମୟ ସହିତ କୌଣସି ବସ୍ତୁର ସ୍ଥାନ ପରିବର୍ତ୍ତନକୁ ଗତି କୁହାଯାଏ ଏବଂ ଏହା ନିରୀକ୍ଷକଙ୍କ ତୁଳନାରେ ନିର୍ଣ୍ଣୟ କରାଯାଏ।',
      summary: 'ସମୟ ସହିତ କୌଣସି ବସ୍ତୁର ସ୍ଥାନ ପରିବର୍ତ୍ତନକୁ ଗତି କୁହାଯାଏ ଏବଂ ଏହା ନିରୀକ୍ଷକଙ୍କ ତୁଳନାରେ ନିର୍ଣ୍ଣୟ କରାଯାଏ।',
      followup: 'ତୁମ ଚାରିପାଖରେ ଦେଖୁଥିବା କୌଣସି ଗତିଶୀଳ ବସ୍ତୁର ଉଦାହରଣ ଦେଇପାରିବ କି?',
      followUp: 'ତୁମ ଚାରିପାଖରେ ଦେଖୁଥିବା କୌଣସି ଗତିଶୀଳ ବସ୍ତୁର ଉଦାହରଣ ଦେଇପାରିବ କି?',
      _parseMethod: 'odia_deterministic_structured_fallback'
    };
  }

  const isForce = /force|ବଳ/i.test(message) || topicId.includes('force') || topicId.includes('ବଳ');
  if (isForce) {
    return {
      mode: 'THINKING-MODE',
      intro: 'ଚାଲ, ବିଜ୍ଞାନରେ ବଳ ଏବଂ ଏହାର ପ୍ରଭାବ ବିଷୟରେ ସହଜରେ ବୁଝିବା।',
      steps: [
        {
          title: 'ମୌଳିକ ସଂଜ୍ଞା (Basic definition)',
          text: 'ବଳ ହେଉଛି ଏକ ବାହ୍ୟ ପ୍ରଭାବ (ଠେଲିବା ବା ଟାଣିବା) ଯାହା କୌଣସି ବସ୍ତୁର ସ୍ଥିତି ବା ଗତିରେ ପରିବର୍ତ୍ତନ ଆଣିପାରେ।',
          explanation: 'ବଳ ହେଉଛି ଏକ ବାହ୍ୟ ପ୍ରଭାବ (ଠେଲିବା ବା ଟାଣିବା) ଯାହା କୌଣସି ବସ୍ତୁର ସ୍ଥିତି ବା ଗତିରେ ପରିବର୍ତ୍ତନ ଆଣିପାରେ।',
          emoji: '💪📦'
        },
        {
          title: 'ବଳର ପ୍ରଭାବ (Effects of force)',
          text: 'ବଳ ପ୍ରୟୋଗ କରି ଏକ ସ୍ଥିର ବସ୍ତୁକୁ ଗତିଶୀଳ କରାଯାଇପାରେ କିମ୍ବା ଗତିର ଦିଗ ଓ ବେଗ ପରିବର୍ତ୍ତନ କରାଯାଇପାରେ।',
          explanation: 'ବଳ ପ୍ରୟୋଗ କରି ଏକ ସ୍ଥିର ବସ୍ତୁକୁ ଗତିଶୀଳ କରାଯାଇପାରେ କିମ୍ବା ଗତିର ଦିଗ ଓ ବେଗ ପରିବର୍ତ୍ତନ କରାଯାଇପାରେ।',
          emoji: '🎯⚡'
        }
      ],
      answer: 'ବଳ ହେଉଛି ଏକ ଠେଲିବା ବା ଟାଣିବା ପ୍ରକ୍ରିୟା ଯାହା ବସ୍ତୁର ଗତି, ଦିଗ କିମ୍ବା ଆକାର ପରିବର୍ତ୍ତନ କରିପାରେ।',
      summary: 'ବଳ ହେଉଛି ଏକ ଠେଲିବା ବା ଟାଣିବା ପ୍ରକ୍ରିୟା ଯାହା ବସ୍ତୁର ଗତି, ଦିଗ କିମ୍ବା ଆକାର ପରିବର୍ତ୍ତନ କରିପାରେ।',
      followup: 'ଏକ ସ୍ଥିର ବସ୍ତୁକୁ ଗତିଶୀଳ କରିବା ପାଇଁ କ’ଣ ପ୍ରୟୋଗ କରିବାକୁ ପଡ଼େ?',
      followUp: 'ଏକ ସ୍ଥିର ବସ୍ତୁକୁ ଗତିଶୀଳ କରିବା ପାଇଁ କ’ଣ ପ୍ରୟୋଗ କରିବାକୁ ପଡ଼େ?',
      _parseMethod: 'odia_deterministic_structured_fallback'
    };
  }

  // General fallback structured schema
  const verifiedExp = (class9Knowledge?.verifiedExplanation && !/[a-zA-Z]{4,}/.test(class9Knowledge.verifiedExplanation))
    ? class9Knowledge.verifiedExplanation
    : 'ବିଷୟଟିର ବୈଜ୍ଞାନିକ ଧାରଣା ଏଠାରେ ସ୍ପଷ୍ଟ କରାଯାଇଛି।';
  const odiaFacts = (class9Knowledge?.verifiedFacts || []).filter(f => typeof f === 'string' && /[\u0b00-\u0b7f]/.test(f) && !/[a-zA-Z]{4,}/.test(f));
  const fact1 = odiaFacts[0] || verifiedExp;
  const fact2 = odiaFacts[1] || verifiedExp;

  return {
    mode: 'THINKING-MODE',
    intro: `ଚାଲ, ${class9Knowledge?.odiaName || 'ଏହି ପାଠ'} ବିଷୟରେ ସହଜରେ ବୁଝିବା।`,
    steps: [
      {
        title: 'ମୌଳିକ ଧାରଣା',
        text: verifiedExp,
        explanation: verifiedExp,
        emoji: '📖'
      },
      {
        title: 'ମୁଖ୍ୟ କାର୍ଯ୍ୟପଦ୍ଧତି',
        text: fact1,
        explanation: fact1,
        emoji: '🔬'
      },
      {
        title: 'ବୈଜ୍ଞାନିକ ମହତ୍ତ୍ୱ',
        text: fact2,
        explanation: fact2,
        emoji: '✨'
      }
    ],
    answer: verifiedExp,
    summary: verifiedExp,
    followup: 'ଏହି ବିଷୟରେ ତୁମ ମନରେ ଆଉ କିଛି ପ୍ରଶ୍ନ ଅଛି କି?',
    followUp: 'ଏହି ବିଷୟରେ ତୁମ ମନରେ ଆଉ କିଛି ପ୍ରଶ୍ନ ଅଛି କି?',
    _parseMethod: 'odia_deterministic_structured_fallback'
  };
}

/**
 * Validates a structured tutor response against language safety, Class 9 facts, and terminology.
 */
function validateStructuredResponse(structured, message = '', language = 'Odia', class9Knowledge = null) {
  if (!structured || typeof structured !== 'object') {
    return { valid: false, reason: 'empty_structure' };
  }

  if (language !== 'Odia' && !isOdia(language)) {
    // English structure sanity check
    const hasSteps = Array.isArray(structured.steps) && structured.steps.length > 0;
    const hasAnswer = !!(structured.answer || structured.summary);
    return { valid: hasSteps && hasAnswer };
  }

  // Odia Structured Validation
  // 1. Validate each individual textual field independently to ensure no field carries corrupted terms
  const fieldsToValidate = [
    { name: 'intro', text: structured.intro },
    ...(Array.isArray(structured.steps) ? structured.steps.flatMap((s, idx) => [
      { name: `step_${idx}_title`, text: s.title },
      { name: `step_${idx}_explanation`, text: s.text || s.explanation }
    ]) : []),
    { name: 'summary', text: structured.answer || structured.summary },
    { name: 'followUp', text: structured.followup || structured.followUp }
  ].filter(f => Boolean(f.text));

  for (const field of fieldsToValidate) {
    const valField = validateOdiaTutorAnswer(field.text, '');
    if (!valField.valid) {
      return { valid: false, reason: `field_${field.name}_${valField.reason}`, detail: valField.detail, failedFactRule: valField.failedFactRule };
    }
  }

  // 2. Validate concatenated content for holistic language and curriculum checks
  const allTexts = [
    structured.intro,
    ...(Array.isArray(structured.steps) ? structured.steps.map(s => `${s.title}: ${s.text || s.explanation}`) : []),
    structured.answer || structured.summary,
    structured.followup || structured.followUp
  ].filter(Boolean);

  const fullText = allTexts.join('\n');

  const valOdia = validateOdiaTutorAnswer(fullText, message);
  if (!valOdia.valid) {
    return { valid: false, reason: valOdia.reason, detail: valOdia.detail, failedFactRule: valOdia.failedFactRule };
  }

  // 3. Class 9 Educational Knowledge Validation
  if (class9Knowledge) {
    const valClass9 = validateAgainstClass9Knowledge(fullText, class9Knowledge);
    if (!valClass9.valid) {
      return { valid: false, reason: valClass9.reason, detail: valClass9.detail };
    }
  }

  // 4. Factual Relationships Validation (Rules 1-10)
  const valFacts = validateFactualRelationships(fullText, message);
  if (!valFacts.valid) {
    return { valid: false, reason: valFacts.reason, detail: valFacts.detail, failedFactRule: valFacts.failedFactRule };
  }

  return { valid: true };
}

/**
 * Builds the application-controlled structured Odia tutor response.
 * Bridges Dhee-Odia output into the universal structured schema or provides
 * a validated deterministic structured fallback.
 */
function buildStructuredOdiaTutorResponse({
  rawReply = '',
  message = '',
  odiaContentPlan = null,
  class9Knowledge = null,
  level = 'beginner'
}) {
  const needsStructured = isStructuredExplanationRequested(message, 'Odia');

  // Attempt to build structured response:
  const deterministicFallback = getDeterministicStructuredFallback(
    class9Knowledge?.id || odiaContentPlan?.topic,
    message,
    class9Knowledge
  );

  // If rawReply exists, check if it can be decomposed into structured sections:
  let candidateStructured = null;
  const rawClean = (rawReply || '').trim();
  const stepMatches = rawClean.match(/(?:^|\n)\s*(?:[୧-୯\d]+[\.\)]|Step\s*[୧-୯\d]+:|ପର୍ଯ୍ୟାୟ\s*[୧-୯\d]+:|ପାହାଚ\s*[୧-୯\d]+:)\s*([^\n]+)/gi);

  if (stepMatches && stepMatches.length >= 2) {
    const parsedSteps = stepMatches.slice(0, 3).map((s, idx) => {
      const cleaned = s.replace(/^[^\w\u0b00-\u0b7f]+/, '').trim();
      const parts = cleaned.split(/[:\-–—]/);
      const title = parts.length > 1 ? parts[0].trim() : (idx === 0 ? 'ପ୍ରାଥମିକ ଧାରଣା' : idx === 1 ? 'ମୁଖ୍ୟ ପ୍ରକ୍ରିୟା' : 'ଅଧିକ ସ୍ପଷ୍ଟୀକରଣ');
      const text = parts.length > 1 ? parts.slice(1).join(':').trim() : cleaned;
      return {
        title,
        text,
        explanation: text,
        emoji: idx === 0 ? '☀️' : idx === 1 ? '🔬' : '✨'
      };
    });

    candidateStructured = {
      mode: needsStructured ? 'THINKING-MODE' : 'QUICK-FIRE',
      intro: deterministicFallback.intro,
      steps: parsedSteps,
      answer: deterministicFallback.answer,
      summary: deterministicFallback.summary,
      followup: deterministicFallback.followup,
      followUp: deterministicFallback.followUp,
      _parseMethod: 'odia_llm_decomposed'
    };
  } else {
    // Check if rawReply has multiple sentences to decompose into pedagogical steps
    const sentences = rawClean
      .split(/(?:[।|!?\n]+|\.\s+)/)
      .map(s => s.trim())
      .filter(s => s.length > 10);

    if (sentences.length >= 2) {
      const candidateSteps = [
        {
          title: 'ପ୍ରାଥମିକ ଧାରଣା (Start with basics)',
          text: sentences[0],
          explanation: sentences[0],
          emoji: '📖'
        },
        {
          title: 'ମୁଖ୍ୟ ପ୍ରକ୍ରିୟା (Key process explanation)',
          text: sentences[1],
          explanation: sentences[1],
          emoji: '🔬'
        }
      ];
      if (sentences.length >= 3) {
        candidateSteps.push({
          title: 'ଅଧିକ ସ୍ପଷ୍ଟୀକରଣ (Key details)',
          text: sentences[2],
          explanation: sentences[2],
          emoji: '✨'
        });
      }

      candidateStructured = {
        mode: needsStructured ? 'THINKING-MODE' : 'QUICK-FIRE',
        intro: deterministicFallback.intro,
        steps: candidateSteps,
        answer: sentences.slice(0, 2).join(' । ') + ' ।',
        summary: sentences.slice(0, 2).join(' । ') + ' ।',
        followup: deterministicFallback.followup,
        followUp: deterministicFallback.followUp,
        _parseMethod: 'odia_llm_sentence_decomposed'
      };
    } else if (sentences.length === 1) {
      // Single clean sentence response (e.g. concise definition)
      // Provide structured 2-step card: Step 1 (Definition) + Step 2 (Characteristics/Details)
      const step2 = deterministicFallback.steps?.[1] || {
        title: 'ପ୍ରମୁଖ ବୈଶିଷ୍ଟ୍ୟ (Key characteristics)',
        text: 'ଏହା ଏକ ମୌଳିକ ବୈଜ୍ଞାନିକ ଧାରଣା ଯାହା ପର୍ଯ୍ୟବେକ୍ଷଣ ଓ ନିୟମ ଉପରେ ଆଧାରିତ।',
        explanation: 'ଏହା ଏକ ମୌଳିକ ବୈଜ୍ଞାନିକ ଧାରଣା ଯାହା ପର୍ଯ୍ୟବେକ୍ଷଣ ଓ ନିୟମ ଉପରେ ଆଧାରିତ।',
        emoji: '🔬'
      };
      const candidateSteps = [
        {
          title: 'ମୌଳିକ ସଂଜ୍ଞା (Basic definition)',
          text: sentences[0],
          explanation: sentences[0],
          emoji: '📖'
        },
        step2
      ];

      candidateStructured = {
        mode: needsStructured ? 'THINKING-MODE' : 'QUICK-FIRE',
        intro: deterministicFallback.intro,
        steps: candidateSteps,
        answer: sentences[0],
        summary: sentences[0],
        followup: deterministicFallback.followup,
        followUp: deterministicFallback.followUp,
        _parseMethod: 'odia_llm_single_sentence_structured'
      };
    }
  }

  if (candidateStructured) {
    const val = validateStructuredResponse(candidateStructured, message, 'Odia', class9Knowledge);
    if (val.valid) {
      return candidateStructured;
    }
  }

  // If LLM structured candidate is unavailable or failed validation,
  // use the verified deterministic structured fallback (which is guaranteed 100% valid)
  const fallbackVal = validateStructuredResponse(deterministicFallback, message, 'Odia', class9Knowledge);
  if (!fallbackVal.valid) {
    console.warn('[Structured Tutor] Fallback validation warning:', fallbackVal.reason, fallbackVal.detail);
  }

  return deterministicFallback;
}

module.exports = {
  isStructuredExplanationRequested,
  getDeterministicStructuredFallback,
  validateStructuredResponse,
  buildStructuredOdiaTutorResponse
};
