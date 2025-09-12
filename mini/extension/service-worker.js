// On action click, toggle the panel: ensure content script is present, then send a toggle message
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    // First try to send a toggle; if receiver is missing, inject the script then toggle.
    await chrome.tabs.sendMessage(tab.id, { type: 'rpv-toggle' });
  } catch (_) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['panel.js'] });
      await chrome.tabs.sendMessage(tab.id, { type: 'rpv-toggle' });
    } catch (e) {
      // ignore final failure
    }
  }
});
