/**
 * @fileoverview JiraSnap Content Script.
 * Injected into Jira board pages (https://*.atlassian.net/*).
 * Handles messages from the popup and returns scraped data.
 * Self-contained — no ES module imports (MV3 content script constraint).
 *
 * @author Ing. Gustavo Gutierrez — Bogotá, Colombia
 */

'use strict';

// ─── Constants ──────────────────────────────────────────────────────────────────

const ASSIGNEE_FILTER_SELECTORS = [
  'fieldset[data-test-id="filters.ui.filters.assignee.stateless.assignee-filter"]',
  'fieldset[data-testid="filters.ui.filters.assignee.stateless.assignee-filter"]',
  'fieldset legend#assignee',
  'input[name="assignee"][type="checkbox"]',
  'input[aria-label^="Filter assignees by "]'
];

const IN_PROGRESS_COLUMN_SELECTORS = [
  '[data-testid="platform-board-kit.common.ui.column-header.editable-title.column-title.column-name"]',
  '[data-testid*="column-name"]'
];

const TICKET_KEY_SELECTORS = [
  '[data-testid="platform-card.common.ui.key.key"] a',
  'a[href*="/browse/"]'
];

const TICKET_SUMMARY_SELECTORS = [
  '[data-testid*="summary"] span',
  '[class*="summary"]'
];

const TICKET_ESTIMATE_SELECTORS = [
  '[data-testid*="estimate"]'
];

const TICKET_DUE_DATE_SELECTORS = [
  '[data-testid*="due-date"]'
];

const CARD_CONTAINER_SELECTORS = [
  '[data-testid="platform-board-kit.ui.card.card"]',
  '[data-component-selector="platform-board-kit.ui.card-container"]',
  '[id^="card-"]',
  '[data-testid="software-board.board-container.board.card-container.card-with-icc"]'
];

const TICKET_KEY_PATTERN = /\b([A-Z][A-Z0-9]+-\d+)\b/;
const ESTIMATE_PATTERN = /(\d+\s*[hmhd])\b/i;

// ─── Board Detection ────────────────────────────────────────────────────────────

function isJiraBoard() {
  return (
    document.querySelector('[data-testid*="board"]') !== null ||
    document.querySelector('[data-testid*="kanban"]') !== null ||
    window.location.href.includes('/boards/') ||
    document.querySelector('[class*="board"]') !== null
  );
}

// ─── Participant Extraction ────────────────────────────────────────────────────

function extractParticipants() {
  for (const sel of ASSIGNEE_FILTER_SELECTORS) {
    const filter = document.querySelector(sel);
    if (!filter) continue;
    const result = extractFromFilter(filter);
    if (result && result.length > 0) return result;
  }
  return extractParticipantsFromCards();
}

function extractFromFilter(filterEl) {
  const participants = [];
  const checkboxes = filterEl.querySelectorAll('input[name="assignee"][type="checkbox"], input[type="checkbox"][name="assignee"]');

  checkboxes.forEach(cb => {
    const id = cb.value;
    if (!id || id === 'all') return;

    const isUnassigned = id === 'unassigned' || (cb.getAttribute('aria-label') || '').toLowerCase().includes('unassigned');
    let name = isUnassigned ? 'Unassigned' : extractNameFromCheckbox(cb, filterEl);
    const avatarUrl = extractAvatarFromCheckbox(cb, filterEl);

    participants.push({
      id,
      name: name || (isUnassigned ? 'Unassigned' : id),
      avatarUrl: avatarUrl || null,
      isUnassigned
    });
  });

  return participants;
}

function extractNameFromCheckbox(cb, filterEl) {
  const ariaLabel = cb.getAttribute('aria-label');
  if (ariaLabel) {
    const match = ariaLabel.match(/Filter assignees by (.+)/i);
    if (match) return match[1].trim();
    return ariaLabel.trim();
  }
  const parent = cb.closest('label') || cb.parentElement;
  if (parent) {
    const labelSpan = parent.querySelector('[data-testid*="avatar"] [data-testid*="label"], span[class*="avatar"]');
    if (labelSpan && labelSpan.textContent.trim()) return labelSpan.textContent.trim();
  }
  return '';
}

function extractAvatarFromCheckbox(cb, filterEl) {
  const container = cb.closest('label') || cb.parentElement;
  if (!container) return null;
  const img = container.querySelector('img[data-testid*="avatar"], img[class*="avatar"]');
  return img && img.src ? img.src : null;
}

function extractParticipantsFromCards() {
  const participantMap = new Map();
  const cards = document.querySelectorAll('[data-testid*="card"], [class*="card"]');

  cards.forEach(card => {
    const assignee = extractAssigneeFromCard(card);
    if (assignee && assignee.id) {
      participantMap.set(assignee.id, assignee);
    }
  });

  return Array.from(participantMap.values());
}

function extractAssigneeFromCard(card) {
  const avatarImg = card.querySelector('img[class*="avatar"], [data-testid*="avatar"] img');
  let name = '';
  let avatarUrl = null;

  if (avatarImg && avatarImg.src) {
    avatarUrl = avatarImg.src;
    name = avatarImg.alt || avatarImg.getAttribute('aria-label') || '';
  }

  if (!name) {
    const labelEl = card.querySelector('[data-testid="board.common.fields.assignee-field-static.avatar--label"], [data-testid*="assignee-field-static.avatar--label"], [aria-label*="Assignee:"]');
    if (labelEl) {
      name = labelEl.textContent?.trim() || labelEl.getAttribute('aria-label') || '';
    }
  }

  if (!name) {
    const nameEl = card.querySelector('[data-testid*="assignee"] span, [aria-label*="assignee"]');
    if (nameEl) name = nameEl.textContent?.trim() || '';
  }

  if (name && /^assignee:/i.test(name)) {
    name = name.replace(/^assignee:\s*/i, '').trim();
  }

  const id = avatarUrl ? btoa(avatarUrl).substring(0, 48) : (name ? btoa(name).substring(0, 48) : 'unassigned');

  return {
    id,
    name: name || 'Unknown',
    avatarUrl,
    isUnassigned: !name || name.toLowerCase() === 'unassigned'
  };
}

// ─── Ticket Extraction ──────────────────────────────────────────────────────────

function extractInProgressTickets(assigneeIds, assigneeNames) {
  const column = findInProgressColumn();
  if (!column) return [];
  return extractTicketsFromColumn(column, assigneeIds, assigneeNames);
}

function findInProgressColumn() {
  for (const sel of IN_PROGRESS_COLUMN_SELECTORS) {
    const headers = document.querySelectorAll(sel);
    for (const col of headers) {
      if (col && isInProgressColumn(col)) {
        return resolveColumnContainer(col);
      }
    }
  }

  // Text-based fallback
  const headers = document.querySelectorAll('[data-testid*="column-header"], [class*="column-header"], [class*="column-name"]');
  for (const header of headers) {
    const text = (header.textContent || '').trim().toLowerCase();
    if (text === 'in progress' || text === 'en progreso') {
      return resolveColumnContainer(header);
    }
  }

  return null;
}

function resolveColumnContainer(headerEl) {
  const explicitMatches = [
    '[data-testid="platform-board-kit.ui.column.draggable-column.styled-wrapper"]',
    '[data-component-selector="platform-board-kit.ui.column.draggable-column"]',
    'div[role="presentation"][data-component-selector="platform-board-kit.ui.column.draggable-column"]'
  ];

  for (const selector of explicitMatches) {
    const match = headerEl.closest(selector);
    if (match) {
      return match;
    }
  }

  let current = headerEl;
  while (current && current !== document.body) {
    if (containsColumnCards(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return headerEl.closest('[data-testid*="column"]') || headerEl.closest('[class*="column"]') || headerEl;
}

function containsColumnCards(element) {
  return CARD_CONTAINER_SELECTORS.some((selector) => element.querySelector(selector));
}

function isInProgressColumn(colHeaderEl) {
  const text = (colHeaderEl.textContent || '').trim().toLowerCase();
  return (
    text === 'in progress' ||
    text === 'en progreso' ||
    (colHeaderEl.getAttribute('data-testid') || '').toLowerCase().includes('inprogress') ||
    (colHeaderEl.getAttribute('data-testid') || '').toLowerCase().includes('in-progress')
  );
}

function extractTicketsFromColumn(columnEl, assigneeIds, assigneeNames) {
  const tickets = [];
  const cards = collectColumnCards(columnEl);

  Array.from(cards).forEach(card => {
    const ticket = extractTicket(card);
    if (ticket && ticket.key) {
      if (matchesSelectedAssignee(ticket, assigneeIds, assigneeNames)) {
        tickets.push(ticket);
      }
    }
  });

  return tickets;
}

function collectColumnCards(columnEl) {
  if (!columnEl || !columnEl.querySelectorAll) {
    return [];
  }

  const rawCards = [];
  CARD_CONTAINER_SELECTORS.forEach((selector) => {
    columnEl.querySelectorAll(selector).forEach((card) => rawCards.push(card));
  });

  const uniqueCards = [];
  const seen = new Set();

  rawCards.forEach((card) => {
    const cardRoot = normalizeCardRoot(card);
    if (!cardRoot) return;
    const key = cardRoot.id || cardRoot.getAttribute('data-testid') || cardRoot.outerHTML.slice(0, 120);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCards.push(cardRoot);
    }
  });

  return uniqueCards;
}

function normalizeCardRoot(cardEl) {
  if (!cardEl || !cardEl.querySelector) {
    return null;
  }

  if (cardEl.matches('[data-testid="platform-board-kit.ui.card.card"], [id^="card-"]')) {
    return cardEl;
  }

  return cardEl.querySelector('[data-testid="platform-board-kit.ui.card.card"], [id^="card-"]') || cardEl;
}

function matchesSelectedAssignee(ticket, assigneeIds, assigneeNames) {
  if ((!assigneeIds || assigneeIds.length === 0) && (!assigneeNames || assigneeNames.length === 0)) {
    return true;
  }

  const ticketAssigneeId = String(ticket.assigneeId || '').toLowerCase();
  const ticketAssigneeName = String(ticket.assigneeName || '').toLowerCase();

  const hasIdMatch = Array.isArray(assigneeIds) && assigneeIds.some(id => {
    const normalized = String(id || '').toLowerCase();
    return normalized && ticketAssigneeId.includes(normalized);
  });

  const hasNameMatch = Array.isArray(assigneeNames) && assigneeNames.some(name => {
    const normalized = String(name || '').trim().toLowerCase();
    return normalized && ticketAssigneeName.includes(normalized);
  });

  return Boolean(hasIdMatch || hasNameMatch);
}

function extractTicket(cardEl) {
  const ticket = {
    key: '', summary: '', estimate: null, dueDate: null,
    assigneeId: '', assigneeName: null, url: '', selected: true, issueType: null
  };
  const cardText = (cardEl.textContent || '').replace(/\s+/g, ' ').trim();

  // Key
  for (const sel of TICKET_KEY_SELECTORS) {
    const keyEl = cardEl.querySelector(sel);
    if (keyEl) {
      ticket.key = (keyEl.textContent || '').trim().match(TICKET_KEY_PATTERN)?.[1] || '';
      ticket.url = keyEl.href || keyEl.closest('a')?.href || '';
      break;
    }
  }

  if (!ticket.key) {
    const html = cardEl.innerHTML;
    const match = html.match(TICKET_KEY_PATTERN) || cardText.match(TICKET_KEY_PATTERN);
    if (match) ticket.key = match[1];
  }

  // Summary
  for (const sel of TICKET_SUMMARY_SELECTORS) {
    const sumEl = cardEl.querySelector(sel);
    if (sumEl) {
      ticket.summary = (sumEl.textContent || '').trim();
      break;
    }
  }

  if (!ticket.summary) {
    ticket.summary = inferSummaryFromText(cardText, ticket.key);
  }

  ticket.issueType = extractIssueType(cardEl);

  // Estimate
  for (const sel of TICKET_ESTIMATE_SELECTORS) {
    const estEl = cardEl.querySelector(sel);
    if (estEl) {
      const estText = estEl.textContent || '';
      const estMatch = estText.match(ESTIMATE_PATTERN);
      if (estMatch) ticket.estimate = estMatch[1];
      else {
        const fullMatch = cardText.match(ESTIMATE_PATTERN);
        if (fullMatch) ticket.estimate = fullMatch[1];
      }
      break;
    }
  }

  if (!ticket.estimate) {
    const estimateMatch = cardText.match(ESTIMATE_PATTERN);
    if (estimateMatch) ticket.estimate = estimateMatch[1];
  }

  // Due date
  for (const sel of TICKET_DUE_DATE_SELECTORS) {
    const dueEl = cardEl.querySelector(sel);
    if (dueEl) {
      ticket.dueDate = (dueEl.textContent || '').trim() || null;
      break;
    }
  }

  if (!ticket.dueDate) {
    const dueMatch = cardText.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?/i);
    if (dueMatch) ticket.dueDate = dueMatch[0];
  }

  // Assignee
  const assigneeData = extractAssigneeFromCard(cardEl);
  if (assigneeData) {
    ticket.assigneeId = assigneeData.id;
    ticket.assigneeName = assigneeData.name;
  }

  if (ticket.assigneeName && /^assignee:/i.test(ticket.assigneeName)) {
    ticket.assigneeName = ticket.assigneeName.replace(/^assignee:\s*/i, '').trim();
  }

  if (!ticket.assigneeName || ticket.assigneeName === 'Unknown') {
    const inferredAssignee = inferAssigneeFromText(cardText);
    if (inferredAssignee) {
      ticket.assigneeName = inferredAssignee.name;
      ticket.assigneeId = ticket.assigneeId || inferredAssignee.id;
    }
  }

  if (!ticket.url && ticket.key) {
    ticket.url = `${window.location.origin}/browse/${ticket.key}`;
  }

  return ticket.key ? ticket : null;
}

function inferSummaryFromText(cardText, ticketKey) {
  if (!cardText) return '';
  let text = cardText;
  if (ticketKey) {
    text = text.replace(ticketKey, '').trim();
  }
  text = text.replace(/\([^)]*subtasks?\)/ig, '').trim();
  text = text.replace(/\b(?:overdue since|due on)\s+[a-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?/ig, '').trim();
  text = text.replace(ESTIMATE_PATTERN, '').trim();
  text = text.replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?/i, '').trim();
  return text.slice(0, 180).trim();
}

function extractIssueType(cardEl) {
  const typeImage = cardEl.querySelector('img[alt][src*="universal_avatar/view/type/issuetype"], img[alt="Sub-task"], img[alt="Story"], img[alt="Bug"], img[alt="Task"], img[alt="Epic"]');
  if (typeImage) {
    const alt = (typeImage.getAttribute('alt') || '').trim();
    if (alt) return alt;
  }

  const labelledType = cardEl.querySelector('[data-testid*="issuetype"], [aria-label*="issue type" i]');
  if (labelledType) {
    const text = (labelledType.getAttribute('aria-label') || labelledType.textContent || '').trim();
    if (text) return text;
  }

  return null;
}

function inferAssigneeFromText(cardText) {
  if (!cardText) return null;
  const participants = extractParticipants();
  for (const participant of participants) {
    if (participant.name && cardText.toLowerCase().includes(participant.name.toLowerCase())) {
      return {
        id: participant.id || btoa(participant.name).substring(0, 48),
        name: participant.name
      };
    }
  }
  return null;
}

// ─── Retry Helper ──────────────────────────────────────────────────────────────

function waitFor(condition, maxRetries = 5, delayMs = 300) {
  return new Promise(resolve => {
    if (condition()) return resolve();
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (condition() || attempts >= maxRetries) {
        clearInterval(interval);
        resolve();
      }
    }, delayMs);
  });
}

async function extractWithRetry(extractorFn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await extractorFn();
      if (result && result.length > 0) return result;
      await new Promise(r => setTimeout(r, 200 * (i + 1)));
    } catch (_) { /* retry */ }
  }
  try {
    return await extractorFn();
  } catch {
    return [];
  }
}

async function waitForBoardReady() {
  const boardReady = () =>
    document.querySelector('[data-testid*="board"]') !== null ||
    document.querySelector('[class*="board"]') !== null;

  await waitFor(boardReady, 8, 400);
}

// ─── Message Handling ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action } = message;

  switch (action) {
    case 'ping':
      sendResponse({ ok: true, board: isJiraBoard() });
      break;

    case 'getBoardInfo':
      sendResponse({ isBoard: isJiraBoard(), url: window.location.href, title: document.title });
      break;

    case 'getParticipants':
      (async () => {
        await waitForBoardReady();
        const participants = await extractWithRetry(() => extractParticipants(), 3);
        sendResponse({ participants, error: null });
      })();
      break;

    case 'getTickets':
      (async () => {
        await waitForBoardReady();
        const tickets = await extractWithRetry(
          () => extractInProgressTickets(message.assigneeIds || null, message.assigneeNames || null),
          3
        );
        sendResponse({ tickets, error: null });
      })();
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return true; // Keep channel open for async response
});
