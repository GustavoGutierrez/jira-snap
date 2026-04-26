# JiraSnap Development Setup

This document explains how to configure JiraSnap for local development, load it as an unpacked Chrome extension, and work with it safely while iterating on the code.

---

## Purpose

Use this guide when you want to:

- run JiraSnap locally in Chrome,
- load the extension without publishing it,
- test changes quickly during development,
- inspect popup, content script, and service worker behavior,
- and validate the extension against a real Jira board.

---

## Requirements

Before starting, make sure you have:

- **Google Chrome** or another Chromium-based browser
- access to a Jira board hosted on `https://*.atlassian.net/*`
- the JiraSnap project folder available on your machine

No build step is required for the current version of JiraSnap.

---

## Project structure used in development

At a minimum, the following files are important during local testing:

```text
jira-snap/
├── manifest.json
├── background.js
├── content-script.js
├── popup.html
├── popup.js
├── docs/
│   └── development-setup.md
├── images/
├── styles/
├── _locales/
└── README.md
```

---

## Load the extension as unpacked

### Step 1 — Open the Chrome extensions page

In Chrome, open:

```text
chrome://extensions/
```

### Step 2 — Enable Developer Mode

Turn on **Developer mode** using the toggle in the top-right corner of the page.

This unlocks the local testing options required for extension development.

### Step 3 — Load the unpacked extension

Click:

```text
Load unpacked
```

Then select the root folder of this project:

```text
jira-snap/
```

If the manifest is valid, Chrome will load the extension and show a new JiraSnap card in the extensions page.

---

## Pin the extension for easier testing

For faster access while developing:

1. Click the extensions puzzle icon in Chrome
2. Find **JiraSnap**
3. Click the pin icon

This keeps JiraSnap visible in the browser toolbar.

---

## Test the extension in development

### Step 1 — Open a Jira board

Navigate to a Jira board such as:

```text
https://your-company.atlassian.net/jira/software/c/projects/PROJECT/boards/123
```

### Step 2 — Open JiraSnap

Click the JiraSnap icon in the toolbar.

The popup should attempt to:

- detect whether the current tab is a Jira board,
- collect visible participants,
- detect tickets in **In Progress**,
- and generate a preview of the daily plan.

### Step 3 — Validate the workflow

Verify that you can:

- select or deselect participants,
- remove tickets that should not be included,
- preview the final text,
- copy the text,
- open the built-in Instructions and About overlays,
- switch between Spanish and English.

---

## Reload the extension after changes

Whenever you edit files, you usually need to reload the extension.

### Recommended workflow

1. Save your code changes
2. Open `chrome://extensions/`
3. Find the **JiraSnap** card
4. Click **Reload**
5. Refresh the Jira board tab
6. Re-open the popup

This ensures the latest popup, content script, and service worker code are active.

---

## How to inspect JiraSnap during development

### Inspect the popup

To debug the popup UI:

1. Open `chrome://extensions/`
2. Find **JiraSnap**
3. Click **Inspect views** for the popup, or right-click the popup and inspect it

Use this to debug:

- popup rendering,
- button behavior,
- preview generation,
- language switching,
- copy-to-clipboard behavior.

### Inspect the service worker

From the JiraSnap card in `chrome://extensions/`, open the **service worker** inspection panel.

Use this to debug:

- extension startup behavior,
- storage values,
- background event handling.

### Inspect the content script

Open DevTools on the Jira board tab and inspect the page context.

Use this to debug:

- DOM extraction,
- board detection,
- participant extraction,
- ticket and subtask detection,
- selector changes caused by Jira UI updates.

---

## Development configuration notes

### 1. JiraSnap is loaded locally only

JiraSnap runs directly from your project folder when loaded as an unpacked extension.

That means:

- changes are local,
- no publishing step is required,
- and you can iterate quickly.

### 2. No CDN runtime dependencies

JiraSnap is designed to run without external runtime CDN dependencies.

This is important for:

- extension stability,
- Manifest V3 compatibility,
- and better control in development.

### 3. Permissions are intentionally limited

The extension currently uses:

- `storage`
- `activeTab`
- `https://*.atlassian.net/*` host permissions

These permissions are expected for the current board-driven behavior.

---

## Recommended testing checklist

When testing a new change, verify the following:

- The extension loads successfully
- The popup opens without a blank screen
- The logo and UI render correctly
- A Jira board is detected correctly
- Participants appear correctly
- In Progress tickets are found correctly
- Subtasks are detected when the board is grouped by stories/swimlanes
- Issue type is shown correctly
- The preview text is generated correctly
- The copied text is formatted correctly for Google Chat
- Language switching works correctly
- Help overlays open correctly

---

## Common development issues

### The extension does not load

Check:

- `manifest.json` syntax
- `default_locale` presence when `_locales/` exists
- missing files referenced by the manifest

### The popup opens but looks blank

Check:

- popup console errors
- invalid DOM references in `popup.js`
- CSS hiding or layout issues

### No tickets are detected

Check:

- whether the current tab is a Jira board,
- whether the board has an **In Progress** column,
- whether Jira rendered the cards in the DOM,
- whether the board is grouped by stories and subtasks need to be detected inside swimlanes,
- whether the Jira DOM changed and selectors need updating.

### The popup still shows stale behavior after edits

Make sure you:

- reloaded the extension,
- refreshed the Jira board tab,
- reopened the popup.

---

## Safe development practices

While working locally, avoid committing:

- personal `.env` files,
- temporary debug logs,
- browser-specific cache files,
- secrets or tokens,
- machine-specific paths added to documentation.

The included `.gitignore` is intended to help keep the repository clean.

---

## Related documentation

- Main project overview: [`../README.md`](../README.md)
- License: [`../LICENSE`](../LICENSE)
