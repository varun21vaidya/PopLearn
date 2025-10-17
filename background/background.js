/* global chrome */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'ilx-simplify', title: 'Interactive Learning: Simplify Article', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'ilx-mindmap', title: 'Interactive Learning: Build Mindmap', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'ilx-quiz', title: 'Interactive Learning: Test Knowledge', contexts: ['page'] });
});

async function sendToValidTab(message, candidateTab){
  try{
    let target = candidateTab;
    if(!target?.id || target.id < 0){
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      target = active;
    }
    if(!target?.id || target.id < 0) return; // no valid tab
    const url = target.url || '';
    if(!/^https?:/i.test(url)) return; // avoid chrome:// etc where content scripts can't run
    await chrome.tabs.sendMessage(target.id, message);
  }catch(e){ 
    console.error('Error sending message to tab:', e); // improved error logging
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if(info.menuItemId === 'ilx-simplify'){
    sendToValidTab({ type: 'ilx-action', action: 'simplify' }, tab);
  } else if(info.menuItemId === 'ilx-mindmap'){
    sendToValidTab({ type: 'ilx-action', action: 'mindmap' }, tab);
  } else if(info.menuItemId === 'ilx-quiz'){
    sendToValidTab({ type: 'ilx-action', action: 'quiz' }, tab);
  }
});


