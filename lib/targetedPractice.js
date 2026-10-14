'use strict';

const { isOdia } = require('./languagePolicy');
const {
  recordLearningEvent,
  chooseNextStudyAction
} = require('./studentLearningState');

/**
 * Strips unnecessary English parentheticals in Odia text (e.g. "(Oxygen)", "(Stomata)")
 * while strictly preserving chemical formulas and scientific notation (e.g. CO2, H2O, ATP).
 */
function cleanOdiaParentheticals(text) {
  if (!text || typeof text !== 'string') return text;
  if (/[\u0b00-\u0b7f]/.test(text)) {
    return text.replace(/\(\s*([A-Za-z0-9_ -]+)\s*\)/g, (match, inner) => {
      const trimmed = inner.trim();
      // Keep chemical formulas & notation
      if (/^(?:CO[2₂]|H[2₂]O|ATP|DNA|RNA|O[2₂3₃]|C[6₆]H[1₁][2₂]O[6₆]|N[2₂])$/i.test(trimmed)) {
        return match;
      }
      return '';
    }).replace(/[ ]{2,}/g, ' ').replace(/\s+([।,?.])/g, '$1').trim();
  }
  return text;
}

/**
 * Deterministic Class 9 Targeted Practice Bank.
 * Strictly adheres to verified Class 9 SCERT/NCERT scientific facts.
 * Odia-first presentation: unnecessary English parentheticals are omitted.
 * Canonical Odia scientific terminology is enforced:
 * - photosynthesis: ଆଲୋକ ସଂଶ୍ଳେଷଣ
 * - stomata: ପତ୍ରରନ୍ଧ୍ର
 * - chlorophyll: ପତ୍ରହରିତ
 * - oxygen: ଅମ୍ଳଜାନ
 * - carbon dioxide: ଅଙ୍ଗାରକାମ୍ଳ
 * - water vapour: ଜଳୀୟ ବାଷ୍ପ
 */
const PRACTICE_BANK = {
  'photosynthesis:oxygen_role': {
    topic: 'photosynthesis',
    concept: 'oxygen_role',
    questions: [
      {
        odia: {
          question: "ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ଅମ୍ଳଜାନର ଭୂମିକା କ'ଣ?",
          options: [
            "ଏହା ଉଦ୍ଭିଦ ଦ୍ୱାରା ବାୟୁମଣ୍ଡଳକୁ ଉପ-ଉତ୍ପାଦ ଭାବରେ ନିର୍ଗତ ହୁଏ",
            "ଏହା ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ବାୟୁରୁ ଗ୍ରହଣ କରାଯାଏ",
            "ଏହା ମାଟିରୁ ଚେର ଦ୍ୱାରା ଶୋଷଣ କରାଯାଏ",
            "ଏହା ଆଲୋକ ସଂଶ୍ଳେଷଣର ଶକ୍ତିର ଉତ୍ସ ଅଟେ"
          ],
          correctAnswer: "ଏହା ଉଦ୍ଭିଦ ଦ୍ୱାରା ବାୟୁମଣ୍ଡଳକୁ ଉପ-ଉତ୍ପାଦ ଭାବରେ ନିର୍ଗତ ହୁଏ",
          explanation: "ଆଲୋକ ସଂଶ୍ଳେଷଣ ସମୟରେ ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକ, ଜଳ ଓ ଅଙ୍ଗାରକାମ୍ଳ ବ୍ୟବହାର କରି ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରେ ଏବଂ ଉପ-ଉତ୍ପାଦ ଭାବରେ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ।"
        },
        english: {
          question: "What is the role of oxygen in the process of photosynthesis?",
          options: [
            "It is released into the atmosphere as a by-product",
            "It is absorbed from the air as an essential input",
            "It is absorbed by roots from the soil",
            "It provides light energy to synthesize glucose"
          ],
          correctAnswer: "It is released into the atmosphere as a by-product",
          explanation: "During photosynthesis, plants synthesize glucose using sunlight, water, and carbon dioxide, and release oxygen into the atmosphere as a by-product."
        }
      },
      {
        odia: {
          question: "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ନିର୍ଗତ ହେଉଥିବା ଅମ୍ଳଜାନ ମୁଖ୍ୟତଃ କେଉଁଥିରୁ ଉତ୍ପନ୍ନ ହୁଏ?",
          options: [
            "ଜଳର ବିଭାଜନରୁ (H2O)",
            "ଅଙ୍ଗାରକାମ୍ଳରୁ (CO2)",
            "ସୂର୍ଯ୍ୟାଲୋକରୁ",
            "ମାଟିର ଖଣିଜ ଲବଣରୁ"
          ],
          correctAnswer: "ଜଳର ବିଭାଜନରୁ (H2O)",
          explanation: "ଆଲୋକ ସଂଶ୍ଳେଷଣର ଆଲୋକ ପ୍ରକ୍ରିୟାରେ ଜଳର ଆଲୋକ ବିଶ୍ଳେଷଣ ଘଟି ଅମ୍ଳଜାନ (O2) ନିର୍ଗତ ହୁଏ।"
        },
        english: {
          question: "In photosynthesis, what is the direct source of the released oxygen gas?",
          options: [
            "Photolysis of water (H2O)",
            "Carbon dioxide breakdown (CO2)",
            "Directly from sunlight",
            "Soil minerals"
          ],
          correctAnswer: "Photolysis of water (H2O)",
          explanation: "During the light reactions of photosynthesis, water molecules are split (photolysis) to release oxygen gas."
        }
      }
    ]
  },

  'photosynthesis:carbon_dioxide_role': {
    topic: 'photosynthesis',
    concept: 'carbon_dioxide_role',
    odia: {
      question: "ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ଅଙ୍ଗାରକାମ୍ଳର (CO2) ଭୂମିକା କ'ଣ?",
      options: [
        "ଉଦ୍ଭିଦ ପତ୍ରରନ୍ଧ୍ର ଦ୍ୱାରା ବାୟୁମଣ୍ଡଳରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରି ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରେ",
        "ଏହା ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ବାୟୁମଣ୍ଡଳକୁ ନିର୍ଗତ ହୁଏ",
        "ଏହା ଚେର ଦ୍ୱାରା ମାଟିରୁ ଶୋଷଣ ହୁଏ",
        "ଏହା ସୂର୍ଯ୍ୟାଲୋକକୁ ସିଧାସଳଖ ଶୋଷଣ କରେ"
      ],
      correctAnswer: "ଉଦ୍ଭିଦ ପତ୍ରରନ୍ଧ୍ର ଦ୍ୱାରା ବାୟୁମଣ୍ଡଳରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରି ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରେ",
      explanation: "ଉଦ୍ଭିଦ ବାୟୁମଣ୍ଡଳରୁ ପତ୍ରରନ୍ଧ୍ର ମାଧ୍ୟମରେ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ ଏବଂ ଏହାକୁ ବ୍ୟବହାର କରି ଖାଦ୍ୟ (ଗ୍ଲୁକୋଜ୍/ଶ୍ୱେତସାର) ତିଆରି କରେ।"
    },
    english: {
      question: "What is the role of carbon dioxide in photosynthesis?",
      options: [
        "Plants absorb carbon dioxide through stomata to synthesize food",
        "It is released into the atmosphere as a waste by-product",
        "It is absorbed by roots directly from soil water",
        "It captures sunlight inside leaf chloroplasts"
      ],
      correctAnswer: "Plants absorb carbon dioxide through stomata to synthesize food",
      explanation: "Plants absorb atmospheric carbon dioxide through stomata on leaves, which is used along with water and sunlight to synthesize food."
    }
  },

  'photosynthesis:photosynthesis': {
    topic: 'photosynthesis',
    concept: 'photosynthesis',
    questions: [
      {
        odia: {
          question: "ସବୁଜ ଉଦ୍ଭିଦ କେଉଁ ପ୍ରକ୍ରିୟା ଦ୍ୱାରା ନିଜର ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରନ୍ତି?",
          options: [
            "ଆଲୋକ ସଂଶ୍ଳେଷଣ",
            "ଶ୍ୱାସକ୍ରିୟା",
            "ବାଷ୍ପୀଭବନ",
            "ଘନୀଭବନ"
          ],
          correctAnswer: "ଆଲୋକ ସଂଶ୍ଳେଷଣ",
          explanation: "ସବୁଜ ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକ, ଜଳ ଓ ଅଙ୍ଗାରକାମ୍ଳ ସାହାଯ୍ୟରେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟା ଦ୍ୱାରା ନିଜର ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରନ୍ତି।"
        },
        english: {
          question: "By which process do green plants synthesize their own food?",
          options: [
            "Photosynthesis",
            "Respiration",
            "Evaporation",
            "Transpiration"
          ],
          correctAnswer: "Photosynthesis",
          explanation: "Green plants synthesize glucose using sunlight, water, and carbon dioxide through photosynthesis."
        }
      },
      {
        odia: {
          question: "ଉଦ୍ଭିଦର ପତ୍ରରେ ଥିବା କେଉଁ କଣିକା ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ସୂର୍ଯ୍ୟାଲୋକ ଶୋଷଣ କରେ?",
          options: [
            "ପତ୍ରହରିତ",
            "ଜଳ",
            "ଶ୍ୱେତସାର",
            "କୋଷରସ"
          ],
          correctAnswer: "ପତ୍ରହରିତ",
          explanation: "ପତ୍ରହରିତ (କ୍ଲୋରୋଫିଲ୍) ସୂର୍ଯ୍ୟାଲୋକର ଆଲୋକ ଶକ୍ତିକୁ ଶୋଷଣ କରି ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ସାହାଯ୍ୟ କରେ।"
        },
        english: {
          question: "Which green pigment in plant leaves absorbs sunlight for photosynthesis?",
          options: [
            "Chlorophyll",
            "Hemoglobin",
            "Carotene",
            "Anthocyanin"
          ],
          correctAnswer: "Chlorophyll",
          explanation: "Chlorophyll is the green pigment in chloroplasts that absorbs sunlight energy needed for photosynthesis."
        }
      }
    ]
  },

  'respiration:plant_respiration': {
    topic: 'respiration',
    concept: 'plant_respiration',
    questions: [
      {
        odia: {
          question: "ଉଦ୍ଭିଦ କେବେ ଶ୍ୱାସକ୍ରିୟା କରେ?",
          options: [
            "ଦିନ ଓ ରାତି ଉଭୟ ସମୟରେ ନିରନ୍ତର ଶ୍ୱାସକ୍ରିୟା କରେ",
            "କେବଳ ରାତିରେ ଶ୍ୱାସକ୍ରିୟା କରେ",
            "କେବଳ ଦିନରେ ଶ୍ୱାସକ୍ରିୟା କରେ",
            "ଉଦ୍ଭିଦ କେବେବି ଶ୍ୱାସକ୍ରିୟା କରେ ନାହିଁ"
          ],
          correctAnswer: "ଦିନ ଓ ରାତି ଉଭୟ ସମୟରେ ନିରନ୍ତର ଶ୍ୱାସକ୍ରିୟା କରେ",
          explanation: "ଉଦ୍ଭିଦ ସବୁ ଜୀବଙ୍କ ପରି ଦିନ ଓ ରାତି ସବୁବେଳେ ନିରନ୍ତର ଶ୍ୱାସକ୍ରିୟା କରିଥାଏ।"
        },
        english: {
          question: "When do plants carry out respiration?",
          options: [
            "Continuously both day and night",
            "Only at night",
            "Only during the day",
            "Plants never respire"
          ],
          correctAnswer: "Continuously both day and night",
          explanation: "Plants respire continuously all 24 hours (day and night) to generate energy for cellular survival."
        }
      },
      {
        odia: {
          question: "ଉଦ୍ଭିଦ ଶ୍ୱାସକ୍ରିୟା ପ୍ରକ୍ରିୟାରେ କେଉଁ ଗ୍ୟାସ ଗ୍ରହଣ କରେ ଏବଂ କେଉଁ ଗ୍ୟାସ ଛାଡ଼େ?",
          options: [
            "ଅମ୍ଳଜାନ (O2) ଗ୍ରହଣ କରେ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ (CO2) ଛାଡ଼େ",
            "ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ ଏବଂ ଅମ୍ଳଜାନ ଛାଡ଼େ",
            "ଉଭୟ ଅମ୍ଳଜାନ ଓ ଯବକ୍ଷାରଜାନ ଗ୍ରହଣ କରେ",
            "କୌଣସି ଗ୍ୟାସ ଗ୍ରହଣ କରେ ନାହିଁ"
          ],
          correctAnswer: "ଅମ୍ଳଜାନ (O2) ଗ୍ରହଣ କରେ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ (CO2) ଛାଡ଼େ",
          explanation: "ଉଦ୍ଭିଦ ଶ୍ୱାସକ୍ରିୟାରେ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରି ଗ୍ଲୁକୋଜ୍ ଭାଙ୍ଗି ଶକ୍ତି ପାଏ ଓ ଅଙ୍ଗାରକାମ୍ଳ ନିର୍ଗତ କରେ।"
        },
        english: {
          question: "Which gas do plants absorb and release during respiration?",
          options: [
            "Absorb oxygen (O2) and release carbon dioxide (CO2)",
            "Absorb carbon dioxide and release oxygen",
            "Absorb both oxygen and nitrogen",
            "They do not exchange gases during respiration"
          ],
          correctAnswer: "Absorb oxygen (O2) and release carbon dioxide (CO2)",
          explanation: "Like all living organisms, plants consume oxygen to break down glucose and release carbon dioxide during cellular respiration."
        }
      },
      {
        odia: {
          question: "ଦିନବେଳେ ଉଦ୍ଭିଦରେ ଶ୍ୱାସକ୍ରିୟା ଏବଂ ଆଲୋକ ସଂଶ୍ଳେଷଣ ମଧ୍ୟରେ କ'ଣ ସମ୍ପର୍କ ରହିଥାଏ?",
          options: [
            "ଦିନବେଳେ ଉଭୟ ଶ୍ୱାସକ୍ରିୟା ଓ ଆଲୋକ ସଂଶ୍ଳେଷଣ ଏକାସାଙ୍ଗରେ ଚାଲେ",
            "ଦିନବେଳେ କେବଳ ଆଲୋକ ସଂଶ୍ଳେଷଣ ଚାଲେ, ଶ୍ୱାସକ୍ରିୟା ବନ୍ଦ ରହେ",
            "ଦିନବେଳେ ଶ୍ୱାସକ୍ରିୟା ଚାଲେ, କିନ୍ତୁ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବନ୍ଦ ରହେ",
            "ଦିନବେଳେ ଦୁଇଟିଯାକ ବନ୍ଦ ରହେ"
          ],
          correctAnswer: "ଦିନବେଳେ ଉଭୟ ଶ୍ୱାସକ୍ରିୟା ଓ ଆଲୋକ ସଂଶ୍ଳେଷଣ ଏକାସାଙ୍ଗରେ ଚାଲେ",
          explanation: "ଦିନରେ ସୂର୍ଯ୍ୟାଲୋକ ଥିବାରୁ ଆଲୋକ ସଂଶ୍ଳେଷଣ ଦ୍ରୁତ ଗତିରେ ଚାଲେ ଏବଂ ଶ୍ୱାସକ୍ରିୟା ମଧ୍ୟ ନିରନ୍ତର ଚାଲୁ ରହେ।"
        },
        english: {
          question: "What happens in plants during daytime regarding respiration and photosynthesis?",
          options: [
            "Both respiration and photosynthesis occur simultaneously",
            "Only photosynthesis occurs; respiration stops",
            "Only respiration occurs; photosynthesis stops",
            "Neither process occurs during daytime"
          ],
          correctAnswer: "Both respiration and photosynthesis occur simultaneously",
          explanation: "During daytime, plants conduct both photosynthesis and respiration simultaneously."
        }
      }
    ]
  },

  'respiration:inhalation_oxygen': {
    topic: 'respiration',
    concept: 'inhalation_oxygen',
    questions: [
      {
        odia: {
          question: "ମଣିଷ ଶ୍ୱାସକ୍ରିୟାରେ କେଉଁ ଗ୍ୟାସ ଗ୍ରହଣ କରେ ଏବଂ କେଉଁ ଗ୍ୟାସ ଛାଡ଼େ?",
          options: [
            "ପ୍ରଶ୍ୱାସରେ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ ଏବଂ ନିଃଶ୍ୱାସରେ ଅଙ୍ଗାରକାମ୍ଳ ଛାଡ଼େ",
            "ପ୍ରଶ୍ୱାସରେ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ ଏବଂ ନିଃଶ୍ୱାସରେ ଅମ୍ଳଜାନ ଛାଡ଼େ",
            "ଉଭୟ ପ୍ରଶ୍ୱାସ ଓ ନିଃଶ୍ୱାସରେ କେବଳ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ",
            "ଉଭୟ ପ୍ରଶ୍ୱାସ ଓ ନିଃଶ୍ୱାସରେ କେବଳ ଅଙ୍ଗାରକାମ୍ଳ ବ୍ୟବହାର କରେ"
          ],
          correctAnswer: "ପ୍ରଶ୍ୱାସରେ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ ଏବଂ ନିଃଶ୍ୱାସରେ ଅଙ୍ଗାରକାମ୍ଳ ଛାଡ଼େ",
          explanation: "ମଣିଷ ଶ୍ୱାସକ୍ରିୟା ସମୟରେ ପ୍ରଶ୍ୱାସରେ ବାୟୁମଣ୍ଡଳରୁ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ ଏବଂ ନିଃଶ୍ୱାସରେ ଅଙ୍ଗାରକାମ୍ଳ ବାହାରକୁ ଛାଡ଼େ।"
        },
        english: {
          question: "Which gas is inhaled and which is exhaled during human respiration?",
          options: [
            "Oxygen is inhaled and carbon dioxide is exhaled",
            "Carbon dioxide is inhaled and oxygen is exhaled",
            "Only oxygen is inhaled and exhaled",
            "Nitrogen is converted into oxygen during breathing"
          ],
          correctAnswer: "Oxygen is inhaled and carbon dioxide is exhaled",
          explanation: "During breathing, humans inhale oxygen from the air into lungs and exhale carbon dioxide produced by cellular metabolism."
        }
      },
      {
        odia: {
          question: "ମଣିଷର ଶ୍ୱାସତନ୍ତ୍ରରେ ମୁଖ୍ୟ ଶ୍ୱାସ ଅଙ୍ଗ କେଉଁଟି?",
          options: [
            "ଫୁସଫୁସ",
            "ହୃତ୍‌ପିଣ୍ଡ",
            "ଯକୃତ",
            "ବୃକ୍‌କ"
          ],
          correctAnswer: "ଫୁସଫୁସ",
          explanation: "ମଣିଷର ମୁଖ୍ୟ ଶ୍ୱାସ ଅଙ୍ଗ ହେଉଛି ଫୁସଫୁସ, ଯାହା ମାଧ୍ୟମରେ ଅମ୍ଳଜାନ ଓ ଅଙ୍ଗାରକାମ୍ଳର ଗ୍ୟାସ ବିନିମୟ ଘଟେ।"
        },
        english: {
          question: "Which is the primary respiratory organ in the human body?",
          options: [
            "Lungs",
            "Heart",
            "Liver",
            "Kidneys"
          ],
          correctAnswer: "Lungs",
          explanation: "The lungs are the primary organs of human respiration where gas exchange takes place."
        }
      }
    ]
  },

  'respiration:respiration': {
    topic: 'respiration',
    concept: 'respiration',
    questions: [
      {
        odia: {
          question: "ମଣିଷ ଶ୍ୱାସକ୍ରିୟାରେ କେଉଁ ଗ୍ୟାସ ଗ୍ରହଣ କରେ ଏବଂ କେଉଁ ଗ୍ୟାସ ଛାଡ଼େ?",
          options: [
            "ପ୍ରଶ୍ୱାସରେ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ ଏବଂ ନିଃଶ୍ୱାସରେ ଅଙ୍ଗାରକାମ୍ଳ ଛାଡ଼େ",
            "ପ୍ରଶ୍ୱାସରେ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ ଏବଂ ନିଃଶ୍ୱାସରେ ଅମ୍ଳଜାନ ଛାଡ଼େ",
            "ଉଭୟ ପ୍ରଶ୍ୱାସ ଓ ନିଃଶ୍ୱାସରେ କେବଳ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ",
            "ଉଭୟ ପ୍ରଶ୍ୱାସ ଓ ନିଃଶ୍ୱାସରେ କେବଳ ଅଙ୍ଗାରକାମ୍ଳ ବ୍ୟବହାର କରେ"
          ],
          correctAnswer: "ପ୍ରଶ୍ୱାସରେ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ ଏବଂ ନିଃଶ୍ୱାସରେ ଅଙ୍ଗାରକାମ୍ଳ ଛାଡ଼େ",
          explanation: "ମଣିଷ ଶ୍ୱାସକ୍ରିୟା ସମୟରେ ପ୍ରଶ୍ୱାସରେ ବାୟୁମଣ୍ଡଳରୁ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ ଏବଂ ନିଃଶ୍ୱାସରେ ଅଙ୍ଗାରକାମ୍ଳ ବାହାରକୁ ଛାଡ଼େ।"
        },
        english: {
          question: "Which gas is inhaled and which is exhaled during human respiration?",
          options: [
            "Oxygen is inhaled and carbon dioxide is exhaled",
            "Carbon dioxide is inhaled and oxygen is exhaled",
            "Only oxygen is inhaled and exhaled",
            "Nitrogen is converted into oxygen during breathing"
          ],
          correctAnswer: "Oxygen is inhaled and carbon dioxide is exhaled",
          explanation: "During breathing, humans inhale oxygen from the air into lungs and exhale carbon dioxide produced by cellular metabolism."
        }
      },
      {
        odia: {
          question: "ଜୀବକୋଷରେ ଶ୍ୱାସକ୍ରିୟାର ମୁଖ୍ୟ ଉଦ୍ଦେଶ୍ୟ କ'ଣ?",
          options: [
            "ଖାଦ୍ୟରୁ ଜୈବିକ ଶକ୍ତି (ATP) ଉତ୍ପନ୍ନ କରିବା",
            "ପତ୍ରରେ ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରିବା",
            "ଜଳ ଶୋଷଣ କରିବା",
            "ରକ୍ତ ସଞ୍ଚାଳନ କରିବା"
          ],
          correctAnswer: "ଖାଦ୍ୟରୁ ଜୈବିକ ଶକ୍ତି (ATP) ଉତ୍ପନ୍ନ କରିବା",
          explanation: "ଶ୍ୱାସକ୍ରିୟାରେ ଗ୍ଲୁକୋଜ୍ ଜାରିତ ହୋଇ କୋଷୀୟ ଶକ୍ତି (ATP) ସୃଷ୍ଟି ହୁଏ।"
        },
        english: {
          question: "What is the primary biological purpose of cellular respiration?",
          options: [
            "To release usable cellular energy (ATP) from food",
            "To synthesize glucose from sunlight",
            "To absorb mineral nutrients from soil",
            "To circulate blood through vessels"
          ],
          correctAnswer: "To release usable cellular energy (ATP) from food",
          explanation: "Cellular respiration breaks down glucose in the presence of oxygen to release usable biochemical energy (ATP)."
        }
      }
    ]
  },

  'evaporation:liquid_to_gas': {
    topic: 'evaporation',
    concept: 'liquid_to_gas',
    odia: {
      question: "ବାଷ୍ପୀଭବନ ପ୍ରକ୍ରିୟାରେ ପଦାର୍ଥର କେଉଁ ଅବସ୍ଥାନ୍ତର ଘଟେ?",
      options: [
        "ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ପଦାର୍ଥ ବାଷ୍ପ ବା ଗ୍ୟାସରେ ପରିଣତ ହୁଏ",
        "ଗ୍ୟାସ ଥଣ୍ଡା ହୋଇ ତରଳରେ ପରିଣତ ହୁଏ",
        "କଠିନ ପଦାର୍ଥ ସିଧାସଳଖ ଗ୍ୟାସରେ ପରିଣତ ହୁଏ",
        "ତରଳ ପଦାର୍ଥ ଜମାଟ ବାନ୍ଧି କଠିନ ହୁଏ"
      ],
      correctAnswer: "ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ପଦାର୍ଥ ବାଷ୍ପ ବା ଗ୍ୟାସରେ ପରିଣତ ହୁଏ",
      explanation: "ବାଷ୍ପୀଭବନରେ ତରଳ ପଦାର୍ଥ ଉତ୍ତାପ ଶୋଷଣ କରି ଏହାର ସ୍ଫୁଟନାଙ୍କ ତଳେ ବାଷ୍ପରେ (ଗ୍ୟାସରେ) ପରିଣତ ହୁଏ।"
    },
    english: {
      question: "What state change occurs during evaporation?",
      options: [
        "Liquid changes into gas/vapour below its boiling point",
        "Gas cools down and changes into liquid",
        "Solid changes directly into gas without melting",
        "Liquid freezes into a crystalline solid"
      ],
      correctAnswer: "Liquid changes into gas/vapour below its boiling point",
      explanation: "Evaporation is the surface phenomenon where liquid particles gain energy and change into vapour below its boiling point."
    }
  },

  'evaporation:evaporation': {
    topic: 'evaporation',
    concept: 'evaporation',
    odia: {
      question: "ବାଷ୍ପୀଭବନ ପ୍ରକ୍ରିୟାରେ ପଦାର୍ଥର କେଉଁ ଅବସ୍ଥାନ୍ତର ଘଟେ?",
      options: [
        "ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ପଦାର୍ଥ ବାଷ୍ପ ବା ଗ୍ୟାସରେ ପରିଣତ ହୁଏ",
        "ଗ୍ୟାସ ଥଣ୍ଡା ହୋଇ ତରଳରେ ପରିଣତ ହୁଏ",
        "କଠିନ ପଦାର୍ଥ ସିଧାସଳଖ ଗ୍ୟାସରେ ପରିଣତ ହୁଏ",
        "ତରଳ ପଦାର୍ଥ ଜମାଟ ବାନ୍ଧି କଠିନ ହୁଏ"
      ],
      correctAnswer: "ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ପଦାର୍ଥ ବାଷ୍ପ ବା ଗ୍ୟାସରେ ପରିଣତ ହୁଏ",
      explanation: "ବାଷ୍ପୀଭବନରେ ତରଳ ପଦାର୍ଥ ଉତ୍ତାପ ଶୋଷଣ କରି ଏହାର ସ୍ଫୁଟନାଙ୍କ ତଳେ ବାଷ୍ପରେ (ଗ୍ୟାସରେ) ପରିଣତ ହୁଏ।"
    },
    english: {
      question: "What state change occurs during evaporation?",
      options: [
        "Liquid changes into gas/vapour below its boiling point",
        "Gas cools down and changes into liquid",
        "Solid changes directly into gas without melting",
        "Liquid freezes into a crystalline solid"
      ],
      correctAnswer: "Liquid changes into gas/vapour below its boiling point",
      explanation: "Evaporation is the surface phenomenon where liquid particles gain energy and change into vapour below its boiling point."
    }
  },

  'water_cycle:condensation_clouds': {
    topic: 'water_cycle',
    concept: 'condensation_clouds',
    odia: {
      question: "ଜଳ ଚକ୍ରରେ ଜଳୀୟ ବାଷ୍ପ ଥଣ୍ଡା ହୋଇ ମେଘ ସୃଷ୍ଟି ହେବା ପ୍ରକ୍ରିୟାକୁ କ'ଣ କୁହାଯାଏ?",
      options: [
        "ଘନୀଭବନ",
        "ବାଷ୍ପୀଭବନ",
        "ଅବକ୍ଷେପଣ",
        "ଭୂତଳ ଜଳ ପ୍ରବାହ"
      ],
      correctAnswer: "ଘନୀଭବନ",
      explanation: "ଉପରକୁ ଉଠିଥିବା ଜଳୀୟ ବାଷ୍ପ ଥଣ୍ଡା ହୋଇ ଘନୀଭବନ ପ୍ରକ୍ରିୟା ମାଧ୍ୟମରେ କ୍ଷୁଦ୍ର ଜଳବିନ୍ଦୁରେ ପରିଣତ ହୁଏ ଏବଂ ମେଘ ସୃଷ୍ଟି କରେ।"
    },
    english: {
      question: "In the water cycle, what process causes water vapour to cool down and form clouds?",
      options: [
        "Condensation",
        "Evaporation",
        "Precipitation",
        "Infiltration"
      ],
      correctAnswer: "Condensation",
      explanation: "As water vapour rises and cools in the upper atmosphere, it condenses into tiny water droplets to form clouds."
    }
  },

  'water_cycle:water_cycle': {
    topic: 'water_cycle',
    concept: 'water_cycle',
    odia: {
      question: "ଜଳ ଚକ୍ରରେ ଜଳୀୟ ବାଷ୍ପ ଥଣ୍ଡା ହୋଇ ମେଘ ସୃଷ୍ଟି ହେବା ପ୍ରକ୍ରିୟାକୁ କ'ଣ କୁହାଯାଏ?",
      options: [
        "ଘନୀଭବନ",
        "ବାଷ୍ପୀଭବନ",
        "ଅବକ୍ଷେପଣ",
        "ଭୂତଳ ଜଳ ପ୍ରବାହ"
      ],
      correctAnswer: "ଘନୀଭବନ",
      explanation: "ଉପରକୁ ଉଠିଥିବା ଜଳୀୟ ବାଷ୍ପ ଥଣ୍ଡା ହୋଇ ଘନୀଭବନ ପ୍ରକ୍ରିୟା ମାଧ୍ୟମରେ କ୍ଷୁଦ୍ର ଜଳବିନ୍ଦୁରେ ପରିଣତ ହୁଏ ଏବଂ ମେଘ ସୃଷ୍ଟି କରେ।"
    },
    english: {
      question: "In the water cycle, what process causes water vapour to cool down and form clouds?",
      options: [
        "Condensation",
        "Evaporation",
        "Precipitation",
        "Infiltration"
      ],
      correctAnswer: "Condensation",
      explanation: "As water vapour rises and cools in the upper atmosphere, it condenses into tiny water droplets to form clouds."
    }
  },

  'states_of_matter:heating_water': {
    topic: 'states_of_matter',
    concept: 'heating_water',
    odia: {
      question: "ପାଣିକୁ ଗରମ କଲେ ଏହା ତରଳ ଅବସ୍ଥାରୁ କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତିତ ହୁଏ?",
      options: [
        "ଗ୍ୟାସୀୟ ଅବସ୍ଥା (ଜଳୀୟ ବାଷ୍ପ)",
        "କଠିନ ଅବସ୍ଥା (ବରଫ)",
        "ପ୍ଲାଜ୍ମା ଅବସ୍ଥା",
        "କୌଣସି ଅବସ୍ଥା ପରିବର୍ତ୍ତନ ହୁଏ ନାହିଁ"
      ],
      correctAnswer: "ଗ୍ୟାସୀୟ ଅବସ୍ଥା (ଜଳୀୟ ବାଷ୍ପ)",
      explanation: "ପାଣିକୁ ଗରମ କଲେ ଏହା ତରଳ ଅବସ୍ଥାରୁ ଗ୍ୟାସୀୟ ଅବସ୍ଥା ଅର୍ଥାତ୍ ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହୁଏ।"
    },
    english: {
      question: "When water is heated to boiling point, which state of matter does it change into?",
      options: [
        "Gaseous state (water vapour)",
        "Solid state (ice)",
        "Plasma state",
        "It remains liquid without state transition"
      ],
      correctAnswer: "Gaseous state (water vapour)",
      explanation: "Heating water supplies thermal energy, causing liquid water to turn into gaseous water vapour (steam)."
    }
  },

  'states_of_matter:states_of_matter': {
    topic: 'states_of_matter',
    concept: 'states_of_matter',
    odia: {
      question: "ପାଣିକୁ ଗରମ କଲେ ଏହା ତରଳ ଅବସ୍ଥାରୁ କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତିତ ହୁଏ?",
      options: [
        "ଗ୍ୟାସୀୟ ଅବସ୍ଥା (ଜଳୀୟ ବାଷ୍ପ)",
        "କଠିନ ଅବସ୍ଥା (ବରଫ)",
        "ପ୍ଲାଜ୍ମା ଅବସ୍ଥା",
        "କୌଣସି ଅବସ୍ଥା ପରିବର୍ତ୍ତନ ହୁଏ ନାହିଁ"
      ],
      correctAnswer: "ଗ୍ୟାସୀୟ ଅବସ୍ଥା (ଜଳୀୟ ବାଷ୍ପ)",
      explanation: "ପାଣିକୁ ଗରମ କଲେ ଏହା ତରଳ ଅବସ୍ଥାରୁ ଗ୍ୟାସୀୟ ଅବସ୍ଥା ଅର୍ଥାତ୍ ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହୁଏ।"
    },
    english: {
      question: "When water is heated to boiling point, which state of matter does it change into?",
      options: [
        "Gaseous state (water vapour)",
        "Solid state (ice)",
        "Plasma state",
        "It remains liquid without state transition"
      ],
      correctAnswer: "Gaseous state (water vapour)",
      explanation: "Heating water supplies thermal energy, causing liquid water to turn into gaseous water vapour (steam)."
    }
  },

  'force_and_motion:inertia_first_law': {
    topic: 'force_and_motion',
    concept: 'inertia_first_law',
    questions: [
      {
        odia: {
          question: "ନ୍ୟୁଟନଙ୍କ ଗତିର ପ୍ରଥମ ନିୟମ ଅନୁସାରେ ଏକ ବସ୍ତୁର ସ୍ଥିର ବା ଗତିଶୀଳ ଅବସ୍ଥା ପରିବର୍ତ୍ତନ ପାଇଁ କ'ଣ ଆବଶ୍ୟକ?",
          options: [
            "ବାହ୍ୟ ଅସନ୍ତୁଳିତ ବଳ",
            "ବସ୍ତୁର ଆଭ୍ୟନ୍ତରୀଣ ବଳ",
            "କୌଣସି ବଳର ଆବଶ୍ୟକତା ନାହିଁ",
            "ସମାନ ଓ ବିପରୀତ ପ୍ରତିକ୍ରିୟା"
          ],
          correctAnswer: "ବାହ୍ୟ ଅସନ୍ତୁଳିତ ବଳ",
          explanation: "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ନିୟମ (ଜଡ଼ତା ନିୟମ) ଅନୁସାରେ କୌଣସି ବାହ୍ୟ ଅସନ୍ତୁଳିତ ବଳ ପ୍ରୟୋଗ ନ ହେବା ପର୍ଯ୍ୟନ୍ତ ବସ୍ତୁଟି ତାର ସ୍ଥିର କିମ୍ବା ସମଗତି ଅବସ୍ଥାରେ ରହେ।"
        },
        english: {
          question: "According to Newton's First Law of Motion, what is needed to alter an object's state of rest or uniform motion?",
          options: [
            "An external unbalanced force",
            "An internal balanced force",
            "Zero net friction only",
            "Equal and opposite reaction force"
          ],
          correctAnswer: "An external unbalanced force",
          explanation: "Newton's First Law (Law of Inertia) states that an object remains at rest or in uniform motion unless acted upon by an external unbalanced force."
        }
      },
      {
        odia: {
          question: "କୌଣସି ବସ୍ତୁର ଜଡ଼ତା ମୁଖ୍ୟତଃ କାହା ଉପରେ ନିର୍ଭର କରେ?",
          options: [
            "ବସ୍ତୁର ବସ୍ତୁତ୍ୱ",
            "ବସ୍ତୁର ବେଗ",
            "ବସ୍ତୁର ଆୟତନ",
            "ବସ୍ତୁର ଆକାର"
          ],
          correctAnswer: "ବସ୍ତୁର ବସ୍ତୁତ୍ୱ",
          explanation: "ବସ୍ତୁର ଜଡ଼ତା ତାର ବସ୍ତୁତ୍ୱ (mass) ଉପରେ ନିର୍ଭର କରେ। ଅଧିକ ବସ୍ତୁତ୍ୱ ଥିବା ବସ୍ତୁର ଜଡ଼ତା ଅଧିକ ହୁଏ।"
        },
        english: {
          question: "What does an object's inertia directly depend on?",
          options: [
            "Its mass",
            "Its speed",
            "Its volume",
            "Its shape"
          ],
          correctAnswer: "Its mass",
          explanation: "Inertia is the inherent tendency of an object to resist changes in its state of motion, and it is directly proportional to its mass."
        }
      },
      {
        odia: {
          question: "ନିମ୍ନଲିଖିତ ମଧ୍ୟରୁ କେଉଁଟିକୁ ଜଡ଼ତା ନିୟମ (Law of Inertia) କୁହାଯାଏ?",
          options: [
            "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ",
            "ନ୍ୟୁଟନଙ୍କ ଦ୍ୱିତୀୟ ଗତି ନିୟମ",
            "ନ୍ୟୁଟନଙ୍କ ତୃତୀୟ ଗତି ନିୟମ",
            "ମହାକର୍ଷଣ ନିୟମ"
          ],
          correctAnswer: "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ",
          explanation: "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମକୁ ଜଡ଼ତା ନିୟମ (Law of Inertia) କୁହାଯାଏ।"
        },
        english: {
          question: "Which law of motion is also known as the Law of Inertia?",
          options: [
            "Newton's First Law of Motion",
            "Newton's Second Law of Motion",
            "Newton's Third Law of Motion",
            "Law of Conservation of Momentum"
          ],
          correctAnswer: "Newton's First Law of Motion",
          explanation: "Newton's First Law of Motion states that an object continues in its state of rest or uniform motion unless acted upon by an external force, which defines inertia."
        }
      }
    ]
  },

  'force_and_motion:force_and_motion': {
    topic: 'force_and_motion',
    concept: 'force_and_motion',
    questions: [
      {
        odia: {
          question: "ନ୍ୟୁଟନଙ୍କ ଗତିର ପ୍ରଥମ ନିୟମ ଅନୁସାରେ ଏକ ବସ୍ତୁର ସ୍ଥିର ବା ଗତିଶୀଳ ଅବସ୍ଥା ପରିବର୍ତ୍ତନ ପାଇଁ କ'ଣ ଆବଶ୍ୟକ?",
          options: [
            "ବାହ୍ୟ ଅସନ୍ତୁଳିତ ବଳ",
            "ବସ୍ତୁର ଆଭ୍ୟନ୍ତରୀଣ ବଳ",
            "କୌଣସି ବଳର ଆବଶ୍ୟକତା ନାହିଁ",
            "ସମାନ ଓ ବିପରୀତ ପ୍ରତିକ୍ରିୟା"
          ],
          correctAnswer: "ବାହ୍ୟ ଅସନ୍ତୁଳିତ ବଳ",
          explanation: "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ନିୟମ (ଜଡ଼ତା ନିୟମ) ଅନୁସାରେ କୌଣସି ବାହ୍ୟ ଅସନ୍ତୁଳିତ ବଳ ପ୍ରୟୋଗ ନ ହେବା ପର୍ଯ୍ୟନ୍ତ ବସ୍ତୁଟି ତାର ସ୍ଥିର କିମ୍ବା ସମଗତି ଅବସ୍ଥାରେ ରହେ।"
        },
        english: {
          question: "According to Newton's First Law of Motion, what is needed to alter an object's state of rest or uniform motion?",
          options: [
            "An external unbalanced force",
            "An internal balanced force",
            "Zero net friction only",
            "Equal and opposite reaction force"
          ],
          correctAnswer: "An external unbalanced force",
          explanation: "Newton's First Law (Law of Inertia) states that an object remains at rest or in uniform motion unless acted upon by an external unbalanced force."
        }
      },
      {
        odia: {
          question: "କୌଣସି ବସ୍ତୁର ଜଡ଼ତା ମୁଖ୍ୟତଃ କାହା ଉପରେ ନିର୍ଭର କରେ?",
          options: [
            "ବସ୍ତୁର ବସ୍ତୁତ୍ୱ",
            "ବସ୍ତୁର ବେଗ",
            "ବସ୍ତୁର ଆୟତନ",
            "ବସ୍ତୁର ଆକାର"
          ],
          correctAnswer: "ବସ୍ତୁର ବସ୍ତୁତ୍ୱ",
          explanation: "ବସ୍ତୁର ଜଡ଼ତା ତାର ବସ୍ତୁତ୍ୱ (mass) ଉପରେ ନିର୍ଭର କରେ। ଅଧିକ ବସ୍ତୁତ୍ୱ ଥିବା ବସ୍ତୁର ଜଡ଼ତା ଅଧିକ ହୁଏ।"
        },
        english: {
          question: "What does an object's inertia directly depend on?",
          options: [
            "Its mass",
            "Its speed",
            "Its volume",
            "Its shape"
          ],
          correctAnswer: "Its mass",
          explanation: "Inertia is the inherent tendency of an object to resist changes in its state of motion, and it is directly proportional to its mass."
        }
      },
      {
        odia: {
          question: "ନିମ୍ନଲିଖିତ ମଧ୍ୟରୁ କେଉଁଟିକୁ ଜଡ଼ତା ନିୟମ (Law of Inertia) କୁହାଯାଏ?",
          options: [
            "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ",
            "ନ୍ୟୁଟନଙ୍କ ଦ୍ୱିତୀୟ ଗତି ନିୟମ",
            "ନ୍ୟୁଟନଙ୍କ ତୃତୀୟ ଗତି ନିୟମ",
            "ମହାକର୍ଷଣ ନିୟମ"
          ],
          correctAnswer: "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ",
          explanation: "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମକୁ ଜଡ଼ତା ନିୟମ (Law of Inertia) କୁହାଯାଏ।"
        },
        english: {
          question: "Which law of motion is also known as the Law of Inertia?",
          options: [
            "Newton's First Law of Motion",
            "Newton's Second Law of Motion",
            "Newton's Third Law of Motion",
            "Law of Conservation of Momentum"
          ],
          correctAnswer: "Newton's First Law of Motion",
          explanation: "Newton's First Law of Motion states that an object continues in its state of rest or uniform motion unless acted upon by an external force, which defines inertia."
        }
      }
    ]
  },

  'cell:mitochondria_powerhouse': {
    topic: 'cell',
    concept: 'mitochondria_powerhouse',
    odia: {
      question: "କୋଷର କେଉଁ ଅଙ୍ଗିକାକୁ ଶକ୍ତି କେନ୍ଦ୍ର କୁହାଯାଏ?",
      options: [
        "ମାଇଟୋକଣ୍ଡ୍ରିଆ",
        "ନ୍ୟୁକ୍ଲିଅସ",
        "କୋଷ ଭିତ୍ତି",
        "ରାଇବୋଜୋମ"
      ],
      correctAnswer: "ମାଇଟୋକଣ୍ଡ୍ରିଆ",
      explanation: "ମାଇଟୋକଣ୍ଡ୍ରିଆ କୋଷୀୟ ଶ୍ୱାସକ୍ରିୟା ମାଧ୍ୟମରେ ଏଟିପି (ATP) ଆକାରରେ ଶକ୍ତି ଉତ୍ପନ୍ନ କରୁଥିବାରୁ ଏହାକୁ କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର କୁହାଯାଏ।"
    },
    english: {
      question: "Which cellular organelle is known as the powerhouse of the cell?",
      options: [
        "Mitochondria",
        "Nucleus",
        "Cell wall",
        "Ribosome"
      ],
      correctAnswer: "Mitochondria",
      explanation: "Mitochondria generate cellular energy in the form of ATP through cellular respiration, earning the name powerhouse of the cell."
    }
  },

  'cell:cell': {
    topic: 'cell',
    concept: 'cell',
    odia: {
      question: "କୋଷର କେଉଁ ଅଙ୍ଗିକାକୁ ଶକ୍ତି କେନ୍ଦ୍ର କୁହାଯାଏ?",
      options: [
        "ମାଇଟୋକଣ୍ଡ୍ରିଆ",
        "ନ୍ୟୁକ୍ଲିଅସ",
        "କୋଷ ଭିତ୍ତି",
        "ରାଇବୋଜୋମ"
      ],
      correctAnswer: "ମାଇଟୋକଣ୍ଡ୍ରିଆ",
      explanation: "ମାଇଟୋକଣ୍ଡ୍ରିଆ କୋଷୀୟ ଶ୍ୱାସକ୍ରିୟା ମାଧ୍ୟମରେ ଏଟିପି (ATP) ଆକାରରେ ଶକ୍ତି ଉତ୍ପନ୍ନ କରୁଥିବାରୁ ଏହାକୁ କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର କୁହାଯାଏ।"
    },
    english: {
      question: "Which cellular organelle is known as the powerhouse of the cell?",
      options: [
        "Mitochondria",
        "Nucleus",
        "Cell wall",
        "Ribosome"
      ],
      correctAnswer: "Mitochondria",
      explanation: "Mitochondria generate cellular energy in the form of ATP through cellular respiration, earning the name powerhouse of the cell."
    }
  },

  'matter:mass_and_space': {
    topic: 'matter',
    concept: 'mass_and_space',
    odia: {
      question: "ପଦାର୍ଥର ମୁଖ୍ୟ ବୈଶିଷ୍ଟ୍ୟ କ'ଣ?",
      options: [
        "ଏହାର ନିର୍ଦ୍ଦିଷ୍ଟ ବସ୍ତୁତ୍ୱ ଥାଏ ଏବଂ ଏହା ସ୍ଥାନ ଅଧିକାର କରେ",
        "ଏହାର କୌଣସି ବସ୍ତୁତ୍ୱ ନ ଥାଏ",
        "ଏହା କେବଳ ଆଲୋକ ଓ ଶବ୍ଦ ରୂପରେ ଥାଏ",
        "ଏହା ସ୍ଥାନ ଅଧିକାର କରେ ନାହିଁ"
      ],
      correctAnswer: "ଏହାର ନିର୍ଦ୍ଦିଷ୍ଟ ବସ୍ତୁତ୍ୱ ଥାଏ ଏବଂ ଏହା ସ୍ଥାନ ଅଧିକାର କରେ",
      explanation: "ଯାହାର ନିର୍ଦ୍ଦିଷ୍ଟ ବସ୍ତୁତ୍ୱ ଥାଏ ଏବଂ ଯାହା ସ୍ଥାନ ଅଧିକାର କରେ, ତାହାକୁ ପଦାର୍ଥ କୁହାଯାଏ।"
    },
    english: {
      question: "What are the fundamental defining characteristics of matter?",
      options: [
        "It has mass and occupies space (volume)",
        "It has neither mass nor volume",
        "It exists only as pure light energy",
        "It occupies space without having any mass"
      ],
      correctAnswer: "It has mass and occupies space (volume)",
      explanation: "Matter is anything that has mass and occupies space (volume)."
    }
  },

  'matter:matter': {
    topic: 'matter',
    concept: 'matter',
    odia: {
      question: "ପଦାର୍ଥର ମୁଖ୍ୟ ବୈଶିଷ୍ଟ୍ୟ କ'ଣ?",
      options: [
        "ଏହାର ନିର୍ଦ୍ଦିଷ୍ଟ ବସ୍ତୁତ୍ୱ ଥାଏ ଏବଂ ଏହା ସ୍ଥାନ ଅଧିକାର କରେ",
        "ଏହାର କୌଣସି ବସ୍ତୁତ୍ୱ ନ ଥାଏ",
        "ଏହା କେବଳ ଆଲୋକ ଓ ଶବ୍ଦ ରୂପରେ ଥାଏ",
        "ଏହା ସ୍ଥାନ ଅଧିକାର କରେ ନାହିଁ"
      ],
      correctAnswer: "ଏହାର ନିର୍ଦ୍ଦିଷ୍ଟ ବସ୍ତୁତ୍ୱ ଥାଏ ଏବଂ ଏହା ସ୍ଥାନ ଅଧିକାର କରେ",
      explanation: "ଯାହାର ନିର୍ଦ୍ଦିଷ୍ଟ ବସ୍ତୁତ୍ୱ ଥାଏ ଏବଂ ଯାହା ସ୍ଥାନ ଅଧିକାର କରେ, ତାହାକୁ ପଦାର୍ଥ କୁହାଯାଏ।"
    },
    english: {
      question: "What are the fundamental defining characteristics of matter?",
      options: [
        "It has mass and occupies space (volume)",
        "It has neither mass nor volume",
        "It exists only as pure light energy",
        "It occupies space without having any mass"
      ],
      correctAnswer: "It has mass and occupies space (volume)",
      explanation: "Matter is anything that has mass and occupies space (volume)."
    }
  }
};

// Automatically wire entry.odia and entry.english to questions[0] for backwards compatibility
for (const key of Object.keys(PRACTICE_BANK)) {
  const item = PRACTICE_BANK[key];
  if (Array.isArray(item.questions) && item.questions.length > 0) {
    item.odia = item.questions[0].odia;
    item.english = item.questions[0].english;
  }
}

// Aliases for seamless concept matching
PRACTICE_BANK['photosynthesis:carbon_dioxide'] = PRACTICE_BANK['photosynthesis:carbon_dioxide_role'];
PRACTICE_BANK['respiration:human_breathing'] = PRACTICE_BANK['respiration:inhalation_oxygen'];
PRACTICE_BANK['states_of_matter:water_states'] = PRACTICE_BANK['states_of_matter:heating_water'];
PRACTICE_BANK['states_of_matter:boiling_point'] = PRACTICE_BANK['states_of_matter:heating_water'];
PRACTICE_BANK['cell:cell_wall'] = PRACTICE_BANK['cell:mitochondria_powerhouse'];
PRACTICE_BANK['force_and_motion:action_reaction_third_law'] = PRACTICE_BANK['force_and_motion:inertia_first_law'];

/**
 * Resolves an action descriptor into a practice entry from the verified practice bank.
 * Supports options.excludeQuestion and options.recentActivity to prevent repeating previous questions.
 * Returns null for unsupported topics/concepts to safely prevent hallucinations.
 */
function getTargetedPractice(action, language = 'English', options = {}) {
  if (!action) return null;

  let topic = null;
  let concept = null;

  if (typeof action === 'string') {
    if (action.includes(':')) {
      const parts = action.split(':');
      topic = parts[0].trim();
      concept = parts[1].trim();
    } else {
      topic = action.trim();
      concept = topic;
    }
  } else if (typeof action === 'object') {
    topic = action.topic || null;
    concept = action.concept || null;
  }

  if (!topic) return null;

  // 1. Try compound key: topic:concept
  let entry = concept ? PRACTICE_BANK[`${topic}:${concept}`] : null;

  // 2. Try topic:topic fallback
  if (!entry) {
    entry = PRACTICE_BANK[`${topic}:${topic}`];
  }

  // 3. Try concept:concept fallback
  if (!entry && concept) {
    entry = PRACTICE_BANK[`${concept}:${concept}`];
  }

  // Safe fail for unsupported concepts
  if (!entry) {
    return null;
  }

  const useOdia = isOdia(language);
  const sanitize = useOdia ? cleanOdiaParentheticals : (t) => t;

  // Gather questions for this entry
  const questionList = Array.isArray(entry.questions) && entry.questions.length > 0
    ? entry.questions
    : [{ odia: entry.odia, english: entry.english }];

  // Build exclusion list (normalized for reliable comparison)
  const normStr = (s) => (s || '').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
  const excludedSet = new Set();

  if (options?.excludeQuestion) {
    const list = Array.isArray(options.excludeQuestion) ? options.excludeQuestion : [options.excludeQuestion];
    list.forEach(q => {
      if (typeof q === 'string') excludedSet.add(normStr(q));
    });
  }

  if (Array.isArray(options?.recentActivity)) {
    for (const act of options.recentActivity) {
      if (act.detail?.question && (act.concept === (concept || entry.concept) || act.topic === topic)) {
        excludedSet.add(normStr(act.detail.question));
      }
    }
  }

  // Pick first question that is not in excluded set
  let selectedQ = null;
  for (const qItem of questionList) {
    const langQ = useOdia ? qItem.odia : qItem.english;
    const qNorm = normStr(langQ?.question);
    if (!excludedSet.has(qNorm)) {
      selectedQ = qItem;
      break;
    }
  }

  // If all questions are excluded via recentActivity (and not explicit excludeQuestion),
  // cycle questions so students can continue practicing/reinforcing:
  if (!selectedQ && !options?.excludeQuestion && questionList.length > 0) {
    selectedQ = questionList[0];
  }

  // If all questions are excluded / exhausted for this concept:
  if (!selectedQ) {
    const fallbackLang = useOdia ? entry.odia : entry.english;
    return {
      id: `${topic}:${concept || entry.concept}:exhausted`,
      type: 'explanation_review',
      topic: topic,
      concept: concept || entry.concept,
      exhausted: true,
      explanation: sanitize(fallbackLang.explanation),
      message: useOdia
        ? `ଏହି ଧାରଣାର ସମସ୍ତ ଅଭ୍ୟାସ ପ୍ରଶ୍ନ ସମାପ୍ତ ହୋଇଛି। ସାରାଂଶ: ${sanitize(fallbackLang.explanation)}`
        : `All practice questions for this concept have been completed. Review: ${sanitize(fallbackLang.explanation)}`
    };
  }

  const langContent = useOdia ? selectedQ.odia : selectedQ.english;
  const sanitizedQuestion = sanitize(langContent.question);
  const rawIdSlug = normStr(sanitizedQuestion).slice(0, 30);
  const activityId = `${topic}:${concept || entry.concept}:${rawIdSlug}`;

  return {
    id: activityId,
    type: 'mcq',
    topic: topic,
    concept: concept || entry.concept,
    question: sanitizedQuestion,
    options: langContent.options.map(sanitize),
    correctAnswer: sanitize(langContent.correctAnswer),
    explanation: sanitize(langContent.explanation)
  };
}

/**
 * Evaluates student answer deterministically.
 * Supports:
 * - Direct string match with correctAnswer
 * - Option index: 0, 1, 2, 3
 * - Option index: 1, 2, 3, 4 (1-based)
 * - Option letter: 'A', 'B', 'C', 'D'
 */
function evaluatePracticeAnswer(activity, studentAnswer) {
  if (!activity || !activity.correctAnswer) {
    return {
      correct: false,
      concept: activity?.concept || 'unknown',
      evidence: 'practice_incorrect',
      feedback: 'Invalid practice activity.'
    };
  }

  const normAnswer = studentAnswer !== undefined && studentAnswer !== null ? String(studentAnswer).trim() : '';
  const options = Array.isArray(activity.options) ? activity.options : [];
  const correctOption = activity.correctAnswer.trim();

  let selectedText = '';

  // Check letter 'A', 'B', 'C', 'D'
  if (/^[a-dA-D]$/.test(normAnswer)) {
    const letterIdx = normAnswer.toUpperCase().charCodeAt(0) - 65; // 'A' -> 0
    if (letterIdx >= 0 && letterIdx < options.length) {
      selectedText = options[letterIdx].trim();
    }
  }
  // Check index number
  else if (/^\d+$/.test(normAnswer)) {
    const num = parseInt(normAnswer, 10);
    if (num === 0) {
      selectedText = options[0] ? options[0].trim() : '';
    } else if (num < options.length && options[num]?.trim() === correctOption) {
      selectedText = options[num].trim();
    } else if (num >= 1 && num <= options.length) {
      selectedText = options[num - 1].trim();
    }
  }
  // Check direct string match with options or answer
  else {
    const matchedOpt = options.find(opt => opt.trim().toLowerCase() === normAnswer.toLowerCase());
    if (matchedOpt) {
      selectedText = matchedOpt.trim();
    } else {
      selectedText = normAnswer;
    }
  }

  const isCorrect = selectedText.toLowerCase() === correctOption.toLowerCase();
  const isOdiaActivity = isOdia(activity.question);

  let feedback = '';
  if (isCorrect) {
    feedback = activity.explanation || (isOdiaActivity ? 'ସଠିକ୍ ଉତ୍ତର!' : 'Correct! Well done.');
  } else {
    feedback = isOdiaActivity
      ? `ଭୁଲ ଉତ୍ତର। ସଠିକ୍ ଉତ୍ତର: ${activity.correctAnswer}। ${activity.explanation || ''}`.trim()
      : `Incorrect. The correct answer is: ${activity.correctAnswer}. ${activity.explanation || ''}`.trim();
  }

  return {
    correct: isCorrect,
    concept: activity.concept || activity.topic,
    evidence: isCorrect ? 'practice_correct' : 'practice_incorrect',
    feedback
  };
}

/**
 * Executes a follow-up loop after student submits a targeted practice answer:
 * 1. Evaluates student answer deterministically
 * 2. Records event into student learning state
 * 3. Chooses the next study action
 */
function processPracticeSubmission(state, activity, studentAnswer) {
  if (!state || !activity) return null;

  const practiceResult = evaluatePracticeAnswer(activity, studentAnswer);

  recordLearningEvent(state, {
    topic: activity.topic,
    concept: activity.concept,
    evidence: practiceResult.evidence,
    detail: {
      question: activity.question,
      studentAnswer,
      correct: practiceResult.correct
    }
  });

  let nextStudy = chooseNextStudyAction(state);

  // Requirement C & G: When student answers correctly, the practice activity is completed.
  // Do NOT return nextStudy pointing back to the same activity or concept.
  if (practiceResult.correct) {
    if (nextStudy && nextStudy.topic === activity.topic && (nextStudy.concept === activity.concept || nextStudy.concept === activity.topic)) {
      nextStudy = {
        action: 'completed',
        topic: activity.topic,
        concept: activity.concept,
        reason: 'concept_practiced_successfully'
      };
    }
  }

  return {
    practiceResult,
    learningState: state,
    nextStudy
  };
}

module.exports = {
  PRACTICE_BANK,
  cleanOdiaParentheticals,
  getTargetedPractice,
  evaluatePracticeAnswer,
  processPracticeSubmission
};
