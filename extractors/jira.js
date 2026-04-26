/**
 * @fileoverview Jira board DOM extractor for JiraSnap.
 * Scrapes the Jira board page to extract:
 *   - Participants (assignees) from the assignee filter
 *   - In-Progress tickets with metadata
 *
 * Uses stable selectors with multiple fallbacks per the PRP strategy.
 *
 * @author Ing. Gustavo Gutierrez — Bogotá, Colombia
 */

/**
 * @typedef {Object} Participant
 * @property {string} id   - Jira accountId
 * @property {string} name - Display name
 * @property {string} [avatarUrl] - Avatar image URL
 * @property {boolean} isUnassigned
 */

/**
 * @typedef {Object} Ticket
 * @property {string} key
 * @property {string} summary
 * @property {string} [estimate]
 * @property {string} [dueDate]
 * @property {string} assigneeId
 * @property {string} [assigneeName]
 * @property {string} url
 * @property {boolean} selected
 */

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Stable Jira selectors for the assignee filter */
const ASSIGNEE_FILTER_SELECTORS = [
  // Primary: fieldset with data-test-id
  'fieldset[data-test-id="filters.ui.filters.assignee.stateless.assignee-filter"]',
  // Secondary: data-testid variant
  'fieldset[data-testid="filters.ui.filters.assignee.stateless.assignee-filter"]',
  // Fallback: legend with id
  'fieldset legend#assignee',
  // Input-based approach
  'input[name="assignee"][type="checkbox"]',
  // ARIA approach
  'input[aria-label^="Filter assignees by "]'
];

/** Stable Jira selectors for In Progress column header */
const IN_PROGRESS_COLUMN_SELECTORS = [
  '[data-testid="platform-board-kit.common.ui.column-header.editable-title.column-title.column-name"]',
  '[data-testid="platform-common.ui.column-header.editable-title.column-title.column-name"]',
  // By exact text match (case-insensitive)
  '[data-testid*="column-name"]',
  // Generic column header containers with text
  '[class*="column-header"] [class*="column-name"]'
];

/** Selector for ticket key inside a card */
const TICKET_KEY_SELECTORS = [
  '[data-testid="platform-card.common.ui.key.key"] a',
  '[data-testid*="card"] [data-testid*="key"] a',
  'a[href*="/browse/"][data-testid*="key"]',
  // Fallback: any link containing a ticket key pattern
  'a[href*="/browse/"]'
];

/** Selector for ticket summary */
const TICKET_SUMMARY_SELECTORS = [
  '[data-testid="issue-field-single-line-text-readview-card.ui.single-line-text.container.box"]',
  '[data-testid*="summary"] span',
  '[data-testid*="field-summary"]'
];

/** Selector for estimate badge */
const TICKET_ESTIMATE_SELECTORS = [
  '[data-testid="issue-field-original-estimate-readview-card.ui.original-estimate.badge"]',
  '[data-testid*="original-estimate"]',
  '[data-testid*="estimate"]'
];

/** Selector for due date */
const TICKET_DUE_DATE_SELECTORS = [
  '[data-testid="coloured-due-date.ui.colored-due-date-container"]',
  '[data-testid*="due-date"]',
  '[data-testid*="dueDate"]'
];

/** Selector for ticket card (list item) */
const TICKET_CARD_SELECTORS = [
  'li[data-testid*="board实体"]',
  'li[data-testid*="board-card"]',
  'li[class*="board卡片"]',
  'li[class*="card"]',
  // Generic card within column
  '[data-testid*="board"] li'
];

/**
 * Pattern to identify a ticket key like DEMO-101, ENG-123, etc.
 * @type {RegExp}
 */
const TICKET_KEY_PATTERN = /\b([A-Z][A-Z0-9]+-\d+)\b/;

/**
 * Estimate patterns: 3h, 2h, 1d, 30m, etc.
 * @type {RegExp}
 */
const ESTIMATE_PATTERN = /(\d+\s*[hmhd])\b/i;

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Check whether the current page looks like a Jira board.
 * @returns {boolean}
 */
export function isJiraBoard() {
  return (
    document.querySelector('[data-testid*="board"]') !== null ||
    document.querySelector('[data-testid*="kanban"]') !== null ||
    document.URL.includes('/boards/') ||
    document.querySelector('[class*="board"]') !== null
  );
}

/**
 * Extract all visible participants from the Jira assignee filter.
 * Falls back to inferring from visible ticket cards if the filter is not expanded.
 *
 * @returns {Promise<Participant[]>}
 */
export async function extractParticipants() {
  // Try each selector until one succeeds
  for (const sel of ASSIGNEE_FILTER_SELECTORS) {
    const filter = document.querySelector(sel);
    if (!filter) continue;

    const participants = extractFromFilter(filter);
    if (participants && participants.length > 0) {
      return participants;
    }
  }

  // Fallback: extract from visible ticket cards
  return extractParticipantsFromCards();
}

/**
 * Extract participants from the assignee filter fieldset.
 * @param {Element} filterEl
 * @returns {Participant[]}
 */
function extractFromFilter(filterEl) {
  const participants = [];

  // Find all assignee checkboxes within the filter
  const checkboxes = filterEl.querySelectorAll(
    'input[name="assignee"][type="checkbox"], input[type="checkbox"][name="assignee"]'
  );

  checkboxes.forEach(cb => {
    const id = cb.value;
    if (!id) return;

    // Skip "all" checkbox
    if (id === 'all') return;

    // Determine if this is the "Unassigned" option
    const isUnassigned = id === 'unassigned' ||
      cb.getAttribute('aria-label')?.toLowerCase().includes('unassigned');

    // Get name from aria-label or sibling elements
    let name = isUnassigned
      ? 'Unassigned'
      : extractNameFromCheckbox(cb, filterEl);

    // Get avatar
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

/**
 * Extract the display name associated with a checkbox input.
 * @param {HTMLInputElement} cb
 * @param {Element} filterEl
 * @returns {string}
 */
function extractNameFromCheckbox(cb, filterEl) {
  // Try aria-label on the checkbox
  const ariaLabel = cb.getAttribute('aria-label');
  if (ariaLabel) {
    // aria-label format: "Filter assignees by NAME"
    const match = ariaLabel.match(/Filter assignees by (.+)/i);
    if (match) return match[1].trim();
    return ariaLabel.trim();
  }

  // Try finding a sibling or nearby label element
  const parent = cb.closest('label') || cb.parentElement;
  if (parent) {
    // Look for avatar label span
    const labelSpan = parent.querySelector(
      '[data-testid*="avatar"] [data-testid*="label"], ' +
      'span[class*="avatar"]'
    );
    if (labelSpan && labelSpan.textContent.trim()) {
      return labelSpan.textContent.trim();
    }
  }

  return '';
}

/**
 * Extract avatar URL from near a checkbox.
 * @param {HTMLInputElement} cb
 * @param {Element} filterEl
 * @returns {string|null}
 */
function extractAvatarFromCheckbox(cb, filterEl) {
  // Try img within the label or parent
  const container = cb.closest('label') || cb.parentElement;
  if (!container) return null;

  const img = container.querySelector(
    'img[data-testid*="avatar"], img[class*="avatar"]'
  );
  if (img && img.src) return img.src;

  return null;
}

/**
 * Fallback: extract participants by scanning all visible ticket cards for assignee info.
 * @returns {Promise<Participant[]>}
 */
async function extractParticipantsFromCards() {
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

/**
 * Extract assignee info from a single ticket card.
 * @param {Element} card
 * @returns {Participant|null}
 */
function extractAssigneeFromCard(card) {
  // Try avatar
  const avatarImg = card.querySelector(
    'img[class*="avatar"], [data-testid*="avatar"] img'
  );
  const nameEl = card.querySelector(
    '[data-testid*="assignee"] [class*="label"], ' +
    '[data-testid*="assignee"] span, ' +
    '[aria-label*="assignee"]'
  );

  let name = '';
  let avatarUrl = null;

  if (avatarImg && avatarImg.src) {
    avatarUrl = avatarImg.src;
    // Try to get alt text as name
    name = avatarImg.alt || avatarImg.getAttribute('aria-label') || '';
  }

  if (!name && nameEl) {
    name = nameEl.textContent?.trim() || '';
  }

  // Try to extract from tooltip or title
  if (!name) {
    const titleAttr = card.getAttribute('title') || '';
    const match = titleAttr.match(/assignee[:\s]+(.+)/i);
    if (match) name = match[1].trim();
  }

  // Generate a pseudo-ID from avatar URL or name hash
  const id = avatarUrl
    ? btoa(avatarUrl).substring(0, 48)
    : name ? btoa(name).substring(0, 48) : 'unassigned';

  return {
    id,
    name: name || 'Unknown',
    avatarUrl,
    isUnassigned: !name || name.toLowerCase() === 'unassigned'
  };
}

// ─── Ticket Extraction ──────────────────────────────────────────────────────────

/**
 * Find the In Progress column and extract all its tickets.
 *
 * @param {string[]} [assigneeIds] - If provided, only return tickets matching these assignees.
 * @returns {Promise<Ticket[]>}
 */
export async function extractInProgressTickets(assigneeIds) {
  // Find the In Progress column
  const column = findInProgressColumn();

  if (!column) {
    // Try text-based search as last resort
    const textFound = findInProgressColumnByText();
    if (textFound) return extractTicketsFromColumn(textFound, assigneeIds);
    return [];
  }

  return extractTicketsFromColumn(column, assigneeIds);
}

/**
 * Find the In Progress column using stable selectors.
 * @returns {Element|null}
 */
function findInProgressColumn() {
  for (const sel of IN_PROGRESS_COLUMN_SELECTORS) {
    const col = document.querySelector(sel);
    if (col && isInProgressColumn(col)) {
      return col.closest('[data-testid*="column"]') || col.closest('div');
    }
  }

  // Fallback: scan all column headers for text match
  return findInProgressColumnByText();
}

/**
 * Check if a column element is "In Progress".
 * @param {Element} colHeaderEl
 * @returns {boolean}
 */
function isInProgressColumn(colHeaderEl) {
  const text = colHeaderEl.textContent?.trim().toLowerCase() || '';
  return (
    text === 'in progress' ||
    text === 'en progreso' ||
    colHeaderEl.getAttribute('data-testid')?.toLowerCase().includes('inprogress') ||
    colHeaderEl.getAttribute('data-testid')?.toLowerCase().includes('in-progress')
  );
}

/**
 * Fallback: find In Progress column by scanning all columns for matching text.
 * @returns {Element|null}
 */
function findInProgressColumnByText() {
  // Find all column header elements
  const headers = document.querySelectorAll(
    '[data-testid*="column-header"], ' +
    '[class*="column-header"], ' +
    '[class*="column-name"], ' +
    'div[class*="columns"] > div'
  );

  for (const header of headers) {
    const text = header.textContent?.trim().toLowerCase() || '';
    if (text === 'in progress' || text === 'en progreso') {
      // Find the column container
      const colContainer = header.closest('[class*="column"]');
      return colContainer || header;
    }
  }

  return null;
}

/**
 * Extract all ticket data from a column element.
 * @param {Element} columnEl
 * @param {string[]} [assigneeIds]
 * @returns {Ticket[]}
 */
function extractTicketsFromColumn(columnEl, assigneeIds) {
  const tickets = [];

  // Find all card elements within the column
  // Use li elements or card-like divs
  const cards = columnEl.querySelectorAll
    ? columnEl.querySelectorAll('li, [data-testid*="card"], [class*="card"]')
    : [];

  Array.from(cards).forEach(card => {
    const ticket = extractTicket(card);
    if (ticket && ticket.key) {
      // Filter by selected assignees if provided
      if (!assigneeIds || assigneeIds.length === 0 ||
          assigneeIds.includes(ticket.assigneeId) ||
          assigneeIds.some(id => ticket.assigneeId.includes(id))) {
        tickets.push(ticket);
      }
    }
  });

  return tickets;
}

/**
 * Extract ticket metadata from a card element.
 * @param {Element} cardEl
 * @returns {Ticket|null}
 */
function extractTicket(cardEl) {
  const ticket = {
    key: '',
    summary: '',
    estimate: null,
    dueDate: null,
    assigneeId: '',
    assigneeName: null,
    url: '',
    selected: true
  };

  // Key
  const keyEl = findOne(cardEl, TICKET_KEY_SELECTORS);
  if (keyEl) {
    ticket.key = keyEl.textContent?.trim().match(TICKET_KEY_PATTERN)?.[1] || '';
    ticket.url = keyEl.href || keyEl.closest('a')?.href || '';
  }

  if (!ticket.key) {
    // Fallback: search within card HTML
    const html = cardEl.innerHTML;
    const match = html.match(TICKET_KEY_PATTERN);
    if (match) ticket.key = match[1];
  }

  // Summary
  const summaryEl = findOne(cardEl, TICKET_SUMMARY_SELECTORS);
  if (summaryEl) {
    ticket.summary = summaryEl.textContent?.trim() || '';
  }

  if (!ticket.summary) {
    // Fallback: any summary-like text
    const summaryText = cardEl.querySelector('[class*="summary"], [class*="summary"]');
    if (summaryText) ticket.summary = summaryText.textContent?.trim() || '';
  }

  // Estimate
  const estEl = findOne(cardEl, TICKET_ESTIMATE_SELECTORS);
  if (estEl) {
    const estText = estEl.textContent || '';
    const estMatch = estText.match(ESTIMATE_PATTERN);
    ticket.estimate = estMatch ? estMatch[1] : null;
  }

  if (!ticket.estimate) {
    // Fallback: scan entire card text for estimate pattern
    const fullText = cardEl.textContent || '';
    const estMatch = fullText.match(ESTIMATE_PATTERN);
    ticket.estimate = estMatch ? estMatch[1] : null;
  }

  // Due date
  const dueEl = findOne(cardEl, TICKET_DUE_DATE_SELECTORS);
  if (dueEl) {
    ticket.dueDate = dueEl.textContent?.trim() || null;
  }

  // Assignee
  const assigneeData = extractAssigneeFromCard(cardEl);
  if (assigneeData) {
    ticket.assigneeId = assigneeData.id;
    ticket.assigneeName = assigneeData.name;
  }

  return ticket.key ? ticket : null;
}

/**
 * Find the first element matching any selector in a list.
 * @param {Element} root
 * @param {string[]} selectors
 * @returns {Element|null}
 */
function findOne(root, selectors) {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}

// ─── Retry / Wait Helpers ───────────────────────────────────────────────────────

/**
 * Wait for a condition with a maximum number of retries.
 * @param {Function} condition - Returns truthy when satisfied
 * @param {number} maxRetries
 * @param {number} delayMs
 * @returns {Promise<void>}
 */
export async function waitFor(condition, maxRetries = 5, delayMs = 300) {
  return new Promise((resolve) => {
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

/**
 * Perform extraction with retry for dynamic Jira content.
 * @param {Function} extractorFn - Async function that returns extraction result
 * @param {number} retries
 * @returns {Promise<*>}
 */
export async function extractWithRetry(extractorFn, retries = 3) {
  let lastError = null;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await extractorFn();
      if (result && result.length > 0) return result;
      // Small wait before retry for dynamic content
      await new Promise(r => setTimeout(r, 200 * (i + 1)));
    } catch (err) {
      lastError = err;
    }
  }
  // Return whatever we got even if empty
  try {
    return await extractorFn();
  } catch {
    return [];
  }
}

// ─── Text Formatting ────────────────────────────────────────────────────────────

/**
 * Format tickets into the Google Chat plan text.
 * @param {Ticket[]} tickets - Selected tickets (selected = true)
 * @param {string} lang - 'es' or 'en'
 * @returns {string}
 */
export function formatPlanText(tickets, lang = 'es') {
  const labels = {
    es: { planTitle: 'PLAN DEL DÍA', estimate: 'Est', due: 'Vence' },
    en: { planTitle: 'DAILY PLAN', estimate: 'Est', due: 'Due' }
  };
  const L = labels[lang] || labels.es;

  if (!tickets || tickets.length === 0) {
    return '';
  }

  // Group by assignee name
  const byAssignee = new Map();
  tickets.forEach(t => {
    const key = t.assigneeName || 'Unknown';
    if (!byAssignee.has(key)) byAssignee.set(key, []);
    byAssignee.get(key).push(t);
  });

  const lines = [`*${L.planTitle}*`, ''];

  byAssignee.forEach((ticketsList, assignee) => {
    lines.push(`*${assignee}*`);
    ticketsList.forEach(t => {
      let line = `- *${t.key}* — ${t.summary}`;
      if (t.estimate) line += ` | ${L.estimate}: ${t.estimate}`;
      if (t.dueDate) line += ` | ${L.due}: ${t.dueDate}`;
      lines.push(line);
    });
    lines.push('');
  });

  return lines.join('\n').trim();
}
