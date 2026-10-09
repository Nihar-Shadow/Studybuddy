/* Streak, due reviews, theme switching, estimate badge */
// ============ Streak + Due Reviews (loaded on start) ============
async function loadStreak() {
  try {
    const res  = await fetch('/streak');
    const data = await res.json();
    const badge = document.getElementById('streak-badge');
    const count = document.getElementById('streak-count');
    if (data.current >= 1) {
      count.textContent = data.current;
      badge.style.display = 'flex';
      if (data.current >= 3) badge.classList.add('hot');
    }
  } catch (e) { /* streak is cosmetic, fail silently */ }

  // Show progress + evaluation buttons if student has any recorded activity
  try {
    const res  = await fetch('/progress');
    const data = await res.json();
    if (data.totalTopicsStudied > 0) {
      const pBtn = document.getElementById('progress-btn');
      const eBtn = document.getElementById('evaluation-btn');
      if (pBtn) pBtn.style.display = '';
      if (eBtn) eBtn.style.display = '';
    }
  } catch (e) { /* non-critical */ }
}

async function loadDueReviews() {
  try {
    const res  = await fetch('/due-reviews');
    const data = await res.json();
    if (data.reviews && data.reviews.length > 0) {
      const banner = document.createElement('div');
      banner.className = 'due-reviews-banner';
      const names = data.reviews.slice(0, 3).map(r => r.name).join(', ');
      const extra = data.reviews.length > 3 ? ` +${data.reviews.length - 3} more` : '';
      banner.innerHTML = `
        <span>📅 <strong>${data.reviews.length} topic${data.reviews.length > 1 ? 's' : ''} due for review:</strong> ${names}${extra}</span>
        <button onclick="startDueReview(this.parentElement)">Review now →</button>
      `;
      chatEl.appendChild(banner);
    }
  } catch (e) { /* fail silently */ }
}

function startDueReview(banner) {
  banner.remove();
  addBubble('Great! Let\'s review. Pick a topic from the list above and ask me to quiz you on it, or just say "Quiz me on [topic name]".', 'bot');
}

// ============ Theme Switching ============
function applyTheme(theme) {
  // Apply theme immediately for smooth CSS variable transitions
  document.body.setAttribute('data-theme', theme);
  
  // Update PWA theme-color meta tag to match the theme
  const themeColors = {
    beginner: '#A8E6CF',
    intermediate: '#6C63FF',
    advanced: '#00D2FF'
  };
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', themeColors[theme] || themeColors.intermediate);
  }

  // Show system message based on theme
  const messages = {
    beginner: "� Safety Zone activated! Soft colors, friendly vibes.",
    intermediate: "� Focus Flow engaged! Clean and modern.",
    advanced: "⚡ Mastery Peak unlocked! Sharp, pro-tool aesthetic."
  };
  
  const bubble = addBubble(messages[theme], 'system');
  bubble.classList.add('system-msg');
}

function showEstimateBadge(estimate) {
  const badge = document.createElement('div');
  badge.className = 'estimate-badge';
  badge.innerHTML = `
    <div class="estimate-value">${estimate.label}</div>
    <div class="estimate-complexity">${estimate.complexity}</div>
  `;
  // Append to body for proper fixed positioning (avoids z-index issues in chat container)
  document.body.appendChild(badge);

  let remaining = estimate.seconds;
  const interval = setInterval(() => {
    remaining--;
    const valueDiv = badge.querySelector('.estimate-value');
    if (valueDiv) {
      valueDiv.textContent = remaining > 0 ? `${remaining}s` : '⏱ Processing...';
    }
    
    if (remaining <= 0) {
      clearInterval(interval);
    }
  }, 1000);

  /**
   * Method to trigger the "countdown to reality" transition:
   * Shrinks and fades the badge while the first content element fades in
   * This creates a psychological "transition" from estimate to actual response
   */
  badge.triggerShrinkFade = function() {
    this.classList.add('shrink-fade');
    setTimeout(() => {
      if (this.parentNode) {
        this.remove();
      }
    }, 400);
  };

  return { badge, interval };
}
