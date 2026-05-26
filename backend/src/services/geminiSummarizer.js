const https = require('https');

/**
 * Summarize an issue description for email using Gemini API if available.
 * Falls back to a simple heuristic summary when GEMINI_API_KEY is not set or on errors.
 *
 * @param {object} payload { title, description, address, latitude, longitude, categoryName }
 * @returns {Promise<string>} short summary (1-3 sentences)
 */
async function summarizeEmailDescription(payload) {
  const { GEMINI_API_KEY } = process.env;
  const safeFallback = buildFallbackSummary(payload);
  if (!GEMINI_API_KEY) return { summary: safeFallback, usedFallback: true };

  try {
    const prompt = buildPrompt(payload);
    const body = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 200,
      }
    });

    const options = {
      method: 'POST',
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(GEMINI_API_KEY),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const responseText = await httpRequest(options, body);
    const data = JSON.parse(responseText);

    // Parse candidate text
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    if (text && typeof text === 'string') {
      return { summary: trimToLength(text, 600), usedFallback: false };
    }
    return { summary: safeFallback, usedFallback: true };
  } catch (err) {
    // Fail safe
    return { summary: safeFallback, usedFallback: true };
  }
}

function buildPrompt({ title, description, address, latitude, longitude, categoryName }) {
  const loc = address ? `Location: ${address}` : (latitude && longitude ? `Location: (${latitude}, ${longitude})` : '');
  const cat = categoryName ? `Category: ${categoryName}` : '';
  return [
    'Summarize the following civic issue into 1-3 concise sentences suitable for an email to a municipal department.',
    'Focus on: what the issue is, where it is, and any urgency. Avoid extra formatting.',
    `Title: ${title || ''}`,
    cat,
    loc,
    'Details:',
    description || ''
  ].filter(Boolean).join('\n');
}

function buildFallbackSummary({ title, description, address }) {
  const base = [title, description].filter(Boolean).join(' - ');
  const withAddr = address ? `${base} (Location: ${address})` : base;
  return trimToLength(withAddr || 'Civic issue reported.', 300);
}

function trimToLength(str, max) {
  if (!str) return '';
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Gemini API HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { summarizeEmailDescription };