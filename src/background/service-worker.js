const MENU_ID = "search-selected-reference";

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Search citation for selected text",
    contexts: ["selection"]
  });

  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) {
    return;
  }

  await chrome.storage.session.set({
    pendingReferenceQuery: info.selectionText.trim()
  });

  if (tab?.windowId !== undefined) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "pdf-tab-context") {
    getActiveTab()
      .then((tab) => resolvePdfContext(tab))
      .then((context) => sendResponse(context))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message
        });
      });
    return true;
  }

  if (message?.type === "consume-pending-reference-query") {
    chrome.storage.session
      .get("pendingReferenceQuery")
      .then(async ({ pendingReferenceQuery }) => {
        await chrome.storage.session.remove("pendingReferenceQuery");
        sendResponse({
          ok: true,
          query: pendingReferenceQuery || ""
        });
      });
    return true;
  }

  return false;
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  return tab;
}

async function resolvePdfContext(tab) {
  if (!tab?.id) {
    return { ok: false, error: "No active tab." };
  }

  const url = tab.url || "";
  return {
    ok: true,
    tabId: tab.id,
    title: tab.title || "",
    url,
    isLikelyPdf: isLikelyPdfUrl(url)
  };
}

function isLikelyPdfUrl(url) {
  if (!url) {
    return false;
  }

  if (url.toLowerCase().endsWith(".pdf")) {
    return true;
  }

  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}
