// ─────────────────────────────────────────────────────────────
// Topic taxonomy — canonical topics mapped to all their aliases
// Add new topics here as students use the app.
// Keys are canonical topic names (lowercase, used as cache keys).
// Values are arrays of synonyms and related keywords.
// ─────────────────────────────────────────────────────────────
const TOPIC_TAXONOMY = {

  // ── Biology ──────────────────────────────────────────────
  'photosynthesis': [
    'photosynthesis', 'plants make food', 'chlorophyll', 'light energy',
    'plant food', 'chloroplast', 'sunlight energy', 'carbon dioxide oxygen',
    'how plants grow', 'plant energy', 'green plants', 'plant process',
    'light dependent reaction', 'light independent reaction', 'calvin cycle',
    'photosystem', 'stroma', 'thylakoid'
  ],
  'cellular respiration': [
    'cellular respiration', 'cell respiration', 'atp', 'mitochondria',
    'energy from food', 'glucose energy', 'aerobic respiration',
    'anaerobic respiration', 'how cells get energy', 'cell energy',
    'glycolysis', 'krebs cycle', 'electron transport chain', 'fermentation',
    'oxidative phosphorylation', 'nad nadh'
  ],
  'mitosis': [
    'mitosis', 'cell division', 'cells divide', 'chromosomes splitting',
    'cell replication', 'somatic cell division', 'cell cycle', 'cytokinesis',
    'prophase metaphase', 'how cells multiply', 'anaphase telophase',
    'interphase', 'spindle fibres', 'sister chromatids'
  ],
  'meiosis': [
    'meiosis', 'sexual reproduction cells', 'gametes', 'sex cells',
    'reproductive cell division', 'sperm egg formation', 'haploid cells',
    'crossing over', 'genetic variation meiosis', 'homologous chromosomes',
    'meiosis 1 meiosis 2', 'reduction division'
  ],
  'dna': [
    'dna', 'deoxyribonucleic acid', 'double helix', 'genes', 'genetics',
    'nucleotides', 'base pairs', 'adenine thymine', 'genetic code',
    'what is dna', 'how dna works', 'chromosomes genes', 'guanine cytosine',
    'dna structure', 'watson crick', 'genome', 'dna replication',
    'dna polymerase', 'helicase'
  ],
  'evolution': [
    'evolution', 'natural selection', 'darwin', 'species change',
    'adaptation', 'survival of fittest', 'evolutionary biology',
    'common ancestor', 'mutation selection', 'how species evolve',
    'speciation', 'fossil record', 'artificial selection', 'genetic drift'
  ],
  'human digestive system': [
    'digestion', 'digestive system', 'stomach', 'intestines',
    'how we digest food', 'enzymes digestion', 'absorption nutrients',
    'oesophagus stomach', 'small intestine large intestine',
    'mouth oesophagus stomach', 'bile liver', 'pancreas enzymes',
    'villi absorption', 'peristalsis', 'digestive enzymes'
  ],
  'ecosystems': [
    'ecosystem', 'food chain', 'food web', 'predator prey',
    'producer consumer', 'decomposer', 'biome', 'habitat',
    'energy flow ecosystem', 'trophic levels', 'biodiversity',
    'ecological niche', 'symbiosis mutualism', 'parasitism',
    'carbon cycle', 'nitrogen cycle', 'water cycle ecosystem'
  ],
  'human body systems': [
    'human body', 'body systems', 'circulatory system', 'respiratory system',
    'nervous system', 'skeletal system', 'muscular system', 'immune system',
    'endocrine system', 'heart lungs brain', 'how body works',
    'organs', 'organ systems', 'excretory system', 'lymphatic system'
  ],
  'genetics and heredity': [
    'genetics', 'heredity', 'inherited traits', 'dominant recessive',
    'punnett square', 'genotype phenotype', 'alleles', 'mendel',
    'gregor mendel peas', 'inheritance', 'genetic disorders',
    'codominance', 'incomplete dominance', 'sex linked traits',
    'blood type genetics', 'heterozygous homozygous'
  ],
  'human circulatory system': [
    'circulatory system', 'heart', 'blood vessels', 'arteries veins',
    'capillaries', 'blood circulation', 'how heart works', 'cardiac cycle',
    'blood pressure', 'red blood cells white blood cells', 'plasma',
    'pulmonary circulation', 'systemic circulation', 'aorta'
  ],
  'human nervous system': [
    'nervous system', 'brain', 'neurons', 'nerve impulse', 'synapse',
    'central nervous system', 'peripheral nervous system', 'spinal cord',
    'reflex arc', 'how brain works', 'neurotransmitter',
    'sensory neurons motor neurons', 'cerebrum cerebellum'
  ],
  'plant biology': [
    'plant biology', 'plant structure', 'roots stems leaves',
    'xylem phloem', 'transpiration', 'plant reproduction',
    'pollination', 'germination', 'seed dispersal', 'plant hormones',
    'auxin', 'tropism', 'flowers parts', 'stamen pistil'
  ],
  'microorganisms': [
    'microorganisms', 'bacteria', 'viruses', 'fungi', 'microbes',
    'pathogens', 'antibiotics', 'vaccination', 'immune response',
    'infectious disease', 'germs', 'how vaccines work',
    'antibodies', 'white blood cells defence'
  ],

  // ── Chemistry ─────────────────────────────────────────────
  'periodic table': [
    'periodic table', 'elements', 'atomic number', 'atomic mass',
    'mendeleev', 'groups periods', 'metals nonmetals', 'element symbols',
    'how periodic table works', 'chemical elements', 'noble gases',
    'halogens', 'alkali metals', 'transition metals', 'metalloids',
    'electron configuration', 'valence shell'
  ],
  'chemical bonding': [
    'chemical bonding', 'covalent bond', 'ionic bond', 'metallic bond',
    'electron sharing', 'electron transfer', 'molecule formation',
    'how atoms bond', 'chemical bonds', 'valence electrons',
    'lewis dot structure', 'polar bond', 'hydrogen bond', 'van der waals',
    'electronegativity', 'bond energy'
  ],
  'acids and bases': [
    'acid base', 'acids bases', 'ph scale', 'ph level', 'neutralisation',
    'neutralization', 'titration', 'hydrogen ions', 'alkaline acid',
    'strong weak acid', 'litmus test', 'indicators',
    'hydroxide ions', 'buffer solution', 'universal indicator',
    'acid rain', 'antacid'
  ],
  'chemical reactions': [
    'chemical reaction', 'reactants products', 'exothermic endothermic',
    'activation energy', 'catalyst', 'rate of reaction',
    'balanced equation', 'conservation of mass', 'stoichiometry',
    'combustion', 'oxidation reduction', 'redox reaction',
    'decomposition reaction', 'synthesis reaction', 'displacement reaction'
  ],
  'atomic structure': [
    'atomic structure', 'atom', 'protons neutrons electrons',
    'nucleus', 'electron shells', 'bohr model', 'subatomic particles',
    'atomic number mass number', 'isotopes', 'how atom looks',
    'electron orbitals', 'quantum numbers', 'electron cloud',
    'rutherford model', 'thomson model', 'plum pudding model'
  ],
  'states of matter': [
    'states of matter', 'solid liquid gas', 'melting boiling', 'evaporation',
    'condensation', 'sublimation', 'freezing point', 'boiling point',
    'particles in solid liquid gas', 'kinetic theory', 'plasma',
    'change of state', 'heating curve', 'cooling curve',
    'diffusion', 'brownian motion'
  ],
  'organic chemistry': [
    'organic chemistry', 'hydrocarbons', 'alkanes alkenes', 'polymers',
    'carbon compounds', 'methane ethane', 'functional groups',
    'isomers', 'cracking', 'crude oil', 'fractional distillation',
    'homologous series', 'saturated unsaturated', 'polymerisation',
    'alcohols', 'carboxylic acids', 'esters'
  ],
  'the mole': [
    'mole chemistry', 'avogadro number', 'molar mass', 'moles calculation',
    'amount of substance', 'mole ratio', 'moles and grams',
    'empirical formula', 'molecular formula', 'concentration molarity',
    'how to calculate moles', 'stoichiometry moles'
  ],
  'electrolysis': [
    'electrolysis', 'electrochemistry', 'electrolyte', 'electrode',
    'anode cathode', 'electroplating', 'electrochemical cell',
    'electrolysis of water', 'ionic compounds electrolysis',
    'faraday electrolysis', 'half equations'
  ],

  // ── Physics ───────────────────────────────────────────────
  'gravity': [
    'gravity', 'gravitational force', 'newton gravity', 'falling objects',
    'weight mass gravity', 'gravitational acceleration', '9.8 m/s',
    'why things fall', 'gravitational field', 'free fall',
    'terminal velocity', 'weight on different planets', 'g force',
    'gravitational potential energy'
  ],
  'newtons laws': [
    'newton laws', 'newtons laws', 'laws of motion', 'first law inertia',
    'second law f=ma', 'third law action reaction', 'force mass acceleration',
    'newtons first second third', 'how forces work',
    'inertia', 'unbalanced forces', 'resultant force', 'momentum',
    'impulse', 'conservation of momentum'
  ],
  'electricity': [
    'electricity', 'electric current', 'voltage', 'resistance', 'ohm',
    'ohms law', 'circuit', 'conductor insulator', 'series parallel circuit',
    'how electricity works', 'watts power', 'coulombs',
    'alternating current', 'direct current', 'ac dc', 'fuse circuit breaker',
    'earthing grounding', 'static electricity'
  ],
  'waves': [
    'waves', 'wave frequency', 'amplitude', 'wavelength', 'transverse longitudinal',
    'sound waves', 'light waves', 'electromagnetic waves', 'wave speed',
    'period frequency', 'how waves travel', 'wave properties',
    'electromagnetic spectrum', 'radio waves', 'microwaves', 'infrared',
    'ultraviolet', 'x rays', 'gamma rays', 'wave equation'
  ],
  'energy': [
    'energy', 'kinetic energy', 'potential energy', 'conservation of energy',
    'energy transfer', 'work done', 'power joules', 'forms of energy',
    'thermal energy', 'how energy works', 'energy transformation',
    'elastic potential energy', 'gravitational potential energy',
    'specific heat capacity', 'efficiency energy', 'renewable energy',
    'sankey diagram'
  ],
  'magnetism': [
    'magnetism', 'magnetic field', 'electromagnet', 'magnetic force',
    'north south pole', 'compass', 'magnetic flux', 'solenoid',
    'how magnets work', 'induced current', 'electromagnetic induction',
    'motor effect', 'generator', 'transformer', 'flemings left hand rule'
  ],
  'light': [
    'light', 'reflection', 'refraction', 'diffraction', 'spectrum',
    'prism colours', 'wavelength colour', 'lens mirror', 'optics',
    'how light behaves', 'visible light', 'photons',
    'total internal reflection', 'snells law', 'concave convex lens',
    'real virtual image', 'speed of light', 'optical fibre'
  ],
  'forces and motion': [
    'forces', 'motion', 'speed velocity', 'acceleration', 'deceleration',
    'distance time graph', 'velocity time graph', 'displacement',
    'uniform motion', 'equations of motion', 'suvat', 'friction',
    'air resistance', 'drag force', 'terminal velocity',
    'circular motion', 'centripetal force'
  ],
  'pressure': [
    'pressure', 'pressure formula', 'atmospheric pressure', 'gas pressure',
    'hydraulics', 'liquid pressure', 'pressure in fluids',
    'pascal', 'barometer', 'manometer', 'boyles law', 'charles law',
    'pressure depth', 'upthrust', 'archimedes principle', 'buoyancy'
  ],
  'radioactivity': [
    'radioactivity', 'radioactive decay', 'alpha beta gamma',
    'half life', 'nuclear radiation', 'nuclear fission', 'nuclear fusion',
    'background radiation', 'carbon dating', 'isotopes radioactive',
    'geiger counter', 'radiation dangers', 'nuclear power',
    'chain reaction', 'atomic bomb'
  ],
  'heat transfer': [
    'heat transfer', 'conduction', 'convection', 'radiation heat',
    'thermal conductor', 'thermal insulator', 'specific heat capacity',
    'latent heat', 'temperature vs heat', 'how heat travels',
    'infrared radiation', 'vacuum flask', 'insulation'
  ],
  'space and astronomy': [
    'space', 'astronomy', 'solar system', 'planets', 'stars',
    'sun', 'moon', 'earth rotation', 'orbit', 'galaxy',
    'milky way', 'universe', 'black hole', 'big bang theory',
    'light year', 'telescope', 'satellite', 'gravity space',
    'seasons', 'day and night', 'phases of moon', 'eclipse',
    'comet asteroid meteor'
  ],

  // ── Mathematics ───────────────────────────────────────────
  'pythagoras theorem': [
    'pythagoras', 'pythagorean theorem', 'right angle triangle',
    'hypotenuse', 'a squared b squared c squared', 'right triangle sides',
    'how to find hypotenuse', 'triangle calculation',
    'pythagorean triples', '3 4 5 triangle'
  ],
  'quadratic equations': [
    'quadratic', 'quadratic equation', 'quadratic formula', 'factoring',
    'completing the square', 'ax squared bx c', 'roots of equation',
    'parabola', 'discriminant', 'solving quadratics',
    'quadratic graph', 'vertex', 'turning point'
  ],
  'calculus': [
    'calculus', 'derivative', 'differentiation', 'integration', 'integral',
    'limits', 'rate of change', 'dy dx', 'gradient function',
    'fundamental theorem calculus', 'how calculus works',
    'chain rule', 'product rule', 'quotient rule', 'definite integral',
    'area under curve', 'maximum minimum turning point'
  ],
  'algebra': [
    'algebra', 'algebraic expressions', 'solving equations', 'variables',
    'linear equation', 'simultaneous equations', 'inequalities',
    'expanding brackets', 'factorising', 'substitution',
    'transposing formula', 'rearranging equations', 'like terms',
    'collecting terms', 'algebraic fractions'
  ],
  'statistics': [
    'statistics', 'mean median mode', 'average', 'standard deviation',
    'probability', 'normal distribution', 'correlation', 'histogram',
    'data analysis', 'how to find mean', 'statistical analysis',
    'box plot', 'cumulative frequency', 'interquartile range',
    'scatter graph', 'bar chart', 'pie chart', 'frequency table',
    'sampling', 'variance'
  ],
  'trigonometry': [
    'trigonometry', 'sin cos tan', 'sine cosine tangent', 'sohcahtoa',
    'trig ratios', 'unit circle', 'radians degrees', 'trig identities',
    'how trig works', 'angle calculation', 'sine rule', 'cosine rule',
    'trig graphs', 'inverse trig', 'arc length', 'sector area'
  ],
  'fractions': [
    'fractions', 'numerator denominator', 'simplify fraction',
    'adding fractions', 'multiplying fractions', 'mixed numbers',
    'equivalent fractions', 'how fractions work', 'fraction division',
    'improper fractions', 'lowest common denominator', 'common denominator',
    'fraction to decimal', 'fraction to percent'
  ],
  'percentages': [
    'percentage', 'percentages', 'percent', 'how to find percentage',
    'percentage increase', 'percentage decrease', 'percentage change',
    'percentage of a number', 'compound interest', 'simple interest',
    'percent to fraction', 'percent to decimal', 'discount percentage',
    'vat tax percentage', 'profit loss percentage'
  ],
  'ratios and proportions': [
    'ratio', 'ratios', 'proportion', 'direct proportion',
    'inverse proportion', 'simplifying ratios', 'dividing in ratio',
    'scale factor', 'map scale', 'recipe ratios', 'ratio problems',
    'unitary method', 'best buy comparison'
  ],
  'geometry': [
    'geometry', 'shapes', 'angles', 'triangle', 'circle', 'rectangle',
    'area', 'perimeter', 'volume', 'surface area', 'parallel lines',
    'perpendicular', 'congruent', 'similar shapes', 'symmetry',
    'interior angles', 'exterior angles', 'polygon', 'tessellation',
    'transformation', 'rotation', 'reflection', 'translation', 'enlargement'
  ],
  'coordinate geometry': [
    'coordinate geometry', 'coordinates', 'x axis y axis', 'gradient',
    'y intercept', 'equation of line', 'y mx c', 'slope',
    'midpoint', 'distance between two points', 'parallel lines gradient',
    'perpendicular gradient', 'straight line graph'
  ],
  'number sequences': [
    'sequences', 'number sequence', 'nth term', 'arithmetic sequence',
    'geometric sequence', 'fibonacci', 'common difference', 'common ratio',
    'linear sequence', 'quadratic sequence', 'term to term rule',
    'position to term', 'sum of series'
  ],
  'indices and powers': [
    'indices', 'powers', 'exponents', 'index laws', 'power rules',
    'squared cubed', 'negative indices', 'fractional indices',
    'standard form', 'scientific notation', 'laws of indices',
    'square root', 'cube root', 'surds'
  ],
  'probability': [
    'probability', 'chance', 'likelihood', 'probability scale',
    'experimental probability', 'theoretical probability',
    'independent events', 'dependent events', 'mutually exclusive',
    'probability tree diagram', 'venn diagram probability',
    'conditional probability', 'sample space', 'outcomes',
    'expected frequency', 'relative frequency'
  ],

  // ── History ───────────────────────────────────────────────
  'world war 2': [
    'world war 2', 'world war two', 'ww2', 'wwii', 'second world war',
    'hitler', 'nazi', 'allied powers', 'axis powers', 'holocaust',
    'd day', 'pearl harbor', 'hiroshima', 'causes of ww2',
    'blitzkrieg', 'dunkirk', 'normandy', 'winston churchill',
    'anne frank', 'concentration camps', 'battle of britain'
  ],
  'world war 1': [
    'world war 1', 'world war one', 'ww1', 'wwi', 'first world war',
    'trench warfare', 'archduke franz ferdinand', 'triple alliance entente',
    'causes of ww1', 'versailles treaty', 'gallipoli',
    'western front', 'no mans land', 'propaganda ww1',
    'armistice', 'league of nations'
  ],
  'french revolution': [
    'french revolution', 'bastille', 'napoleon', 'marie antoinette',
    'reign of terror', 'robespierre', 'liberty equality fraternity',
    'causes french revolution', 'france 1789',
    'third estate', 'estates general', 'declaration rights man'
  ],
  'industrial revolution': [
    'industrial revolution', 'steam engine', 'factory system', 'urbanisation',
    'james watt', 'mass production', 'cotton gin', 'child labour history',
    'how industrial revolution started', 'britain industrialisation',
    'spinning jenny', 'iron steel', 'canals railways', 'luddites'
  ],
  'american revolution': [
    'american revolution', 'declaration of independence', 'boston tea party',
    'george washington', 'thirteen colonies', 'revolutionary war',
    'taxation without representation', 'constitution', 'bill of rights',
    'founding fathers', 'paul revere', 'battle of yorktown'
  ],
  'ancient civilisations': [
    'ancient egypt', 'ancient rome', 'ancient greece', 'mesopotamia',
    'pharaoh', 'pyramids', 'roman empire', 'julius caesar', 'colosseum',
    'greek gods', 'democracy athens', 'sparta', 'alexander the great',
    'hieroglyphics', 'mummification', 'gladiators',
    'indus valley', 'ancient china'
  ],
  'civil rights movement': [
    'civil rights', 'martin luther king', 'mlk', 'rosa parks',
    'segregation', 'racial equality', 'i have a dream',
    'civil rights act', 'montgomery bus boycott', 'malcolm x',
    'apartheid', 'nelson mandela', 'voting rights', 'jim crow laws'
  ],
  'cold war': [
    'cold war', 'soviet union', 'usa vs ussr', 'iron curtain',
    'nuclear arms race', 'cuban missile crisis', 'berlin wall',
    'space race', 'nato warsaw pact', 'communism capitalism',
    'proxy wars', 'korean war', 'vietnam war', 'gorbachev'
  ],

  // ── English / Literature ──────────────────────────────────
  'shakespeare': [
    'shakespeare', 'william shakespeare', 'hamlet', 'macbeth', 'romeo juliet',
    'othello', 'sonnets', 'elizabethan era', 'globe theatre',
    'shakespeare plays', 'iambic pentameter', 'merchant of venice',
    'midsummer nights dream', 'the tempest', 'twelfth night',
    'king lear', 'julius caesar play'
  ],
  'essay writing': [
    'essay writing', 'how to write essay', 'thesis statement', 'introduction conclusion',
    'paragraph structure', 'argumentative essay', 'analytical essay',
    'topic sentence', 'essay structure', 'writing techniques',
    'persuasive writing', 'discursive essay', 'narrative writing',
    'descriptive writing', 'connectives', 'linking words'
  ],
  'poetry': [
    'poetry', 'poem', 'rhyme scheme', 'stanza', 'verse',
    'simile', 'metaphor', 'personification', 'alliteration',
    'onomatopoeia', 'imagery', 'sonnet', 'haiku', 'limerick',
    'free verse', 'enjambment', 'caesura', 'poetry analysis',
    'poetic techniques', 'war poetry'
  ],
  'grammar and punctuation': [
    'grammar', 'punctuation', 'sentence structure', 'parts of speech',
    'noun verb adjective', 'adverb', 'pronoun', 'preposition',
    'conjunction', 'comma usage', 'semicolon', 'colon', 'apostrophe',
    'subject verb agreement', 'tenses', 'passive voice active voice',
    'clauses', 'phrases', 'relative clause'
  ],
  'reading comprehension': [
    'reading comprehension', 'inference', 'main idea', 'theme',
    'authors purpose', 'context clues', 'summarising', 'paraphrasing',
    'point of view', 'character analysis', 'plot structure',
    'setting', 'conflict', 'foreshadowing', 'symbolism',
    'tone mood', 'literary devices'
  ],

  // ── Computer Science ──────────────────────────────────────
  'sorting algorithms': [
    'sorting algorithm', 'bubble sort', 'merge sort', 'quick sort',
    'insertion sort', 'selection sort', 'how sorting works',
    'algorithm complexity', 'big o notation sorting',
    'comparison sorting', 'sorting efficiency'
  ],
  'binary': [
    'binary', 'binary numbers', 'bits bytes', 'base 2', 'binary conversion',
    'binary to decimal', 'how computers store numbers', 'binary code',
    'ones zeros computer', 'hexadecimal', 'octal', 'binary addition',
    'binary subtraction', 'twos complement'
  ],
  'programming basics': [
    'programming', 'coding', 'variables programming', 'loops', 'if else',
    'conditional statements', 'functions programming', 'arrays', 'lists',
    'for loop', 'while loop', 'iteration', 'selection', 'sequence',
    'pseudocode', 'flowchart', 'debugging', 'syntax error',
    'python basics', 'javascript basics'
  ],
  'data structures': [
    'data structures', 'array', 'linked list', 'stack', 'queue',
    'tree data structure', 'binary tree', 'hash table', 'graph data structure',
    'heap', 'push pop', 'fifo lifo', 'traversal',
    'data structure comparison'
  ],
  'computer networks': [
    'computer network', 'internet', 'tcp ip', 'http https', 'dns',
    'ip address', 'lan wan', 'wifi', 'router switch', 'protocols',
    'packet switching', 'bandwidth', 'firewall', 'encryption',
    'how internet works', 'client server', 'peer to peer'
  ],
  'cybersecurity': [
    'cybersecurity', 'cyber security', 'hacking', 'malware', 'virus computer',
    'phishing', 'encryption decryption', 'password security', 'firewall',
    'two factor authentication', 'social engineering', 'ransomware',
    'data protection', 'privacy online', 'cyber attack'
  ],

  // ── Geography ─────────────────────────────────────────────
  'weather and climate': [
    'weather', 'climate', 'atmosphere', 'weather patterns',
    'cloud types', 'precipitation', 'humidity', 'air pressure weather',
    'climate zones', 'tropical temperate polar', 'weather forecast',
    'wind patterns', 'seasons weather', 'microclimate',
    'weather instruments', 'thermometer barometer'
  ],
  'climate change': [
    'climate change', 'global warming', 'greenhouse effect', 'greenhouse gases',
    'carbon dioxide emissions', 'fossil fuels climate', 'ice caps melting',
    'sea level rise', 'deforestation', 'carbon footprint',
    'paris agreement', 'renewable energy climate', 'ozone layer',
    'sustainability', 'climate crisis'
  ],
  'tectonic plates': [
    'tectonic plates', 'plate tectonics', 'earthquake', 'volcano',
    'continental drift', 'fault line', 'seismic waves', 'richter scale',
    'magma lava', 'convergent divergent', 'transform boundary',
    'ring of fire', 'tsunami', 'pangaea', 'plate boundary',
    'volcanic eruption', 'epicentre'
  ],
  'rivers and water cycle': [
    'rivers', 'water cycle', 'evaporation condensation precipitation',
    'river features', 'erosion deposition', 'meander', 'waterfall',
    'floodplain', 'delta', 'drainage basin', 'tributary',
    'source mouth river', 'oxbow lake', 'groundwater',
    'infiltration', 'surface runoff'
  ],
  'population and migration': [
    'population', 'population growth', 'migration', 'immigration',
    'birth rate death rate', 'population density', 'urbanisation',
    'push pull factors', 'population pyramid', 'demographic transition',
    'overpopulation', 'census', 'rural urban migration',
    'refugee', 'asylum seeker'
  ],

  // ── Economics ──────────────────────────────────────────────
  'supply and demand': [
    'supply demand', 'supply and demand', 'market equilibrium',
    'price mechanism', 'demand curve', 'supply curve', 'shortage surplus',
    'factors affecting demand', 'factors affecting supply',
    'elasticity', 'price elasticity demand', 'market forces',
    'law of demand', 'law of supply'
  ],
  'economic systems': [
    'economic systems', 'capitalism', 'socialism', 'communism',
    'mixed economy', 'free market', 'planned economy',
    'economic growth', 'gdp', 'gross domestic product',
    'inflation', 'unemployment', 'recession', 'fiscal policy',
    'monetary policy', 'interest rates', 'central bank'
  ],
  'money and banking': [
    'money', 'banking', 'currency', 'savings', 'loans', 'credit',
    'debit', 'interest', 'compound interest money', 'inflation money',
    'stock market', 'shares', 'investment', 'budget', 'tax',
    'income tax', 'national debt', 'financial literacy'
  ],
};

// ─────────────────────────────────────────────────────────────
// Build reverse index at startup
// Every keyword maps back to its canonical topic key
// ─────────────────────────────────────────────────────────────
const KEYWORD_TO_TOPIC = {};
for (const [topic, keywords] of Object.entries(TOPIC_TAXONOMY)) {
  KEYWORD_TO_TOPIC[topic] = topic;
  for (const kw of keywords) {
    KEYWORD_TO_TOPIC[kw.toLowerCase()] = topic;
  }
}

// ─────────────────────────────────────────────────────────────
// Resolve a raw student message to a canonical topic
// Returns the best-matching canonical topic key, or null if unknown
// ─────────────────────────────────────────────────────────────
function resolveCanonicalTopic(message) {
  if (!message || typeof message !== 'string') return null;

  const cleaned = message.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words   = cleaned.split(/\s+/).filter(Boolean);
  const scores  = {};

  // Score single-word matches
  for (const word of words) {
    if (KEYWORD_TO_TOPIC[word]) {
      const canonical = KEYWORD_TO_TOPIC[word];
      scores[canonical] = (scores[canonical] || 0) + 1;
    }
  }

  // Score two-word bigram matches (higher weight — more specific)
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + ' ' + words[i + 1];
    if (KEYWORD_TO_TOPIC[bigram]) {
      const canonical = KEYWORD_TO_TOPIC[bigram];
      scores[canonical] = (scores[canonical] || 0) + 3;
    }
  }

  // Score three-word trigram matches (highest weight)
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = words[i] + ' ' + words[i + 1] + ' ' + words[i + 2];
    if (KEYWORD_TO_TOPIC[trigram]) {
      const canonical = KEYWORD_TO_TOPIC[trigram];
      scores[canonical] = (scores[canonical] || 0) + 5;
    }
  }

  if (Object.keys(scores).length === 0) return null;

  // Return the highest-scoring canonical topic
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];
}

// Get all topics in a subject area (for pre-warming suggestions)
function getTopicsInSubject(topic) {
  const subjects = {
    biology:    ['photosynthesis', 'cellular respiration', 'mitosis', 'meiosis',
                 'dna', 'evolution', 'ecosystems', 'human digestive system',
                 'human body systems', 'genetics and heredity', 'human circulatory system',
                 'human nervous system', 'plant biology', 'microorganisms'],
    chemistry:  ['atomic structure', 'periodic table', 'chemical bonding',
                 'chemical reactions', 'acids and bases', 'states of matter',
                 'organic chemistry', 'the mole', 'electrolysis'],
    physics:    ['gravity', 'newtons laws', 'electricity', 'waves',
                 'energy', 'magnetism', 'light', 'forces and motion',
                 'pressure', 'radioactivity', 'heat transfer', 'space and astronomy'],
    maths:      ['algebra', 'fractions', 'pythagoras theorem', 'trigonometry',
                 'quadratic equations', 'statistics', 'calculus', 'percentages',
                 'ratios and proportions', 'geometry', 'coordinate geometry',
                 'number sequences', 'indices and powers', 'probability'],
    history:    ['world war 1', 'world war 2', 'french revolution', 'industrial revolution',
                 'american revolution', 'ancient civilisations', 'civil rights movement', 'cold war'],
    english:    ['shakespeare', 'essay writing', 'poetry', 'grammar and punctuation',
                 'reading comprehension'],
    computer_science: ['sorting algorithms', 'binary', 'programming basics',
                       'data structures', 'computer networks', 'cybersecurity'],
    geography:  ['weather and climate', 'climate change', 'tectonic plates',
                 'rivers and water cycle', 'population and migration'],
    economics:  ['supply and demand', 'economic systems', 'money and banking'],
  };
  for (const [subject, topics] of Object.entries(subjects)) {
    if (topics.includes(topic)) {
      return topics.filter(t => t !== topic);
    }
  }
  return [];
}

module.exports = { resolveCanonicalTopic, getTopicsInSubject, TOPIC_TAXONOMY, KEYWORD_TO_TOPIC };
