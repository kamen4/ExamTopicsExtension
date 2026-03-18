chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchQuestion') {
    findQuestionBackground(request.exam, request.topic, request.question)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ url: null, error: error.message }));
    return true;
  }
});

let lastCaptchaOpenAt = 0;

function openCaptchaTab(url) {
  const now = Date.now();
  if (now - lastCaptchaOpenAt < 5000) {
    return;
  }

  lastCaptchaOpenAt = now;
  if (url) {
    chrome.tabs.create({ url });
  }
}

function isCaptchaPage(html, url) {
  if (!html) {
    return false;
  }

  const haystack = (html + ' ' + (url || '')).toLowerCase();
  const hasChallengeMarker =
    haystack.includes('cf-turnstile') ||
    haystack.includes('g-recaptcha') ||
    haystack.includes('hcaptcha') ||
    haystack.includes('cf-chl-widget') ||
    haystack.includes('cf-challenge') ||
    haystack.includes('challenge-form') ||
    haystack.includes('/cdn-cgi/') ||
    haystack.includes('recaptcha') ||
    haystack.includes('turnstile');

  const hasCaptchaPageContext =
    haystack.includes('cloudflare') ||
    haystack.includes('challenge') ||
    haystack.includes('captcha');

  return hasChallengeMarker && hasCaptchaPageContext;
}

async function findQuestionBackground(exam, topic, question) {
  try {
    let examCode = exam.toLowerCase().trim();
    const searchQuery = `site:examtopics.com "exam-${examCode}-topic-${topic}-question-${question}-discussion"`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.status === 403 || response.status === 429 || response.status === 503) {
      openCaptchaTab(response.url || searchUrl);
      return { url: null, captcha: true, captchaUrl: response.url || searchUrl };
    }

    if (!response.ok) {
      return { url: null, captcha: false };
    }

    const html = await response.text();

    if (isCaptchaPage(html, response.url)) {
      openCaptchaTab(response.url || searchUrl);
      return { url: null, captcha: true, captchaUrl: response.url || searchUrl };
    }

    const pattern = new RegExp(
      `href="(https:\/\/www\.examtopics\.com\/discussions\/[^"]*?-exam-${examCode.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}-topic-${topic}-question-${question}-discussion\/)"`,
      'i'
    );

    const match = pattern.exec(html);
    if (match && match[1]) {
      const url = match[1];
      return { url, captcha: false };
    }

    return { url: null, captcha: false };
  } catch (error) {
    console.error('Background search error:', error);
    return { url: null, captcha: false };
  }
}
