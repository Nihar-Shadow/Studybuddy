/* Facts loading screen, skeleton loader */
// ============ Engaging Facts Loading Screen ============
const learningFacts = [
  "🧠 Your brain uses 20% of your body's total energy!",
  "🌍 Earth's core is as hot as the surface of the Sun — about 5,500°C!",
  "🐙 Octopuses have three hearts and blue blood!",
  "📚 The Library of Alexandria once held 400,000 scrolls of knowledge!",
  "🔬 A single human cell contains about 6 feet of DNA!",
  "🌊 The ocean produces over 50% of the world's oxygen!",
  "🦋 Butterflies taste with their feet!",
  "⚡ Lightning strikes Earth about 8 million times per day!",
  "🌙 The Moon is slowly drifting away from Earth at 3.8 cm per year!",
  "🧮 Zero was invented independently in India and by the Mayans!",
  "🎵 Music can reduce stress hormones by up to 25%!",
  "🌳 Trees communicate through underground fungal networks!",
  "🔭 Light from the Sun takes 8 minutes to reach Earth!",
  "🧬 Humans share 60% of their DNA with bananas!",
  "📖 Reading for just 6 minutes can reduce stress by 68%!",
  "🦠 Your body has more bacteria than human cells!",
  "🌌 There are more stars in the universe than grains of sand on Earth!",
  "🧊 Hot water freezes faster than cold water (Mpemba effect)!",
  "🐋 A blue whale's heart is the size of a small car!",
  "🎨 Van Gogh only sold one painting during his lifetime!",
  "🏔️ Mount Everest grows about 4mm taller every year!",
  "🦷 Tooth enamel is the hardest substance in the human body!",
  "🌸 Honey never spoils — 3,000-year-old honey is still edible!",
  "🦑 Giant squid have the largest eyes in the animal kingdom!",
  "📱 The first computer weighed over 27 tons!"
];

let factsContainer = null;
let factsInterval = null;
let currentFactIndex = 0;

function showFactsLoading() {
  // Remove any existing facts container
  hideFactsLoading();

  // Shuffle and pick a random starting index
  currentFactIndex = Math.floor(Math.random() * learningFacts.length);

  factsContainer = document.createElement('div');
  factsContainer.className = 'facts-loading-container fade-in';
  factsContainer.innerHTML = `
    <div class="facts-loading-icon">🧠</div>
    <div class="facts-loading-label">Did you know?</div>
    <div class="facts-loading-text">${learningFacts[currentFactIndex]}</div>
    <div class="facts-loading-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <div class="facts-loading-progress">
      <div class="facts-loading-progress-bar"></div>
    </div>
  `;

  chatEl.appendChild(factsContainer);
  scrollToBottom();

  // Rotate facts every 7 seconds so users can read them
  factsInterval = setInterval(() => {
    currentFactIndex = (currentFactIndex + 1) % learningFacts.length;
    const textEl = factsContainer.querySelector('.facts-loading-text');
    if (textEl) {
      textEl.style.opacity = '0';
      textEl.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        textEl.textContent = learningFacts[currentFactIndex];
        textEl.style.opacity = '1';
        textEl.style.transform = 'translateY(0)';
      }, 300);
    }
  }, 7000);

  return factsContainer;
}

function hideFactsLoading() {
  if (factsInterval) {
    clearInterval(factsInterval);
    factsInterval = null;
  }
  if (factsContainer && factsContainer.parentNode) {
    factsContainer.classList.remove('fade-in');
    factsContainer.classList.add('fade-out');
    setTimeout(() => {
      if (factsContainer && factsContainer.parentNode) {
        factsContainer.remove();
      }
      factsContainer = null;
    }, 300);
  }
}
