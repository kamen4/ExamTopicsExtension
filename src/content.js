function initPopupRemover() {
  document.getElementById('notRemoverPopup')?.remove();
  if (document.body) {
    new MutationObserver(() => document.getElementById('notRemoverPopup')?.remove())
      .observe(document.body, { childList: true, subtree: true, attributes: true });
  }
}

function parseExamUrl() {
  const url = window.location.href;
  const match = url.match(/exam-(.+?)-topic-(\d+)-question-(\d+)-discussion/);
  
  if (match) {
    return {
      exam: match[1],
      topic: parseInt(match[2]),
      question: parseInt(match[3]),
      success: true
    };
  }
  
  return { success: false };
}

function createNavigationUI() {
  const container = document.createElement('div');
  container.id = 'exam-topics-navigator';
  container.className = 'etn-panel';

  const info = parseExamUrl();
  
  if (!info.success) {
    container.innerHTML = '<p class="etn-error">Could not parse exam page</p>';
    return container;
  }

  container.innerHTML = `
    <div id="panel-header" class="etn-header">
      <strong class="etn-title">ExamTopics Navigator</strong>
      <div class="etn-actions">
        <button id="hide-panel" class="etn-btn etn-btn-small">Hide</button>
      </div>
    </div>
    <div id="panel-body">
    <div class="etn-section">
      <div class="etn-meta">
        Exam: <strong>${info.exam}</strong><br>
        Topic: <strong id="current-topic">${info.topic}</strong><br>
        Question: <strong id="current-question">${info.question}</strong>
      </div>
    </div>
    <div class="etn-grid-2 etn-section">
      <button id="prev-q" class="etn-btn">Previous</button>
      <button id="next-q" class="etn-btn etn-btn-primary">Next</button>
    </div>
    <div class="etn-section">
      <div class="etn-grid-2 etn-row">
        <div>
          <label class="etn-label">Topic:</label>
          <input type="number" id="input-topic" value="${info.topic}" class="etn-input">
        </div>
        <div>
          <label class="etn-label">Question:</label>
          <input type="number" id="input-question" value="${info.question}" class="etn-input">
        </div>
      </div>
      <button id="go-to" class="etn-btn etn-btn-success etn-btn-wide">Go To</button>
    </div>
    <div id="status" class="etn-status"></div>
    </div>
  `;

  return container;
}

function showCaptchaMessage(target, captchaUrl) {
  if (!target) {
    return;
  }

  const openUrl = captchaUrl || 'https://www.examtopics.com';

  target.innerHTML = 'Captcha detected. Complete it in the opened tab, then retry.<br><br>' +
    '<button id="open-examtopics-btn" class="etn-captcha-btn">Open Captcha</button>';
  target.classList.add('etn-captcha');

  document.getElementById('open-examtopics-btn')?.addEventListener('click', () => {
    window.open(openUrl, '_blank');
  });
}

function createPanelToggleButton() {
  const toggle = document.createElement('div');
  toggle.id = 'exam-topics-toggle';
  toggle.className = 'etn-toggle';

  toggle.textContent = 'Open';
  return toggle;
}

function getActivePanel() {
  return document.getElementById('exam-topics-navigator') || document.getElementById('exam-topics-input');
}

function setPanelState(state) {
  const panel = getActivePanel();
  const toggle = document.getElementById('exam-topics-toggle');
  const body = panel ? panel.querySelector('#panel-body') : null;
  const header = panel ? panel.querySelector('#panel-header') : null;

  if (!panel || !toggle) {
    return;
  }

  if (state === 'open') {
    panel.style.display = 'block';
    toggle.style.display = 'none';
    if (body) {
      body.style.display = 'block';
    }
    if (header) {
      header.style.marginBottom = '12px';
    }
    panel.style.minWidth = '280px';
  } else {
    panel.style.display = 'none';
    toggle.style.display = 'flex';
  }

  localStorage.setItem('examtopics-panel-state', state);
}

function createExamInputUI() {
  const container = document.createElement('div');
  container.id = 'exam-topics-input';
  container.className = 'etn-panel';

  container.innerHTML = `
    <div id="panel-header" class="etn-header">
      <strong class="etn-title">ExamTopics Navigator</strong>
      <div class="etn-actions">
        <button id="hide-panel" class="etn-btn etn-btn-small">Hide</button>
      </div>
    </div>
    <div id="panel-body">
    <div class="etn-section">
      <div class="etn-row">
        <label class="etn-label">Exam Code (e.g. az-900, mb-820):</label>
        <input type="text" id="exam-code-input" placeholder="az-900" class="etn-input etn-input-lg">
      </div>
      <div class="etn-grid-2 etn-row">
        <div>
          <label class="etn-label">Topic:</label>
          <input type="number" id="exam-topic-input" value="1" min="1" class="etn-input">
        </div>
        <div>
          <label class="etn-label">Question:</label>
          <input type="number" id="exam-question-input" value="1" min="1" class="etn-input">
        </div>
      </div>
      <button id="go-to-exam" class="etn-btn etn-btn-success etn-btn-wide">Go To Exam</button>
    </div>
    <div id="exam-status" class="etn-status"></div>
    </div>
  `;

  return container;
}

async function findQuestion(exam, topic, question) {
  try {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'searchQuestion', exam, topic, question },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Message error:', chrome.runtime.lastError);
            resolve({ url: null, captcha: false });
          } else {
            const captcha = Boolean(response && response.captcha);
            const captchaUrl = response && response.captchaUrl ? response.captchaUrl : null;
            const url = response && response.url ? response.url : null;
            resolve({ url, captcha, captchaUrl });
          }
        }
      );
    });
  } catch (error) {
    console.error('Search error:', error);
    return { url: null, captcha: false, captchaUrl: null };
  }
}

async function navigateToQuestion(topic, question) {
  const statusDiv = document.getElementById('status');
  const info = parseExamUrl();
  
  if (!info.success) {
    statusDiv.textContent = 'Error: Could not parse current page';
    statusDiv.style.color = '#d13438';
    return;
  }

  statusDiv.textContent = 'Searching...';
  statusDiv.style.color = '#0078d4';

  let currentTopic = topic;
  let found = null;

  for (let i = 1; i <= 3; i++) {
    const searchQuestion = question + i;
    const result = await findQuestion(info.exam, currentTopic, searchQuestion);
    if (result.captcha) {
      showCaptchaMessage(statusDiv, result.captchaUrl);
      return;
    }

    found = result.url;
    if (found) {
      break;
    }
  }

  if (!found) {
    currentTopic++;
    const result = await findQuestion(info.exam, currentTopic, 1);
    if (result.captcha) {
      showCaptchaMessage(statusDiv, result.captchaUrl);
      return;
    }

    found = result.url;
  }

  if (found) {
    statusDiv.textContent = 'Found! Loading...';
    statusDiv.style.color = '#107c10';
    setTimeout(() => {
      window.location.href = found;
    }, 500);
  } else {
    statusDiv.textContent = 'Last question reached!';
    statusDiv.style.color = '#d13438';
  }
}

async function navigateToPreviousQuestion(topic, question) {
  const statusDiv = document.getElementById('status');
  const info = parseExamUrl();
  
  if (!info.success) {
    statusDiv.textContent = 'Error: Could not parse current page';
    statusDiv.style.color = '#d13438';
    return;
  }

  statusDiv.textContent = 'Searching...';
  statusDiv.style.color = '#0078d4';

  let currentTopic = topic;
  let found = null;

  for (let i = 1; i <= 3; i++) {
    const searchQuestion = question - i;
    if (searchQuestion < 1) break;
    
    const result = await findQuestion(info.exam, currentTopic, searchQuestion);
    if (result.captcha) {
      showCaptchaMessage(statusDiv, result.captchaUrl);
      return;
    }

    found = result.url;
    if (found) {
      break;
    }
  }

  if (!found && currentTopic > 1) {
    currentTopic--;
    for (let q = 100; q >= 1; q--) {
      const result = await findQuestion(info.exam, currentTopic, q);
      if (result.captcha) {
        showCaptchaMessage(statusDiv, result.captchaUrl);
        return;
      }

      found = result.url;
      if (found) {
        break;
      }
    }
  }

  if (found) {
    statusDiv.textContent = 'Found! Loading...';
    statusDiv.style.color = '#107c10';
    setTimeout(() => {
      window.location.href = found;
    }, 500);
  } else {
    statusDiv.textContent = 'First question reached!';
    statusDiv.style.color = '#d13438';
  }
}

async function navigateToExactQuestion(topic, question) {
  const statusDiv = document.getElementById('status');
  const info = parseExamUrl();

  if (!info.success) {
    statusDiv.textContent = 'Error: Could not parse current page';
    statusDiv.style.color = '#d13438';
    return;
  }

  statusDiv.textContent = 'Searching...';
  statusDiv.style.color = '#0078d4';

  const result = await findQuestion(info.exam, topic, question);
  if (result.captcha) {
    showCaptchaMessage(statusDiv, result.captchaUrl);
    return;
  }

  if (result.url) {
    statusDiv.textContent = 'Found! Loading...';
    statusDiv.style.color = '#107c10';
    setTimeout(() => {
      window.location.href = result.url;
    }, 500);
  } else {
    statusDiv.textContent = 'Question not found';
    statusDiv.style.color = '#d13438';
  }
}

async function navigateToExam(exam, topic, question) {
  const statusDiv = document.getElementById('exam-status');
  
  if (!exam || exam.trim() === '') {
    statusDiv.innerHTML = 'Please enter exam code';
    statusDiv.style.color = '#d13438';
    return;
  }

  if (topic < 1 || question < 1) {
    statusDiv.innerHTML = 'Invalid topic or question';
    statusDiv.style.color = '#d13438';
    return;
  }

  statusDiv.innerHTML = 'Searching...';
  statusDiv.style.color = '#0078d4';

  const firstResult = await findQuestion(exam, topic, question);
  if (firstResult.captcha) {
    showCaptchaMessage(statusDiv, firstResult.captchaUrl);
    return;
  }

  let found = firstResult.url;
  if (!found) {
    for (let i = 1; i <= 3; i++) {
      const result = await findQuestion(exam, topic, question + i);
      if (result.captcha) {
        showCaptchaMessage(statusDiv, result.captchaUrl);
        return;
      }

      found = result.url;
      if (found) {
        break;
      }
    }
  }

  if (!found) {
    const result = await findQuestion(exam, topic + 1, 1);
    if (result.captcha) {
      showCaptchaMessage(statusDiv, result.captchaUrl);
      return;
    }

    found = result.url;
  }

  if (found) {
    statusDiv.innerHTML = 'Found! Loading...';
    statusDiv.style.color = '#107c10';
    setTimeout(() => {
      window.location.href = found;
    }, 500);
  } else {
    statusDiv.innerHTML = `
      Exam not found. This extension only works on examtopics.com<br><br>
      <button id="go-examtopics-btn" class="etn-action-btn">Visit ExamTopics.com</button>
    `;
    statusDiv.style.color = '#d13438';
    document.getElementById('go-examtopics-btn')?.addEventListener('click', () => {
      window.location.href = 'https://www.examtopics.com';
    });
  }
}

function initializeUI() {
  initPopupRemover();
  const info = parseExamUrl();
  
  if (info.success) {
    const ui = createNavigationUI();
    document.body.appendChild(ui);

    const toggle = createPanelToggleButton();
    document.body.appendChild(toggle);

    document.getElementById('hide-panel')?.addEventListener('click', () => {
      setPanelState('hidden');
    });

    toggle.addEventListener('click', () => {
      setPanelState('open');
    });

    document.getElementById('next-q')?.addEventListener('click', () => {
      navigateToQuestion(info.topic, info.question);
    });

    document.getElementById('prev-q')?.addEventListener('click', () => {
      navigateToPreviousQuestion(info.topic, info.question);
    });

    document.getElementById('go-to')?.addEventListener('click', () => {
      const topic = parseInt(document.getElementById('input-topic').value);
      const question = parseInt(document.getElementById('input-question').value);
      
      if (isNaN(topic) || isNaN(question) || topic < 1 || question < 1) {
        document.getElementById('status').textContent = 'Invalid input';
        document.getElementById('status').style.color = '#d13438';
        return;
      }

      navigateToExactQuestion(topic, question);
    });

    document.getElementById('input-topic')?.addEventListener('change', (e) => {
      document.getElementById('input-topic').value = Math.max(1, parseInt(e.target.value) || 1);
    });

    document.getElementById('input-question')?.addEventListener('change', (e) => {
      document.getElementById('input-question').value = Math.max(1, parseInt(e.target.value) || 1);
    });
  } else {
    const ui = createExamInputUI();
    document.body.appendChild(ui);

    const toggle = createPanelToggleButton();
    document.body.appendChild(toggle);

    document.getElementById('hide-panel')?.addEventListener('click', () => {
      setPanelState('hidden');
    });

    toggle.addEventListener('click', () => {
      setPanelState('open');
    });

    document.getElementById('go-to-exam')?.addEventListener('click', () => {
      const exam = document.getElementById('exam-code-input').value.trim();
      const topic = parseInt(document.getElementById('exam-topic-input').value);
      const question = parseInt(document.getElementById('exam-question-input').value);
      
      navigateToExam(exam, topic, question);
    });

    document.getElementById('exam-code-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('go-to-exam').click();
      }
    });

    document.getElementById('exam-topic-input')?.addEventListener('change', (e) => {
      document.getElementById('exam-topic-input').value = Math.max(1, parseInt(e.target.value) || 1);
    });

    document.getElementById('exam-question-input')?.addEventListener('change', (e) => {
      document.getElementById('exam-question-input').value = Math.max(1, parseInt(e.target.value) || 1);
    });
  }

  const savedState = localStorage.getItem('examtopics-panel-state');
  if (savedState === 'hidden') {
    setPanelState(savedState);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUI);
} else {
  initializeUI();
}

window.addEventListener('load', () => {
  if (!document.getElementById('exam-topics-navigator') && !document.getElementById('exam-topics-input')) {
    initializeUI();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) {
    return;
  }

  if (request.action === 'next-question') {
    navigateToQuestion(request.topic, request.question + 1);
  }

  if (request.action === 'prev-question') {
    navigateToPreviousQuestion(request.topic, request.question);
  }

  if (request.action === 'go-to-question') {
    navigateToExactQuestion(request.topic, request.question);
  }
});
