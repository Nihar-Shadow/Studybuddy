'use strict';

const http = require('http');
const { shouldShowPracticeCTA } = require('../public/scripts/agent');

const BASE_URL = 'http://localhost:3000';

function postJson(path, body, cookie = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(`${BASE_URL}${path}`, {
      method: 'POST',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let setCookie = res.headers['set-cookie'];
        if (Array.isArray(setCookie)) setCookie = setCookie.map(c => c.split(';')[0]).join('; ');
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), cookie: setCookie });
        } catch (_) {
          resolve({ status: res.statusCode, raw: data, cookie: setCookie });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function streamChat(message, language = 'English', cookie = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ message, language, level: 'beginner' });
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(`${BASE_URL}/chat`, {
      method: 'POST',
      headers
    }, (res) => {
      let sseData = '';
      let finalEvent = null;

      res.on('data', chunk => {
        sseData += chunk.toString();
        const lines = sseData.split('\n');
        sseData = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed.done) finalEvent = parsed;
            } catch (_) {}
          }
        }
      });
      res.on('end', () => {
        if (sseData && sseData.trim().startsWith('data: ')) {
          try {
            const parsed = JSON.parse(sseData.trim().slice(6));
            if (parsed.done) finalEvent = parsed;
          } catch (_) {}
        }
        resolve(finalEvent);
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const loginRes = await postJson('/auth/login', { pin: '1234', studentName: 'TestStudent' });
  const cookie = loginRes.cookie;

  const queries = [
    { q: 'What is reproduction?', lang: 'English' },
    { q: 'What is force?', lang: 'English' },
    { q: 'What is motion?', lang: 'English' },
    { q: "ପ୍ରଜନନ କ'ଣ?", lang: 'Odia' },
    { q: "ବଳ କ'ଣ?", lang: 'Odia' },
    { q: "ଗତି କ'ଣ?", lang: 'Odia' }
  ];

  for (const item of queries) {
    console.log(`\n====================================================`);
    console.log(`QUERY: "${item.q}" (${item.lang})`);
    const ev = await streamChat(item.q, item.lang, cookie);
    const structured = ev ? ev.structured : null;
    const ctaAppeared = structured ? shouldShowPracticeCTA(structured) : false;

    console.log('detected language:', item.lang);
    console.log('topic:', structured ? structured.currentTopic : null);
    console.log('concept:', structured ? structured.currentConcept : null);
    console.log('knowledgeFound:', structured ? structured.knowledgeFound : false);
    console.log('nextStudy:', structured ? JSON.stringify(structured.nextStudy) : null);
    console.log('CTA appeared:', ctaAppeared);
  }
}

main().catch(console.error);
