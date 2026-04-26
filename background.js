/**
 * @fileoverview JiraSnap Background Service Worker (MV3).
 * Acts as the communication hub between popup and content script.
 * Handles extension lifecycle events and message routing.
 *
 * @author Ing. Gustavo Gutierrez — Bogotá, Colombia
 */

// ─── Service Worker Lifecycle ───────────────────────────────────────────────────

/**
 * Fired when the extension is first installed or updated.
 * @param {chrome.runtime.InstalledDetails} details
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First-time install: set default preferences
    chrome.storage.local.set({
      jiraSnapLang: 'es',
      jiraSnapVersion: '1.0.0'
    });
    console.log('[JiraSnap] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[JiraSnap] Extension updated');
  }
});

/**
 * Fired when the service worker starts up.
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('[JiraSnap] Service worker started');
});

// ─── Message Routing ───────────────────────────────────────────────────────────

/**
 * Handle messages from popup and content scripts.
 * In this extension, the popup talks to the content script directly
 * via chrome.tabs.sendMessage. This handler can intercept for coordination.
 *
 * @param {chrome.runtime.Message} message
 * @param {chrome.runtime.MessageSender} sender
 * @param {Function} sendResponse
 * @returns {boolean}
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'background') {
    sendResponse({ received: true });
    return true;
  }
  // Let other messages pass through
  return false;
});

// ─── Storage Helpers (non-module syntax for MV3 service worker) ───────────────

/**
 * Get a stored preference.
 * @param {string} key
 * @param {*} defaultValue
 * @param {function(*):void} callback
 */
function getPref(key, defaultValue, callback) {
  chrome.storage.local.get(key, (data) => {
    callback(data[key] !== undefined ? data[key] : defaultValue);
  });
}

/**
 * Set a stored preference.
 * @param {string} key
 * @param {*} value
 * @param {function():void} [callback]
 */
function setPref(key, value, callback) {
  const obj = {};
  obj[key] = value;
  chrome.storage.local.set(obj, callback);
}

// ─── Tab Events ─────────────────────────────────────────────────────────────────

/**
 * Respond to tab updates (e.g., user navigates to a Jira board).
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('/boards/')) {
      console.log('[JiraSnap] Board tab updated:', tab.url);
    }
  }
});

// ─── Cleanup on uninstall ──────────────────────────────────────────────────────

/**
 * Clean up when extension is uninstalled.
 */
chrome.runtime.onSuspend.addListener(() => {
  console.log('[JiraSnap] Service worker suspending');
});