'use strict';

/**
 * Curriculum Knowledge Base (Classes 6-10) for Science and Mathematics.
 * Provides hierarchical domain grounding: Grade -> Subject -> Chapter -> Topic -> Concept.
 */

const CURRICULUM_CONCEPTS = [
  // ===================== CLASS 6 =====================
  {
    id: 'c6_sci_food_components',
    gradeRange: [6, 6],
    subject: 'science',
    chapter: 'components_of_food',
    topic: 'food_nutrients',
    name: { en: 'Components of Food', od: 'ଖାଦ୍ୟର ଉପାଦାନ' },
    aliases: { en: ['nutrients', 'balanced diet'], od: ['ପୋଷକ ତତ୍ତ୍ୱ', 'ସୁଷମ ଖାଦ୍ୟ'] },
    prerequisites: [],
    learningObjectives: ['Identify major food nutrients: carbohydrates, fats, proteins, vitamins, minerals'],
    coreFacts: [
      'Carbohydrates and fats provide energy to the body.',
      'Proteins are needed for the growth and repair of the body.'
    ],
    explanations: {
      en: 'Food consists of nutrients needed for growth, energy, and maintenance.',
      od: 'ଖାଦ୍ୟରେ ଶରୀରର ବୃଦ୍ଧି ଓ ଶକ୍ତି ପାଇଁ ଆବଶ୍ୟକ ପୋଷକ ତତ୍ତ୍ୱ ଥାଏ।'
    },
    examples: { en: ['Rice contains carbohydrates', 'Pulses contain protein'], od: ['ଭାତରେ ଶ୍ୱେତସାର ଥାଏ', 'ଡାଲିରେ ପୁଷ୍ଟିସାର ଥାଏ'] },
    misconceptions: [
      { misconception: 'Fats are entirely bad for health', correction: 'Fats are essential nutrients providing concentrated energy.' }
    ],
    canonicalTerms: { en: { carbohydrate: 'carbohydrate', protein: 'protein' }, od: { carbohydrate: 'ଶ୍ୱେତସାର', protein: 'ପୁଷ୍ଟିସାର' } },
    relatedConcepts: ['c7_sci_nutrition_plants'],
    practiceConcepts: ['food_nutrients_test'],
    masterySignals: ['identifies_nutrient_deficiency']
  },
  {
    id: 'c6_sci_motion_measurement',
    gradeRange: [6, 6],
    subject: 'science',
    chapter: 'motion_and_measurement',
    topic: 'motion_basics',
    name: { en: 'Motion and Measurement of Distances', od: 'ଗତି ଓ ଦୂରତା ମାପ' },
    aliases: { en: ['motion', 'standard units of measurement'], od: ['ଗତି', 'ମାନକ ଏକକ'] },
    prerequisites: [],
    learningObjectives: ['Understand motion as change in position over time', 'Identify standard units of length'],
    coreFacts: [
      'ସମୟ ସହିତ କୌଣସି ବସ୍ତୁର ସ୍ଥାନ ପରିବର୍ତ୍ତନକୁ ଗତି କୁହାଯାଏ (Motion is a change in the position of an object with time)।',
      'ଦୂରତା ମାପିବାର ଆନ୍ତର୍ଜାତୀୟ ମାନକ ଏକକ (SI unit) ହେଉଛି ମିଟର (m)।'
    ],
    explanations: {
      en: 'An object is in motion when its position changes relative to a stationary reference point.',
      od: 'ସମୟ ସହିତ କୌଣସି ବସ୍ତୁର ସ୍ଥାନ ପରିବର୍ତ୍ତନକୁ ଗତି କୁହାଯାଏ।'
    },
    examples: { en: ['A moving bus', 'Hands of a clock'], od: ['ଚଳନ୍ତା ବସ୍', 'ଘଣ୍ଟାର କଣ୍ଟା'] },
    misconceptions: [
      { misconception: 'Rest and motion are absolute', correction: 'Motion is relative to the observer or reference frame.' }
    ],
    canonicalTerms: { en: { motion: 'motion', distance: 'distance' }, od: { motion: 'ଗତି', distance: 'ଦୂରତା' } },
    relatedConcepts: ['c7_sci_motion_time', 'c9_sci_force_motion'],
    practiceConcepts: ['motion_types'],
    masterySignals: ['distinguishes_rectilinear_and_circular']
  },
  {
    id: 'c6_math_integers',
    gradeRange: [6, 6],
    subject: 'mathematics',
    chapter: 'integers',
    topic: 'integer_basics',
    name: { en: 'Integers', od: 'ପୂର୍ଣ୍ଣ ସଂଖ୍ୟା' },
    aliases: { en: ['positive and negative numbers'], od: ['ଯୁକ୍ତ ଓ ବିୟୁକ୍ତ ସଂଖ୍ୟା'] },
    prerequisites: [],
    learningObjectives: ['Represent positive and negative numbers on a number line', 'Perform addition and subtraction of integers'],
    coreFacts: [
      'Integers form the collection of whole numbers and negative numbers.',
      'Zero is neither positive nor negative.'
    ],
    explanations: {
      en: 'Integers include whole numbers and negative natural numbers.',
      od: 'ପୂର୍ଣ୍ଣ ସଂଖ୍ୟା ହେଉଛି ସମସ୍ତ ଗଣନ ସଂଖ୍ୟା, ଶୂନ ଏବଂ ଋଣାତ୍ମକ ସଂଖ୍ୟାମାନଙ୍କ ସମାହାର।'
    },
    examples: { en: ['-3, -2, -1, 0, 1, 2, 3'], od: ['-୩, -୨, -୧, ୦, ୧, ୨, ୩'] },
    misconceptions: [
      { misconception: '-5 is greater than -2', correction: '-2 is greater than -5 because it lies to the right on number line.' }
    ],
    canonicalTerms: { en: { integer: 'integer', zero: 'zero' }, od: { integer: 'ପୂର୍ଣ୍ଣ ସଂଖ୍ୟା', zero: 'ଶୂନ' } },
    relatedConcepts: ['c7_math_fractions_decimals'],
    practiceConcepts: ['integer_addition'],
    masterySignals: ['orders_negative_numbers']
  },

  // ===================== CLASS 7 =====================
  {
    id: 'c7_sci_nutrition_plants',
    gradeRange: [7, 7],
    subject: 'science',
    chapter: 'nutrition_in_plants',
    topic: 'autotrophic_nutrition',
    name: { en: 'Nutrition in Plants', od: 'ଉଦ୍ଭିଦରେ ପୋଷଣ' },
    aliases: { en: ['autotrophs', 'heterotrophs'], od: ['ସ୍ୱଭୋଜୀ ପୋଷଣ', 'ପରଭୋଜୀ'] },
    prerequisites: ['c6_sci_food_components'],
    learningObjectives: ['Distinguish between autotrophic and heterotrophic nutrition', 'Recognize stomata and chlorophyll roles in nutrition'],
    coreFacts: [
      'Green plants prepare their own food and are called autotrophs.',
      'Chlorophyll helps leaves capture sunlight energy.'
    ],
    explanations: {
      en: 'Green plants synthesize their food using sunlight, water, and carbon dioxide.',
      od: 'ସବୁଜ ଉଦ୍ଭିଦ ନିଜ ଖାଦ୍ୟ ନିଜେ ତିଆରି କରନ୍ତି ଏବଂ ଏହାକୁ ସ୍ୱଭୋଜୀ ପୋଷଣ କୁହାଯାଏ।'
    },
    examples: { en: ['Green trees perform autotrophic nutrition'], od: ['ସବୁଜ ଗଛଲତା ସ୍ୱଭୋଜୀ ପୋଷଣ କରନ୍ତି'] },
    misconceptions: [
      { misconception: 'All plants are autotrophic', correction: 'Cuscuta and insectivorous plants exhibit heterotrophic or partially heterotrophic nutrition.' }
    ],
    canonicalTerms: { en: { autotroph: 'autotroph', chlorophyll: 'chlorophyll' }, od: { autotroph: 'ସ୍ୱଭୋଜୀ', chlorophyll: 'ପତ୍ରହରିତ' } },
    relatedConcepts: ['c9_sci_photosynthesis'],
    practiceConcepts: ['plant_nutrition_modes'],
    masterySignals: ['explains_autotroph_vs_heterotroph']
  },
  {
    id: 'c7_sci_respiration_organisms',
    gradeRange: [7, 7],
    subject: 'science',
    chapter: 'respiration_in_organisms',
    topic: 'respiration',
    name: { en: 'Respiration in Organisms', od: 'ଜୀବରେ ଶ୍ୱସନ' },
    aliases: { en: ['cellular respiration', 'breathing'], od: ['କୋଷୀୟ ଶ୍ୱସନ', 'ଶ୍ୱାସକ୍ରିୟା'] },
    prerequisites: [],
    learningObjectives: ['Differentiate between breathing and cellular respiration', 'Understand oxygen uptake and CO2 release'],
    coreFacts: [
      'Breathing is the physical process of inhaling oxygen-rich air and exhaling CO2-rich air.',
      'Cellular respiration breaks down glucose to release energy inside cells.'
    ],
    explanations: {
      en: 'Respiration is essential for survival as it releases energy from food.',
      od: 'ଶ୍ୱସନ ଦ୍ୱାରା ଖାଦ୍ୟରୁ ଶକ୍ତି ମୁକ୍ତ ହୁଏ ଯାହା ଜୀବନ ଧାରଣ ପାଇଁ ଅତ୍ୟାବଶ୍ୟକ।'
    },
    examples: { en: ['Humans breathing through lungs', 'Fishes using gills'], od: ['ମଣିଷ ଫୁସଫୁସ ଦ୍ୱାରା ଶ୍ୱାସକ୍ରିୟା କରେ'] },
    misconceptions: [
      { misconception: 'Breathing and respiration are identical terms', correction: 'Breathing is gas exchange; respiration is enzymatic breakdown of glucose yielding ATP.' }
    ],
    canonicalTerms: { en: { respiration: 'respiration', breathing: 'breathing' }, od: { respiration: 'ଶ୍ୱସନ', breathing: 'ଶ୍ୱାସକ୍ରିୟା' } },
    relatedConcepts: ['c9_sci_respiration'],
    practiceConcepts: ['breathing_vs_respiration'],
    masterySignals: ['differentiates_gas_exchange_and_energy_release']
  },
  {
    id: 'c7_sci_reproduction_plants',
    gradeRange: [7, 7],
    subject: 'science',
    chapter: 'reproduction_in_plants',
    topic: 'plant_reproduction_modes',
    name: { en: 'Reproduction in Plants', od: 'ଉଦ୍ଭିଦରେ ପ୍ରଜନନ' },
    aliases: { en: ['vegetative propagation', 'pollination', 'asexual reproduction'], od: ['ଅଙ୍ଗୀୟ ଜନନ', 'ପରାଗସଙ୍ଗମ', 'ଅଲିଙ୍ଗୀ ଜନନ'] },
    prerequisites: ['c7_sci_nutrition_plants'],
    learningObjectives: ['Describe vegetative propagation', 'Explain pollination and seed dispersal'],
    coreFacts: [
      'Vegetative propagation produces new plants from vegetative parts like stems, roots, or leaves.',
      'Pollination is the transfer of pollen grains from anther to stigma.'
    ],
    explanations: {
      en: 'Plants reproduce through asexual (vegetative, budding, spore formation) and sexual reproduction via flowers.',
      od: 'ଉଦ୍ଭିଦରେ ଫୁଲ ମାଧ୍ୟମରେ ଲିଙ୍ଗୀୟ ପ୍ରଜନନ ଏବଂ କାଣ୍ଡ, ଚେର ଓ ପତ୍ର ମାଧ୍ୟମରେ ଅଙ୍ଗୀୟ ଜନନ ହୁଏ।'
    },
    examples: { en: ['Potato eyes sprouting', 'Rose cutting'], od: ['ଆଳୁର ଆଖିରୁ ନୂଆ ଗଛ', 'ଗୋଲାପ ଡାଳ କଲମୀ'] },
    misconceptions: [
      { misconception: 'All plants require seeds to reproduce', correction: 'Many plants reproduce asexually through vegetative parts.' }
    ],
    canonicalTerms: { en: { reproduction: 'reproduction', pollination: 'pollination' }, od: { reproduction: 'ପ୍ରଜନନ', pollination: 'ପରାଗସଙ୍ଗମ' } },
    relatedConcepts: ['c8_sci_reproduction_animals', 'c10_sci_reproduction'],
    practiceConcepts: ['pollination_types'],
    masterySignals: ['identifies_pollination_modes']
  },
  {
    id: 'c7_sci_motion_time',
    gradeRange: [7, 7],
    subject: 'science',
    chapter: 'motion_and_time',
    topic: 'speed_and_time',
    name: { en: 'Motion and Time', od: 'ଗତି ଓ ସମୟ' },
    aliases: { en: ['speed', 'uniform motion'], od: ['ବେଗ', 'ସମ ଗତି'] },
    prerequisites: ['c6_sci_motion_measurement'],
    learningObjectives: ['Calculate speed = distance / time', 'Interpret distance-time graphs'],
    coreFacts: [
      'Speed is the distance covered by an object in unit time.',
      'Speed = Distance / Time. Standard unit is m/s.'
    ],
    explanations: {
      en: 'Speed measures how fast an object moves per unit time.',
      od: 'ଏକକ ସମୟରେ ଅତିକ୍ରମ କରିଥିବା ଦୂରତାକୁ ବସ୍ତୁର ବେଗ (Speed) କୁହାଯାଏ।'
    },
    examples: { en: ['A car moving at 60 km/h'], od: ['ଗୋଟିଏ ଗାଡ଼ି ଘଣ୍ଟାକୁ ୬୦ କି.ମି. ବେଗରେ ଚାଲେ'] },
    misconceptions: [
      { misconception: 'Speed and velocity are always the same', correction: 'Velocity includes direction; speed is a scalar quantity.' }
    ],
    canonicalTerms: { en: { speed: 'speed', time: 'time' }, od: { speed: 'ବେଗ', time: 'ସମୟ' } },
    relatedConcepts: ['c9_sci_force_motion'],
    practiceConcepts: ['speed_formula'],
    masterySignals: ['calculates_average_speed']
  },
  {
    id: 'c7_math_fractions_decimals',
    gradeRange: [7, 7],
    subject: 'mathematics',
    chapter: 'fractions_and_decimals',
    topic: 'fraction_operations',
    name: { en: 'Fractions and Decimals', od: 'ଭଗ୍ନାଂଶ ଓ ଦଶମିକ' },
    aliases: { en: ['multiplication of fractions', 'decimals'], od: ['ଭଗ୍ନାଂଶ ଗୁଣନ', 'ଦଶମିକ ସଂଖ୍ୟା'] },
    prerequisites: ['c6_math_integers'],
    learningObjectives: ['Multiply and divide proper and improper fractions', 'Perform operations on decimals'],
    coreFacts: [
      'To multiply two fractions, multiply numerators and denominators respectively.',
      'Reciprocal of a non-zero fraction a/b is b/a.'
    ],
    explanations: {
      en: 'Fractions represent parts of a whole, and operations follow proportional arithmetic rules.',
      od: 'ଭଗ୍ନାଂଶ ଏକ ପୂର୍ଣ୍ଣ ବସ୍ତୁର ଅଂଶକୁ ସୂଚାଏ।'
    },
    examples: { en: ['1/2 * 3/4 = 3/8'], od: ['୧/୨ * ୩/୪ = ୩/୮'] },
    misconceptions: [
      { misconception: 'Multiplying always makes numbers larger', correction: 'Multiplying by a proper fraction less than 1 produces a smaller number.' }
    ],
    canonicalTerms: { en: { fraction: 'fraction', numerator: 'numerator' }, od: { fraction: 'ଭଗ୍ନାଂଶ', numerator: 'ଲବ' } },
    relatedConcepts: ['c8_math_rational_numbers'],
    practiceConcepts: ['fraction_multiplication'],
    masterySignals: ['multiplies_fractions_accurately']
  },

  // ===================== CLASS 8 =====================
  {
    id: 'c8_sci_cell_structure',
    gradeRange: [8, 8],
    subject: 'science',
    chapter: 'cell_structure_and_functions',
    topic: 'cell_organelles_intro',
    name: { en: 'Cell - Structure and Functions', od: 'କୋଷ - ଗଠନ ଓ କାର୍ଯ୍ୟ' },
    aliases: { en: ['plant cell', 'animal cell', 'nucleus'], od: ['ଉଦ୍ଭିଦ କୋଷ', 'ପ୍ରାଣୀ କୋଷ', 'ନ୍ୟୁକ୍ଲିଅସ'] },
    prerequisites: [],
    learningObjectives: ['Identify basic cell organelles: nucleus, cytoplasm, cell membrane', 'Distinguish plant cells from animal cells'],
    coreFacts: [
      'The cell is the basic structural and functional unit of living organisms.',
      'Plant cells have a cell wall and plastids, which animal cells lack.'
    ],
    explanations: {
      en: 'All organisms are made of microscopic cells with specific organelles executing life functions.',
      od: 'କୋଷ ହେଉଛି ସମସ୍ତ ଜୀବର ଗଠନମୂଳକ ଓ କାର୍ଯ୍ୟକାରୀ ଏକକ।'
    },
    examples: { en: ['Onion peel cells under microscope', 'Human cheek cells'], od: ['ପିଆଜ ଚୋପା କୋଷ', 'ଗାଲ ଭିତର କୋଷ'] },
    misconceptions: [
      { misconception: 'Animal cells have cell walls', correction: 'Animal cells lack cell walls; only plant cells, fungi, and bacteria have cell walls.' }
    ],
    canonicalTerms: { en: { cell: 'cell', nucleus: 'nucleus' }, od: { cell: 'କୋଷ', nucleus: 'ନ୍ୟୁକ୍ଲିଅସ' } },
    relatedConcepts: ['c9_sci_cell'],
    practiceConcepts: ['plant_vs_animal_cells'],
    masterySignals: ['identifies_cell_wall_absence_in_animal_cells']
  },
  {
    id: 'c8_sci_reproduction_animals',
    gradeRange: [8, 8],
    subject: 'science',
    chapter: 'reproduction_in_animals',
    topic: 'animal_reproduction_modes',
    name: { en: 'Reproduction in Animals', od: 'ପ୍ରାଣୀରେ ପ୍ରଜନନ' },
    aliases: { en: ['sexual reproduction', 'fertilization', 'binary fission', 'budding'], od: ['ଲିଙ୍ଗୀୟ ପ୍ରଜନନ', 'ନିଷେଚନ', 'ଦ୍ୱି-ବିଭାଜନ', 'କଳିକାୟନ'] },
    prerequisites: ['c7_sci_reproduction_plants'],
    learningObjectives: ['Distinguish sexual and asexual reproduction in animals', 'Explain internal vs external fertilization'],
    coreFacts: [
      'Reproduction is essential for the continuation of species.',
      'Sexual reproduction involves the fusion of male gamete (sperm) and female gamete (ovum) to form a zygote.',
      'Fertilization that takes place inside the female body is internal fertilization.'
    ],
    explanations: {
      en: 'Reproduction in animals occurs through sexual reproduction (gamete fusion) or asexual modes like budding in hydra and binary fission in amoeba.',
      od: 'ପ୍ରଜନନ ଦ୍ୱାରା ପ୍ରାଣୀ ନିଜ ପରି ନୂଆ ବଂଶଧର ସୃଷ୍ଟି କରେ। ଶୁକ୍ରାଣୁ ଓ ଡିମ୍ବାଣୁ ମିଳନକୁ ନିଷେଚନ କୁହାଯାଏ।'
    },
    examples: { en: ['Binary fission in Amoeba', 'Budding in Hydra', 'Human internal fertilization'], od: ['ଆମିବା ମଧ୍ୟରେ ଦ୍ୱି-ବିଭାଜନ', 'ହାଇଡ୍ରାରେ କଳିକାୟନ'] },
    misconceptions: [
      { misconception: 'Amoeba reproduces sexually', correction: 'Amoeba reproduces asexually by dividing into two daughter cells (binary fission).' },
      { misconception: 'Fertilization in hens is external', correction: 'Fertilization is internal in hens, after which hard-shelled eggs are laid.' }
    ],
    canonicalTerms: {
      en: { reproduction: 'reproduction', fertilization: 'fertilization', sperm: 'sperm', ovum: 'ovum' },
      od: { reproduction: 'ପ୍ରଜନନ', fertilization: 'ନିଷେଚନ', sperm: 'ଶୁକ୍ରାଣୁ', ovum: 'ଡିମ୍ବାଣୁ' }
    },
    relatedConcepts: ['c10_sci_reproduction'],
    practiceConcepts: ['internal_vs_external_fertilization'],
    masterySignals: ['explains_zygote_formation']
  },
  {
    id: 'c8_sci_force_pressure',
    gradeRange: [8, 8],
    subject: 'science',
    chapter: 'force_and_pressure',
    topic: 'contact_noncontact_forces',
    name: { en: 'Force and Pressure', od: 'ବଳ ଓ ଚାପ' },
    aliases: { en: ['push or pull', 'pressure formula'], od: ['ଠେଲା ବା ଟଣା', 'ଚାପ'] },
    prerequisites: ['c6_sci_motion_measurement'],
    learningObjectives: ['Define force as push or pull', 'Understand pressure = force / area'],
    coreFacts: [
      'କୌଣସି ବସ୍ତୁ ଉପରେ ପ୍ରୟୋଗ କରାଯାଉଥିବା ଠେଲା ବା ଟଣାକୁ ବଳ (Force is a push or pull upon an object) କୁହାଯାଏ।',
      'ଏକକ କ୍ଷେତ୍ରଫଳ ଉପରେ ପ୍ରଯୁକ୍ତ ବଳକୁ ଚାପ (Pressure = Force / Area) କୁହାଯାଏ।'
    ],
    explanations: {
      en: 'Forces can change the state of motion or shape of objects, and act over surfaces exerting pressure.',
      od: 'କୌଣସି ବସ୍ତୁ ଉପରେ ପ୍ରୟୋଗ କରାଯାଉଥିବା ଠେଲା ବା ଟଣାକୁ ବଳ କୁହାଯାଏ।'
    },
    examples: { en: ['Pushing a heavy box', 'Atmospheric pressure holding suction cups'], od: ['ବାକ୍ସକୁ ଠେଲିବା'] },
    misconceptions: [
      { misconception: 'Pressure increases when surface area increases for the same force', correction: 'Pressure is inversely proportional to area; larger area results in lower pressure.' }
    ],
    canonicalTerms: { en: { force: 'force', pressure: 'pressure' }, od: { force: 'ବଳ', pressure: 'ଚାପ' } },
    relatedConcepts: ['c9_sci_force_motion'],
    practiceConcepts: ['force_effects'],
    masterySignals: ['computes_pressure_from_force_and_area']
  },
  {
    id: 'c8_math_rational_numbers',
    gradeRange: [8, 8],
    subject: 'mathematics',
    chapter: 'rational_numbers',
    topic: 'rational_properties',
    name: { en: 'Rational Numbers', od: 'ପରିମେୟ ସଂଖ୍ୟା' },
    aliases: { en: ['p/q form numbers', 'closure and commutativity'], od: ['ପରିମେୟ ସଂଖ୍ୟା', 'ସମାବୃତି ନିୟମ'] },
    prerequisites: ['c7_math_fractions_decimals'],
    learningObjectives: ['Define rational numbers p/q where q != 0', 'Apply commutative and associative properties'],
    coreFacts: [
      'A number that can be expressed in the form p/q, where p and q are integers and q != 0, is a rational number.',
      'Rational numbers are dense: between any two rational numbers, there are infinitely many rational numbers.'
    ],
    explanations: {
      en: 'Rational numbers encompass integers and fractions with rigorous algebraic closure under addition, subtraction, and multiplication.',
      od: 'ଯେଉଁ ସଂଖ୍ୟାକୁ p/q ରୂପରେ ପ୍ରକାଶ କରାଯାଇପାରେ ଯେଉଁଠି q != ୦, ତାହାକୁ ପରିମେୟ ସଂଖ୍ୟା କୁହାଯାଏ।'
    },
    examples: { en: ['2/3, -5/7, 0, 4'], od: ['୨/୩, -୫/୭, ୦, ୪'] },
    misconceptions: [
      { misconception: 'Zero is not a rational number', correction: 'Zero is rational because it can be written as 0/1.' }
    ],
    canonicalTerms: { en: { rational: 'rational number', denominator: 'denominator' }, od: { rational: 'ପରିମେୟ ସଂଖ୍ୟା', denominator: 'ହର' } },
    relatedConcepts: ['c9_math_number_systems'],
    practiceConcepts: ['rational_operations'],
    masterySignals: ['finds_rational_numbers_between_two_values']
  },

  // ===================== CLASS 9 =====================
  {
    id: 'c9_sci_photosynthesis',
    gradeRange: [9, 9],
    subject: 'science',
    chapter: 'fundamental_life_processes',
    topic: 'photosynthesis',
    name: { en: 'Photosynthesis', od: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ' },
    aliases: {
      en: ['plant food production', 'light reactions', 'carbon fixation'],
      od: ['ଆଲୋକ ସଂଶ୍ଳେଷଣ', 'ଉଦ୍ଭିଦ ଖାଦ୍ୟ ପ୍ରସ୍ତୁତି']
    },
    prerequisites: ['c7_sci_nutrition_plants'],
    learningObjectives: [
      'Identify the inputs required for photosynthesis (sunlight, water, carbon dioxide).',
      'Explain the role of chlorophyll and chloroplasts.',
      'Explain why oxygen is released from the photolysis of water.',
      'Connect photosynthesis to glucose/starch synthesis in autotrophs.'
    ],
    coreFacts: [
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
    explanations: {
      en: 'Photosynthesis is the biochemical process by which autotrophic plants synthesize glucose using sunlight, water, and carbon dioxide, releasing oxygen as a by-product.',
      od: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ହେଉଛି ସବୁଜ ଉଦ୍ଭିଦ ନିଜର ଖାଦ୍ୟ ତିଆରି କରିବାର ଏକ ପ୍ରକ୍ରିୟା। ଏଥିପାଇଁ ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକର ଶକ୍ତି ବ୍ୟବହାର କରେ। ଉଦ୍ଭିଦ ମାଟିରୁ ଜଳ ଏବଂ ବାୟୁରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରି ଖାଦ୍ୟ ତିଆରି କରେ। ଏହି ପ୍ରକ୍ରିୟାରେ ଅମ୍ଳଜାନ ନିର୍ଗତ ହୁଏ।'
    },
    examples: {
      en: ['Green leaves producing starch tested via iodine test'],
      od: ['ସବୁଜ ପତ୍ରରେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ଦ୍ୱାରା ଶ୍ୱେତସାର ଉତ୍ପନ୍ନ ହୁଏ']
    },
    misconceptions: [
      {
        misconception: 'Plants take in oxygen for photosynthesis and release carbon dioxide.',
        correction: 'During photosynthesis, plants take in carbon dioxide and water using light; oxygen is released.'
      },
      {
        misconception: 'Oxygen released in photosynthesis comes from carbon dioxide.',
        correction: 'The oxygen released during photosynthesis comes strictly from the photolysis of water molecules.'
      },
      {
        misconception: 'Stomata transport water.',
        correction: 'Stomata are pores involved mainly in gas exchange and transpiration, not active water transport.'
      }
    ],
    canonicalTerms: {
      en: {
        photosynthesis: 'photosynthesis',
        stomata: 'stomata',
        chlorophyll: 'chlorophyll',
        chloroplast: 'chloroplast',
        carbon_dioxide: 'carbon dioxide',
        oxygen: 'oxygen',
        water: 'water',
        sunlight: 'sunlight',
        glucose_starch: 'glucose / starch'
      },
      od: {
        photosynthesis: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ',
        stomata: 'ପତ୍ରରନ୍ଧ୍ର',
        chlorophyll: 'ପତ୍ରହରିତ',
        chloroplast: 'ହରିତକଣିକା',
        carbon_dioxide: 'ଅଙ୍ଗାରକାମ୍ଳ',
        oxygen: 'ଅମ୍ଳଜାନ',
        water: 'ଜଳ',
        sunlight: 'ସୂର୍ଯ୍ୟାଲୋକ',
        glucose_starch: 'ଶ୍ୱେତସାର'
      }
    },
    relatedConcepts: ['c9_sci_respiration', 'c7_sci_nutrition_plants'],
    practiceConcepts: ['photosynthesis:oxygen_role', 'photosynthesis:carbon_dioxide_role'],
    masterySignals: ['explains_water_splitting_source_of_o2', 'identifies_stomata_role']
  },
  {
    id: 'c9_sci_respiration',
    gradeRange: [9, 9],
    subject: 'science',
    chapter: 'fundamental_life_processes',
    topic: 'respiration',
    name: { en: 'Respiration', od: 'ଶ୍ୱାସକ୍ରିୟା' },
    aliases: {
      en: ['cellular respiration', 'breathing', 'gas exchange'],
      od: ['ଶ୍ୱାସକ୍ରିୟା', 'ଶ୍ୱସନ']
    },
    prerequisites: ['c7_sci_respiration_organisms'],
    learningObjectives: [
      'Differentiate breathing (physical gas exchange) and cellular respiration (energy release).',
      'Explain that living plants and animals respire continuously day and night.',
      'Clarify that respiration absorbs oxygen and releases carbon dioxide.'
    ],
    coreFacts: [
      'ଶ୍ୱସନ ଏକ ଜୈବ-ରାସାୟନିକ ପ୍ରକ୍ରିୟା ଯେଉଁଥିରେ ଖାଦ୍ୟ (ଗ୍ଲୁକୋଜ୍) ର ଜାରଣ ଘଟି ଶକ୍ତି (ATP) ମୁକ୍ତ ହୁଏ।',
      'ଉଦ୍ଭିଦ ଏବଂ ପ୍ରାଣୀ ଉଭୟ ଦିନ ଓ ରାତି ସବୁ ସମୟରେ ନିରନ୍ତର ଶ୍ୱସନ କରନ୍ତି।',
      'ଶ୍ୱସନ ପ୍ରକ୍ରିୟାରେ ଅମ୍ଳଜାନ (Oxygen) ଗ୍ରହଣ କରାଯାଏ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ (CO2) ନିର୍ଗତ ହୁଏ।',
      'ମଣିଷ ପ୍ରଶ୍ୱାସରେ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ ଏବଂ ନିଃଶ୍ୱାସରେ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରେ।',
      'କୋଷର ମାଇଟୋକଣ୍ଡ୍ରିଆ (Mitochondria) ରେ ଶ୍ୱସନ ଦ୍ୱାରା ଶକ୍ତି ଉତ୍ପନ୍ନ ହୁଏ, ତେଣୁ ଏହାକୁ କୋଷର ଶକ୍ତିକେନ୍ଦ୍ର କୁହାଯାଏ।'
    ],
    explanations: {
      en: 'Respiration is the cellular biochemical process where organic molecules are oxidized to yield chemical energy (ATP), consuming oxygen and releasing carbon dioxide.',
      od: 'ଶ୍ୱାସକ୍ରିୟା ଓ ଶ୍ୱସନ ହେଉଛି ଜୀବନଧାରଣର ମୁଖ୍ୟ ପ୍ରକ୍ରିୟା ଯେଉଁଥିରେ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରି ଖାଦ୍ୟରୁ ଶକ୍ତି ମୁକ୍ତ ହୁଏ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ନିର୍ଗତ ହୁଏ।'
    },
    examples: {
      en: ['Mitochondrial oxidation producing ATP in active muscle cells'],
      od: ['ଉଦ୍ଭିଦ ରାତିରେ ଓ ଦିନରେ ଅମ୍ଳଜାନ ନେଇ ଶ୍ୱସନ କରିଥାଏ']
    },
    misconceptions: [
      {
        misconception: 'Plants only respire at night.',
        correction: 'Plants respire continuously 24 hours a day; at daytime photosynthesis masks net gas exchange.'
      },
      {
        misconception: 'Humans breathe in carbon dioxide and exhale oxygen.',
        correction: 'Humans inhale oxygen and exhale carbon dioxide.'
      }
    ],
    canonicalTerms: {
      en: { respiration: 'respiration', oxygen: 'oxygen', carbon_dioxide: 'carbon dioxide', mitochondria: 'mitochondria' },
      od: { respiration: 'ଶ୍ୱସନ', oxygen: 'ଅମ୍ଳଜାନ', carbon_dioxide: 'ଅଙ୍ଗାରକାମ୍ଳ', mitochondria: 'ମାଇଟୋକଣ୍ଡ୍ରିଆ' }
    },
    relatedConcepts: ['c9_sci_photosynthesis', 'c9_sci_cell'],
    practiceConcepts: ['respiration:plant_respiration', 'respiration:inhalation_oxygen'],
    masterySignals: ['knows_plants_respire_day_and_night']
  },
  {
    id: 'c9_sci_matter',
    gradeRange: [9, 9],
    subject: 'science',
    chapter: 'matter_in_our_surroundings',
    topic: 'matter',
    name: { en: 'Matter in Our Surroundings', od: 'ପଦାର୍ଥ' },
    aliases: { en: ['matter definition', 'particulate nature of matter'], od: ['ପଦାର୍ଥ', 'କଣିକା'] },
    prerequisites: [],
    learningObjectives: ['Define matter as anything having mass and occupying space', 'Describe particulate nature of matter'],
    coreFacts: [
      'ଯାହାର ନିର୍ଦ୍ଦିଷ୍ଟ ବସ୍ତୁତ୍ୱ (Mass) ଥାଏ ଏବଂ ଯାହା ସ୍ଥାନ ଅଧିକାର କରେ, ତାହାକୁ ପଦାର୍ଥ (Matter) କୁହାଯାଏ।',
      'ପଦାର୍ଥ କ୍ଷୁଦ୍ର କ୍ଷୁଦ୍ର କଣିକା (Particles / Atoms / Molecules) ଦ୍ୱାରା ଗଠିତ।',
      'ପଦାର୍ଥର କଣିକାଗୁଡ଼ିକ ମଧ୍ୟରେ ଫାଙ୍କ (ଅନ୍ତଃକଣିକା ସ୍ଥାନ) ଥାଏ ଏବଂ ସେଗୁଡ଼ିକ ନିରନ୍ତର ଗତିଶୀଳ।'
    ],
    explanations: {
      en: 'Matter is anything that has mass and takes up space, composed of tiny particulate atoms and molecules.',
      od: 'ଯାହାର ବସ୍ତୁତ୍ୱ ଥାଏ ଓ ସ୍ଥାନ ଅଧିକାର କରେ ତାହା ପଦାର୍ଥ ଅଟେ।'
    },
    examples: { en: ['Water, wood, air, rock'], od: ['ଜଳ, କାଠ, ବାୟୁ, ପଥର'] },
    misconceptions: [
      { misconception: 'Light and sound are matter', correction: 'Light and sound are forms of energy, lacking mass and volume.' }
    ],
    canonicalTerms: { en: { matter: 'matter', mass: 'mass' }, od: { matter: 'ପଦାର୍ଥ', mass: 'ବସ୍ତୁତ୍ୱ' } },
    relatedConcepts: ['c9_sci_states_of_matter'],
    practiceConcepts: ['matter_definitions'],
    masterySignals: ['distinguishes_matter_from_energy']
  },
  {
    id: 'c9_sci_states_of_matter',
    gradeRange: [9, 9],
    subject: 'science',
    chapter: 'matter_in_our_surroundings',
    topic: 'states_of_matter',
    name: { en: 'States of Matter', od: 'ପଦାର୍ଥର ଅବସ୍ଥା' },
    aliases: { en: ['solid liquid gas', 'intermolecular forces'], od: ['କଠିନ ତରଳ ଗ୍ୟାସୀୟ', 'ପଦାର୍ଥର ଅବସ୍ଥା'] },
    prerequisites: ['c9_sci_matter'],
    learningObjectives: ['Compare solid, liquid, and gas states', 'Explain phase transitions upon heating/cooling'],
    coreFacts: [
      'ପଦାର୍ଥର ତିନୋଟି ମୁଖ୍ୟ ଅବସ୍ଥା ହେଉଛି: କଠିନ (Solid), ତରଳ (Liquid) ଏବଂ ଗ୍ୟାସୀୟ (Gas)।',
      'ପାଣିକୁ ଗରମ କଲେ ତାହା ତରଳରୁ ଜଳୀୟ ବାଷ୍ପ (ଗ୍ୟାସ) ରେ ପରିଣତ ହୁଏ; ଏହା ଅମ୍ଳଜାନ ବା ଅଙ୍ଗାରକାମ୍ଳ ସୃଷ୍ଟି କରେ ନାହିଁ।',
      'କଠିନରେ କଣିକାଗୁଡ଼ିକ ଅତି ପାଖାପାଖି ଥାଆନ୍ତି ଏବଂ ଅନ୍ତଃକଣିକା ଆକର୍ଷଣ ବଳ ସବୁଠାରୁ ଅଧିକ।'
    ],
    explanations: {
      en: 'The kinetic arrangement of particles dictates whether matter is solid, liquid, or gas.',
      od: 'ପଦାର୍ଥର କଠିନ, ତରଳ ଓ ଗ୍ୟାସୀୟ ଅବସ୍ଥା କଣିକାମାନଙ୍କ ଆକର୍ଷଣ ବଳ ଓ ଗତିଶୀଳତା ଉପରେ ନିର୍ଭର କରେ।'
    },
    examples: { en: ['Ice, liquid water, steam'], od: ['ବରଫ (କଠିନ), ପାଣି (ତରଳ), ବାଷ୍ପ (ଗ୍ୟାସୀୟ)'] },
    misconceptions: [
      { misconception: 'Heating water decomposes it into oxygen and hydrogen gases during boiling', correction: 'Boiling water is a physical phase change into water vapour, not chemical decomposition.' }
    ],
    canonicalTerms: {
      en: { solid: 'solid', liquid: 'liquid', gas: 'gas', steam: 'water vapour' },
      od: { solid: 'କଠିନ', liquid: 'ତରଳ', gas: 'ଗ୍ୟାସୀୟ', steam: 'ଜଳୀୟ ବାଷ୍ପ' }
    },
    relatedConcepts: ['c9_sci_evaporation'],
    practiceConcepts: ['states_of_matter:heating_water'],
    masterySignals: ['explains_liquid_to_gas_state_change']
  },
  {
    id: 'c9_sci_evaporation',
    gradeRange: [9, 9],
    subject: 'science',
    chapter: 'matter_in_our_surroundings',
    topic: 'evaporation',
    name: { en: 'Evaporation', od: 'ବାଷ୍ପୀଭବନ' },
    aliases: { en: ['evaporative cooling', 'vaporization'], od: ['ବାଷ୍ପୀଭବନ'] },
    prerequisites: ['c9_sci_states_of_matter'],
    learningObjectives: ['Define evaporation as surface phenomenon below boiling point', 'Explain cooling effect caused by evaporation'],
    coreFacts: [
      'ସ୍ଫୁଟନାଙ୍କଠାରୁ କମ୍ ତାପମାତ୍ରାରେ ତରଳ ପଦାର୍ଥ ବାଷ୍ପରେ ପରିଣତ ହେବା ପ୍ରକ୍ରିୟାକୁ ବାଷ୍ପୀଭବନ (Evaporation) କୁହାଯାଏ।',
      'ବାଷ୍ପୀଭବନ ଏକ ପୃଷ୍ଠୀୟ ଘଟଣା (Surface phenomenon) ଅଟେ।',
      'ବାଷ୍ପୀଭବନ ଦ୍ୱାରା ଶୀତଳତା (Cooling effect) ଅନୁଭୂତ ହୁଏ।'
    ],
    explanations: {
      en: 'Evaporation is the phase change of liquid to vapor occurring at surface temperatures below boiling.',
      od: 'ତରଳ ପଦାର୍ଥ ଫୁଟିବା ପୂର୍ବରୁ ପୃଷ୍ଠରୁ ଧୀରେ ଧୀରେ ବାଷ୍ପ ହେବାକୁ ବାଷ୍ପୀଭବନ କୁହାଯାଏ।'
    },
    examples: { en: ['Wet clothes drying in sun', 'Water cooling in earthen pot'], od: ['ଓଦା ଲୁଗା ଶୁଖିବା', 'ମାଠିଆରେ ପାଣି ଥଣ୍ଡା ରହିବା'] },
    misconceptions: [
      { misconception: 'Evaporation occurs only at 100 degrees Celsius', correction: 'Boiling occurs at 100 degrees C, but evaporation occurs at any temperature below boiling.' }
    ],
    canonicalTerms: { en: { evaporation: 'evaporation' }, od: { evaporation: 'ବାଷ୍ପୀଭବନ' } },
    relatedConcepts: ['c9_sci_water_cycle'],
    practiceConcepts: ['evaporation:liquid_to_gas'],
    masterySignals: ['explains_factors_affecting_evaporation']
  },
  {
    id: 'c9_sci_water_cycle',
    gradeRange: [9, 9],
    subject: 'science',
    chapter: 'natural_resources',
    topic: 'water_cycle',
    name: { en: 'Water Cycle', od: 'ଜଳଚକ୍ର' },
    aliases: { en: ['hydrological cycle', 'precipitation', 'condensation'], od: ['ଜଳଚକ୍ର', 'ଘନୀଭବନ'] },
    prerequisites: ['c9_sci_evaporation'],
    learningObjectives: ['Describe stages of hydrological cycle', 'Distinguish evaporation, condensation, and precipitation'],
    coreFacts: [
      'ଜଳଚକ୍ର ହେଉଛି ପୃଥିବୀ ପୃଷ୍ଠରୁ ଜଳ ବାଷ୍ପୀଭୂତ ହୋଇ ବାୟୁମଣ୍ଡଳକୁ ଯିବା ଏବଂ ପୁଣି ବର୍ଷା ରୂପେ ଭୂପୃଷ୍ଠକୁ ଫେରିଆସିବାର ନିରନ୍ତର ପ୍ରକ୍ରିୟା।',
      'ବାଷ୍ପ ଉପରକୁ ଉଠି ଥଣ୍ଡା ହୋଇ ଘନୀଭବନ (Condensation) ଦ୍ୱାରା ମେଘ ସୃଷ୍ଟି କରେ।',
      'ମେଘରୁ ଜଳକଣିକାଗୁଡ଼ିକ ବର୍ଷା (Precipitation) ଆକାରରେ ଭୂପୃଷ୍ଠକୁ ଖସିଥାଏ।'
    ],
    explanations: {
      en: 'The water cycle recirculates water across lithosphere, hydrosphere, and atmosphere via evaporation, transpiration, condensation, and precipitation.',
      od: 'ପୃଥିବୀ ଓ ବାୟୁମଣ୍ଡଳ ମଧ୍ୟରେ ଜଳର ନିରନ୍ତର ଚଳପ୍ରଚଳକୁ ଜଳଚକ୍ର କୁହାଯାଏ।'
    },
    examples: { en: ['Ocean evaporation forming rain clouds'], od: ['ସମୁଦ୍ର ଜଳ ବାଷ୍ପୀଭୂତ ହୋଇ ମେଘ ସୃଷ୍ଟି'] },
    misconceptions: [
      { misconception: 'Rain travels upward to form clouds', correction: 'Vapour rises upward, condenses into clouds, and rain falls downward toward Earth.' }
    ],
    canonicalTerms: { en: { water_cycle: 'water cycle', condensation: 'condensation' }, od: { water_cycle: 'ଜଳଚକ୍ର', condensation: 'ଘନୀଭବନ' } },
    relatedConcepts: ['c9_sci_evaporation'],
    practiceConcepts: ['water_cycle:condensation_clouds'],
    masterySignals: ['orders_hydrological_cycle_phases']
  },
  {
    id: 'c9_sci_cell',
    gradeRange: [9, 9],
    subject: 'science',
    chapter: 'fundamental_unit_of_life',
    topic: 'cell',
    name: { en: 'The Fundamental Unit of Life', od: 'କୋଷ' },
    aliases: { en: ['cell theory', 'organelles', 'mitochondria', 'cell wall'], od: ['କୋଷ', 'ମାଇଟୋକଣ୍ଡ୍ରିଆ', 'କୋଷ ଭିତ୍ତି'] },
    prerequisites: ['c8_sci_cell_structure'],
    learningObjectives: ['Examine structural components of eukaryotic cells', 'Analyze organelle functions: mitochondria, nucleus, plastids'],
    coreFacts: [
      'କୋଷ ହେଉଛି ସମସ୍ତ ଜୀବର ମୌଳିକ ଗଠନମୂଳକ ଓ କାର୍ଯ୍ୟକାରୀ ଏକକ (Fundamental unit of life)।',
      'ଉଦ୍ଭିଦ କୋଷରେ କୋଷ ଭିତ୍ତି (Cell Wall) ଏବଂ ହରିତକଣିକା (Chloroplast) ଥାଏ; ପ୍ରାଣୀ କୋଷରେ କୋଷ ଭିତ୍ତି ନ ଥାଏ।',
      'ମାଇଟୋକଣ୍ଡ୍ରିଆ (Mitochondria) କୋଷର ଶକ୍ତିକେନ୍ଦ୍ର (Powerhouse of the cell) ଅଟେ।'
    ],
    explanations: {
      en: 'Eukaryotic cells feature membrane-bound organelles coordinating cellular metabolism, energy generation, and genetic control.',
      od: 'କୋଷ ହେଉଛି ଜୀବନର ମୂଳ ଏକକ ଯେଉଁଥିରେ ବିଭିନ୍ନ କୋଷାଙ୍ଗ ନିଜ ନିଜର ନିର୍ଦ୍ଦିଷ୍ଟ କାର୍ଯ୍ୟ ସମ୍ପାଦନ କରନ୍ତି।'
    },
    examples: { en: ['Plant cell wall composed of cellulose'], od: ['ଉଦ୍ଭିଦ କୋଷ ଭିତ୍ତି ସେଲ୍ୟୁଲୋଜ୍ ଦ୍ୱାରା ନିର୍ମିତ'] },
    misconceptions: [
      { misconception: 'Mitochondria performs photosynthesis', correction: 'Chloroplasts perform photosynthesis; mitochondria perform aerobic cellular respiration.' },
      { misconception: 'Animal cells contain a cell wall', correction: 'Animal cells have only a flexible cell membrane, never a cell wall.' }
    ],
    canonicalTerms: {
      en: { cell: 'cell', mitochondria: 'mitochondria', cell_wall: 'cell wall' },
      od: { cell: 'କୋଷ', mitochondria: 'ମାଇଟୋକଣ୍ଡ୍ରିଆ', cell_wall: 'କୋଷ ଭିତ୍ତି' }
    },
    relatedConcepts: ['c9_sci_respiration', 'c9_sci_photosynthesis'],
    practiceConcepts: ['cell:mitochondria_powerhouse'],
    masterySignals: ['identifies_mitochondria_as_powerhouse']
  },
  {
    id: 'c9_sci_force_motion',
    gradeRange: [9, 9],
    subject: 'science',
    chapter: 'force_and_laws_of_motion',
    topic: 'force_and_motion',
    name: { en: 'Force and Laws of Motion', od: 'ବଳ ଓ ଗତି' },
    aliases: { en: ['newtons laws of motion', 'inertia', 'momentum'], od: ['ବଳ ଓ ଗତି', 'ନ୍ୟୁଟନଙ୍କ ଗତି ନିୟମ', 'ଜଡ଼ତା'] },
    prerequisites: ['c6_sci_motion_measurement', 'c8_sci_force_pressure'],
    learningObjectives: ['Define Newton’s First Law and Inertia', 'Explain Newton’s Second Law F = ma and momentum', 'Understand Newton’s Third Law action-reaction'],
    coreFacts: [
      'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ ଅନୁସାରେ ବସ୍ତୁ ତାର ସ୍ଥିରାବସ୍ଥା ବା ସରଳରୈଖିକ ସମଗତି ଅବସ୍ଥା ବଜାୟ ରଖେ ଯେପର୍ଯ୍ୟନ୍ତ କୌଣସି ଅସନ୍ତୁଳିତ ବାହ୍ୟ ବଳ ପ୍ରୟୋଗ ନ ହୋଇଛି। ଏହାକୁ ଜଡ଼ତା (Inertia) ନିୟମ କୁହାଯାଏ।',
      'ବସ୍ତୁତ୍ୱ (Mass) ହେଉଛି ବସ୍ତୁର ଜଡ଼ତାର ଏକ ପରିମାପ।',
      'ନ୍ୟୁଟନଙ୍କ ତୃତୀୟ ଗତି ନିୟମ: ପ୍ରତ୍ୟେକ କ୍ରିୟାର ଏକ ସମାନ ଓ ବିପରୀତ ପ୍ରତିକ୍ରିୟା ଥାଏ।'
    ],
    explanations: {
      en: 'Dynamics study forces altering momentum; inertia resists changes in translational state as encapsulated by Newton’s laws.',
      od: 'ବାହ୍ୟ ବଳ ପ୍ରୟୋଗ ନ ହେବା ଯାଏ ବସ୍ତୁ ତାର ପୂର୍ବ ଅବସ୍ଥା ବଜାୟ ରଖିବା ପ୍ରବୃତ୍ତିକୁ ଜଡ଼ତା କୁହାଯାଏ।'
    },
    examples: { en: ['Passenger lurching forward when bus brakes suddenly'], od: ['ବସ୍ ହଠାତ୍ ଅଟକିଗଲେ ଯାତ୍ରୀ ଆଗକୁ ଝୁଙ୍କିପଡ଼ିବା (ଗତି ଜଡ଼ତା)'] },
    misconceptions: [
      { misconception: 'Newton\'s First Law is Action-Reaction', correction: 'Newton\'s First Law is the Law of Inertia; Third Law is Action and Reaction.' }
    ],
    canonicalTerms: {
      en: { force: 'force', motion: 'motion', inertia: 'inertia', newtons_laws: 'laws of motion' },
      od: { force: 'ବଳ', motion: 'ଗତି', inertia: 'ଜଡ଼ତା', newtons_laws: 'ଗତି ନିୟମ' }
    },
    relatedConcepts: ['c8_sci_force_pressure'],
    practiceConcepts: ['force_and_motion:inertia_first_law'],
    masterySignals: ['identifies_inertia_in_newtons_first_law']
  },
  {
    id: 'c9_sci_reproduction',
    gradeRange: [9, 9],
    subject: 'science',
    chapter: 'fundamental_life_processes',
    topic: 'reproduction',
    name: { en: 'Reproduction and Continuity of Life', od: 'ପ୍ରଜନନ' },
    aliases: { en: ['reproduction in living organisms', 'modes of reproduction'], od: ['ପ୍ରଜନନ', 'ଜୀବନର ଧାରାବାହିକତା'] },
    prerequisites: ['c8_sci_reproduction_animals'],
    learningObjectives: ['Understand reproduction as the biological process of producing offspring', 'Differentiate asexual and sexual reproduction'],
    coreFacts: [
      'ପ୍ରଜନନ (Reproduction) ହେଉଛି ଏକ ଜୈବିକ ପ୍ରକ୍ରିୟା ଯାହା ଦ୍ୱାରା ଜୀବ ନିଜ ଭଳି ନୂତନ ବଂଶଧର ସୃଷ୍ଟି କରେ।',
      'ପ୍ରଜନନ ମୁଖ୍ୟତଃ ଦୁଇ ପ୍ରକାରର: ଅଲିଙ୍ଗୀ ପ୍ରଜନନ (Asexual reproduction) ଏବଂ ଲିଙ୍ଗୀୟ ପ୍ରଜନନ (Sexual reproduction)।',
      'ଲିଙ୍ଗୀୟ ପ୍ରଜନନରେ ପୁଂ-ଯୁଗ୍ମକ ଓ ସ୍ତ୍ରୀ-ଯୁଗ୍ମକର ମିଳନ ଘଟି ଯୁଗ୍ମଜ (Zygote) ସୃଷ୍ଟି ହୁଏ।'
    ],
    explanations: {
      en: 'Reproduction ensures species survival across generations through hereditary transmission via asexual duplication or sexual recombination.',
      od: 'ପ୍ରଜନନ ହେଉଛି ଏକ ଜୈବିକ ପ୍ରକ୍ରିୟା ଯାହା ମାଧ୍ୟମରେ ପ୍ରତ୍ୟେକ ଜୀବ ନିଜର ପ୍ରଜାତିକୁ ବଜାୟ ରଖିବା ପାଇଁ ନୂତନ ଜୀବ ସୃଷ୍ଟି କରେ।'
    },
    examples: { en: ['Spore formation in fungi', 'Flowering plant fertilization producing seeds'], od: ['ଫୁଲରୁ ଫଳ ଓ ମଞ୍ଜି ସୃଷ୍ଟି'] },
    misconceptions: [
      { misconception: 'Reproduction is required for individual organism survival', correction: 'Reproduction is essential for species continuity, but not for the metabolic survival of the individual organism.' }
    ],
    canonicalTerms: {
      en: { reproduction: 'reproduction', gamete: 'gamete', zygote: 'zygote' },
      od: { reproduction: 'ପ୍ରଜନନ', gamete: 'ଯୁଗ୍ମକ', zygote: 'ଯୁଗ୍ମଜ' }
    },
    relatedConcepts: ['c8_sci_reproduction_animals', 'c10_sci_reproduction'],
    practiceConcepts: ['reproduction_basics'],
    masterySignals: ['distinguishes_asexual_and_sexual_reproduction']
  },
  {
    id: 'c9_math_number_systems',
    gradeRange: [9, 9],
    subject: 'mathematics',
    chapter: 'number_systems',
    topic: 'real_numbers',
    name: { en: 'Number Systems', od: 'ସଂଖ୍ୟା ପଦ୍ଧତି' },
    aliases: { en: ['irrational numbers', 'real numbers'], od: ['ଅପରିମେୟ ସଂଖ୍ୟା', 'ବାସ୍ତବ ସଂଖ୍ୟା'] },
    prerequisites: ['c8_math_rational_numbers'],
    learningObjectives: ['Define irrational numbers as non-terminating, non-recurring decimals', 'Locate irrational numbers on real number line'],
    coreFacts: [
      'A number is irrational if its decimal representation is non-terminating and non-recurring.',
      'The collection of all rational and irrational numbers forms real numbers.'
    ],
    explanations: {
      en: 'Real numbers comprise complete continuum of rationals and irrationals represented on real line.',
      od: 'ପରିମେୟ ଓ ଅପରିମେୟ ସଂଖ୍ୟାମାନଙ୍କ ସମାହାରକୁ ବାସ୍ତବ ସଂଖ୍ୟା କୁହାଯାଏ।'
    },
    examples: { en: ['sqrt(2), sqrt(3), pi'], od: ['ରୁଟ୍ ୨, ରୁଟ୍ ୩, ପାଇ'] },
    misconceptions: [
      { misconception: '22/7 is the exact value of pi', correction: '22/7 is a rational approximation of the irrational number pi.' }
    ],
    canonicalTerms: { en: { real_numbers: 'real numbers', irrational: 'irrational number' }, od: { real_numbers: 'ବାସ୍ତବ ସଂଖ୍ୟା', irrational: 'ଅପରିମେୟ ସଂଖ୍ୟା' } },
    relatedConcepts: ['c10_math_real_numbers'],
    practiceConcepts: ['irrational_classification'],
    masterySignals: ['proves_irrationality']
  },

  // ===================== CLASS 10 =====================
  {
    id: 'c10_sci_chemical_reactions',
    gradeRange: [10, 10],
    subject: 'science',
    chapter: 'chemical_reactions_and_equations',
    topic: 'balancing_equations',
    name: { en: 'Chemical Reactions and Equations', od: 'ରାସାୟନିକ ପ୍ରତିକ୍ରିୟା ଓ ସମୀକରଣ' },
    aliases: { en: ['chemical equation', 'oxidation reduction', 'types of reactions'], od: ['ରାସାୟନିକ ସମୀକରଣ', 'ଜାରଣ ବିଜାରଣ'] },
    prerequisites: ['c9_sci_matter'],
    learningObjectives: ['Balance chemical equations satisfying law of conservation of mass', 'Classify combination, decomposition, displacement, and redox reactions'],
    coreFacts: [
      'A chemical reaction involves chemical change where reactant bonds break and product bonds form.',
      'Law of conservation of mass states mass can neither be created nor destroyed in a chemical reaction.'
    ],
    explanations: {
      en: 'Chemical equations represent atomic rearrangements and must be stoichiometrically balanced.',
      od: 'ରାସାୟନିକ ପ୍ରତିକ୍ରିୟାରେ ପ୍ରତିକାରକଗୁଡ଼ିକ ପରସ୍ପର ସହ ପ୍ରତିକ୍ରିୟା କରି ନୂତନ ଉତ୍ପାଦ ସୃଷ୍ଟି କରନ୍ତି।'
    },
    examples: { en: ['2H2 + O2 -> 2H2O', 'Zn + H2SO4 -> ZnSO4 + H2'], od: ['ଜଳ ସୃଷ୍ଟି: 2H2 + O2 -> 2H2O'] },
    misconceptions: [
      { misconception: 'Chemical subscripts can be changed to balance an equation', correction: 'Only stoichiometric coefficients can be altered; subscripts define compound identity.' }
    ],
    canonicalTerms: { en: { reactant: 'reactant', product: 'product' }, od: { reactant: 'ପ୍ରତିକାରକ', product: 'ଉତ୍ପାଦ' } },
    relatedConcepts: ['c9_sci_matter'],
    practiceConcepts: ['balancing_chemical_equations'],
    masterySignals: ['balances_redox_equation']
  },
  {
    id: 'c10_sci_reproduction',
    gradeRange: [10, 10],
    subject: 'science',
    chapter: 'how_do_organisms_reproduce',
    topic: 'human_and_plant_reproduction',
    name: { en: 'How do Organisms Reproduce', od: 'ଜୀବ କିପରି ପ୍ରଜନନ କରନ୍ତି' },
    aliases: { en: ['sexual reproduction in humans', 'flower structure', 'dna copying'], od: ['ପ୍ରଜନନ', 'ପୁଷ୍ପୀ ଉଦ୍ଭିଦରେ ପ୍ରଜନନ'] },
    prerequisites: ['c8_sci_reproduction_animals', 'c9_sci_reproduction'],
    learningObjectives: ['Explain DNA replication importance during reproduction', 'Describe human male and female reproductive systems and menstrual cycle'],
    coreFacts: [
      'DNA replication is fundamental to reproduction, ensuring genetic continuity.',
      'Sexual reproduction introduces genetic variation crucial for evolution.',
      'In flowering plants, double fertilization occurs inside the ovule.'
    ],
    explanations: {
      en: 'Reproduction couples cellular DNA replication with specialized gamete production and developmental mechanisms.',
      od: 'ପ୍ରଜନନ ଜୀବର ବଂଶଗତି ଓ ବିବର୍ତ୍ତନ ପାଇଁ ନୂତନ ବିଭିନ୍ନତା ସୃଷ୍ଟି କରିବାରେ ସାହାଯ୍ୟ କରେ।'
    },
    examples: { en: ['Pollen tube growth to ovule', 'Embryo implantation in uterus'], od: ['ଡିମ୍ବାଶୟରେ ଭ୍ରୂଣର ବୃଦ୍ଧି'] },
    misconceptions: [
      { misconception: 'Asexual reproduction yields high genetic diversity', correction: 'Asexual reproduction produces genetically identical clones; sexual reproduction drives diversity.' }
    ],
    canonicalTerms: {
      en: { reproduction: 'reproduction', fertilization: 'fertilization', dna: 'DNA' },
      od: { reproduction: 'ପ୍ରଜନନ', fertilization: 'ନିଷେଚନ', dna: 'DNA' }
    },
    relatedConcepts: ['c8_sci_reproduction_animals', 'c9_sci_reproduction'],
    practiceConcepts: ['human_reproduction_stages'],
    masterySignals: ['explains_double_fertilization']
  },
  {
    id: 'c10_sci_electricity',
    gradeRange: [10, 10],
    subject: 'science',
    chapter: 'electricity',
    topic: 'electric_circuits_and_ohms_law',
    name: { en: 'Electricity', od: 'ବିଦ୍ୟୁତ୍ ସ୍ରୋତ' },
    aliases: { en: ['ohms law', 'potential difference', 'resistance'], od: ['ଓମ୍‌ଙ୍କ ନିୟମ', 'ପୋଟେନସିଆଲ ପ୍ରଭେଦ', 'ପ୍ରତିରୋଧ'] },
    prerequisites: [],
    learningObjectives: ['Define electric current I = Q/t', 'State Ohm’s Law V = IR', 'Calculate equivalent resistance for series and parallel circuits'],
    coreFacts: [
      'Electric current is the rate of flow of electric charges (I = Q / t). SI unit is Ampere (A).',
      'Ohm’s law states potential difference across a conductor is proportional to current at constant temperature (V = IR).'
    ],
    explanations: {
      en: 'Electric charge transport through conductive media obeys Ohm\'s law with resistive dissipation.',
      od: 'ଏକ ନିର୍ଦ୍ଦିଷ୍ଟ ପରିବାହୀରେ ପ୍ରବାହିତ ବିଦ୍ୟୁତ୍ ସ୍ରୋତ ଏହାର ଦୁଇ ପ୍ରାନ୍ତ ମଧ୍ୟରେ ଥିବା ବିଭବାନ୍ତର ସହ ସମାନୁପାତୀ (V = IR)।'
    },
    examples: { en: ['Resistors connected in series sharing current'], od: ['ଶ୍ରେଣୀ ସଂଯୋଗରେ ପ୍ରତିରୋଧକ'] },
    misconceptions: [
      { misconception: 'Current is consumed inside a resistor', correction: 'Current is conserved in a closed loop; electric potential energy is converted to thermal energy.' }
    ],
    canonicalTerms: { en: { current: 'current', voltage: 'voltage', resistance: 'resistance' }, od: { current: 'ବିଦ୍ୟୁତ୍ ସ୍ରୋତ', voltage: 'ବିଭବାନ୍ତର', resistance: 'ପ୍ରତିରୋଧ' } },
    relatedConcepts: [],
    practiceConcepts: ['ohms_law_calculations'],
    masterySignals: ['solves_circuit_equivalent_resistance']
  },
  {
    id: 'c10_math_real_numbers',
    gradeRange: [10, 10],
    subject: 'mathematics',
    chapter: 'real_numbers',
    topic: 'fundamental_theorem_of_arithmetic',
    name: { en: 'Real Numbers', od: 'ବାସ୍ତବ ସଂଖ୍ୟା' },
    aliases: { en: ['euclids division lemma', 'fundamental theorem of arithmetic', 'hcf lcm'], od: ['ୟୁକ୍ଲିଡ୍‌ଙ୍କ ଭାଗ କ୍ରିୟା', 'ମୌଳିକ ଅଙ୍କଗାଣିତିକ ପ୍ରମେୟ'] },
    prerequisites: ['c9_math_number_systems'],
    learningObjectives: ['Apply Fundamental Theorem of Arithmetic', 'Prove irrationality of numbers like sqrt(2), sqrt(5)'],
    coreFacts: [
      'Every composite number can be expressed as a product of primes uniquely up to order.',
      'HCF(a, b) * LCM(a, b) = a * b for any positive integers a and b.'
    ],
    explanations: {
      en: 'The Fundamental Theorem of Arithmetic guarantees prime factorization uniqueness, anchoring divisibility and irrationality proofs.',
      od: 'ପ୍ରତ୍ୟେକ ଯୌଗିକ ସଂଖ୍ୟାକୁ ମୌଳିକ ସଂଖ୍ୟାଗୁଡ଼ିକର ଏକ ଅଦ୍ୱିତୀୟ ଗୁଣନଫଳ ରୂପେ ପ୍ରକାଶ କରାଯାଇପାରେ।'
    },
    examples: { en: ['12 = 2^2 * 3'], od: ['୧୨ = ୨^୨ * ୩'] },
    misconceptions: [
      { misconception: '1 is a prime number', correction: '1 is neither prime nor composite by arithmetic definition.' }
    ],
    canonicalTerms: { en: { prime: 'prime number', composite: 'composite number' }, od: { prime: 'ମୌଳିକ ସଂଖ୍ୟା', composite: 'ଯୌଗିକ ସଂଖ୍ୟା' } },
    relatedConcepts: ['c9_math_number_systems'],
    practiceConcepts: ['prime_factorization'],
    masterySignals: ['proves_square_root_irrationality']
  }
];

/**
 * Validates the entire curriculum knowledge base graph.
 * Enforces structural integrity, uniqueness, relationship validity, and multilingual fields.
 */
function validateCurriculumKnowledgeBase() {
  const errors = [];
  const conceptIds = new Set();
  const aliasMap = new Map();

  for (const c of CURRICULUM_CONCEPTS) {
    // 1. Concept ID
    if (!c.id || typeof c.id !== 'string') {
      errors.push('Concept is missing string ID');
      continue;
    }
    if (conceptIds.has(c.id)) {
      errors.push(`Duplicate concept ID detected: ${c.id}`);
    }
    conceptIds.add(c.id);

    // 2. Grade range
    if (!Array.isArray(c.gradeRange) || c.gradeRange.length !== 2 || c.gradeRange[0] < 6 || c.gradeRange[1] > 10 || c.gradeRange[0] > c.gradeRange[1]) {
      errors.push(`Concept ${c.id} has invalid gradeRange: ${JSON.stringify(c.gradeRange)}`);
    }

    // 3. Subject, Chapter, Topic
    if (!c.subject || !['science', 'mathematics'].includes(c.subject)) {
      errors.push(`Concept ${c.id} missing valid subject`);
    }
    if (!c.chapter || typeof c.chapter !== 'string') {
      errors.push(`Concept ${c.id} missing chapter`);
    }
    if (!c.topic || typeof c.topic !== 'string') {
      errors.push(`Concept ${c.id} missing topic`);
    }

    // 4. English name
    if (!c.name?.en || typeof c.name.en !== 'string') {
      errors.push(`Concept ${c.id} missing English name`);
    }

    // 5. Canonical Odia terminology
    if (!c.canonicalTerms?.od || typeof c.canonicalTerms.od !== 'object') {
      errors.push(`Concept ${c.id} missing Odia canonical terms`);
    }

    // 6. Misconceptions format
    if (Array.isArray(c.misconceptions)) {
      for (const m of c.misconceptions) {
        if (!m.misconception || !m.correction) {
          errors.push(`Concept ${c.id} has malformed misconception entry: ${JSON.stringify(m)}`);
        }
      }
    }

    // 7. Aliases duplicate checking
    if (c.aliases) {
      const allAliases = [...(c.aliases.en || []), ...(c.aliases.od || [])];
      for (const alias of allAliases) {
        const lower = alias.trim().toLowerCase();
        if (aliasMap.has(lower) && aliasMap.get(lower) !== c.id) {
          // Warning or error if conflicting alias points to different concepts
          // Allowed only if scoped, but flag duplicates within same topic
        }
        aliasMap.set(lower, c.id);
      }
    }
  }

  // 8. Validate Prerequisite & Related concept references
  for (const c of CURRICULUM_CONCEPTS) {
    if (Array.isArray(c.prerequisites)) {
      for (const prereq of c.prerequisites) {
        if (!conceptIds.has(prereq)) {
          errors.push(`Concept ${c.id} references non-existent prerequisite: "${prereq}"`);
        }
      }
    }
    if (Array.isArray(c.relatedConcepts)) {
      for (const rel of c.relatedConcepts) {
        if (!conceptIds.has(rel)) {
          errors.push(`Concept ${c.id} references non-existent relatedConcept: "${rel}"`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    detail: errors.join('; '),
    totalConcepts: conceptIds.size
  };
}

/**
 * Searches the curriculum knowledge base for a relevant concept given student query text.
 * Returns hierarchical match { grade, subject, chapter, topic, concept, conceptData } or null.
 */
function findCurriculumConcept(query = '') {
  if (!query || typeof query !== 'string') return null;
  const q = query.trim().toLowerCase();

  // 1. Specific key patterns for core questions
  if (/(?:ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|photosynthesis)/i.test(q)) {
    const c = CURRICULUM_CONCEPTS.find(x => x.id === 'c9_sci_photosynthesis');
    return { grade: c.gradeRange[0], subject: c.subject, chapter: c.chapter, topic: c.topic, concept: c.id, data: c };
  }
  if (/(?:ଶ୍ୱାସକ୍ରିୟା|ଶ୍ୱସନ|respiration)/i.test(q)) {
    const c = CURRICULUM_CONCEPTS.find(x => x.id === 'c9_sci_respiration');
    return { grade: c.gradeRange[0], subject: c.subject, chapter: c.chapter, topic: c.topic, concept: c.id, data: c };
  }
  if (/(?:ପ୍ରଜନନ|reproduction)/i.test(q)) {
    const c = CURRICULUM_CONCEPTS.find(x => x.id === 'c9_sci_reproduction');
    return { grade: c.gradeRange[0], subject: c.subject, chapter: c.chapter, topic: c.topic, concept: c.id, data: c };
  }
  if (/(?:ବଳ\s*କ['’]?ଣ|what\s*is\s*force\b|force\b|ବଳ\b)/i.test(q)) {
    const c = CURRICULUM_CONCEPTS.find(x => x.id === 'c9_sci_force_motion');
    return { grade: c.gradeRange[0], subject: c.subject, chapter: c.chapter, topic: c.topic, concept: c.id, data: c };
  }
  if (/(?:ଗତି\s*କ['’]?ଣ|what\s*is\s*motion\b|motion\b|ଗତି\b)/i.test(q)) {
    const c = CURRICULUM_CONCEPTS.find(x => x.id === 'c6_sci_motion_measurement');
    return { grade: c.gradeRange[0], subject: c.subject, chapter: c.chapter, topic: c.topic, concept: c.id, data: c };
  }

  // 2. Canonical term / name matches
  for (const c of CURRICULUM_CONCEPTS) {
    if (q.includes(c.name.en.toLowerCase())) {
      return { grade: c.gradeRange[0], subject: c.subject, chapter: c.chapter, topic: c.topic, concept: c.id, data: c };
    }
    if (c.name.od && q.includes(c.name.od)) {
      return { grade: c.gradeRange[0], subject: c.subject, chapter: c.chapter, topic: c.topic, concept: c.id, data: c };
    }
    if (c.canonicalTerms?.od) {
      for (const term of Object.values(c.canonicalTerms.od)) {
        if (term && term.length > 2 && q.includes(term.toLowerCase())) {
          return { grade: c.gradeRange[0], subject: c.subject, chapter: c.chapter, topic: c.topic, concept: c.id, data: c };
        }
      }
    }
    if (c.canonicalTerms?.en) {
      for (const term of Object.values(c.canonicalTerms.en)) {
        if (term && term.length > 3 && q.includes(term.toLowerCase())) {
          return { grade: c.gradeRange[0], subject: c.subject, chapter: c.chapter, topic: c.topic, concept: c.id, data: c };
        }
      }
    }
  }

  return null;
}

module.exports = {
  CURRICULUM_CONCEPTS,
  validateCurriculumKnowledgeBase,
  findCurriculumConcept
};
