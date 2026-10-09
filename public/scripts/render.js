/**
 * typewriterEffect — types out text one character at a time, then reveals (removes blur)
 * @param {HTMLElement} element - The DOM element to type into (should have .typewriter-text)
 * @param {string} text - The text to type
 * @param {number} speed - ms per character (default 30)
 * @returns {Promise} Resolves when typing is complete
 */
function typewriterEffect(element, text, speed = 30) {
  return new Promise(resolve => {
    element.textContent = '';
    element.classList.remove('active-typing');
    let i = 0;
    function typeNext() {
      if (i < text.length) {
        element.textContent += text[i];
        i++;
        setTimeout(typeNext, speed);
      } else {
        element.classList.add('active-typing');
        resolve();
      }
    }
    typeNext();
  });
}
/**
 * renderResponse — Blur & Render pipeline entrypoint
 * Accepts a structured JSON object (steps, answer, etc) and renders cards/answer block.
 * Handles missing/partial data gracefully. Uses theme colors.
 */
function renderResponse(jsonData) {
  if (!jsonData || typeof jsonData !== 'object') {
    renderFormattedFallback('⚠️ No response data.');
    return;
  }
  // Defensive: allow both {steps, answer, ...} and {structured: {...}}
  const s = jsonData.structured && jsonData.structured.steps ? jsonData.structured : jsonData;
  if (s.steps && Array.isArray(s.steps)) {
    const converted = {
      intro: convertLatexToReadable(s.intro || ''),
      steps: s.steps.map(step => ({
        title: convertLatexToReadable(step.title || ''),
        text: convertLatexToReadable(step.text || ''),
        emoji: step.emoji || ''
      })),
      answer: convertLatexToReadable(s.answer || ''),
      followup: convertLatexToReadable(s.followup || '')
    };
    renderStructuredResponse(converted);
  } else if (s.socraticQuestion) {
    // Socratic agent: typewriter effect on the question
    const container = document.createElement('div');
    container.className = 'structured-response';
    const qEl = document.createElement('div');
    qEl.className = 'resp-answer';
    const twSpan = document.createElement('span');
    twSpan.className = 'typewriter-text';
    qEl.appendChild(twSpan);
    container.appendChild(qEl);
    chatEl.appendChild(container);
    scrollToBottom();
    typewriterEffect(twSpan, convertLatexToReadable(s.socraticQuestion), 22);
  } else if (s.answer) {
    // No steps, but has an answer — show as a single answer card with typewriter
    const container = document.createElement('div');
    container.className = 'structured-response';
    const answerEl = document.createElement('div');
    answerEl.className = 'resp-answer';
    const twSpan = document.createElement('span');
    twSpan.className = 'typewriter-text';
    answerEl.appendChild(twSpan);
    container.appendChild(answerEl);
    chatEl.appendChild(container);
    scrollToBottom();
    typewriterEffect(twSpan, convertLatexToReadable(s.answer), 22);
  } else {
    renderFormattedFallback('⚠️ No structured response.');
  }
}
/* LaTeX conversion, structured response rendering, vision rendering, fallback rendering */
// ============ LaTeX to Readable Conversion ============
function convertLatexToReadable(text) {
  if (!text) return text;

  return text
    // Remove malformed \text prefixes (e.g., \textH₂\textO → H₂O)
    .replace(/\\text([A-Za-z₀-₉])/g, '$1')
    // Remove \text{} wrappers entirely
    .replace(/\\text\{([^}]*)\}/g, '$1')
    // Fix subscript parentheses O₍₆₎ → O₆
    .replace(/([A-Za-z])₍(\d+)₎/g, (match, letter, digit) => {
      const subscriptMap = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
      return letter + digit.split('').map(d => subscriptMap[d] || d).join('');
    })
    // Chemical formulas: H_2O or H2O → H₂O
    .replace(/([A-Za-z])(\d+)/g, (match, letter, num) => {
      const subscriptMap = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
      return letter + num.split('').map(d => subscriptMap[d] || d).join('');
    })
    // Single subscripts: H_2 → H₂
    .replace(/_(\d+)/g, (match, digit) => {
      const subscriptMap = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
      return digit.split('').map(d => subscriptMap[d] || d).join('');
    })
    // Superscripts: ^2 → ²
    .replace(/\^(\d+)/g, (match, digit) => {
      const superscriptMap = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
      return digit.split('').map(d => superscriptMap[d] || d).join('');
    })
    // Greek letters: \alpha → α
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\pi/g, 'π')
    // Math operations
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    // Remove remaining LaTeX markers
    .replace(/\$/g, '')
    .replace(/\\\\/g, ' ')
    .replace(/[{}]/g, '');
}

// ============ Structured Response Rendering ============

// Store the last uploaded image for thumbnail display
let lastUploadedImageDataUrl = null;

function renderBotResponse(data, imageDataUrl = null) {
  // Guard: null/non-object data (e.g. network error before JSON arrives)
  if (!data || typeof data !== 'object') {
    addBubble('⚠️  Empty response from server. Please try again.', 'bot');
    return;
  }

  // Store image URL for vision responses
  if (imageDataUrl) {
    lastUploadedImageDataUrl = imageDataUrl;
  }
  
  // Check if this is a vision response (image analysis)
  if (data.isVision && data.structured && data.structured.visual_summary) {
    renderVisionResponse(data.structured, lastUploadedImageDataUrl);
    lastUploadedImageDataUrl = null; // Clear after use
    return;
  }
  
  // If structured JSON is available, render it as cards
  if (data.structured && data.structured.steps) {
    // Convert LaTeX in structured response
    const converted = {
      intro: convertLatexToReadable(data.structured.intro),
      steps: (data.structured.steps || []).map(step => ({
        title: convertLatexToReadable(step.title),
        text: convertLatexToReadable(step.text),
        emoji: step.emoji
      })),
      answer: convertLatexToReadable(data.structured.answer),
      followup: convertLatexToReadable(data.structured.followup)
    };
    renderStructuredResponse(converted);
  } else {
    // Fallback: render reply as formatted rich-text bubble
    renderFormattedFallback(data.reply || '');
  }
}

/**
 * renderFormattedFallback — Converts a raw markdown-ish reply into a nicely
 * formatted HTML bubble so advanced-mode plain-text responses aren't a wall of text.
 */
function renderFormattedFallback(raw) {
  // 1. Strip stray <think>…</think> blocks that leaked through
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Strip markdown code fences that wrap the entire reply
  text = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // 3. Try one last shot at parsing JSON — the server might have missed it
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text);
    if (parsed && parsed.steps) {
      const converted = {
        intro: convertLatexToReadable(parsed.intro || ''),
        steps: (parsed.steps || []).map(step => ({
          title: convertLatexToReadable(step.title || ''),
          text: convertLatexToReadable(step.text || ''),
          emoji: step.emoji || ''
        })),
        answer: convertLatexToReadable(parsed.answer || ''),
        followup: convertLatexToReadable(parsed.followup || '')
      };
      renderStructuredResponse(converted);
      return;
    }
  } catch (_) { /* not JSON — render as formatted text */ }

  // 4. Convert lightweight markdown → HTML
  let html = escapeHtml(text);

  // Code blocks (``` … ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g,
    '<pre class="fallback-code"><code>$2</code></pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="fallback-inline-code">$1</code>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Headers  ### → <h4>, ## → <h3>
  html = html.replace(/^### (.+)$/gm, '<h4 class="fallback-h">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="fallback-h">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h3 class="fallback-h">$1</h3>');
  // Unordered lists  - item  or * item
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul class="fallback-list">$1</ul>');
  // Merge adjacent <ul> blocks
  html = html.replace(/<\/ul>\s*<ul class="fallback-list">/g, '');
  // Numbered lists  1. item
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  // Paragraphs: double newline → <p>
  html = html.replace(/\n{2,}/g, '</p><p>');
  // Single newlines → <br>
  html = html.replace(/\n/g, '<br>');
  // Wrap in opening <p>
  html = '<p>' + html + '</p>';
  // Clean empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  // Convert any LaTeX
  html = convertLatexToReadable(html);

  addBubble(html, 'bot', true);
}

/**
 * renderVisionResponse - Renders the Vision Analysis Card with scanning animation
 * @param {Object} visionData - Structured vision data from backend
 * @param {string} imageDataUrl - Base64 data URL of the uploaded image
 */
function renderVisionResponse(visionData, imageDataUrl) {
  const theme = document.body.getAttribute('data-theme') || 'intermediate';
  
  // Theme-adaptive labels
  const labels = {
    beginner: {
      summary: '👀 What I See',
      extracted: '📝 Things I Found',
      steps: '🎯 Let\'s Learn!',
      solution: '⭐ The Answer!'
    },
    intermediate: {
      summary: '🔍 Visual Summary',
      extracted: '📋 Extracted Data',
      steps: '📖 Breakdown',
      solution: '✅ Solution'
    },
    advanced: {
      summary: 'VISUAL_ANALYSIS',
      extracted: 'INPUT_VARIABLES',
      steps: 'LOGIC_SEQUENCE',
      solution: 'OUTPUT'
    }
  };
  
  const currentLabels = labels[theme] || labels.intermediate;
  
  // Create main container
  const card = document.createElement('div');
  card.className = 'vision-analysis-card';
  card.setAttribute('data-theme', theme);
  
  // Add scanning overlay first (will be removed after animation)
  const scanning = document.createElement('div');
  scanning.className = 'vision-scanning';
  scanning.innerHTML = `
    <div class="vision-scanning-icon">🔬</div>
    <div class="vision-scanning-text">Scanning Image...</div>
    <div class="vision-scanning-bar"></div>
  `;
  card.appendChild(scanning);
  
  // Add micro-thumbnail if image available
  if (imageDataUrl) {
    const thumbnail = document.createElement('img');
    thumbnail.className = 'vision-thumbnail';
    thumbnail.src = imageDataUrl;
    thumbnail.alt = 'Uploaded image';
    thumbnail.loading = 'lazy';
    card.appendChild(thumbnail);
  }
  
  // Add card to chat immediately (shows scanning animation)
  chatEl.appendChild(card);
  scrollToBottom();
  
  // After scanning animation, reveal content
  setTimeout(() => {
    // Remove scanning overlay with fade
    scanning.style.animation = 'visionFadeIn 0.3s ease reverse forwards';
    setTimeout(() => scanning.remove(), 300);
    
    // Build content elements
    const contentElements = [];

    // Helper: wrap a section with a collapsible header + body
    function makeCollapsible(sectionEl, headerHtml, bodyHtml, startCollapsed = false) {
      const collapseId = 'vc-' + Math.random().toString(36).slice(2, 8);
      sectionEl.innerHTML = `
        <div class="vision-collapse-header" data-collapse-target="${collapseId}">
          ${headerHtml}
          <button class="vision-collapse-toggle${startCollapsed ? ' collapsed' : ''}" aria-label="Toggle section">▾</button>
        </div>
        <div id="${collapseId}" class="vision-collapsible${startCollapsed ? ' collapsed' : ''}">
          ${bodyHtml}
        </div>
      `;
      // Wire up click
      const header = sectionEl.querySelector('.vision-collapse-header');
      header.addEventListener('click', () => {
        const body = sectionEl.querySelector('.vision-collapsible');
        const btn = sectionEl.querySelector('.vision-collapse-toggle');
        const isCollapsed = body.classList.toggle('collapsed');
        btn.classList.toggle('collapsed', isCollapsed);
        // Scroll to bottom when expanding
        if (!isCollapsed) setTimeout(() => scrollToBottom(), 360);
      });
    }
    
    // 1. Visual Summary Section (always expanded, collapsible)
    if (visionData.visual_summary) {
      const summarySection = document.createElement('div');
      summarySection.className = 'vision-summary-section';
      const icon = theme === 'beginner' ? '👀' : (theme === 'advanced' ? '◉' : '🔍');
      makeCollapsible(summarySection,
        `<div class="vision-section-header" style="margin-bottom:0">
          <span class="icon">${icon}</span>
          <span>${currentLabels.summary}</span>
        </div>`,
        `<div class="vision-summary" style="margin-top:8px">${convertLatexToReadable(escapeHtml(visionData.visual_summary))}</div>`
      );
      summarySection.style.animation = 'visionFadeIn 0.4s ease forwards';
      contentElements.push(summarySection);
    }
    
    // 2. Extracted Data Section (collapsible)
    if (visionData.extracted_data && visionData.extracted_data.length > 0) {
      const extractedSection = document.createElement('div');
      extractedSection.className = 'vision-extracted-section';
      
      const headerIcon = theme === 'beginner' ? '📝' : (theme === 'advanced' ? '⟨⟩' : '📋');
      let itemsHtml = visionData.extracted_data.map(item => 
        `<div class="vision-extracted-item">${convertLatexToReadable(escapeHtml(item))}</div>`
      ).join('');
      
      makeCollapsible(extractedSection,
        `<div class="vision-section-header" style="margin-bottom:0">
          <span class="icon">${headerIcon}</span>
          <span>${currentLabels.extracted}</span>
        </div>`,
        `<div class="vision-extracted-data" style="margin-top:8px">${itemsHtml}</div>`
      );
      extractedSection.style.animation = 'visionFadeIn 0.4s ease 0.2s forwards';
      extractedSection.style.opacity = '0';
      contentElements.push(extractedSection);
    }
    
    // 3. Logic Steps Section (collapsible)
    if (visionData.logic_steps && visionData.logic_steps.length > 0) {
      const stepsSection = document.createElement('div');
      stepsSection.className = 'vision-steps-section';
      
      const stepsHeaderIcon = theme === 'beginner' ? '🎯' : (theme === 'advanced' ? '▶' : '📖');
      
      let stepsHtml = visionData.logic_steps.map((step, i) => `
        <div class="vision-step" style="animation-delay: ${0.3 + (i * 0.15)}s">
          <div class="vision-step-num">${step.step || i + 1}</div>
          <div class="vision-step-content">
            <div class="vision-step-title">${convertLatexToReadable(escapeHtml(step.title))}</div>
            <div class="vision-step-explanation">${convertLatexToReadable(escapeHtml(step.explanation))}</div>
          </div>
        </div>
      `).join('');
      
      makeCollapsible(stepsSection,
        `<div class="vision-section-header" style="margin-bottom:0">
          <span class="icon">${stepsHeaderIcon}</span>
          <span>${currentLabels.steps}</span>
        </div>`,
        `<div class="vision-logic-steps" style="margin-top:8px">${stepsHtml}</div>`
      );
      contentElements.push(stepsSection);
    }
    
    // 4. Final Solution Section (always expanded, collapsible)
    if (visionData.final_solution) {
      const solutionSection = document.createElement('div');
      solutionSection.className = 'vision-solution-section';
      
      const solutionIcon = theme === 'beginner' ? '⭐' : (theme === 'advanced' ? '◆' : '✅');
      const stepCount = visionData.logic_steps ? visionData.logic_steps.length : 0;
      const solutionDelay = 0.4 + (stepCount * 0.15);
      
      makeCollapsible(solutionSection,
        `<div class="vision-section-header" style="margin-bottom:0">
          <span class="icon">${solutionIcon}</span>
          <span>${currentLabels.solution}</span>
        </div>`,
        `<div class="vision-final-solution" style="margin-top:8px;animation-delay:${solutionDelay}s">
          ${convertLatexToReadable(escapeHtml(visionData.final_solution))}
        </div>`
      );
      contentElements.push(solutionSection);
    }
    
    // 5. Confidence Indicator
    if (visionData.confidence) {
      const confidenceSection = document.createElement('div');
      confidenceSection.className = 'vision-confidence';
      const confLevel = visionData.confidence.toLowerCase();
      const confText = {
        high: 'High confidence in analysis',
        medium: 'Medium confidence - verify key details',
        low: 'Low confidence - image may be unclear'
      };
      confidenceSection.innerHTML = `
        <span class="vision-confidence-dot ${confLevel}"></span>
        <span>${confText[confLevel] || confText.medium}</span>
      `;
      contentElements.push(confidenceSection);
    }
    
    // Append all content elements
    contentElements.forEach((el, i) => {
      card.appendChild(el);
    });
    
    // Scroll multiple times as staggered animations reveal content
    scrollToBottom();
    setTimeout(() => scrollToBottom(), 300);
    setTimeout(() => scrollToBottom(), 800);
    
  }, 1500); // Scanning animation duration
}

/**
 * createSkeletonLoader - Creates a "ghost" skeleton loader that mimics the structured response
 * This appears immediately when user hits "Send" while waiting for the actual response
 */
function createSkeletonLoader(stepCount = 3) {
  const container = document.createElement('div');
  container.className = 'skeleton-loader';
  container.setAttribute('data-skeleton', 'true');

  // Skeleton intro
  const introSkeleton = document.createElement('div');
  introSkeleton.className = 'skeleton-intro skeleton-block';
  container.appendChild(introSkeleton);

  // Skeleton steps (default 3, but adapt based on expected count)
  for (let i = 0; i < stepCount; i++) {
    const stepSkeleton = document.createElement('div');
    stepSkeleton.className = 'skeleton-step';

    const numSkeleton = document.createElement('div');
    numSkeleton.className = 'skeleton-step-num';

    const contentSkeleton = document.createElement('div');
    contentSkeleton.className = 'skeleton-step-content';

    const titleSkeleton = document.createElement('div');
    titleSkeleton.className = 'skeleton-step-title';

    const textSkeleton = document.createElement('div');
    textSkeleton.className = 'skeleton-step-text';

    const textSkeleton2 = document.createElement('div');
    textSkeleton2.className = 'skeleton-step-text';

    contentSkeleton.appendChild(titleSkeleton);
    contentSkeleton.appendChild(textSkeleton);
    contentSkeleton.appendChild(textSkeleton2);

    stepSkeleton.appendChild(numSkeleton);
    stepSkeleton.appendChild(contentSkeleton);

    container.appendChild(stepSkeleton);
  }

  // Skeleton answer pill
  const answerSkeleton = document.createElement('div');
  answerSkeleton.className = 'skeleton-answer skeleton-block';
  container.appendChild(answerSkeleton);

  return container;
}

/**
 * Removes skeleton loader and replaces it with actual content
 */
function removeSkeletonLoader(container) {
  const skeleton = container.querySelector('[data-skeleton="true"]');
  if (skeleton) {
    // Fade out skeleton
    skeleton.style.animation = 'skeleton-fade 0.3s ease forwards';
    setTimeout(() => skeleton.remove(), 300);
  }
}

/**
 * renderStructuredResponse - Renders structured JSON response with staggered animations
 * Now includes skeleton loader that shows immediately, then fades to actual content
 */
function renderStructuredResponse(s) {
  const theme = document.body.getAttribute('data-theme') || 'intermediate';
  const container = document.createElement('div');
  container.className = 'structured-response';
  container.setAttribute('data-theme', theme);
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 78%;
    align-self: flex-start;
  `;

  // Add skeleton loader immediately
  const skeleton = createSkeletonLoader(s.steps ? s.steps.length : 3);
  container.appendChild(skeleton);
  chatEl.appendChild(container);
  scrollToBottom();

  // Render actual content after a short delay (allows skeleton to be seen)
  setTimeout(() => {
    // Create actual content elements
    const contentElements = [];

    // 1. INTRO card
    if (s.intro) {
      const introEl = document.createElement('div');
      introEl.className = 'resp-intro animate-greeting';
      introEl.textContent = s.intro;
      introEl.style.setProperty('--delay', '0s');
      contentElements.push(introEl);
    }

    // 2. STEP cards — each staggered
    if (s.steps && s.steps.length > 0) {
      s.steps.forEach((step, i) => {
        const stepEl = document.createElement('div');
        stepEl.className = 'resp-step animate-in';
        // Stagger with 0.1s between each step
        const delay = (i + 1) * 0.1;
        stepEl.style.animationDelay = `${delay}s`;

        const numEl = document.createElement('div');
        numEl.className = 'resp-step-num';
        numEl.textContent = i + 1;

        const bodyEl = document.createElement('div');
        bodyEl.className = 'resp-step-body';

        const titleEl = document.createElement('div');
        titleEl.className = 'resp-step-title';
        titleEl.textContent = step.title;

        const textEl = document.createElement('div');
        textEl.className = 'resp-step-text';
        textEl.textContent = step.text;

        bodyEl.appendChild(titleEl);
        bodyEl.appendChild(textEl);

        // Emoji row — only shown if field is non-empty (beginner mode)
        if (step.emoji && step.emoji.trim() !== '') {
          const emojiEl = document.createElement('div');
          emojiEl.className = 'resp-step-emoji';
          emojiEl.textContent = step.emoji;
          bodyEl.appendChild(emojiEl);
        }

        stepEl.appendChild(numEl);
        stepEl.appendChild(bodyEl);
        contentElements.push(stepEl);
      });
    }

    // 3. ANSWER pill/card — final element with bounce scale and typewriter effect
    if (s.answer) {
      const answerEl = document.createElement('div');
      answerEl.className = 'resp-answer animate-bounce-scale';
      // Add typewriter-text span
      const twSpan = document.createElement('span');
      twSpan.className = 'typewriter-text';
      answerEl.appendChild(twSpan);
      // Answer appears after all steps, with bounce effect
      const delay = (s.steps ? s.steps.length : 0) * 0.1 + 0.2;
      answerEl.style.animationDelay = `${delay}s`;
      // Start typewriter after skeleton fade
      setTimeout(() => {
        typewriterEffect(twSpan, s.answer, 22);
      }, 350 + delay * 1000); // 350ms skeleton + animation delay
      contentElements.push(answerEl);
    }

    // 4. FOLLOW-UP note
    if (s.followup) {
      const followupEl = document.createElement('div');
      followupEl.className = 'resp-followup animate-in';
      followupEl.textContent = s.followup;
      const delay = (s.steps ? s.steps.length : 0) * 0.1 + 0.3;
      followupEl.style.animationDelay = `${delay}s`;
      contentElements.push(followupEl);
    }

    // Remove skeleton and add content
    removeSkeletonLoader(container);
    
    // Add all content elements to container
    contentElements.forEach(el => container.appendChild(el));
    
    // Scroll to bottom
    scrollToBottom();
  }, 300); // Let skeleton shimmer for 300ms
}
