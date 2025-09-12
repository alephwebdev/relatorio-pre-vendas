// Minimal background to support action click toggling via messaging if needed in future
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['panel.js']
    });
  } catch (e) {
    // ignore
  }
});
