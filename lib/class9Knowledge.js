'use strict';

const {
  CORRUPTED_ODIA_VOCAB,
  validateOdiaTutorAnswer
} = require('./languagePolicy');
const { findCurriculumConcept } = require('./curriculumKnowledge');

/**
 * Class 9 Verified Educational Knowledge Base for Odia Tutor.
 * Covers 8 core science topics from SCERT Odisha Class 9 curriculum.
 * Ensures the local LLM (dhee-odia) is grounded in verified textbook facts.
 */
const CLASS_9_KNOWLEDGE = {
  photosynthesis: {
    id: 'photosynthesis',
    englishName: 'Photosynthesis',
    odiaName: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ',
    concepts: [
      'sunlight',
      'carbon_dioxide',
      'water',
      'oxygen',
      'chlorophyll',
      'chloroplast',
      'stomata',
      'glucose_starch'
    ],
    terminology: [
      {
        concept: 'photosynthesis',
        canonical: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ',
        english: 'photosynthesis',
        forbidden: ['ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ', 'ଉଦ୍ଭିଦ ସଂଶ୍ଳେଷଣ', 'ଫୋଟୋସିନ୍ଥେସିସ']
      },
      {
        concept: 'stomata',
        canonical: 'ପତ୍ରରନ୍ଧ୍ର',
        english: 'stomata',
        forbidden: ['ପତ୍ରର ମାଂସପେଶୀ', 'ମାଂସପେଶୀ', 'ଷ୍ଟୋମାଟା']
      },
      {
        concept: 'chlorophyll',
        canonical: 'ପତ୍ରହରିତ',
        english: 'chlorophyll',
        forbidden: ['କ୍ଲୋରୋଫିଲ', 'କ୍ଲୋରୋଫିଲ୍', 'ପତ୍ରର ସବୁଜ ରଙ୍ଗ']
      },
      {
        concept: 'chloroplast',
        canonical: 'ହରିତକଣିକା',
        english: 'chloroplast',
        forbidden: ['ଗୋଲାକ', 'କ୍ଲୋରୋପ୍ଲାଷ୍ଟ']
      },
      {
        concept: 'carbon_dioxide',
        canonical: 'ଅଙ୍ଗାରକାମ୍ଳ',
        english: 'carbon dioxide',
        forbidden: ['କାର୍ବନ ଡାଇଅକ୍ସାଇଡ', 'କାର୍ବନ ଡାଇଅକ୍ସାଇଡ୍']
      },
      {
        concept: 'oxygen',
        canonical: 'ଅମ୍ଳଜାନ',
        english: 'oxygen',
        forbidden: ['ଅକ୍ସିଜେନ', 'ଅକ୍ସିଜେନ୍']
      },
      {
        concept: 'water',
        canonical: 'ଜଳ',
        english: 'water',
        forbidden: ['ୱାଟର']
      },
      {
        concept: 'sunlight',
        canonical: 'ସୂର୍ଯ୍ୟାଲୋକ',
        english: 'sunlight',
        forbidden: ['ସୂର୍ଯ୍ୟାସ୍ଥଳୀ', 'ସନଲାଇଟ']
      },
      {
        concept: 'glucose_starch',
        canonical: 'ଶ୍ୱେତସାର',
        english: 'glucose / starch',
        forbidden: ['ଷ୍ଟାର୍ଚ']
      }
    ],
    verifiedFacts: [
      'ସୂର୍ଯ୍ୟାଲୋକ (Sunlight) ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ପ୍ରାଥମିକ ଶକ୍ତିର ଉତ୍ସ ଅଟେ।',
      'ଉଦ୍ଭିଦ ବାୟୁମଣ୍ଡଳରୁ ପତ୍ରରନ୍ଧ୍ର (Stomata) ମାଧ୍ୟମରେ ଅଙ୍ଗାରକାମ୍ଳ (CO2) ଗ୍ରହଣ କରେ।',
      'ଉଦ୍ଭିଦ ଚେର ଦ୍ୱାରା ମାଟିରୁ ଜଳ (Water) ଏବଂ ଖଣିଜ ଲବଣ ଶୋଷଣ କରେ।',
      'ଏହି ପ୍ରକ୍ରିୟାରେ ଉପ-ଉତ୍ପାଦ (by-product) ଭାବରେ ଅମ୍ଳଜାନ (Oxygen) ବାୟୁମଣ୍ଡଳକୁ ନିର୍ଗତ ହୁଏ।',
      'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ନିର୍ଗତ ଅମ୍ଳଜାନ (Oxygen) ଜଳ (Water) ଅଣୁର ବିଭାଜନରୁ ଆସିଥାଏ।',
      'ଆଲୋକ ପ୍ରକ୍ରିୟା ସମୟରେ ଜଳର ବିଭାଜନ ଘଟି ଜଳରୁ ଅମ୍ଳଜାନ ମୁକ୍ତ ହୁଏ।',
      'ଅଙ୍ଗାରକାମ୍ଳ (CO2) କେବଳ ଶ୍ୱେତସାର ବା ଗ୍ଲୁକୋଜ୍ ପ୍ରସ୍ତୁତି ପାଇଁ ବ୍ୟବହୃତ ହୁଏ; ନିର୍ଗତ ଅମ୍ଳଜାନ ଅଙ୍ଗାରକାମ୍ଳରୁ ଆସେ ନାହିଁ।',
      'ପତ୍ରରେ ଥିବା ସବୁଜ ବର୍ଣ୍ଣକଣିକା ପତ୍ରହରିତ (Chlorophyll) ସୌରଶକ୍ତି ଶୋଷଣ କରେ।',
      'ହରିତକଣିକା (Chloroplast) ହେଉଛି ଆଲୋକ ସଂଶ୍ଳେଷଣର କାର୍ଯ୍ୟସ୍ଥଳୀ (site)।',
      'ପ୍ରସ୍ତୁତ ଖାଦ୍ୟ ଗ୍ଲୁକୋଜ୍ ରୂପେ ସୃଷ୍ଟି ହୋଇ ଶ୍ୱେତସାର (Starch) ଭାବରେ ସଞ୍ଚିତ ହୁଏ।',
      'ରାତିରେ ସୂର୍ଯ୍ୟାଲୋକ ନ ଥିବାରୁ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବନ୍ଦ ରହେ; ଉଦ୍ଭିଦ ରାତିରେ ଅଙ୍ଗାରକାମ୍ଳ ସଞ୍ଚୟ କରି ରଖନ୍ତି ନାହିଁ।'
    ],
    commonMisconceptions: [
      'ଅମ୍ଳଜାନ ଆଲୋକ ସଂଶ୍ଳେଷଣର ଉପାଦାନ ବା ଗ୍ରହଣ କରାଯାଉଥିବା ଗ୍ୟାସ ନୁହେଁ।',
      'ଅଙ୍ଗାରକାମ୍ଳ ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ନିର୍ଗତ ହୁଏ ନାହିଁ।',
      'ଜଳ ଆଲୋକ ସଂଶ୍ଳେଷଣର ମୁଖ୍ୟ ଉତ୍ପାଦ ନୁହେଁ, ଏହା ବ୍ୟବହୃତ ଉପାଦାନ।',
      'ସୂର୍ଯ୍ୟାଲୋକ ଏକ ପଦାର୍ଥ ବା ଖାଦ୍ୟ ନୁହେଁ, ଏହା ଶକ୍ତିର ଉତ୍ସ।',
      'ଗଛମାନେ ରାତିରେ ଅଙ୍ଗାରକାମ୍ଳ ସଞ୍ଚୟ କରି ରଖିବା ଯୋଗୁଁ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବନ୍ଦ ହୁଏ ନାହିଁ।',
      'ଅମ୍ଳଜାନ ଅଙ୍ଗାରକାମ୍ଳରୁ (CO2) ଆସେ ନାହିଁ; ଏହା ଜଳର ବିଭାଜନରୁ ମୁକ୍ତ ହୁଏ।'
    ],
    canonicalTerms: [
      'ଆଲୋକ ସଂଶ୍ଳେଷଣ',
      'ସୂର୍ଯ୍ୟାଲୋକ',
      'ଅଙ୍ଗାରକାମ୍ଳ',
      'ଅମ୍ଳଜାନ',
      'ଜଳ',
      'ପତ୍ରହରିତ',
      'ହରିତକଣିକା',
      'ପତ୍ରରନ୍ଧ୍ର',
      'ଶ୍ୱେତସାର'
    ],
    verifiedExplanation: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ହେଉଛି ସବୁଜ ଉଦ୍ଭିଦ ନିଜର ଖାଦ୍ୟ ତିଆରି କରିବାର ଏକ ପ୍ରକ୍ରିୟା। ଏଥିପାଇଁ ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକର ଶକ୍ତି ବ୍ୟବହାର କରେ। ଉଦ୍ଭିଦ ମାଟିରୁ ଜଳ ଏବଂ ବାୟୁରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରି ଖାଦ୍ୟ ତିଆରି କରେ। ଏହି ପ୍ରକ୍ରିୟାରେ ଅମ୍ଳଜାନ ନିର୍ଗତ ହୁଏ।',
    targetedFallbacks: [
      {
        intent: 'oxygen_source',
        match: (text) => /(?:ଅମ୍ଳଜାନ|oxygen).*(?:କେଉଁଠାରୁ|କେଉଁଠୁ|ଉତ୍ସ|ଆସେ)|(?:କେଉଁଠାରୁ|କେଉଁଠୁ|ଉତ୍ସ).*(?:ଅମ୍ଳଜାନ|oxygen)|(?:ଏହା|ଏହାର|ତାହା)\s*(?:କେଉଁଠାରୁ|କେଉଁଠୁ)\s*ଆସେ/i.test(text),
        answer: 'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ନିର୍ଗତ ଅମ୍ଳଜାନ ଜଳରୁ ଆସିଥାଏ। ଆଲୋକ ପ୍ରକ୍ରିୟାରେ ଜଳ ଅଣୁର ବିଭାଜନ ଘଟି ଜଳରୁ ଅମ୍ଳଜାନ ମୁକ୍ତ ହୁଏ; ଏହା ଅଙ୍ଗାରକାମ୍ଳରୁ ଆସେ ନାହିଁ।'
      },
      {
        intent: 'gas_exchange_reversed_misconception',
        match: (text) => (
          /(?:ଅମ୍ଳଜାନ.*(?:ନେଇ|ଗ୍ରହଣ|ନିଏ)|ଅଙ୍ଗାରକାମ୍ଳ.*(?:ଛାଡ଼|ତ୍ୟାଗ|ନିର୍ଗତ|ବାହାର))/i.test(text) &&
          /(?:ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|photosynthesis)/i.test(text)
        ) || /(?:ଅମ୍ଳଜାନ\s*ନେଇ.*ଅଙ୍ଗାରକାମ୍ଳ\s*ଛାଡ଼|ଅମ୍ଳଜାନ.*ନିଏ.*ଅଙ୍ଗାରକାମ୍ଳ.*ଛାଡ଼)/i.test(text),
        answer: 'ନା, ଏହା ଠିକ୍ ନୁହେଁ। ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ସବୁଜ ଉଦ୍ଭିଦ ବାୟୁରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ ଏବଂ ସୂର୍ଯ୍ୟାଲୋକ ଓ ଜଳ ବ୍ୟବହାର କରି ଖାଦ୍ୟ ତିଆରି କରେ। ଏହି ପ୍ରକ୍ରିୟାରେ ଅମ୍ଳଜାନ ବାୟୁମଣ୍ଡଳକୁ ନିର୍ଗତ ହୁଏ।'
      },
      {
        intent: 'oxygen_role',
        match: (text) => /ଅମ୍ଳଜାନ|oxygen/i.test(text),
        answer: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ସମୟରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ।'
      },
      {
        intent: 'co2_role',
        match: (text) => /ଅଙ୍ଗାରକାମ୍ଳ|co2|carbon dioxide/i.test(text),
        answer: 'ଉଦ୍ଭିଦ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ବାୟୁମଣ୍ଡଳରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ। ଏହି ଅଙ୍ଗାରକାମ୍ଳ ବ୍ୟବହାର କରି ଉଦ୍ଭିଦ ନିଜର ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରେ।'
      },
      {
        intent: 'sunlight_role',
        match: (text) => /ସୂର୍ଯ୍ୟାଲୋକ|ସୂର୍ଯ୍ୟ|sunlight/i.test(text),
        answer: 'ସୂର୍ଯ୍ୟାଲୋକ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ପ୍ରାଥମିକ ଶକ୍ତିର ଉତ୍ସ ଅଟେ। ପତ୍ରରେ ଥିବା ପତ୍ରହରିତ ଏହି ସୌରଶକ୍ତିକୁ ଶୋଷଣ କରେ।'
      },
      {
        intent: 'stomata_role',
        match: (text) => /ପତ୍ରରନ୍ଧ୍ର|stomata/i.test(text),
        answer: 'ପତ୍ରରନ୍ଧ୍ର (Stomata) ମାଧ୍ୟମରେ ଉଦ୍ଭିଦ ବାୟୁମଣ୍ଡଳରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ ଏବଂ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ। ଏହା ପତ୍ର ପୃଷ୍ଠରେ ଥିବା କ୍ଷୁଦ୍ର ରନ୍ଧ୍ର ଅଟେ।'
      },
      {
        intent: 'chlorophyll_role',
        match: (text) => /ପତ୍ରହରିତ|ହରିତକଣିକା|chlorophyll|chloroplast/i.test(text),
        answer: 'ପତ୍ରହରିତ (Chlorophyll) ହେଉଛି ପତ୍ରରେ ଥିବା ସବୁଜ ବର୍ଣ୍ଣକଣିକା ଯାହା ସୂର୍ଯ୍ୟାଲୋକ ଶୋଷଣ କରେ। ହରିତକଣିକାରେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟା ସମ୍ପାଦିତ ହୁଏ।'
      },
      {
        intent: 'night_photosynthesis',
        match: (text) => /ରାତି|ରାତିରେ|ଅନ୍ଧାର|night/i.test(text),
        answer: 'ରାତିରେ ସୂର୍ଯ୍ୟାଲୋକ ନ ଥିବାରୁ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟା ବନ୍ଦ ରହେ। ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ସୂର୍ଯ୍ୟାଲୋକର ଶକ୍ତି ଏକାନ୍ତ ଆବଶ୍ୟକ।'
      }
    ]
  },

  matter: {
    id: 'matter',
    englishName: 'Matter',
    odiaName: 'ପଦାର୍ଥ',
    concepts: [
      'mass',
      'volume_space',
      'particles',
      'intermolecular_space',
      'intermolecular_force'
    ],
    terminology: [
      { concept: 'matter', canonical: 'ପଦାର୍ଥ', english: 'matter', forbidden: ['ମ୍ୟାଟର'] },
      { concept: 'mass', canonical: 'ବସ୍ତୁତ୍ୱ', english: 'mass', forbidden: ['ମାସ', 'ଭାର'] },
      { concept: 'volume_space', canonical: 'ସ୍ଥାନ', english: 'space', forbidden: ['ସ୍ପେସ'] },
      { concept: 'particles', canonical: 'କଣିକା', english: 'particles', forbidden: ['ପାର୍ଟିକଲ'] },
      { concept: 'atom', canonical: 'ପରମାଣୁ', english: 'atom', forbidden: ['ଆଟମ'] },
      { concept: 'molecule', canonical: 'ଅଣୁ', english: 'molecule', forbidden: ['ମଲିକ୍ୟୁଲ'] },
      { concept: 'intermolecular_force', canonical: 'ଅନ୍ତଃକଣିକା ବଳ', english: 'intermolecular force', forbidden: [] }
    ],
    verifiedFacts: [
      'ଯାହାର ନିର୍ଦ୍ଦିଷ୍ଟ ବସ୍ତୁତ୍ୱ (Mass) ଥାଏ ଏବଂ ଯାହା ସ୍ଥାନ ଅଧିକାର କରେ, ତାହାକୁ ପଦାର୍ଥ (Matter) କୁହାଯାଏ।',
      'ପଦାର୍ଥ କ୍ଷୁଦ୍ର କ୍ଷୁଦ୍ର କଣିକା (Particles / Atoms / Molecules) ଦ୍ୱାରା ଗଠିତ।',
      'ପଦାର୍ଥର କଣିକାଗୁଡ଼ିକ ମଧ୍ୟରେ ଫାଙ୍କ (ଅନ୍ତଃକଣିକା ସ୍ଥାନ) ଥାଏ ଏବଂ ସେଗୁଡ଼ିକ ନିରନ୍ତର ଗତିଶୀଳ।',
      'କଣିକାଗୁଡ଼ିକ ପରସ୍ପରକୁ ଆକର୍ଷଣ କରନ୍ତି, ଯାହାକୁ ଅନ୍ତଃକଣିକା ଆକର୍ଷଣ ବଳ (Intermolecular force) କୁହାଯାଏ।'
    ],
    commonMisconceptions: [
      'ଆଲୋକ ଓ ଧ୍ୱନି ପଦାର୍ଥ ନୁହଁନ୍ତି, ସେଗୁଡ଼ିକ ଶକ୍ତିର ରୂପ।',
      'ପଦାର୍ଥର ବସ୍ତୁତ୍ୱ ନ ଥାଏ ବୋଲି କହିବା ଭୁଲ।'
    ],
    canonicalTerms: [
      'ପଦାର୍ଥ',
      'ବସ୍ତୁତ୍ୱ',
      'ସ୍ଥାନ',
      'କଣିକା',
      'ଅଣୁ',
      'ପରମାଣୁ',
      'ଅନ୍ତଃକଣିକା ବଳ'
    ],
    verifiedExplanation: 'ଯାହାର ନିର୍ଦ୍ଦିଷ୍ଟ ବସ୍ତୁତ୍ୱ (mass) ଥାଏ ଏବଂ କିଛି ସ୍ଥାନ ଅଧିକାର କରେ, ତାହାକୁ ପଦାର୍ଥ (Matter) କୁହାଯାଏ। ଆମ ଚାରିପାଖରେ ଥିବା ସମସ୍ତ ବସ୍ତୁ କ୍ଷୁଦ୍ର କ୍ଷୁଦ୍ର କଣିକାଦ୍ୱାରା ଗଠିତ।',
    targetedFallbacks: [
      {
        intent: 'what_is_matter',
        match: (text) => /ପଦାର୍ଥ\s*କ['’]?ଣ|ପଦାର୍ଥ\s*କାହାକୁ/i.test(text),
        answer: 'ଯାହାର ନିର୍ଦ୍ଦିଷ୍ଟ ବସ୍ତୁତ୍ୱ ଥାଏ ଏବଂ ଯାହା ସ୍ଥାନ ଅଧିକାର କରେ, ତାହାକୁ ପଦାର୍ଥ କୁହାଯାଏ। ଆମ ଚାରିପାଖର ସମସ୍ତ ବସ୍ତୁ ପଦାର୍ଥ ଅଟନ୍ତି।'
      },
      {
        intent: 'particles',
        match: (text) => /କଣିକା|ଅଣୁ|ପରମାଣୁ|particles|atoms/i.test(text),
        answer: 'ପଦାର୍ଥ କ୍ଷୁଦ୍ର କ୍ଷୁଦ୍ର କଣିକା (ଅଣୁ ଓ ପରମାଣୁ) ଦ୍ୱାରା ଗଠିତ। ଏହି କଣିକାଗୁଡ଼ିକ ମଧ୍ୟରେ ଫାଙ୍କ ଥାଏ ଏବଂ ସେଗୁଡ଼ିକ ନିରନ୍ତର ଗତିଶୀଳ।'
      }
    ]
  },

  states_of_matter: {
    id: 'states_of_matter',
    englishName: 'States of Matter',
    odiaName: 'ପଦାର୍ଥର ଅବସ୍ଥା',
    concepts: [
      'solid',
      'liquid',
      'gas',
      'water_states',
      'heating_water',
      'boiling_point',
      'melting_point'
    ],
    terminology: [
      { concept: 'solid', canonical: 'କଠିନ', english: 'solid', forbidden: ['ସଲିଡ'] },
      { concept: 'liquid', canonical: 'ତରଳ', english: 'liquid', forbidden: ['ଲିକୁଇଡ'] },
      { concept: 'gas', canonical: 'ଗ୍ୟାସୀୟ', english: 'gas', forbidden: [] },
      { concept: 'ice', canonical: 'ବରଫ', english: 'ice', forbidden: ['ଆଇସ'] },
      { concept: 'water', canonical: 'ଜଳ', english: 'water', forbidden: ['ୱାଟର'] },
      { concept: 'water_vapour', canonical: 'ଜଳୀୟ ବାଷ୍ପ', english: 'water vapour', forbidden: ['ୱାଟର ଭେପର', 'ଭେପର'] },
      { concept: 'boiling_point', canonical: 'ସ୍ଫୁଟନାଙ୍କ', english: 'boiling point', forbidden: ['ବଏଲିଂ ପଏଣ୍ଟ'] },
      { concept: 'melting_point', canonical: 'ଗଳନାଙ୍କ', english: 'melting point', forbidden: ['ମେଲ୍ଟିଂ ପଏଣ୍ଟ'] }
    ],
    verifiedFacts: [
      'ପଦାର୍ଥ ମୁଖ୍ୟତଃ ତିନୋଟି ଭୌତିକ ଅବସ୍ଥାରେ ଥାଏ: କଠିନ (Solid), ତରଳ (Liquid), ଏବଂ ଗ୍ୟାସୀୟ (Gas)।',
      'ଜଳ ତିନୋଟି ଅବସ୍ଥାରେ ରହିପାରେ: କଠିନ ଅବସ୍ଥା (ବରଫ / Ice), ତରଳ ଅବସ୍ଥା (ଜଳ ବା ପାଣି / Water), ଏବଂ ଗ୍ୟାସୀୟ ଅବସ୍ଥା (ବାଷ୍ପ ବା ଜଳୀୟ ବାଷ୍ପ / Steam or Water Vapour)।',
      'ପାଣିକୁ ଯଥେଷ୍ଟ ଗରମ କଲେ ଏହା ତରଳ ଅବସ୍ଥାରୁ ବାଷ୍ପ ବା ଜଳୀୟ ବାଷ୍ପ (ଗ୍ୟାସ) ରେ ପରିଣତ ହୁଏ।',
      'ଜଳକୁ ଗରମ କଲେ ଅମ୍ଳଜାନ ବା ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ୟାସ ସୃଷ୍ଟି ହୁଏ ନାହିଁ; କେବଳ ଭୌତିକ ଅବସ୍ଥା ପରିବର୍ତ୍ତନ ହୋଇ ଜଳୀୟ ବାଷ୍ପ ହୁଏ।',
      'ସାଧାରଣ ବାୟୁମଣ୍ଡଳୀୟ ଚାପରେ ଜଳର ସ୍ଫୁଟନାଙ୍କ ୧୦୦°C (100°C) ଏବଂ ବରଫର ଗଳନାଙ୍କ ୦°C (0°C) ଅଟେ।'
    ],
    commonMisconceptions: [
      'ଜଳୀୟ ବାଷ୍ପ ଅମ୍ଳଜାନ ବା ଅଙ୍ଗାରକାମ୍ଳ ନୁହେଁ।',
      'ପାଣିକୁ ଗରମ କଲେ ଅମ୍ଳଜାନ ସୃଷ୍ଟି ହୁଏ ନାହିଁ।',
      'ବରଫ ଗ୍ୟାସ ନୁହେଁ କିମ୍ବା ବାଷ୍ପ କଠିନ ନୁହେଁ।'
    ],
    canonicalTerms: [
      'କଠିନ',
      'ତରଳ',
      'ଗ୍ୟାସୀୟ',
      'ବରଫ',
      'ଜଳ',
      'ପାଣି',
      'ବାଷ୍ପ',
      'ଜଳୀୟ ବାଷ୍ପ',
      'ସ୍ଫୁଟନାଙ୍କ',
      'ଗଳନାଙ୍କ'
    ],
    verifiedExplanation: 'ପଦାର୍ଥର ତିନୋଟି ମୁଖ୍ୟ ଭୌତିକ ଅବସ୍ଥା ରହିଛି: କଠିନ (Solid), ତରଳ (Liquid) ଏବଂ ଗ୍ୟାସୀୟ (Gas)। ଉଦାହରଣ ସ୍ୱରୂପ, ଜଳ ବରଫ (କଠିନ), ପାଣି (ତରଳ) ଏବଂ ଜଳୀୟ ବାଷ୍ପ (ଗ୍ୟାସୀୟ) ଭାବରେ ରହିପାରେ। ପାଣିକୁ ଗରମ କଲେ ଏହା ତରଳରୁ ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହୁଏ।',
    targetedFallbacks: [
      {
        intent: 'heating_water',
        match: (text) => /ପାଣି.*ଗରମ|ଜଳ.*ଗରମ|heat.*water|heating.*water/i.test(text),
        answer: 'ପାଣିକୁ ଗରମ କଲେ ଏହା ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହୁଏ। ଅର୍ଥାତ୍, ପାଣି ତରଳ ଅବସ୍ଥାରୁ ଗ୍ୟାସୀୟ ଅବସ୍ଥାକୁ ଯାଏ।'
      },
      {
        intent: 'boiling_melting_point',
        match: (text) => /ସ୍ଫୁଟନାଙ୍କ|ଗଳନାଙ୍କ|boiling|melting/i.test(text),
        answer: 'ସାଧାରଣ ବାୟୁମଣ୍ଡଳୀୟ ଚାପରେ ଜଳର ସ୍ଫୁଟନାଙ୍କ ୧୦୦°C ଏବଂ ବରଫର ଗଳନାଙ୍କ ୦°C ଅଟେ।'
      },
      {
        intent: 'three_states',
        match: (text) => /ତିନୋଟି\s*ଅବସ୍ଥା|୩ଟି\s*ଅବସ୍ଥା|three\s*states/i.test(text),
        answer: 'ପଦାର୍ଥର ତିନୋଟି ମୁଖ୍ୟ ଭୌତିକ ଅବସ୍ଥା ହେଉଛି କଠିନ, ତରଳ ଏବଂ ଗ୍ୟାସୀୟ। ଉଦାହରଣ ସ୍ୱରୂପ, ଜଳ ବରଫ (କଠିନ), ପାଣି (ତରଳ) ଏବଂ ଜଳୀୟ ବାଷ୍ପ (ଗ୍ୟାସୀୟ) ଭାବରେ ଥାଏ।'
      }
    ]
  },

  evaporation: {
    id: 'evaporation',
    englishName: 'Evaporation',
    odiaName: 'ବାଷ୍ପୀଭବନ',
    concepts: [
      'liquid_to_gas',
      'heat_energy',
      'surface_phenomenon',
      'cooling_effect',
      'everyday_example'
    ],
    terminology: [
      { concept: 'evaporation', canonical: 'ବାଷ୍ପୀଭବନ', english: 'evaporation', forbidden: ['ଇଭାପୋରେସନ'] },
      { concept: 'water_vapour', canonical: 'ଜଳୀୟ ବାଷ୍ପ', english: 'water vapour', forbidden: ['ୱାଟର ଭେପର', 'ଭେପର'] },
      { concept: 'liquid', canonical: 'ତରଳ', english: 'liquid', forbidden: ['ଲିକୁଇଡ'] },
      { concept: 'heat', canonical: 'ଉତ୍ତାପ', english: 'heat', forbidden: ['ହିଟ'] },
      { concept: 'surface_phenomenon', canonical: 'ପୃଷ୍ଠୀୟ ପ୍ରକ୍ରିୟା', english: 'surface phenomenon', forbidden: [] }
    ],
    verifiedFacts: [
      'ସ୍ଫୁଟନାଙ୍କଠାରୁ କମ୍ ଯେକୌଣସି ତାପମାତ୍ରାରେ ତରଳ ପଦାର୍ଥ ବାଷ୍ପରେ ପରିଣତ ହେବା ପ୍ରକ୍ରିୟାକୁ ବାଷ୍ପୀଭବନ (Evaporation) କୁହାଯାଏ।',
      'ବାଷ୍ପୀଭବନ ଏକ ପୃଷ୍ଠୀୟ ପ୍ରକ୍ରିୟା (Surface phenomenon)।',
      'ସୂର୍ଯ୍ୟଙ୍କ ଉତ୍ତାପ ବା ତାପଜ ଶକ୍ତି ଯୋଗୁଁ ତରଳ ଜଳ ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହୁଏ।',
      'ବାଷ୍ପୀଭବନ ଫଳରେ ଶୀତଳତା (Cooling effect) ସୃଷ୍ଟି ହୁଏ।',
      'ଦୈନନ୍ଦିନ ଉଦାହରଣ: ଖରାରେ ଓଦା ଲୁଗା ଶୁଖିବା।'
    ],
    commonMisconceptions: [
      'ବାଷ୍ପ ତରଳ ହେବା ବାଷ୍ପୀଭବନ ନୁହେଁ (ତାହା ଘନୀଭବନ)।',
      'ବାଷ୍ପୀଭବନ କେବଳ ୧୦୦°C ରେ ହୁଏ ନାହିଁ; ଏହା ଯେକୌଣସି ତାପମାତ୍ରାରେ ହୋଇପାରେ।'
    ],
    canonicalTerms: [
      'ବାଷ୍ପୀଭବନ',
      'ତରଳ',
      'ଜଳୀୟ ବାଷ୍ପ',
      'ଉତ୍ତାପ',
      'ପୃଷ୍ଠୀୟ ପ୍ରକ୍ରିୟା',
      'ବାଷ୍ପ'
    ],
    verifiedExplanation: 'ବାଷ୍ପୀଭବନ ହେଉଛି ଏକ ପ୍ରାକୃତିକ ପ୍ରକ୍ରିୟା ଯେଉଁଥିରେ ସୂର୍ଯ୍ୟଙ୍କ ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ଜଳ ଜଳୀୟ ବାଷ୍ପରେ (ଗ୍ୟାସରେ) ପରିଣତ ହୁଏ। ଉଦାହରଣ ସ୍ୱରୂପ, ଖରାରେ ଓଦା ଲୁଗା ଶୁଖିବା।',
    targetedFallbacks: [
      {
        intent: 'cooling_effect',
        match: (text) => /ଶୀତଳ|ଥଣ୍ଡା|cool/i.test(text),
        answer: 'ବାଷ୍ପୀଭବନ ଫଳରେ ଶୀତଳତା (Cooling effect) ସୃଷ୍ଟି ହୁଏ। ତରଳ ପଦାର୍ଥ ବାଷ୍ପୀଭୂତ ହେବା ପାଇଁ ଆଖପାଖରୁ ଉତ୍ତାପ ଶୋଷଣ କରେ।'
      },
      {
        intent: 'what_is_evaporation',
        match: (text) => /ବାଷ୍ପୀଭବନ\s*କ['’]?ଣ|ବାଷ୍ପୀଭବନ\s*କିପରି/i.test(text),
        answer: 'ସ୍ଫୁଟନାଙ୍କଠାରୁ କମ୍ ଯେକୌଣସି ତାପମାତ୍ରାରେ ତରଳ ଜଳ ବାଷ୍ପରେ ପରିଣତ ହେବାକୁ ବାଷ୍ପୀଭବନ କୁହାଯାଏ। ଉଦାହରଣ ସ୍ୱରୂପ, ଖରାରେ ଓଦା ଲୁଗା ଶୁଖିବା।'
      }
    ]
  },

  water_cycle: {
    id: 'water_cycle',
    englishName: 'Water Cycle',
    odiaName: 'ଜଳଚକ୍ର',
    concepts: [
      'evaporation',
      'condensation',
      'precipitation',
      'transpiration',
      'groundwater'
    ],
    terminology: [
      { concept: 'water_cycle', canonical: 'ଜଳଚକ୍ର', english: 'water cycle', forbidden: ['ୱାଟର ସାଇକେଲ'] },
      { concept: 'evaporation', canonical: 'ବାଷ୍ପୀଭବନ', english: 'evaporation', forbidden: ['ଇଭାପୋରେସନ'] },
      { concept: 'condensation', canonical: 'ଘନୀଭବନ', english: 'condensation', forbidden: ['କଣ୍ଡେନସେସନ'] },
      { concept: 'precipitation', canonical: 'ଅବକ୍ଷେପଣ', english: 'precipitation', forbidden: ['ପ୍ରେସିପିଟେସନ'] },
      { concept: 'transpiration', canonical: 'ଉତ୍ସ୍ୱେଦନ', english: 'transpiration', forbidden: ['ଟ୍ରାନ୍ସପିରେସନ'] },
      { concept: 'rain', canonical: 'ବର୍ଷା', english: 'rain', forbidden: ['ରେନ'] },
      { concept: 'clouds', canonical: 'ମେଘ', english: 'clouds', forbidden: ['କ୍ଲାଉଡ'] }
    ],
    verifiedFacts: [
      'ଜଳଚକ୍ର (Water Cycle) ହେଉଛି ଭୂପୃଷ୍ଠରୁ ବାୟୁମଣ୍ଡଳ ଏବଂ ପୁଣି ଭୂପୃଷ୍ଠକୁ ଜଳର ନିରନ୍ତର ଚକ୍ରାକାର ଗତି।',
      'ସୋପାନ ୧ - ବାଷ୍ପୀଭବନ: ସୂର୍ଯ୍ୟଙ୍କ ଉତ୍ତାପ ଯୋଗୁଁ ନଦୀ, ସମୁଦ୍ରର ତରଳ ଜଳ ବାଷ୍ପ ହୋଇ ଉପରକୁ ଉଠେ।',
      'ସୋପାନ ୨ - ଘନୀଭବନ (Condensation): ଉପର ବାୟୁମଣ୍ଡଳରେ ଜଳୀୟ ବାଷ୍ପ ଥଣ୍ଡା ହୋଇ କ୍ଷୁଦ୍ର ଜଳବିନ୍ଦୁରେ ପରିଣତ ହୁଏ ଏବଂ ମେଘ ସୃଷ୍ଟି କରେ।',
      'ସୋପାନ ୩ - ଅବକ୍ଷେପଣ (Precipitation): ମେଘରୁ ଜଳବିନ୍ଦୁଗୁଡ଼ିକ ଏକତ୍ରିତ ହୋଇ ବର୍ଷା ଆକାରରେ ଭୂପୃଷ୍ଠକୁ ଖସିପଡ଼େ।',
      'ଉଦ୍ଭିଦମାନେ ଉତ୍ସ୍ୱେଦନ (Transpiration) ପ୍ରକ୍ରିୟାରେ ବାୟୁମଣ୍ଡଳକୁ ଜଳୀୟ ବାଷ୍ପ ଛାଡ଼ନ୍ତି।'
    ],
    commonMisconceptions: [
      'ବର୍ଷା ଭୂପୃଷ୍ଠରୁ ମେଘକୁ ଯାଏ ନାହିଁ; ଏହା ମେଘରୁ ଭୂପୃଷ୍ଠକୁ ଖସିଥାଏ।',
      'ଘନୀଭବନରେ ତରଳ ବାଷ୍ପ ହୁଏ ନାହିଁ; ବାଷ୍ପ ତରଳ ହୁଏ।'
    ],
    canonicalTerms: [
      'ଜଳଚକ୍ର',
      'ବାଷ୍ପୀଭବନ',
      'ଘନୀଭବନ',
      'ଅବକ୍ଷେପଣ',
      'ବର୍ଷା',
      'ମେଘ',
      'ଉତ୍ସ୍ୱେଦନ'
    ],
    verifiedExplanation: 'ଜଳଚକ୍ରରେ ପ୍ରଥମେ ସୂର୍ଯ୍ୟଙ୍କ ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ଜଳ ବାଷ୍ପୀଭବନ ହୋଇ ବାୟୁମଣ୍ଡଳକୁ ଯାଏ। ସେଠାରେ ଘନୀଭବନ ହୋଇ ମେଘ ସୃଷ୍ଟି ହୁଏ ଏବଂ ଶେଷରେ ବର୍ଷା (ଅବକ୍ଷେପଣ) ଆକାରରେ ଜଳ ପୃଥିବୀକୁ ଫେରିଆସେ।',
    targetedFallbacks: [
      {
        intent: 'condensation_clouds',
        match: (text) => /ଘନୀଭବନ|ମେଘ|clouds|condensation/i.test(text),
        answer: 'ବାୟୁମଣ୍ଡଳରେ ଜଳୀୟ ବାଷ୍ପ ଥଣ୍ଡା ହୋଇ କ୍ଷୁଦ୍ର ଜଳବିନ୍ଦୁରେ ପରିଣତ ହେବାକୁ ଘନୀଭବନ କୁହାଯାଏ। ଏହାଦ୍ୱାରା ମେଘ ସୃଷ୍ଟି ହୁଏ।'
      },
      {
        intent: 'water_cycle_steps',
        match: (text) => /ସୋପାନ|ପର୍ଯ୍ୟାୟ|step|stages|କିପରି\s*ହୁଏ/i.test(text),
        answer: 'ଜଳଚକ୍ରର ମୁଖ୍ୟ ସୋପାନଗୁଡ଼ିକ ହେଉଛି ବାଷ୍ପୀଭବନ, ଘନୀଭବନ ଏବଂ ଅବକ୍ଷେପଣ (ବର୍ଷା)। ଏହି ପ୍ରକ୍ରିୟାରେ ଭୂପୃଷ୍ଠର ଜଳ ବାୟୁମଣ୍ଡଳକୁ ଯାଇ ପୁଣି ବର୍ଷା ଆକାରରେ ଫେରିଆସେ।'
      }
    ]
  },

  force_and_motion: {
    id: 'force_and_motion',
    englishName: 'Force and Motion',
    odiaName: 'ବଳ ଓ ଗତି',
    concepts: [
      'force',
      'motion',
      'inertia',
      'newtons_first_law',
      'momentum_second_law',
      'action_reaction_third_law',
      'friction'
    ],
    terminology: [
      { concept: 'force', canonical: 'ବଳ', english: 'force', forbidden: ['ଫୋର୍ସ'] },
      { concept: 'motion', canonical: 'ଗତି', english: 'motion', forbidden: ['ମୋସନ'] },
      { concept: 'inertia', canonical: 'ଜଡ଼ତା', english: 'inertia', forbidden: ['ଇନର୍ସିଆ'] },
      { concept: 'newtons_first_law', canonical: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ', english: "Newton's first law", forbidden: [] },
      { concept: 'momentum', canonical: 'ସଂବେଗ', english: 'momentum', forbidden: ['ମୋମେଣ୍ଟମ'] },
      { concept: 'action_reaction', canonical: 'କ୍ରିୟା ଓ ପ୍ରତିକ୍ରିୟା', english: 'action and reaction', forbidden: [] }
    ],
    verifiedFacts: [
      'ବଳ (Force) ଏକ ଟାଣିବା ବା ଠେଲିବା କ୍ରିୟା ଯାହା ବସ୍ତୁର ସ୍ଥିରତା ବା ସରଳ ରୈଖିକ ଗତିର ପରିବର୍ତ୍ତନ କରିପାରେ।',
      'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ (ଜଡ଼ତା ନିୟମ - Law of Inertia): କୌଣସି ବାହ୍ୟ ଅସନ୍ତୁଳିତ ବଳ ପ୍ରୟୋଗ ନ ହେବା ପର୍ଯ୍ୟନ୍ତ ଏକ ସ୍ଥିର ବସ୍ତୁ ସ୍ଥିର ରହେ ଏବଂ ଗତିଶୀଳ ବସ୍ତୁ ସରଳ ରେଖାରେ ସମଗତିରେ ଗତିଶୀଳ ରହେ।',
      'ନ୍ୟୁଟନଙ୍କ ଦ୍ୱିତୀୟ ଗତି ନିୟମ: ସଂବେଗ (Momentum) ପରିବର୍ତ୍ତନର ହାର ପ୍ରଯୁକ୍ତ ବଳ ସହିତ ସମାନୁପାତୀ (F = ma)।',
      'ନ୍ୟୁଟନଙ୍କ ତୃତୀୟ ଗତି ନିୟମ: ପ୍ରତ୍ୟେକ କ୍ରିୟାର ଏକ ସମାନ ଓ ବିପରୀତ ପ୍ରତିକ୍ରିୟା ଥାଏ (Action and Reaction)।'
    ],
    commonMisconceptions: [
      'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ନିୟମ କ୍ରିୟା-ପ୍ରତିକ୍ରିୟା ନୁହେଁ (ତାହା ତୃତୀୟ ନିୟମ)।',
      'ବସ୍ତୁକୁ ଗତିଶୀଳ ରଖିବା ପାଇଁ ଘର୍ଷଣହୀନ ସ୍ଥାନରେ କୌଣସି କ୍ରମାଗତ ବଳ ଦରକାର ନାହିଁ।'
    ],
    canonicalTerms: [
      'ବଳ',
      'ଗତି',
      'ଜଡ଼ତା',
      'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ',
      'ବାହ୍ୟ ବଳ',
      'ସଂବେଗ',
      'କ୍ରିୟା',
      'ପ୍ରତିକ୍ରିୟା'
    ],
    verifiedExplanation: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ ବା ଜଡ଼ତା ନିୟମ ଅନୁସାରେ, କୌଣସି ବାହ୍ୟ ବଳ ପ୍ରୟୋଗ ନ ହେବା ପର୍ଯ୍ୟନ୍ତ ଏକ ସ୍ଥିର ବସ୍ତୁ ସ୍ଥିର ରହେ ଏବଂ ଏକ ଗତିଶୀଳ ବସ୍ତୁ ସରଳ ରେଖାରେ ସମଗତିରେ ଗତିଶୀଳ ରହେ।',
    targetedFallbacks: [
      {
        intent: 'newton_first_law',
        match: (text) => /ପ୍ରଥମ|ଜଡ଼ତା|inertia|first\s*law/i.test(text),
        answer: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ ବା ଜଡ଼ତା ନିୟମ ଅନୁସାରେ, ବାହ୍ୟ ବଳ ପ୍ରୟୋଗ ନ ହେବା ପର୍ଯ୍ୟନ୍ତ ଏକ ସ୍ଥିର ବସ୍ତୁ ସ୍ଥିର ରହେ ଏବଂ ଗତିଶୀଳ ବସ୍ତୁ ସରଳ ରେଖାରେ ସମଗତିରେ ଗତି କରେ।'
      },
      {
        intent: 'newton_third_law',
        match: (text) => /ତୃତୀୟ|କ୍ରିୟା.*ପ୍ରତିକ୍ରିୟା|action.*reaction|third\s*law/i.test(text),
        answer: 'ନ୍ୟୁଟନଙ୍କ ତୃତୀୟ ଗତି ନିୟମ ଅନୁସାରେ, ପ୍ରତ୍ୟେକ କ୍ରିୟାର ଏକ ସମାନ ଓ ବିପରୀତ ପ୍ରତିକ୍ରିୟା ଥାଏ।'
      },
      {
        intent: 'newton_second_law',
        match: (text) => /ଦ୍ୱିତୀୟ|ସଂବେଗ|momentum|second\s*law/i.test(text),
        answer: 'ନ୍ୟୁଟନଙ୍କ ଦ୍ୱିତୀୟ ଗତି ନିୟମ ଅନୁସାରେ, ବସ୍ତୁର ସଂବେଗ ପରିବର୍ତ୍ତନର ହାର ପ୍ରଯୁକ୍ତ ବଳ ସହିତ ସମାନୁପାତୀ (F = ma) ଅଟେ।'
      }
    ]
  },

  cell: {
    id: 'cell',
    englishName: 'Cell',
    odiaName: 'କୋଷ',
    concepts: [
      'cell_wall',
      'cell_membrane',
      'nucleus',
      'cytoplasm',
      'mitochondria',
      'chloroplast',
      'plant_vs_animal_cell'
    ],
    terminology: [
      { concept: 'cell', canonical: 'କୋଷ', english: 'cell', forbidden: ['ସେଲ'] },
      { concept: 'cell_wall', canonical: 'କୋଷ ଭିତ୍ତି', english: 'cell wall', forbidden: ['ସେଲ ୱାଲ'] },
      { concept: 'cell_membrane', canonical: 'କୋଷ ଝିଲ୍ଲୀ', english: 'cell membrane', forbidden: ['ସେଲ ମେମ୍ବ୍ରେନ'] },
      { concept: 'nucleus', canonical: 'ନ୍ୟୁକ୍ଲିଅସ', english: 'nucleus', forbidden: [] },
      { concept: 'cytoplasm', canonical: 'କୋଷଜୀବକ', english: 'cytoplasm', forbidden: ['ସାଇଟୋପ୍ଲାଜମ'] },
      { concept: 'mitochondria', canonical: 'ମାଇଟୋକଣ୍ଡ୍ରିଆ', english: 'mitochondria', forbidden: [] },
      { concept: 'chloroplast', canonical: 'ହରିତକଣିକା', english: 'chloroplast', forbidden: ['ଗୋଲାକ'] }
    ],
    verifiedFacts: [
      'କୋଷ (Cell) ହେଉଛି ଜୀବନର ମୌଳିକ ଗଠନମୂଳକ ଓ କାର୍ଯ୍ୟକାରୀ ଏକକ (Basic structural and functional unit of life)।',
      'ରବର୍ଟ ହୁକ୍ (Robert Hooke) ୧୬୬୫ ମସିହାରେ କୋଷ ଆବିଷ୍କାର କରିଥିଲେ।',
      'ନ୍ୟୁକ୍ଲିଅସ (Nucleus / କେନ୍ଦ୍ରିକ) କୋଷର ସମସ୍ତ କାର୍ଯ୍ୟ ନିୟନ୍ତ୍ରଣ କରେ।',
      'ମାଇଟୋକଣ୍ଡ୍ରିଆ (Mitochondria) କୁ କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର (Powerhouse of the cell) କୁହାଯାଏ।',
      'ଉଦ୍ଭିଦ କୋଷରେ କୋଷ ଭିତ୍ତି (Cell Wall) ଏବଂ ହରିତକଣିକା (Chloroplast) ଥାଏ, ଯାହା ପ୍ରାଣୀ କୋଷରେ ନ ଥାଏ।',
      'କୋଷ ଝିଲ୍ଲୀ (Plasma Membrane) ଭିତରେ ଥିବା ତରଳ ଅଂଶକୁ କୋଷଜୀବକ (Cytoplasm) କୁହାଯାଏ।'
    ],
    commonMisconceptions: [
      'ପ୍ରାଣୀ କୋଷରେ କୋଷ ଭିତ୍ତି ଥାଏ ବୋଲି କହିବା ଭୁଲ; କୋଷ ଭିତ୍ତି କେବଳ ଉଦ୍ଭିଦ କୋଷରେ ଥାଏ।',
      'ମାଇଟୋକଣ୍ଡ୍ରିଆ ଆଲୋକ ସଂଶ୍ଳେଷଣ କରେ ନାହିଁ; ଏହା କୋଷୀୟ ଶ୍ୱସନ ଦ୍ୱାରା ଶକ୍ତି ମୁକ୍ତ କରେ।'
    ],
    canonicalTerms: [
      'କୋଷ',
      'କୋଷ ଭିତ୍ତି',
      'କୋଷ ଝିଲ୍ଲୀ',
      'ନ୍ୟୁକ୍ଲିଅସ',
      'କୋଷଜୀବକ',
      'ମାଇଟୋକଣ୍ଡ୍ରିଆ',
      'ହରିତକଣିକା'
    ],
    verifiedExplanation: 'କୋଷ (Cell) ହେଉଛି ପ୍ରତ୍ୟେକ ଜୀବର ମୌଳିକ ଗଠନମୂଳକ ଓ କାର୍ଯ୍ୟକାରୀ ଏକକ। ଉଦ୍ଭିଦ କୋଷରେ କୋଷ ଭିତ୍ତି ଏବଂ ହରିତକଣିକା ଥାଏ, କିନ୍ତୁ ପ୍ରାଣୀ କୋଷରେ ଏହା ନ ଥାଏ। ମାଇଟୋକଣ୍ଡ୍ରିଆକୁ କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର କୁହାଯାଏ।',
    targetedFallbacks: [
      {
        intent: 'powerhouse',
        match: (text) => /ଶକ୍ତି\s*କେନ୍ଦ୍ର|powerhouse|ମାଇଟୋକଣ୍ଡ୍ରିଆ/i.test(text),
        answer: 'ମାଇଟୋକଣ୍ଡ୍ରିଆକୁ କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର କୁହାଯାଏ। ଏହା କୋଷୀୟ ଶ୍ୱସନ ମାଧ୍ୟମରେ ଶକ୍ତି (ATP) ଉତ୍ପାଦନ କରେ।'
      },
      {
        intent: 'cell_wall',
        match: (text) => /କୋଷ\s*ଭିତ୍ତି|ଉଦ୍ଭିଦ\s*କୋଷ.*ପ୍ରାଣୀ|plant.*animal/i.test(text),
        answer: 'ଉଦ୍ଭିଦ କୋଷରେ କୋଷ ଭିତ୍ତି ଏବଂ ହରିତକଣିକା ଥାଏ। ପ୍ରାଣୀ କୋଷରେ କୋଷ ଭିତ୍ତି ନ ଥାଏ।'
      },
      {
        intent: 'nucleus',
        match: (text) => /ନ୍ୟୁକ୍ଲିଅସ|କେନ୍ଦ୍ରିକ|nucleus/i.test(text),
        answer: 'ନ୍ୟୁକ୍ଲିଅସ କୋଷର ସମସ୍ତ କାର୍ଯ୍ୟ ନିୟନ୍ତ୍ରଣ କରେ। ଏହାକୁ କୋଷର ନିୟନ୍ତ୍ରଣ କେନ୍ଦ୍ର କୁହାଯାଏ।'
      }
    ]
  },

  respiration: {
    id: 'respiration',
    englishName: 'Respiration',
    odiaName: 'ଶ୍ୱାସକ୍ରିୟା ଓ ଶ୍ୱସନ',
    concepts: [
      'human_breathing',
      'inhalation_oxygen',
      'exhalation_co2',
      'cellular_respiration',
      'plant_respiration'
    ],
    terminology: [
      { concept: 'respiration', canonical: 'ଶ୍ୱସନ', english: 'respiration', forbidden: ['ରେସପିରେସନ'] },
      { concept: 'breathing', canonical: 'ଶ୍ୱାସକ୍ରିୟା', english: 'breathing', forbidden: ['ବ୍ରିଦିଂ'] },
      { concept: 'inhalation', canonical: 'ପ୍ରଶ୍ୱାସ', english: 'inhalation', forbidden: [] },
      { concept: 'exhalation', canonical: 'ନିଃଶ୍ୱାସ', english: 'exhalation', forbidden: [] },
      { concept: 'oxygen', canonical: 'ଅମ୍ଳଜାନ', english: 'oxygen', forbidden: ['ଅକ୍ସିଜେନ', 'ଅକ୍ସିଜେନ୍'] },
      { concept: 'carbon_dioxide', canonical: 'ଅଙ୍ଗାରକାମ୍ଳ', english: 'carbon dioxide', forbidden: ['କାର୍ବନ ଡାଇଅକ୍ସାଇଡ', 'କାର୍ବନ ଡାଇଅକ୍ସାଇଡ୍'] },
      { concept: 'cellular_respiration', canonical: 'କୋଷୀୟ ଶ୍ୱସନ', english: 'cellular respiration', forbidden: [] }
    ],
    verifiedFacts: [
      'ମଣିଷ ଶ୍ୱାସ ନେବା ସମୟରେ (ପ୍ରଶ୍ୱାସରେ / Inhalation) ବାୟୁରୁ ଅମ୍ଳଜାନ (Oxygen) ଗ୍ରହଣ କରେ।',
      'ମଣିଷ ଶ୍ୱାସ ଛାଡ଼ିବା ସମୟରେ (ନିଃଶ୍ୱାସରେ / Exhalation) ଶରୀରରୁ ଅଙ୍ଗାରକାମ୍ଳ (Carbon dioxide) ବାହାର କରେ।',
      'ଉଦ୍ଭିଦମାନେ ଦିନ ଏବଂ ରାତି ଉଭୟ ସମୟରେ ନିରନ୍ତର ଶ୍ୱସନ (Respiration) କରନ୍ତି।',
      'ଦିନବେଳେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ସହିତ ଉଦ୍ଭିଦରେ ଶ୍ୱସନ ପ୍ରକ୍ରିୟା ମଧ୍ୟ ନିରନ୍ତର ଚାଲିଥାଏ; ଦିନବେଳେ ଶ୍ୱସନ ବନ୍ଦ ରହେ ନାହିଁ।',
      'ଉଦ୍ଭିଦ ଶ୍ୱସନରେ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରେ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରେ; ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଏହାର ବିପରୀତ ଘଟେ।',
      'କୋଷୀୟ ଶ୍ୱସନ (Cellular respiration) ମାଇଟୋକଣ୍ଡ୍ରିଆରେ ଘଟି ଗ୍ଲୁକୋଜ୍ ରୁ ଶକ୍ତି (ATP) ମୁକ୍ତ କରେ।'
    ],
    commonMisconceptions: [
      'ମଣିଷ ଶ୍ୱାସ ନେବା ସମୟରେ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ ନାହିଁ।',
      'ମଣିଷ ଶ୍ୱାସ ଛାଡ଼ିବା ସମୟରେ ଅମ୍ଳଜାନ ଛାଡ଼େ ନାହିଁ।',
      'ଉଦ୍ଭିଦମାନେ ରାତିରେ ଶ୍ୱସନ ବନ୍ଦ କରନ୍ତି ନାହିଁ।',
      'ଉଦ୍ଭିଦମାନେ ଦିନବେଳେ ଶ୍ୱସନ ବନ୍ଦ କରନ୍ତି ନାହିଁ; ଦିନ ଏବଂ ରାତି ଉଭୟ ସମୟରେ ଶ୍ୱସନ ଚାଲେ।',
      'ଉଦ୍ଭିଦମାନେ ରାତିରେ ଅଙ୍ଗାରକାମ୍ଳ ସଞ୍ଚୟ କରି ରଖନ୍ତି ନାହିଁ।'
    ],
    canonicalTerms: [
      'ଶ୍ୱାସକ୍ରିୟା',
      'ଶ୍ୱସନ',
      'ପ୍ରଶ୍ୱାସ',
      'ନିଃଶ୍ୱାସ',
      'ଅମ୍ଳଜାନ',
      'ଅଙ୍ଗାରକାମ୍ଳ',
      'ମାଇଟୋକଣ୍ଡ୍ରିଆ'
    ],
    verifiedExplanation: 'ଶ୍ୱାସକ୍ରିୟାରେ ମଣିଷ ବାୟୁରୁ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ (ପ୍ରଶ୍ୱାସ) ଏବଂ ଶରୀରରୁ ଅଙ୍ଗାରକାମ୍ଳ ବାହାର କରେ (ନିଃଶ୍ୱାସ)। ଉଦ୍ଭିଦମାନେ ମଧ୍ୟ ଦିନ ଏବଂ ରାତି ଉଭୟ ସମୟରେ ଶ୍ୱସନ କରନ୍ତି, ଯେଉଁଥିରେ ସେମାନେ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରି ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରନ୍ତି।',
    targetedFallbacks: [
      {
        intent: 'plant_daytime_respiration_misconception',
        match: (text) => /(?:ଦିନ|ଦିନବେଳେ|daytime|day).*(?:ଶ୍ୱାସକ୍ରିୟା|ଶ୍ୱସନ|respiration)|(?:ଶ୍ୱାସକ୍ରିୟା|ଶ୍ୱସନ|respiration).*(?:ଦିନ|ଦିନବେଳେ|daytime|day)|(?:ଶ୍ୱାସକ୍ରିୟା|ଶ୍ୱସନ|respiration).*?(?:କରେ\s*ନାହିଁ|କରନ୍ତି\s*ନାହିଁ)/i.test(text),
        answer: 'ନା, ଏହା ଭୁଲ୍ ଧାରଣା। ଗଛମାନେ ଦିନ ଏବଂ ରାତି ଉଭୟ ସମୟରେ ନିରନ୍ତର ଶ୍ୱାସକ୍ରିୟା (ଶ୍ୱସନ) କରନ୍ତି। ଦିନବେଳେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ସହିତ ଶ୍ୱସନ ପ୍ରକ୍ରିୟା ମଧ୍ୟ ନିରନ୍ତର ଚାଲିଥାଏ।'
      },
      {
        intent: 'respiration_vs_photosynthesis',
        match: (text) => /(?:ପାର୍ଥକ୍ୟ|difference|ତୁଳନା).*(?:photosynthesis|ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ)|(?:photosynthesis|ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ).*(?:ପାର୍ଥକ୍ୟ|difference|ତୁଳନା)/i.test(text),
        answer: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ଏବଂ ଶ୍ୱସନ ମଧ୍ୟରେ ମୁଖ୍ୟ ପାର୍ଥକ୍ୟ ହେଉଛି: ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକ ଶକ୍ତି ବ୍ୟବହାର କରି ଖାଦ୍ୟ ତିଆରି କରେ ଏବଂ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ। କିନ୍ତୁ ଶ୍ୱସନରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରି ଖାଦ୍ୟରୁ ଶକ୍ତି ମୁକ୍ତ କରେ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରେ। ଗଛ ଦିନ-ରାତି ନିରନ୍ତର ଶ୍ୱସନ କରିଥାଏ।'
      },
      {
        intent: 'why_human_takes_oxygen',
        match: (text) => /ମଣିଷ.*ଅମ୍ଳଜାନ|ଅମ୍ଳଜାନ.*କାହିଁକି|why.*oxygen/i.test(text),
        answer: 'ମଣିଷର କୋଷଗୁଡ଼ିକ ଶକ୍ତି ଉତ୍ପାଦନ ପାଇଁ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରନ୍ତି।'
      },
      {
        intent: 'human_breathing_gases',
        match: (text) => /ଶ୍ୱାସ|ପ୍ରଶ୍ୱାସ|ନିଃଶ୍ୱାସ|ମଣିଷ/i.test(text),
        answer: 'ମଣିଷ ଶ୍ୱାସ ନେବା ସମୟରେ (ପ୍ରଶ୍ୱାସରେ) ବାୟୁରୁ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ। ଶ୍ୱାସ ଛାଡ଼ିବା ସମୟରେ (ନିଃଶ୍ୱାସରେ) ଶରୀରରୁ ଅଙ୍ଗାରକାମ୍ଳ ବାହାର କରିଥାଏ।'
      },
      {
        intent: 'plant_respiration',
        match: (text) => /ଉଦ୍ଭିଦ|ଗଛ|plant/i.test(text),
        answer: 'ଉଦ୍ଭିଦମାନେ ଦିନ ଏବଂ ରାତି ଉଭୟ ସମୟରେ ନିରନ୍ତର ଶ୍ୱସନ କରନ୍ତି। ଶ୍ୱସନରେ ସେମାନେ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରନ୍ତି ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରନ୍ତି।'
      }
    ]
  }
};

function wrapTopicWithSecondary(primaryKnowledge, secondaryKnowledge = null) {
  if (!primaryKnowledge) return null;
  return Object.assign({}, primaryKnowledge, {
    primaryTopic: primaryKnowledge.id,
    secondaryTopic: secondaryKnowledge ? secondaryKnowledge.id : null,
    secondaryKnowledge: secondaryKnowledge || null,
    source: primaryKnowledge.source || 'lib/class9Knowledge.js',
    grade: primaryKnowledge.grade || 9,
    subject: primaryKnowledge.subject || 'science',
    chapter: primaryKnowledge.chapter || null,
    conceptId: primaryKnowledge.conceptId || primaryKnowledge.id
  });
}

/**
 * Detects Class 9 topic directly from message text without history.
 * Implements deterministic primary-intent resolution before topic selection.
 */
function detectDirectClass9Topic(message = '') {
  if (!message || typeof message !== 'string') return null;
  const text = message.trim().toLowerCase();

  const hasRespiration = /(?:ଶ୍ୱାସକ୍ରିୟା|ଶ୍ୱସନ|respiration|breathing|ପ୍ରଶ୍ୱାସ|ନିଃଶ୍ୱାସ)/i.test(text);
  const hasPhotosynthesis = /(?:ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|photosynthesis|ପତ୍ରହରିତ|ହରିତକଣିକା|କ୍ଲୋରୋଫିଲ|chloroplast|chlorophyll)/i.test(text) ||
    (/(?:ଉଦ୍ଭିଦ|ଗଛ).*(?:ଅଙ୍ଗାରକାମ୍ଳ|ଅମ୍ଳଜାନ|ସୂର୍ଯ୍ୟାଲୋକ)/i.test(text) && !hasRespiration);

  // Deterministic primary-intent resolution between respiration & photosynthesis
  if (hasRespiration && hasPhotosynthesis) {
    // 1. Explicit misconception or question about respiration
    const isRespirationQuestionOrMisconception =
      /(?:ଦିନବେଳେ|ଦିନରେ|ରାତିରେ|ଗଛ|ଉଦ୍ଭିଦ|plant).*?(?:ଶ୍ୱାସକ୍ରିୟା|ଶ୍ୱସନ|respiration).*?(?:କରେ\s*ନାହିଁ|କରନ୍ତି\s*ନାହିଁ|ବନ୍ଦ\s*ରହେ|ହୁଏ\s*ନାହିଁ|not\s*respire|doesn'?t\s*respire)/i.test(text) ||
      /(?:ଶ୍ୱାସକ୍ରିୟା|ଶ୍ୱସନ|respiration).*?(?:ସତ\s*କି|true|correct|ଠିକ୍\s*କି|ହୁଏ\s*ନାହିଁ|କରେ\s*ନାହିଁ)/i.test(text) ||
      /(?:ଗଛ|ଉଦ୍ଭିଦ|plant).*?(?:ଶ୍ୱାସକ୍ରିୟା|ଶ୍ୱସନ|respiration).*?(?:କରେ\s*କି|କରନ୍ତି\s*କି|ହୁଏ\s*କି|କ['’]?ଣ|କାହିଁକି|does.*respire|respire\s*\?)/i.test(text) ||
      /(?:ଶ୍ୱାସକ୍ରିୟା|ଶ୍ୱସନ|respiration).*?(?:କରେ\s*କି|କରନ୍ତି\s*କି|କ['’]?ଣ|କିପରି|କାହିଁକି|does.*respire|what\s*is\s*respiration)/i.test(text);

    if (isRespirationQuestionOrMisconception) {
      return wrapTopicWithSecondary(CLASS_9_KNOWLEDGE.respiration, CLASS_9_KNOWLEDGE.photosynthesis);
    }

    // 2. Explicit question about photosynthesis (where respiration is only secondary)
    const isPhotosynthesisQuestion =
      /(?:ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|photosynthesis).*?(?:କ['’]?ଣ|କିପରି|କାହିଁକି|what\s*is|how\s*does)/i.test(text) &&
      !/(?:ଶ୍ୱାସକ୍ରିୟା|ଶ୍ୱସନ|respiration).*?(?:କରେ\s*କି|କରନ୍ତି\s*କି)/i.test(text);

    if (isPhotosynthesisQuestion) {
      return wrapTopicWithSecondary(CLASS_9_KNOWLEDGE.photosynthesis, CLASS_9_KNOWLEDGE.respiration);
    }

    // 3. Comparison between respiration and photosynthesis
    // E.g. "photosynthesis ଓ respiration ମଧ୍ୟରେ ପାର୍ଥକ୍ୟ କ'ଣ?", "ମୁଁ photosynthesis ଓ respiration ମଧ୍ୟରେ ପାର୍ଥକ୍ୟ କ'ଣ?"
    // Resolves to respiration as primary and photosynthesis as secondary context.
    const isComparison = /(?:ପାର୍ଥକ୍ୟ|ତୁଳନା|ଭିନ୍ନ|difference|different|differ|versus|\bvs\b|compare|comparison)/i.test(text);
    if (isComparison) {
      return wrapTopicWithSecondary(CLASS_9_KNOWLEDGE.respiration, CLASS_9_KNOWLEDGE.photosynthesis);
    }

    // Default when both present without explicit split: prioritize respiration as primary
    return wrapTopicWithSecondary(CLASS_9_KNOWLEDGE.respiration, CLASS_9_KNOWLEDGE.photosynthesis);
  }

  // Pure Respiration
  if (hasRespiration) {
    return wrapTopicWithSecondary(CLASS_9_KNOWLEDGE.respiration);
  }

  // Pure Photosynthesis
  if (hasPhotosynthesis) {
    return wrapTopicWithSecondary(CLASS_9_KNOWLEDGE.photosynthesis);
  }

  // 2. States of matter (including water heating and state change)
  if (/ପଦାର୍ଥର\s*ଅବସ୍ଥା|states?\s*of\s*matter|ପାଣିକୁ\s*ଗରମ|ଜଳକୁ\s*ଗରମ|ପାଣି\s*ଗରମ|ଜଳ\s*ଗରମ|ଗରମ\s*କଲେ.*ଅବସ୍ଥା|ଅବସ୍ଥା\s*ପରିବର୍ତ୍ତନ|water\s*state|heating\s*water|ବରଫ.*ତରଳ|ସ୍ଫୁଟନାଙ୍କ|ଗଳନାଙ୍କ|ତିନୋଟି\s*ଅବସ୍ଥା|୩ଟି\s*ଅବସ୍ଥା/i.test(text)) {
    return wrapTopicWithSecondary(CLASS_9_KNOWLEDGE.states_of_matter);
  }

  // 3. Evaporation (standalone or differential)
  if (/ବାଷ୍ପୀଭବନ|evaporation/i.test(text) && !/ଜଳ\s*ଚକ୍ର|ଜଳଚକ୍ର|water\s*cycle/i.test(text)) {
    return wrapTopicWithSecondary(CLASS_9_KNOWLEDGE.evaporation);
  }

  // 4. Water cycle
  if (/ଜଳ\s*ଚକ୍ର|ଜଳଚକ୍ର|water\s*cycle/i.test(text)) {
    return wrapTopicWithSecondary(CLASS_9_KNOWLEDGE.water_cycle);
  }

  // 5. Force and motion
  if (/ବଳ\s*ଓ\s*ଗତି|force\s*(?:and|&)\s*motion|ନ୍ୟୁଟନ|newton|ଜଡ଼ତା|inertia|ଗତି\s*ନିୟମ|ସଂବେଗ|momentum|କ୍ରିୟା.*ପ୍ରତିକ୍ରିୟା/i.test(text)) {
    return wrapTopicWithSecondary(CLASS_9_KNOWLEDGE.force_and_motion);
  }

  // 6. Cell
  if (/କୋଷ|cell\b|ମାଇଟୋକଣ୍ଡ୍ରିଆ|mitochondria|କୋଷ\s*ଭିତ୍ତି|କୋଷ\s*ଝିଲ୍ଲୀ|ନ୍ୟୁକ୍ଲିଅସ|nucleus|କୋଷଜୀବକ/i.test(text)) {
    return wrapTopicWithSecondary(CLASS_9_KNOWLEDGE.cell);
  }

  // 8. Matter (general concept)
  if (/ପଦାର୍ଥ\s*କ['’]?ଣ|what\s*is\s*matter|ପଦାର୍ଥ\s*ବୋଇଲେ|matter\b/i.test(text)) {
    return wrapTopicWithSecondary(CLASS_9_KNOWLEDGE.matter);
  }

  return null;
}

/**
 * Checks if a question has clear follow-up indicators in Odia.
 */
function isFollowUpIndicator(text = '', previousTopic = null) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();

  // Explicit follow-up indicators:
  // - "ଏହା କେଉଁଠାରୁ ଆସେ?"
  // - "ଏହାର କାମ କ'ଣ?"
  // - "କାହିଁକି?"
  // - "ପୁଣିଥରେ ବୁଝାଅ"
  // - "ସହଜ ଭାବରେ କହ"
  // - "ତାହେଲେ..."
  // - "ଏହା କିପରି ହୁଏ?"
  // - "ତୁମେ ଠିକ୍ ଭାବେ ବୁଝାଇନାହଁ। ଅମ୍ଳଜାନ ଆସେ କେଉଁଠାରୁ? ପୁଣିଥରେ ସହଜ ଭାବରେ ବୁଝାଅ।"
  const explicitIndicators = [
    /(?:^|[^\p{L}\p{N}])(?:ଏହା|ଏହାର|ଏହି|ସେହି|ସେଥିରୁ|ସେଥିରେ|ତାହା|ତାହାର|ତାହେଲେ|ତା’ହେଲେ|ତାହାହେଲେ)(?:[^\p{L}\p{N}]|$)/iu,
    /(?:କେଉଁଠାରୁ|କେଉଁଠୁ).*(?:ଆସେ|ମିଳେ|ବାହାରେ)|(?:ଆସେ|ମିଳେ|ବାହାରେ).*(?:କେଉଁଠାରୁ|କେଉଁଠୁ)/i,
    /(?:କାମ|କାର୍ଯ୍ୟ)\s*କ['’]?ଣ/i,
    /କାହିଁକି/i,
    /(?:ପୁଣିଥରେ|ପୁଣି\s*ଥରେ|ପୁଣି).*(?:ବୁଝାଅ|କହ|କୁହ)|(?:ବୁଝାଅ|କହ|କୁହ).*(?:ପୁଣିଥରେ|ପୁଣି\s*ଥରେ|ପୁଣି)/i,
    /(?:ସହଜ|ସରଳ)\s*ଭାବ(?:ରେ)?.*(?:କହ|କୁହ|ବୁଝାଅ)|(?:କହ|କୁହ|ବୁଝାଅ).*(?:ସହଜ|ସରଳ)\s*ଭାବ(?:ରେ)?|ସହଜରେ/i,
    /ତାହେଲେ|ତା’ହେଲେ|ତାହାହେଲେ/i,
    /(?:କିପରି|କେମିତି|କିଭଳି)\s*(?:ହୁଏ|ଘଟେ|କରେ)?/i,
    /ଠିକ୍\s*ଭାବେ\s*ବୁଝାଇନାହଁ|ବୁଝାଇନାହଁ|ବୁଝିପାରିଲି\s*ନାହିଁ|ବୁଝାପଡ଼ିଲା\s*ନାହିଁ/i
  ];

  for (const regex of explicitIndicators) {
    if (regex.test(clean)) return true;
  }

  // Concept continuation from previous topic + question intent
  if (previousTopic) {
    const topicTerms = [
      ...(Array.isArray(previousTopic.concepts) ? previousTopic.concepts : []),
      ...(Array.isArray(previousTopic.canonicalTerms) ? previousTopic.canonicalTerms : [])
    ];
    const cleanLower = clean.toLowerCase();
    const hasConceptMatch = topicTerms.some(term => {
      if (term.length < 2) return false;
      return cleanLower.includes(term.toLowerCase());
    });
    const hasQuestionIntent = /[?]|କ['’]?ଣ|କେଉଁ|କିପରି|କାହିଁକି|କେମିତି|ଆସେ|ମିଳେ|ହୁଏ|ବୁଝାଅ|କହ|କୁହ/i.test(clean);
    if (hasConceptMatch && hasQuestionIntent) {
      return true;
    }
  }

  return false;
}

/**
 * Deterministically identifies relevant Class 9 knowledge entry from student message.
 * Resolves follow-up questions using recent conversation context.
 * Returns null if the question is outside the current verified Class 9 science topics.
 */
function findRelevantClass9Knowledge(message = '', languageOrHistory = 'Odia', history = []) {
  if (!message || typeof message !== 'string') return null;

  let hist = history;
  if (Array.isArray(languageOrHistory)) {
    hist = languageOrHistory;
  }

  // 1. Direct topic match on message
  const direct = detectDirectClass9Topic(message);
  if (direct) {
    return direct;
  }

  // 2. Deterministic follow-up resolution using conversation history
  if (Array.isArray(hist) && hist.length > 0) {
    let previousTopic = null;
    for (let i = hist.length - 1; i >= 0; i--) {
      const turn = hist[i];
      const text = typeof turn === 'string' ? turn : (turn?.content || '');
      if (!text) continue;
      const found = detectDirectClass9Topic(text);
      if (found) {
        previousTopic = found;
        break;
      }
    }

    if (previousTopic && isFollowUpIndicator(message, previousTopic)) {
      return previousTopic;
    }
  }

  // 3. Extensible Curriculum Knowledge Base fallback lookup
  if (typeof findCurriculumConcept === 'function') {
    const curriculumMatch = findCurriculumConcept(message);
    if (curriculumMatch) {
      const cData = curriculumMatch.data;
      const isOd = languageOrHistory === 'Odia' || (typeof languageOrHistory === 'string' && languageOrHistory.toLowerCase().includes('odia'));
      return wrapTopicWithSecondary({
        id: curriculumMatch.topic,
        conceptId: curriculumMatch.concept,
        grade: curriculumMatch.grade,
        subject: curriculumMatch.subject,
        chapter: curriculumMatch.chapter,
        topic: curriculumMatch.topic,
        englishName: cData.name?.en || curriculumMatch.topic,
        odiaName: cData.name?.od || curriculumMatch.topic,
        concepts: cData.practiceConcepts || [curriculumMatch.concept],
        terminology: Object.entries(cData.canonicalTerms?.od || {}).map(([key, canon]) => ({
          concept: key,
          canonical: canon,
          english: cData.canonicalTerms?.en?.[key] || key,
          forbidden: []
        })),
        verifiedFacts: cData.coreFacts || [],
        commonMisconceptions: (cData.misconceptions || []).map(m => m.misconception),
        canonicalTerms: Object.values(cData.canonicalTerms?.od || {}),
        verifiedExplanation: isOd ? (cData.explanations?.od || '') : (cData.explanations?.en || ''),
        targetedFallbacks: [],
        source: 'lib/curriculumKnowledge.js'
      });
    }
  }

  return null;
}

/**
 * Returns the closest verified Class 9 knowledge entry by topic name or query.
 */
function getClass9Knowledge(topic = '', language = 'Odia') {
  if (!topic || typeof topic !== 'string') return null;
  const key = topic.trim().toLowerCase();

  if (CLASS_9_KNOWLEDGE[key]) return CLASS_9_KNOWLEDGE[key];

  const aliasMap = {
    'photosynthesis': 'photosynthesis',
    'ଆଲୋକ ସଂଶ୍ଳେଷଣ': 'photosynthesis',
    'matter': 'matter',
    'ପଦାର୍ଥ': 'matter',
    'states_of_matter': 'states_of_matter',
    'states of matter': 'states_of_matter',
    'water_states': 'states_of_matter',
    'water_state_change': 'states_of_matter',
    'ପଦାର୍ଥର ଅବସ୍ଥା': 'states_of_matter',
    'evaporation': 'evaporation',
    'ବାଷ୍ପୀଭବନ': 'evaporation',
    'water_cycle': 'water_cycle',
    'water cycle': 'water_cycle',
    'ଜଳଚକ୍ର': 'water_cycle',
    'ଜଳ ଚକ୍ର': 'water_cycle',
    'force_and_motion': 'force_and_motion',
    'force and motion': 'force_and_motion',
    'newton_motion': 'force_and_motion',
    'ବଳ ଓ ଗତି': 'force_and_motion',
    'cell': 'cell',
    'କୋଷ': 'cell',
    'respiration': 'respiration',
    'plant_respiration': 'respiration',
    'human_breathing': 'respiration',
    'ଶ୍ୱାସକ୍ରିୟା': 'respiration',
    'ଶ୍ୱସନ': 'respiration'
  };

  if (aliasMap[key]) return CLASS_9_KNOWLEDGE[aliasMap[key]];

  return findRelevantClass9Knowledge(topic, language);
}

/**
 * Validates an answer strictly against verified Class 9 knowledge.
 * Rejects contradictions, role changes, known misconceptions, and corrupted vocabulary.
 * Does NOT reject normal explanatory wording merely because phrasing differs.
 */
function validateAgainstClass9Knowledge(answer = '', knowledge = null) {
  if (!answer || typeof answer !== 'string') {
    return { valid: false, reason: 'empty_answer', detail: 'Empty answer text' };
  }
  if (!knowledge) {
    return { valid: true };
  }

  const clean = answer.trim();

  // Safe fallback / apology responses are valid safety boundaries
  if (/ଏହି\s*ପ୍ରଶ୍ନର\s*ନିଶ୍ଚିତ\s*ଉତ୍ତର\s*ଦେବାରେ\s*ମୋତେ\s*ଅସୁବିଧା\s*ହେଉଛି/i.test(clean)) {
    return { valid: true, isSafeFallback: true };
  }

  const cleanLower = clean.toLowerCase();

  // 1. Corrupted scientific vocabulary check (global)
  for (const { bad, replacement } of CORRUPTED_ODIA_VOCAB) {
    if (bad.test(clean)) {
      return {
        valid: false,
        reason: 'corrupted_terminology',
        failedFactRule: 'corrupted_vocabulary',
        detail: `Contains corrupted scientific terminology, should use: ${replacement}`
      };
    }
  }

  // 1b. Check forbidden terms from ALL topic terminologies
  for (const topicKey of Object.keys(CLASS_9_KNOWLEDGE)) {
    const topic = CLASS_9_KNOWLEDGE[topicKey];
    if (Array.isArray(topic.terminology)) {
      for (const term of topic.terminology) {
        if (Array.isArray(term.forbidden)) {
          for (const bad of term.forbidden) {
            if (!bad) continue;
            if (clean.includes(bad)) {
              return {
                valid: false,
                reason: 'corrupted_terminology',
                failedFactRule: 'canonical_terminology_violation',
                detail: `Contains forbidden/corrupted term "${bad}". Canonical Odia term is "${term.canonical}" (${term.english}).`
              };
            }
          }
        }
      }
    }
  }

  // 2. Topic drift check: ensure answer doesn't drift to completely unrelated topics
  if (knowledge.id === 'states_of_matter' || knowledge.id === 'matter' || knowledge.id === 'cell') {
    if (/photosynthesis|ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|ପତ୍ରହରିତ|ପତ୍ରରନ୍ଧ୍ର/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'topic_drift',
        failedFactRule: 'unrelated_topic_drift',
        detail: `Answer drifted to photosynthesis when topic is ${knowledge.englishName}`
      };
    }
  }

  // 3. Topic-specific factual relationships & misconceptions
  if (knowledge.id === 'photosynthesis') {
    // Oxygen must not be described as an input or main component
    const o2InputRegex = /ଅମ୍ଳଜାନ\s*(?:ହିଁ|ହେଉଛି|ଏକ)?\s*(?:(?:ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ(?:ର)?|ଖାଦ୍ୟ\s*ପ୍ରସ୍ତୁତି(?:ର)?)\s*)?(?:ଏକ\s*)?(?:ମୁଖ୍ୟ\s*)?ଉପାଦାନ|(?:ମୁଖ୍ୟ\s*)?ଉପାଦାନ\s*(?:ହେଉଛି|ଅଟେ)\s*ଅମ୍ଳଜାନ|ଅମ୍ଳଜାନ\s*(?:ଗ୍ୟାସ\s*)?(?:ଗ୍ରହଣ|ନିଏ|ନିଅନ୍ତି|ନିଆଯାଏ|ନିଆଯାଇଥାଏ|ନିଆଯାଉଛି|ବ୍ୟବହାର\s*କରେ|ବ୍ୟବହାର\s*କରି|ଆବଶ୍ୟକ|ଶୋଷଣ)|(?:ଗ୍ରହଣ\s*କରେ|ଗ୍ରହଣ\s*କରନ୍ତି|ନିଏ|ନିଅନ୍ତି|ନିଆଯାଏ|ଶୋଷଣ\s*କରେ)\s*(?:ହେଉଛି\s*)?ଅମ୍ଳଜାନ|ଅମ୍ଳଜାନ[^।]*?(?:ଭାବରେ\s*)?ନିଆଯାଏ/i;
    if (o2InputRegex.test(cleanLower)) {
      if (!/ଅମ୍ଳଜାନ.*(?:ଗ୍ରହଣ\s*କରେ\s*ନାହିଁ|ନିଏ\s*ନାହିଁ)|ଶ୍ୱସନ/i.test(cleanLower)) {
        return {
          valid: false,
          reason: 'misconception_oxygen_input',
          failedFactRule: 'rule1_photosynthesis_oxygen_input',
          detail: 'Oxygen is an output of photosynthesis, not an input or main component'
        };
      }
    }

    // CO2 must not be described as an output
    const co2OutputRegex = /ଅଙ୍ଗାରକାମ୍ଳ\s*(?:ହିଁ|ହେଉଛି|ଏକ)?\s*(?:(?:ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ(?:ର)?|ଖାଦ୍ୟ\s*ପ୍ରସ୍ତୁତି(?:ର)?)\s*)?(?:ଏକ\s*)?(?:ମୁଖ୍ୟ\s*)?ଉତ୍ପାଦ|(?:ମୁଖ୍ୟ\s*)?ଉତ୍ପାଦ\s*(?:ହେଉଛି|ଅଟେ)\s*ଅଙ୍ଗାରକାମ୍ଳ|ଅଙ୍ଗାରକାମ୍ଳ\s*(?:ଗ୍ୟାସ\s*)?(?:ନିର୍ଗତ|ତ୍ୟାଗ|ବାହାର\s*କରେ|ବାହାରିଥାଏ)|(?:ନିର୍ଗତ\s*ହୁଏ|ତ୍ୟାଗ\s*କରେ|ବାହାର\s*କରେ)\s*(?:ହେଉଛି\s*)?ଅଙ୍ଗାରକାମ୍ଳ/i;
    if (co2OutputRegex.test(cleanLower)) {
      if (!/ଅଙ୍ଗାରକାମ୍ଳ.*(?:ନିର୍ଗତ\s*ହୁଏ\s*ନାହିଁ|ତ୍ୟାଗ\s*କରେ\s*ନାହିଁ)|ଶ୍ୱସନ/i.test(cleanLower)) {
        return {
          valid: false,
          reason: 'misconception_co2_output',
          failedFactRule: 'rule1_photosynthesis_co2_output',
          detail: 'Carbon dioxide is absorbed for photosynthesis, not released'
        };
      }
    }

    // Water not main product
    if (/(?:ଜଳ|ପାଣି)\s*(?:ହେଉଛି\s*)?(?:ମୁଖ୍ୟ\s*ଉତ୍ପାଦ|ପ୍ରମୁଖ\s*ଉତ୍ପାଦ)|(?:ମୁଖ୍ୟ\s*ଉତ୍ପାଦ|ପ୍ରମୁଖ\s*ଉତ୍ପାଦ)\s*(?:ହେଉଛି\s*)?(?:ଜଳ|ପାଣି)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'misconception_water_product',
        failedFactRule: 'rule1_photosynthesis_water_main_product',
        detail: 'Water is an input for photosynthesis, not the main produced output'
      };
    }

    // Sunlight not food/matter
    if (/(?:ସୂର୍ଯ୍ୟାଲୋକ|ସୂର୍ଯ୍ୟଙ୍କ\s*ଆଲୋକ)\s*(?:କୁ\s*)?(?:ଖାଦ୍ୟ\s*ଭାବରେ|ପଦାର୍ଥ\s*ଭାବରେ|ଖାଦ୍ୟ\s*ରୂପେ)|(?:ଖାଦ୍ୟ\s*ଭାବରେ|ଖାଦ୍ୟ\s*ରୂପେ)\s*(?:ସୂର୍ଯ୍ୟାଲୋକ|ସୂର୍ଯ୍ୟଙ୍କ\s*ଆଲୋକ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'misconception_sunlight_food',
        failedFactRule: 'rule1_photosynthesis_sunlight_food',
        detail: 'Sunlight is an energy source, not food or matter'
      };
    }

    // Oxygen must not be described as an energy source
    if (/ଅମ୍ଳଜାନ[^।]*?ଶକ୍ତିର\s*ଉତ୍ସ|ଶକ୍ତିର\s*ଉତ୍ସ[^।]*?ଅମ୍ଳଜାନ/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'misconception_oxygen_energy_source',
        failedFactRule: 'rule1_photosynthesis_oxygen_energy_source',
        detail: 'Sunlight is the energy source for photosynthesis, not oxygen'
      };
    }

    // CO2 storage misconception
    if (/(?:ଅଙ୍ଗାରକାମ୍ଳ|co2|କାର୍ବନ)\s*(?:ଗ୍ୟାସ\s*)?(?:ସଞ୍ଚ[ୟଯ][଼]?|ସାଇତି|store|ଜମା)|(?:ସଞ୍ଚ[ୟଯ][଼]?|ସାଇତି|store|ଜମା)\s*(?:କରି\s*)?(?:ଅଙ୍ଗାରକାମ୍ଳ|co2|କାର୍ବନ)/i.test(cleanLower)) {
      if (!/(?:ସଞ୍ଚ[ୟଯ][଼]?|ସାଇତି|store|ଜମା)[^।]*?(?:ନାହିଁ|ନ\s*ଥାଏ)|(?:ନାହିଁ|ନ\s*ଥାଏ)[^।]*?(?:ସଞ୍ଚ[ୟଯ][଼]?|ସାଇତି)/i.test(cleanLower)) {
        return {
          valid: false,
          reason: 'misconception_night_co2_storage',
          failedFactRule: 'rule1_photosynthesis_night_co2_storage',
          detail: 'Plants do not store carbon dioxide as reason for stopping photosynthesis'
        };
      }
    }

    // Oxygen source: Oxygen released in photosynthesis comes from water splitting, NOT CO2
    const claimsO2FromCO2 = /(?:ଅମ୍ଳଜାନ|oxygen)\s*(?:ଗ୍ୟାସ\s*)?(?:co2|co₂|ଅଙ୍ଗାରକାମ୍ଳ|କାର୍ବନ\s*ଡାଇଅକ୍ସାଇଡ)[^।]*?(?:ରୁ|ଦ୍ୱାରା)\s*(?:ଆସେ|ମିଳେ|ନିର୍ଗତ|ମୁକ୍ତ|ବାହାରେ|ଉତ୍ପନ୍ନ|ସୃଷ୍ଟି)|(?:co2|co₂|ଅଙ୍ଗାରକାମ୍ଳ|କାର୍ବନ\s*ଡାଇଅକ୍ସାଇଡ)[^।]*?(?:ରୁ|ଦ୍ୱାରା)\s*(?:ଅମ୍ଳଜାନ|oxygen)[^।]*?(?:ଆସେ|ମିଳେ|ନିର୍ଗତ|ମୁକ୍ତ|ବାହାରେ|ଉତ୍ପନ୍ନ|ସୃଷ୍ଟି)/i.test(cleanLower);
    const o2FromCO2Negated = /(?:co2|co₂|ଅଙ୍ଗାରକାମ୍ଳ)[^।]*?(?:ରୁ\s*ନୁହେଁ|ରୁ\s*ଆସେ\s*ନାହିଁ|ରୁ\s*ମିଳେ\s*ନାହିଁ|ରୁ\s*ନିର୍ଗତ\s*ହୁଏ\s*ନାହିଁ|ରୁ\s*ମୁକ୍ତ\s*ହୁଏ\s*ନାହିଁ)|(?:ନାହିଁ|ନୁହେଁ)[^।]*?(?:co2|co₂|ଅଙ୍ଗାରକାମ୍ଳ)/i.test(cleanLower);
    if (claimsO2FromCO2 && !o2FromCO2Negated) {
      return {
        valid: false,
        reason: 'misconception_oxygen_from_co2',
        failedFactRule: 'rule1_photosynthesis_oxygen_from_co2',
        detail: 'The oxygen released during photosynthesis comes from the splitting of water molecules, not from carbon dioxide (CO2).'
      };
    }

    // Oxygen role requirement: if answer describes oxygen in photosynthesis, it must state it is released/output
    if (/ଅମ୍ଳଜାନ|oxygen/i.test(cleanLower)) {
      const mentionsRelease = /ନିର୍ଗତ|ମୁକ୍ତ|ବାହାର|ତ୍ୟାଗ|ଉପ-ଉତ୍ପାଦ|ପ୍ରକାଶ|ସୃଷ୍ଟି|ଉତ୍ପନ୍ନ|ଛାଡ଼/i.test(cleanLower);
      if (!mentionsRelease) {
        return {
          valid: false,
          reason: 'missing_oxygen_release_role',
          failedFactRule: 'rule1_photosynthesis_oxygen_release_missing',
          detail: 'Oxygen must be clearly stated as being released/produced as a by-product in photosynthesis'
        };
      }
    }
  }

  if (knowledge.id === 'states_of_matter') {
    if (/(?:ପାଣି|ଜଳ).*(?:ଗରମ|ଉତ୍ତାପ)|(?:ଗରମ|ଉତ୍ତାପ).*(?:ପାଣି|ଜଳ)|heating\s*water/i.test(cleanLower)) {
      if (!/ବାଷ୍ପ|ଜଳୀ[ୟୱ]\s*ବାଷ୍ପ|ଗ୍[ୟଯ][଼]?ାସ/i.test(cleanLower)) {
        return {
          valid: false,
          reason: 'missing_state_change',
          failedFactRule: 'rule4_water_heating_state_change_missing',
          detail: 'Must explain that heating water turns liquid into water vapour / gas'
        };
      }
    }
    if (/(?:ବାଷ୍ପ|ଜଳୀୟ\s*ବାଷ୍ପ)\s*(?:ହେଉଛି|ଅଟେ|ଭାବରେ)\s*ଅମ୍ଳଜାନ|ଅମ୍ଳଜାନ\s*(?:ହେଉଛି|ଅଟେ)\s*(?:ବାଷ୍ପ|ଜଳୀୟ\s*ବାଷ୍ପ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'misconception_vapour_oxygen',
        failedFactRule: 'rule4_water_states_gas_confusion',
        detail: 'Water vapour is gaseous water, not oxygen'
      };
    }
    if (/(?:ପାଣି|ଜଳ)\s*(?:କୁ\s*)?(?:ଗରମ|ଉତ୍ତାପ\s*କଲେ)\s*(?:ଅମ୍ଳଜାନ|ଅଙ୍ଗାରକାମ୍ଳ)\s*(?:ସୃଷ୍ଟି|ନିର୍ଗତ|ବାହାର|ଉତ୍ପନ୍ନ)|(?:ଗରମ|ଉତ୍ତାପ\s*କଲେ)\s*(?:ପାଣି|ଜଳ\s*ରୁ)\s*(?:ଅମ୍ଳଜାନ|ଅଙ୍ଗାରକାମ୍ଳ)\s*(?:ସୃଷ୍ଟି|ନିର୍ଗତ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'misconception_heating_produces_gas',
        failedFactRule: 'rule4_water_heating_produces_wrong_gas',
        detail: 'Heating water turns liquid into water vapour, does not produce oxygen or carbon dioxide'
      };
    }
    if (/ବରଫ\s*(?:ହେଉଛି|ଅଟେ|ଏକ)?\s*(?:ଗ୍ୟାସ|ବାଷ୍ପ)|ଗ୍ୟାସ\s*(?:ହେଉଛି|ଅଟେ)\s*ବରଫ|(?:ବାଷ୍ପ|ଜଳୀୟ\s*ବାଷ୍ପ)\s*(?:ହେଉଛି|ଅଟେ|ଏକ)?\s*କଠିନ|କଠିନ\s*(?:ହେଉଛି|ଅଟେ)\s*(?:ବାଷ୍ପ|ଜଳୀୟ\s*ବାଷ୍ପ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'misconception_states_reversed',
        failedFactRule: 'rule4_water_states_reversed',
        detail: 'Solid is ice, liquid is water, gas is water vapour'
      };
    }
    if (/ପାଣି.*ଗରମ|ଜଳ.*ଗରମ|heating.*water/i.test(cleanLower)) {
      if (!/ବାଷ୍ପ|ଜଳୀ[ୟୱ]\s*ବାଷ୍ପ|steam|vapou?r|ଗ୍[ୟଯ][଼]?ାସ/i.test(cleanLower)) {
        return {
          valid: false,
          reason: 'missing_water_steam_state_change',
          failedFactRule: 'rule4_water_heating_state_change_missing',
          detail: 'When asked about heating water, answer must explain the state change from liquid to water vapour/steam/gas'
        };
      }
    }
  }

  if (knowledge.id === 'evaporation') {
    if (/(?:ବାଷ୍ପ(?!ୀଭବନ)|ଜଳୀୟ\s*ବାଷ୍ପ|ଗ୍ୟାସ)[^।]*?(?:ତରଳ|ଜଳ(?!ୀୟ)|ପାଣି)[^।]*?(?:ପରିଣତ|ହେବାକୁ|କୁହାଯାଏ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'misconception_evaporation_reversed',
        failedFactRule: 'rule5_evaporation_reversed',
        detail: 'Evaporation is liquid to gas, not gas to liquid'
      };
    }
  }

  if (knowledge.id === 'water_cycle') {
    if (/ବର୍ଷା.*(?:ପୃଥିବୀରୁ\s*ମେଘ|ଭୂପୃଷ୍ଠରୁ\s*ମେଘ|ଉପରକୁ\s*ଯାଏ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'misconception_water_cycle_reversed',
        failedFactRule: 'rule8_water_cycle_reversed',
        detail: 'Rain falls from clouds to Earth'
      };
    }
  }

  if (knowledge.id === 'force_and_motion') {
    if (/ନ୍ୟୁଟନ.*ପ୍ରଥମ|newton.*first|ଜଡ଼ତା|inertia/i.test(cleanLower)) {
      if (/କ୍ରିୟା.*ପ୍ରତିକ୍ରିୟା|action.*reaction/i.test(cleanLower) && !/ତୃତୀୟ|third/i.test(cleanLower)) {
        return {
          valid: false,
          reason: 'misconception_inertia_newton3_confusion',
          failedFactRule: 'rule7_newton_inertia_confusion',
          detail: "Newton's First Law is Inertia, not Action and Reaction"
        };
      }
    }
  }

  if (knowledge.id === 'cell') {
    if (/ପ୍ରାଣୀ\s*କୋଷ.*(?:କୋଷ\s*ଭିତ୍ତି\s*ଥାଏ|ହରିତକଣିକା\s*ଥାଏ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'misconception_cell_animal_cell_wall',
        failedFactRule: 'rule_cell_animal_no_cell_wall',
        detail: 'Animal cells do not have a cell wall or chloroplasts; only plant cells do'
      };
    }
    if (/ମାଇଟୋକଣ୍ଡ୍ରିଆ.*(?:ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|ଖାଦ୍ୟ\s*ପ୍ରସ୍ତୁତି)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'misconception_mitochondria_photosynthesis',
        failedFactRule: 'rule_cell_mitochondria_role',
        detail: 'Mitochondria is the powerhouse for respiration, not the site of photosynthesis'
      };
    }
  }

  if (knowledge.id === 'respiration') {
    if (/ଅଙ୍ଗାରକାମ୍ଳ\s*(?:ଗ୍ୟାସ\s*)?(?:ଗ୍ରହଣ\s*କରେ|ଗ୍ରହଣ\s*କରନ୍ତି|ନିଏ|ନିଅନ୍ତି|ପ୍ରଶ୍ୱାସରେ\s*ନିଏ)|(?:ଗ୍ରହଣ\s*କରେ|ଗ୍ରହଣ\s*କରନ୍ତି|ପ୍ରଶ୍ୱାସରେ\s*ନିଏ)\s*ଅଙ୍ଗାରକାମ୍ଳ/i.test(cleanLower)) {
      if (!/ଅଙ୍ଗାରକାମ୍ଳ\s*ଗ୍ରହଣ\s*କରେ\s*ନାହିଁ/i.test(cleanLower)) {
        return {
          valid: false,
          reason: 'misconception_breathing_co2_inhaled',
          failedFactRule: 'rule3_human_breathing_reversed',
          detail: 'Humans inhale oxygen, not carbon dioxide'
        };
      }
    }
    if (/ଅମ୍ଳଜାନ\s*(?:ଗ୍ୟାସ\s*)?(?:ତ୍ୟାଗ\s*କରେ|ତ୍ୟାଗ\s*କରନ୍ତି|ନିଃଶ୍ୱାସରେ\s*ବାହାର|ବାହାର\s*କରେ|ଛାଡ଼େ)|(?:ତ୍ୟାଗ\s*କରେ|ନିଃଶ୍ୱାସରେ\s*ବାହାର\s*କରେ|ଛାଡ଼େ)\s*ଅମ୍ଳଜାନ/i.test(cleanLower)) {
      if (!/ଅମ୍ଳଜାନ\s*ତ୍ୟାଗ\s*କରେ\s*ନାହିଁ/i.test(cleanLower)) {
        return {
          valid: false,
          reason: 'misconception_breathing_oxygen_exhaled',
          failedFactRule: 'rule3_human_breathing_reversed',
          detail: 'Humans exhale carbon dioxide, not oxygen'
        };
      }
    }
    if (/(?:ରାତିରେ|ଅନ୍ଧାରରେ)\s*ଶ୍ୱସନ\s*(?:ବନ୍ଦ|କରନ୍ତି\s*ନାହିଁ|ରୋକିଦିଅନ୍ତି)|ଶ୍ୱସନ\s*(?:ରାତିରେ\s*ବନ୍ଦ|ରାତିରେ\s*କରନ୍ତି\s*ନାହିଁ)/i.test(cleanLower)) {
      return {
        valid: false,
        reason: 'misconception_plant_respiration_night_stop',
        failedFactRule: 'rule2_plant_respiration_night_stop',
        detail: 'Plants respire continuously day and night'
      };
    }
  }

  return { valid: true };
}

/**
 * Audits all 8 Class 9 knowledge entries and fails if:
 * - Canonical terms are missing
 * - Forbidden terms appear in verified facts or explanations
 * - A fact contradicts another fact in the same topic
 */
function validateClass9KnowledgeBase() {
  const errors = [];
  const requiredTopicIds = [
    'photosynthesis',
    'matter',
    'states_of_matter',
    'evaporation',
    'water_cycle',
    'force_and_motion',
    'cell',
    'respiration'
  ];

  // 1. Check all required topics exist with terminology definitions
  for (const tid of requiredTopicIds) {
    const topic = CLASS_9_KNOWLEDGE[tid];
    if (!topic) {
      errors.push(`Missing topic: ${tid}`);
      continue;
    }

    if (!Array.isArray(topic.terminology) || topic.terminology.length === 0) {
      errors.push(`Topic ${tid} is missing terminology definition`);
      continue;
    }

    for (const term of topic.terminology) {
      if (!term.canonical || typeof term.canonical !== 'string') {
        errors.push(`Topic ${tid} concept ${term.concept} missing canonical term`);
      }
      if (!term.english || typeof term.english !== 'string') {
        errors.push(`Topic ${tid} concept ${term.concept} missing English mapping`);
      }
      if (!Array.isArray(term.forbidden)) {
        errors.push(`Topic ${tid} concept ${term.concept} missing forbidden list`);
      }
    }
  }

  // 2. Minimum canonical mappings verification:
  // stomata → ପତ୍ରରନ୍ଧ୍ର
  // chlorophyll → ପତ୍ରହରିତ
  // photosynthesis → ଆଲୋକ ସଂଶ୍ଳେଷଣ
  // carbon dioxide → ଅଙ୍ଗାରକାମ୍ଳ
  // oxygen → ଅମ୍ଳଜାନ
  // water vapour → ଜଳୀୟ ବାଷ୍ପ / ବାଷ୍ପ
  const minRequired = [
    { concept: 'stomata', canonical: 'ପତ୍ରରନ୍ଧ୍ର' },
    { concept: 'chlorophyll', canonical: 'ପତ୍ରହରିତ' },
    { concept: 'photosynthesis', canonical: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ' },
    { concept: 'carbon_dioxide', canonical: 'ଅଙ୍ଗାରକାମ୍ଳ' },
    { concept: 'oxygen', canonical: 'ଅମ୍ଳଜାନ' },
    { concept: 'water_vapour', canonical: ['ଜଳୀୟ ବାଷ୍ପ', 'ବାଷ୍ପ'] }
  ];

  for (const req of minRequired) {
    let found = false;
    for (const tid of requiredTopicIds) {
      const topic = CLASS_9_KNOWLEDGE[tid];
      if (!topic?.terminology) continue;
      const t = topic.terminology.find(item => item.concept === req.concept);
      if (t) {
        if (Array.isArray(req.canonical)) {
          if (req.canonical.some(c => t.canonical.includes(c))) found = true;
        } else if (t.canonical === req.canonical) {
          found = true;
        }
      }
    }
    if (!found) {
      errors.push(`Canonical mapping missing for concept: ${req.concept}`);
    }
  }

  // 3. Collect all forbidden terms across all topics
  const allForbiddenTerms = [];
  for (const tid of Object.keys(CLASS_9_KNOWLEDGE)) {
    const topic = CLASS_9_KNOWLEDGE[tid];
    if (Array.isArray(topic.terminology)) {
      for (const term of topic.terminology) {
        if (Array.isArray(term.forbidden)) {
          for (const f of term.forbidden) {
            if (f && typeof f === 'string') {
              allForbiddenTerms.push({ forbidden: f, concept: term.concept, topicId: tid });
            }
          }
        }
      }
    }
  }

  // 4. Ensure no forbidden terms appear in verified facts or explanations
  for (const tid of Object.keys(CLASS_9_KNOWLEDGE)) {
    const topic = CLASS_9_KNOWLEDGE[tid];
    const textsToCheck = [
      ...(topic.verifiedFacts || []),
      topic.verifiedExplanation || ''
    ];

    for (const text of textsToCheck) {
      if (!text) continue;
      for (const { forbidden, concept, topicId } of allForbiddenTerms) {
        if (text.includes(forbidden)) {
          errors.push(`Forbidden term "${forbidden}" (concept: ${concept} in ${topicId}) appears in verified text of topic "${tid}": "${text}"`);
        }
      }
      for (const { bad, replacement } of CORRUPTED_ODIA_VOCAB) {
        if (bad.test(text)) {
          errors.push(`Corrupted vocabulary pattern ${bad} appears in verified text of topic "${tid}": "${text}" (should use ${replacement})`);
        }
      }
    }
  }

  // 5. Contradiction check: ensure verified facts do not contradict rules or each other in the same topic
  for (const tid of Object.keys(CLASS_9_KNOWLEDGE)) {
    const topic = CLASS_9_KNOWLEDGE[tid];
    if (!Array.isArray(topic.verifiedFacts)) continue;

    for (const fact of topic.verifiedFacts) {
      const val = validateAgainstClass9Knowledge(fact, topic);
      if (!val.valid) {
        errors.push(`Verified fact in topic "${tid}" contradicts topic rules: "${fact}" (${val.reason}: ${val.detail})`);
      }

      // Check intra-topic contradictions for each individual fact
      const factLower = fact.toLowerCase();
      if (tid === 'photosynthesis') {
        const claimsO2Input = /ଅମ୍ଳଜାନ\s*(?:ଗ୍ୟାସ\s*)?(?:ଗ୍ରହଣ|ଶୋଷଣ|ନିଏ)/i.test(factLower) && !/ଅମ୍ଳଜାନ.*ଗ୍ରହଣ\s*କରେ\s*ନାହିଁ/i.test(factLower);
        const claimsCO2Output = /ଅଙ୍ଗାରକାମ୍ଳ\s*(?:ଗ୍ୟାସ\s*)?(?:ନିର୍ଗତ|ତ୍ୟାଗ|ବାହାର)/i.test(factLower) && !/ଅଙ୍ଗାରକାମ୍ଳ.*ନିର୍ଗତ\s*ହୁଏ\s*ନାହିଁ/i.test(factLower);
        const claimsO2FromCO2 = /(?:ଅମ୍ଳଜାନ|oxygen).*(?:co2|co₂|ଅଙ୍ଗାରକାମ୍ଳ).*(?:ରୁ|ଦ୍ୱାରା)\s*(?:ଆସେ|ମିଳେ|ନିର୍ଗତ|ମୁକ୍ତ)/i.test(factLower) && !/(?:co2|co₂|ଅଙ୍ଗାରକାମ୍ଳ).*ରୁ\s*(?:ନୁହେଁ|(?:ଆସେ\s*)?ନାହିଁ)/i.test(factLower);
        if (claimsO2Input) errors.push(`Topic photosynthesis contains fact claiming oxygen is input: "${fact}"`);
        if (claimsCO2Output) errors.push(`Topic photosynthesis contains fact claiming CO2 is output: "${fact}"`);
        if (claimsO2FromCO2) errors.push(`Topic photosynthesis contains fact claiming oxygen comes from CO2: "${fact}"`);
      } else if (tid === 'respiration') {
        const claimsCO2In = /ପ୍ରଶ୍ୱାସ.*ଅଙ୍ଗାରକାମ୍ଳ|ଅଙ୍ଗାରକାମ୍ଳ\s*(?:ଗ୍ୟାସ\s*)?ଗ୍ରହଣ/i.test(factLower) && !/ଅଙ୍ଗାରକାମ୍ଳ.*ଗ୍ରହଣ\s*କରେ\s*ନାହିଁ/i.test(factLower);
        const claimsO2Out = /ନିଃଶ୍ୱାସ.*ଅମ୍ଳଜାନ|ଅମ୍ଳଜାନ\s*(?:ଗ୍ୟାସ\s*)?ତ୍ୟାଗ/i.test(factLower) && !/ଅମ୍ଳଜାନ.*ତ୍ୟାଗ\s*କରେ\s*ନାହିଁ/i.test(factLower);
        if (claimsCO2In) errors.push(`Topic respiration contains fact claiming CO2 is inhaled: "${fact}"`);
        if (claimsO2Out) errors.push(`Topic respiration contains fact claiming oxygen is exhaled: "${fact}"`);
      } else if (tid === 'states_of_matter') {
        const claimsWrongGas = /ଗରମ\s*କଲେ.*(?:ଅମ୍ଳଜାନ|ଅଙ୍ଗାରକାମ୍ଳ)/i.test(factLower) && !/(?:ଅମ୍ଳଜାନ|ଅଙ୍ଗାରକାମ୍ଳ).*ସୃଷ୍ଟି\s*ହୁଏ\s*ନାହିଁ/i.test(factLower);
        if (claimsWrongGas) errors.push(`Topic states_of_matter contains fact claiming heating water makes oxygen or CO2: "${fact}"`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    detail: errors.join('; ')
  };
}

/**
 * Returns a direct, question-specific verified Odia answer in 2-4 simple sentences.
 * Selects the smallest relevant verified answer using question intent and concept.
 * Validates the answer before returning.
 */
function getVerifiedAnswer(question = '', knowledge = null) {
  if (!question || typeof question !== 'string') return '';
  const cleanQ = question.trim();
  const qLower = cleanQ.toLowerCase();

  const kb = knowledge || findRelevantClass9Knowledge(cleanQ, 'Odia');
  if (!kb) {
    return '';
  }

  let answer = '';

  // 1. Check targeted concept/question intent fallbacks
  if (Array.isArray(kb.targetedFallbacks)) {
    for (const tf of kb.targetedFallbacks) {
      if (typeof tf.match === 'function' && tf.match(cleanQ)) {
        const cand = tf.answer;
        const vQuality = typeof validateOdiaTutorAnswer === 'function'
          ? validateOdiaTutorAnswer(cand, cleanQ)
          : { valid: true };
        const vFact = validateAgainstClass9Knowledge(cand, kb);
        if (vQuality.valid && vFact.valid) {
          answer = cand;
          break;
        }
      }
    }
  }

  // 2. If no targeted intent matched, select the smallest relevant verified answer
  // by finding the best matching verified facts based on keyword overlap
  if (!answer && Array.isArray(kb.verifiedFacts) && kb.verifiedFacts.length > 0) {
    let bestFact = null;
    let highestScore = 0;

    for (const fact of kb.verifiedFacts) {
      const factLower = fact.toLowerCase();
      let score = 0;
      if (Array.isArray(kb.concepts)) {
        for (const c of kb.concepts) {
          if (qLower.includes(c) && factLower.includes(c)) score += 2;
        }
      }
      if (Array.isArray(kb.canonicalTerms)) {
        for (const term of kb.canonicalTerms) {
          if (qLower.includes(term) && factLower.includes(term)) score += 3;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestFact = fact;
      }
    }

    if (bestFact && highestScore >= 2) {
      const candFact = bestFact.replace(/\([A-Za-z0-9\s,./-]+\)/g, '').replace(/\s+/g, ' ').trim();
      const vQuality = typeof validateOdiaTutorAnswer === 'function'
        ? validateOdiaTutorAnswer(candFact, cleanQ)
        : { valid: true };
      const vFact = validateAgainstClass9Knowledge(candFact, kb);
      if (vQuality.valid && vFact.valid) {
        answer = candFact;
      }
    }
  }

  if (!answer) {
    answer = kb.verifiedExplanation || '';
  }

  // 3. Final validation of generated answer
  const factVal = validateAgainstClass9Knowledge(answer, kb);
  const qualVal = typeof validateOdiaTutorAnswer === 'function'
    ? validateOdiaTutorAnswer(answer, cleanQ)
    : { valid: true };
  if (!factVal.valid || !qualVal.valid) {
    console.warn(`[getVerifiedAnswer] Fallback answer failed validation (fact: ${factVal.reason}, qual: ${qualVal.reason}): ${answer}`);
    answer = kb.verifiedExplanation || '';
  }

  return answer;
}

/**
 * Returns a guaranteed-valid verified answer generated directly from Class 9 knowledge.
 * Ensures the candidate passes both quality and factual validations.
 */
function getGuaranteedClass9Answer(knowledge, question = '', contentPlan = null) {
  if (!knowledge) return '';
  const cleanQ = (question || '').trim();

  // 1. Try getVerifiedAnswer
  const verified = getVerifiedAnswer(cleanQ, knowledge);
  if (verified) {
    const v1 = typeof validateOdiaTutorAnswer === 'function'
      ? validateOdiaTutorAnswer(verified, cleanQ, contentPlan)
      : { valid: true };
    const v2 = validateAgainstClass9Knowledge(verified, knowledge);
    if (v1.valid && v2.valid) {
      return verified;
    }
  }

  // 2. Try verifiedExplanation directly
  if (knowledge.verifiedExplanation) {
    const exp = knowledge.verifiedExplanation;
    const v1 = typeof validateOdiaTutorAnswer === 'function'
      ? validateOdiaTutorAnswer(exp, cleanQ, contentPlan)
      : { valid: true };
    const v2 = validateAgainstClass9Knowledge(exp, knowledge);
    if (v1.valid && v2.valid) {
      return exp;
    }
  }

  // 3. Try each targeted fallback
  if (Array.isArray(knowledge.targetedFallbacks)) {
    for (const tf of knowledge.targetedFallbacks) {
      if (tf.answer) {
        const v1 = typeof validateOdiaTutorAnswer === 'function'
          ? validateOdiaTutorAnswer(tf.answer, cleanQ, contentPlan)
          : { valid: true };
        const v2 = validateAgainstClass9Knowledge(tf.answer, knowledge);
        if (v1.valid && v2.valid) {
          return tf.answer;
        }
      }
    }
  }

  return knowledge.verifiedExplanation || '';
}

module.exports = {
  CLASS_9_KNOWLEDGE,
  getClass9Knowledge,
  findRelevantClass9Knowledge,
  detectDirectClass9Topic,
  isFollowUpIndicator,
  wrapTopicWithSecondary,
  validateAgainstClass9Knowledge,
  validateClass9KnowledgeBase,
  getVerifiedAnswer,
  getGuaranteedClass9Answer
};
