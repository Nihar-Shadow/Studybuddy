'use strict';

/**
 * Hybrid LLM Provider Layer for StudyBuddy
 * Automatically routes between Online Provider (OpenAI-compatible) and local Ollama.
 * Offline-first: Falls back to local Ollama on network loss, timeout, or provider failure.
 */

require('dotenv').config();
const { reasoningWithDraft } = require('../agent/models');

/**
 * Distinguishes payload/request size errors from standard rate limiting, timeouts, and network drops.
 */
function classifyOnlineError(err, status, bodyText = '') {
  const combined = `${err?.message || ''} ${bodyText || ''} ${err?.cause?.message || ''}`.toLowerCase();
  if (
    combined.includes('timeout') ||
    combined.includes('timed out') ||
    combined.includes('aborted') ||
    status === 504 ||
    status === 408
  ) {
    return 'timeout';
  }
  if (
    combined.includes('request too large') ||
    combined.includes('payload too large') ||
    combined.includes('request_too_large') ||
    combined.includes('context length') ||
    combined.includes('context_length') ||
    combined.includes('model maximum context') ||
    status === 413
  ) {
    return 'request_too_large';
  }
  if (
    status === 429 ||
    combined.includes('rate limit') ||
    combined.includes('rate_limit') ||
    combined.includes('too many requests')
  ) {
    return 'rate_limited';
  }
  return 'network_error';
}

class OllamaProvider {
  constructor(config = {}) {
    this._config = config;
    this.name = 'ollama';
  }

  get baseUrl() {
    return this._config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  get defaultModel() {
    return this._config.defaultModel || process.env.OLLAMA_DEFAULT_MODEL || 'qwen3:4b';
  }

  get odiaModel() {
    return this._config.odiaModel || process.env.OLLAMA_ODIA_MODEL || 'dhee-odia';
  }

  isConfigured() {
    return true; // Ollama is always available locally by design
  }

  async checkHealth(timeoutMs = 3000) {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  async generate({
    messages = [],
    language = 'English',
    model,
    stream = false,
    onToken = null,
    format = undefined,
    options = undefined,
    signal = null
  }) {
    const selectedModel = model || (language === 'Odia' ? this.odiaModel : this.defaultModel);
    const payload = {
      ...reasoningWithDraft(selectedModel),
      model: selectedModel,
      messages,
      stream,
      think: false,
      options: options || { temperature: 0.2, num_ctx: 4096 }
    };
    if (format) payload.format = format;

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    }

    if (!stream) {
      const data = await res.json();
      const raw = data.message?.content || '';
      const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim();
      return { text, provider: 'ollama', model: selectedModel };
    }

    // Stream handling (NDJSON)
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullReply = '';
    let insideThink = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          let token = chunk.message?.content || chunk.response || '';
          if (token) {
            fullReply += token;

            // Live-strip <think>
            if (insideThink) {
              const endIdx = token.indexOf('</think>');
              if (endIdx !== -1) {
                insideThink = false;
                token = token.slice(endIdx + '</think>'.length);
              } else {
                token = '';
              }
            }
            if (!insideThink) {
              const startIdx = token.indexOf('<think>');
              if (startIdx !== -1) {
                const before = token.slice(0, startIdx);
                const after = token.slice(startIdx + '<think>'.length);
                const endIdx = after.indexOf('</think>');
                if (endIdx !== -1) {
                  token = before + after.slice(endIdx + '</think>'.length);
                } else {
                  insideThink = true;
                  token = before;
                }
              }
            }

            if (token && typeof onToken === 'function') {
              onToken(token);
            }
          }
        } catch (_) {}
      }
    }

    const cleanText = fullReply.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim();
    return { text: cleanText, provider: 'ollama', model: selectedModel };
  }
}

class OnlineProvider {
  constructor(config = {}) {
    this._config = config;
    this.name = 'online';
  }

  get enabled() {
    return this._config.enabled ?? (process.env.ONLINE_LLM_ENABLED === 'true');
  }

  get baseUrl() {
    return this._config.baseUrl || process.env.ONLINE_LLM_BASE_URL || 'https://api.openai.com/v1';
  }

  get model() {
    return this._config.model || process.env.ONLINE_LLM_MODEL || 'gpt-4o-mini';
  }

  get apiKey() {
    return this._config.apiKey || process.env.ONLINE_LLM_API_KEY || '';
  }

  get timeoutMs() {
    return Number(this._config.timeoutMs || process.env.ONLINE_LLM_TIMEOUT_MS || 5000);
  }

  isConfigured() {
    return Boolean(this.enabled && this.apiKey && this.model);
  }

  getEndpoint() {
    let clean = (this.baseUrl || '').trim().replace(/\/+$/, '');
    if (!clean.endsWith('/chat/completions')) {
      clean += '/chat/completions';
    }
    return clean;
  }

  async checkHealth(timeoutMs = 3000) {
    if (!this.isConfigured()) return false;
    try {
      // Test basic connectivity to base URL or endpoint
      const rootUrl = this.baseUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '');
      const res = await fetch(`${rootUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        signal: AbortSignal.timeout(timeoutMs)
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  async generate({
    messages = [],
    model,
    stream = false,
    onToken = null,
    temperature = 0.2,
    signal = null,
    timeoutMs = null
  }) {
    if (!this.isConfigured()) {
      throw new Error('Online LLM provider is not configured (missing key, model, or disabled).');
    }

    const selectedModel = model || this.model;
    const endpoint = this.getEndpoint();
    const effectiveTimeout = Number(timeoutMs || this.timeoutMs);

    // Link caller signal with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error(`Online LLM timeout after ${effectiveTimeout}ms`));
    }, effectiveTimeout);

    if (signal) {
      if (signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    }

    try {
      const payload = {
        model: selectedModel,
        messages,
        temperature,
        stream
      };

      let res;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } catch (fetchErr) {
        if ((fetchErr.cause?.name === 'ConnectTimeoutError' || String(fetchErr.cause).includes('Connect Timeout Error')) && !controller.signal.aborted) {
          console.warn('[LLM] Handshake timeout on first attempt, retrying connection once...');
          res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
        } else {
          throw fetchErr;
        }
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        const errorType = classifyOnlineError(null, res.status, errBody);
        const err = new Error(`Online API error: ${res.status} ${res.statusText}${errBody ? ` - ${errBody.slice(0, 150)}` : ''}`);
        err.status = res.status;
        err.errorType = errorType;
        err.errBody = errBody;
        throw err;
      }

      if (!stream) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || '';
        const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim();
        return { text, provider: 'online', model: selectedModel };
      }

      // Stream handling (SSE: data: {...})
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullReply = '';
      let insideThink = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const chunk = JSON.parse(jsonStr);
            let token = chunk.choices?.[0]?.delta?.content || '';
            if (token) {
              fullReply += token;

              if (insideThink) {
                const endIdx = token.indexOf('</think>');
                if (endIdx !== -1) {
                  insideThink = false;
                  token = token.slice(endIdx + '</think>'.length);
                } else {
                  token = '';
                }
              }
              if (!insideThink) {
                const startIdx = token.indexOf('<think>');
                if (startIdx !== -1) {
                  const before = token.slice(0, startIdx);
                  const after = token.slice(startIdx + '<think>'.length);
                  const endIdx = after.indexOf('</think>');
                  if (endIdx !== -1) {
                    token = before + after.slice(endIdx + '</think>'.length);
                  } else {
                    insideThink = true;
                    token = before;
                  }
                }
              }

              if (token && typeof onToken === 'function') {
                onToken(token);
              }
            }
          } catch (_) {}
        }
      }

      const cleanText = fullReply.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim();
      return { text: cleanText, provider: 'online', model: selectedModel };
    } finally {
      clearTimeout(timer);
    }
  }
}

class HybridLLMProvider {
  constructor(options = {}) {
    this.onlineProvider = options.onlineProvider || new OnlineProvider(options.onlineConfig);
    this.ollamaProvider = options.ollamaProvider || new OllamaProvider(options.ollamaConfig);
    this.lastProviderUsed = null;
    this.lastFallbackOccurred = false;
  }

  isOnlineConfigured() {
    return this.onlineProvider.isConfigured();
  }

  getStatus() {
    const onlineConfigured = this.onlineProvider.isConfigured();
    let status = 'local';
    if (onlineConfigured) {
      if (this.lastFallbackOccurred) {
        status = 'online_fallback';
      } else if (this.lastProviderUsed === 'online') {
        status = 'online';
      } else {
        status = 'online';
      }
    }
    return {
      status,
      provider: this.lastProviderUsed || (onlineConfigured ? 'online' : 'ollama'),
      onlineConfigured,
      fallback: this.lastFallbackOccurred,
      model: this.lastProviderUsed === 'online' ? this.onlineProvider.model : this.ollamaProvider.defaultModel
    };
  }

  getProviderStatus() {
    return this.getStatus();
  }

  async generate(params) {
    const {
      language = 'English',
      task = 'chat',
      messages = [],
      model,
      temperature = 0.2,
      stream = false,
      onToken = null,
      format = undefined,
      options = undefined,
      signal = null,
      requestScope = null
    } = params;

    const effectiveLanguage = language;
    const isOdia = effectiveLanguage === 'Odia';
    const localModel = model || (isOdia ? this.ollamaProvider.odiaModel : this.ollamaProvider.defaultModel);

    // 0. Force local routing (e.g. after online request-size failure)
    if (params.forceLocal) {
      this.lastProviderUsed = 'ollama';
      this.lastFallbackOccurred = false;
      console.log(`[LLM]\nprovider=ollama\nreason=forced_local\ntask=${task}`);
      const ollamaResult = await this.ollamaProvider.generate({
        messages,
        language: effectiveLanguage,
        model: localModel,
        stream,
        onToken,
        format,
        options,
        signal
      });
      return {
        ...ollamaResult,
        provider: 'ollama',
        fallback: false
      };
    }

    // 0b. Request-scoped offline check: If already determined unavailable for this request, bypass online completely
    if (requestScope && requestScope.onlineUnavailable) {
      this.lastProviderUsed = 'ollama';
      this.lastFallbackOccurred = false;
      if (task === 'repair') {
        console.log(`[Odia Tutor Quality]\nrepair_provider=ollama\nreason=online_unavailable`);
      }
      console.log(`[Provider Routing]\nprovider=ollama\nreason=online_unavailable`);
      console.log(`[LLM]\nprovider=ollama\nlanguage=${effectiveLanguage}\nmodel=${localModel}\nfallback=false\ntask=${task}`);
      const ollamaResult = await this.ollamaProvider.generate({
        messages,
        language: effectiveLanguage,
        model: localModel,
        stream,
        onToken,
        format,
        options,
        signal
      });
      return {
        ...ollamaResult,
        provider: 'ollama',
        fallback: false
      };
    }

    // 1. Detailed request sizing analysis & pre-flight request size protection
    const userMsg = (messages || []).slice().reverse().find(m => m.role === 'user');
    const systemMsg = (messages || []).find(m => m.role === 'system');
    const historyMsgs = (messages || []).filter(m => m !== systemMsg && m !== userMsg);

    const userPromptSize = userMsg?.content ? userMsg.content.length : 0;
    const systemPromptSize = systemMsg?.content ? systemMsg.content.length : 0;
    const historySize = historyMsgs.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0);
    const curriculumContextSize = params.curriculumContextSize || 0;
    const maxRequestChars = Number(process.env.ONLINE_LLM_MAX_REQUEST_CHARS || 4500);
    const totalRequestChars = (messages || []).reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0);

    console.log(`[Request Sizing]\nuser_prompt_size=${userPromptSize}\nsystem_prompt_size=${systemPromptSize}\ncurriculum_context_size=${curriculumContextSize}\nconversation_history_size=${historySize}\nestimated_total_request_size=${totalRequestChars}`);

    if (this.onlineProvider.isConfigured() && (!requestScope || !requestScope.onlineUnavailable)) {
      console.log(`[Provider Routing]\nonline_available=unknown`);
    }

    if (this.onlineProvider.isConfigured() && totalRequestChars > maxRequestChars) {
      if (requestScope) {
        requestScope.onlineUnavailable = true;
        requestScope.reason = 'request_too_large';
      }
      console.log(`[Provider Routing]\nonline_available=false\nreason=request_too_large`);
      console.log(`[Provider Routing]\nprovider=ollama\nreason=online_unavailable`);
      console.log(`[LLM]\nprovider=ollama\nreason=online_request_too_large\ntask=${task}`);
      this.lastFallbackOccurred = true;
      this.lastProviderUsed = 'ollama';
      const ollamaResult = await this.ollamaProvider.generate({
        messages,
        language: effectiveLanguage,
        model: localModel,
        stream,
        onToken,
        format,
        options,
        signal
      });
      return {
        ...ollamaResult,
        provider: 'ollama',
        fallback: true,
        reason: 'online_request_too_large',
        errorType: 'request_too_large'
      };
    }

    // 2. Online provider attempt if configured
    if (this.onlineProvider.isConfigured()) {
      try {
        const quizTimeout = task === 'quiz' ? Math.max(60000, this.onlineProvider.timeoutMs) : undefined;
        const onlineResult = await this.onlineProvider.generate({
          messages,
          model: this.onlineProvider.model,
          temperature,
          stream,
          onToken,
          signal,
          timeoutMs: params.timeoutMs || quizTimeout
        });

        this.lastProviderUsed = 'online';
        this.lastFallbackOccurred = false;

        console.log(`[LLM]\nprovider=online\nlanguage=${effectiveLanguage}\nmodel=${onlineResult.model}\ntask=${task}`);

        return {
          ...onlineResult,
          provider: 'online',
          fallback: false
        };
      } catch (onlineErr) {
        const errorType = onlineErr.errorType || classifyOnlineError(onlineErr, onlineErr.status, onlineErr.errBody || onlineErr.message);
        if (requestScope) {
          requestScope.onlineUnavailable = true;
          requestScope.reason = errorType;
        }
        console.log(`[Provider Routing]\nonline_available=false\nreason=${errorType}`);
        console.log(`[Provider Routing]\nprovider=ollama\nreason=online_unavailable`);
        console.warn(`[LLM] Online provider error (${onlineErr.message}${onlineErr.cause ? ' - cause: ' + (onlineErr.cause.message || onlineErr.cause) : ''}). Automatically falling back to local Ollama.`);

        this.lastFallbackOccurred = true;
        this.lastProviderUsed = 'ollama';

        console.log(`[LLM]\nprovider=online\nerror_type=${errorType}\nfallback=ollama\ntask=${task}`);
        console.log(`[LLM]\nprovider=ollama\nlanguage=${effectiveLanguage}\nmodel=${localModel}\nfallback=true\ntask=${task}`);

        try {
          const ollamaResult = await this.ollamaProvider.generate({
            messages,
            language: effectiveLanguage,
            model: localModel,
            stream,
            onToken,
            format,
            options,
            signal
          });

          return {
            ...ollamaResult,
            provider: 'ollama',
            fallback: true,
            errorType,
            onlineError: onlineErr.message
          };
        } catch (ollamaErr) {
          throw new Error(`Both online provider (${onlineErr.message}) and local Ollama (${ollamaErr.message}) failed.`);
        }
      }
    }

    // 3. Direct Ollama execution when online is not configured
    this.lastProviderUsed = 'ollama';
    this.lastFallbackOccurred = false;

    console.log(`[LLM]\nprovider=ollama\nlanguage=${effectiveLanguage}\nmodel=${localModel}\nfallback=false\ntask=${task}`);

    const ollamaResult = await this.ollamaProvider.generate({
      messages,
      language: effectiveLanguage,
      model: localModel,
      stream,
      onToken,
      format,
      options,
      signal
    });

    return {
      ...ollamaResult,
      provider: 'ollama',
      fallback: false
    };
  }
}

// Default singleton instance
const defaultProvider = new HybridLLMProvider();

function createRequestScope() {
  return {
    onlineUnavailable: false,
    reason: null
  };
}

module.exports = {
  OllamaProvider,
  OnlineProvider,
  HybridLLMProvider,
  defaultProvider,
  llmProvider: defaultProvider,
  classifyOnlineError,
  createRequestScope,
  generate: (params) => defaultProvider.generate(params),
  getProviderStatus: () => defaultProvider.getStatus()
};
