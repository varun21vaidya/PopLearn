/* global chrome */

async function sendActionToActiveTab(action){
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if(!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, { type: 'ilx-action', action });
  } catch (e) {
    console.error('Failed to send action:', action, e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('simplify').addEventListener('click', ()=>sendActionToActiveTab('simplify'));
  document.getElementById('mindmap').addEventListener('click', ()=>sendActionToActiveTab('mindmap'));
  document.getElementById('quiz').addEventListener('click', ()=>sendActionToActiveTab('quiz'));
});

// Add aria-labels to buttons for accessibility in popup.html

