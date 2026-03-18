function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status active ${type}`;
}

function clearStatus() {
    const statusEl = document.getElementById('status');
    statusEl.className = 'status';
}

async function checkCurrentPage() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            const url = tab.url || '';
            
            const match = url.match(/exam-(.+?)-topic-(\d+)-question-(\d+)-discussion/);
            
            if (match) {
                resolve({
                    isExamPage: true,
                    exam: match[1],
                    topic: parseInt(match[2]),
                    question: parseInt(match[3])
                });
            } else {
                resolve({ isExamPage: false });
            }
        });
    });
}

async function sendMessageToContent(action, data) {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action, ...data }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve(null);
                    } else {
                        resolve(response);
                    }
                });
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const pageInfo = await checkCurrentPage();

    if (!pageInfo.isExamPage) {
        document.getElementById('not-on-exam').classList.remove('is-hidden');
        document.getElementById('info-section').classList.add('is-hidden');
        document.getElementById('nav-buttons').classList.add('is-hidden');
        document.getElementById('input-section').classList.add('is-hidden');
        const openExamTopics = document.getElementById('open-examtopics');
        if (openExamTopics) {
            openExamTopics.addEventListener('click', () => {
                chrome.tabs.create({ url: 'https://www.examtopics.com' });
            });
        }
        return;
    }

    document.getElementById('exam-name').textContent = pageInfo.exam.toUpperCase();
    document.getElementById('current-topic').textContent = pageInfo.topic;
    document.getElementById('current-question').textContent = pageInfo.question;
    document.getElementById('topic-input').value = pageInfo.topic;
    document.getElementById('question-input').value = pageInfo.question;

    document.getElementById('info-section').classList.remove('is-hidden');
    document.getElementById('nav-buttons').classList.remove('is-hidden');
    document.getElementById('input-section').classList.remove('is-hidden');

    document.getElementById('btn-next').addEventListener('click', () => {
        showStatus('Searching...', 'info');
        sendMessageToContent('next-question', {
            topic: pageInfo.topic,
            question: pageInfo.question
        });
    });

    document.getElementById('btn-prev').addEventListener('click', () => {
        showStatus('Searching...', 'info');
        sendMessageToContent('prev-question', {
            topic: pageInfo.topic,
            question: pageInfo.question
        });
    });

    document.getElementById('btn-go').addEventListener('click', () => {
        const topic = parseInt(document.getElementById('topic-input').value);
        const question = parseInt(document.getElementById('question-input').value);

        if (isNaN(topic) || isNaN(question) || topic < 1 || question < 1) {
            showStatus('Invalid input', 'error');
            return;
        }

        showStatus('Searching...', 'info');
        sendMessageToContent('go-to-question', { topic, question });
    });

    document.getElementById('topic-input').addEventListener('focus', clearStatus);
    document.getElementById('question-input').addEventListener('focus', clearStatus);
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'status-update') {
        showStatus(request.message, request.status);
    }
});
