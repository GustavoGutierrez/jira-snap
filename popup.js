/**
 * @fileoverview JiraSnap popup runtime.
 * Plain JS implementation to avoid CSP/runtime issues in Chrome MV3 popup pages.
 *
 * @author Ing. Gustavo Gutierrez — Bogotá, Colombia
 */

(function () {
  'use strict';

  const i18n = {
    es: {
      loading: 'Cargando...',
      projectParticipants: 'Participantes',
      ticketsInProgress: 'Tickets en progreso',
      preview: 'Previsualización',
      includeTypeInCopy: 'Incluir tipo en el texto copiado',
      copyPlan: 'Copiar plan',
      copied: '¡Copiado!',
      clearAll: 'Limpiar selección',
      selectAll: 'Seleccionar todos',
      retry: 'Reintentar',
      noParticipants: 'No se detectaron participantes',
      noTickets: 'No se encontraron tickets en progreso',
      noTicketsForSelection: 'No hay tickets para los participantes seleccionados',
      notJira: 'La pestaña actual no es un board de Jira soportado',
      estimate: 'Est',
      due: 'Vence',
      type: 'Tipo',
      remove: 'Quitar',
      ticketsSelected: 'tickets seleccionados',
      unassigned: 'Sin asignar',
      connected: 'Board de Jira detectado',
      copyFailed: 'No se pudo copiar el plan',
      jumpToPreview: 'Ir a preview',
      instructions: 'Instrucciones',
      about: 'About',
      stickySummary: 'Preview disponible',
      close: 'Cerrar',
      issueTypes: {
        'sub-task': 'Subtarea',
        subtask: 'Subtarea',
        story: 'Historia',
        task: 'Tarea',
        bug: 'Bug',
        epic: 'Epic',
        spike: 'Spike'
      }
    },
    en: {
      loading: 'Loading...',
      projectParticipants: 'Participants',
      ticketsInProgress: 'In progress tickets',
      preview: 'Preview',
      includeTypeInCopy: 'Include issue type in copied text',
      copyPlan: 'Copy plan',
      copied: 'Copied!',
      clearAll: 'Clear selection',
      selectAll: 'Select all',
      retry: 'Retry',
      noParticipants: 'No participants detected',
      noTickets: 'No in-progress tickets found',
      noTicketsForSelection: 'No tickets for selected participants',
      notJira: 'The current tab is not a supported Jira board',
      estimate: 'Est',
      due: 'Due',
      type: 'Type',
      remove: 'Remove',
      ticketsSelected: 'tickets selected',
      unassigned: 'Unassigned',
      connected: 'Jira board detected',
      copyFailed: 'Could not copy the plan',
      jumpToPreview: 'Jump to preview',
      instructions: 'Instructions',
      about: 'About',
      stickySummary: 'Preview available',
      close: 'Close',
      issueTypes: {
        'sub-task': 'Sub-task',
        subtask: 'Sub-task',
        story: 'Story',
        task: 'Task',
        bug: 'Bug',
        epic: 'Epic',
        spike: 'Spike'
      }
    }
  };

  const state = {
    lang: 'es',
    isJiraBoard: false,
    participants: [],
    tickets: [],
    isLoading: true,
    isLoadingTickets: false,
    isCopying: false,
    currentTabId: null,
    includeTypeInCopy: true
  };

  let elements = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements();
    bindEvents();
    await loadLang();
    applyLanguageButtons();
    setStatus('loading', t().loading);
    showLoading(true);
    await detectBoardAndLoad();
  }

  function cacheElements() {
    elements = {
      langEs: document.getElementById('lang-es'),
      langEn: document.getElementById('lang-en'),
      statusDot: document.getElementById('status-dot'),
      statusMessage: document.getElementById('status-message'),
      jumpToPreview: document.getElementById('jump-to-preview'),
      openInstructions: document.getElementById('open-instructions'),
      openAbout: document.getElementById('open-about'),
      loadingState: document.getElementById('loading-state'),
      loadingMessage: document.getElementById('loading-message'),
      notJiraState: document.getElementById('not-jira-state'),
      notJiraMessage: document.getElementById('not-jira-message'),
      mainContent: document.getElementById('main-content'),
      participantsSection: document.getElementById('participants-section'),
      participantsHeading: document.getElementById('participants-heading'),
      selectAllParticipants: document.getElementById('select-all-participants'),
      clearAllParticipants: document.getElementById('clear-all-participants'),
      participantsEmpty: document.getElementById('participants-empty'),
      participantsEmptyText: document.getElementById('participants-empty-text'),
      participantsList: document.getElementById('participants-list'),
      ticketsSection: document.getElementById('tickets-section'),
      ticketsHeading: document.getElementById('tickets-heading'),
      retryTickets: document.getElementById('retry-tickets'),
      ticketsEmpty: document.getElementById('tickets-empty'),
      ticketsEmptyText: document.getElementById('tickets-empty-text'),
      ticketsList: document.getElementById('tickets-list'),
      outputSection: document.getElementById('output-section'),
      outputHeading: document.getElementById('output-heading'),
      includeTypeInCopy: document.getElementById('include-type-in-copy'),
      includeTypeLabel: document.getElementById('include-type-label'),
      outputPreview: document.getElementById('output-preview'),
      actionsRow: document.getElementById('actions-row'),
      copyPlan: document.getElementById('copy-plan'),
      resetSelection: document.getElementById('reset-selection'),
      stickyActions: document.getElementById('sticky-actions'),
      stickySummary: document.getElementById('sticky-summary'),
      stickyJumpToPreview: document.getElementById('sticky-jump-to-preview'),
      stickyCopyPlan: document.getElementById('sticky-copy-plan'),
      helpOverlay: document.getElementById('help-overlay'),
      helpTitle: document.getElementById('help-title'),
      helpContent: document.getElementById('help-content'),
      closeHelp: document.getElementById('close-help'),
      toastContainer: document.getElementById('toast-container')
    };
  }

  function bindEvents() {
    elements.langEs.addEventListener('click', () => setLang('es'));
    elements.langEn.addEventListener('click', () => setLang('en'));
    elements.jumpToPreview.addEventListener('click', scrollToPreview);
    elements.stickyJumpToPreview.addEventListener('click', scrollToPreview);
    elements.openInstructions.addEventListener('click', openInstructionsOverlay);
    elements.openAbout.addEventListener('click', openAboutOverlay);
    elements.closeHelp.addEventListener('click', closeHelpOverlay);
    elements.helpOverlay.addEventListener('click', (event) => {
      if (event.target === elements.helpOverlay) closeHelpOverlay();
    });
    elements.selectAllParticipants.addEventListener('click', selectAllParticipants);
    elements.clearAllParticipants.addEventListener('click', clearAllParticipants);
    elements.retryTickets.addEventListener('click', refreshTickets);
    elements.copyPlan.addEventListener('click', copyPlan);
    elements.stickyCopyPlan.addEventListener('click', copyPlan);
    elements.resetSelection.addEventListener('click', resetSelection);
    elements.includeTypeInCopy.addEventListener('change', () => {
      state.includeTypeInCopy = elements.includeTypeInCopy.checked;
      chrome.storage.local.set({ jiraSnapIncludeTypeInCopy: state.includeTypeInCopy });
      renderOutput();
    });
  }

  async function loadLang() {
    const data = await chrome.storage.local.get(['jiraSnapLang', 'jiraSnapIncludeTypeInCopy']);
    if (data.jiraSnapLang && i18n[data.jiraSnapLang]) {
      state.lang = data.jiraSnapLang;
    }
    if (typeof data.jiraSnapIncludeTypeInCopy === 'boolean') {
      state.includeTypeInCopy = data.jiraSnapIncludeTypeInCopy;
    }
  }

  function t() {
    return i18n[state.lang] || i18n.es;
  }

  function translateIssueType(issueType) {
    if (!issueType) return '';
    const key = String(issueType).trim().toLowerCase();
    return t().issueTypes?.[key] || issueType;
  }

  function setLang(lang) {
    if (!i18n[lang]) return;
    state.lang = lang;
    chrome.storage.local.set({ jiraSnapLang: lang });
    applyLanguageButtons();
    render();
  }

  function applyLanguageButtons() {
    const isEs = state.lang === 'es';
    elements.langEs.classList.toggle('active', isEs);
    elements.langEn.classList.toggle('active', !isEs);
    elements.langEs.setAttribute('aria-pressed', String(isEs));
    elements.langEn.setAttribute('aria-pressed', String(!isEs));
  }

  async function detectBoardAndLoad() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      state.currentTabId = tab?.id || null;

      if (!tab || !tab.url || !tab.url.includes('atlassian.net') || !tab.url.includes('/boards/')) {
        state.isJiraBoard = false;
        showLoading(false);
        showNotJira();
        return;
      }

      state.isJiraBoard = true;
      setStatus('loading', t().loading);
      await loadParticipants();
    } catch (error) {
      state.isJiraBoard = false;
      showLoading(false);
      showNotJira();
      showToast(String(error?.message || error), 'error');
    }
  }

  async function loadParticipants() {
    if (!state.currentTabId) return;

    state.isLoading = true;
    showLoading(true);
    try {
      const response = await chrome.tabs.sendMessage(state.currentTabId, { action: 'getParticipants' });
      state.participants = (response?.participants || []).map((participant) => ({
        ...participant,
        selected: !participant.isUnassigned
      }));
      setStatus('online', state.participants.length > 0 ? `${state.participants.length} ${t().projectParticipants.toLowerCase()}` : t().noParticipants);
      await loadTickets();
    } catch (error) {
      state.participants = [];
      setStatus('error', t().noParticipants);
      showToast(String(error?.message || error), 'error');
    } finally {
      state.isLoading = false;
      showLoading(false);
      render();
    }
  }

  async function loadTickets() {
    if (!state.currentTabId) return;

    state.isLoadingTickets = true;
    render();
    try {
      const selectedAssignees = state.participants.filter((p) => p.selected).map((p) => p.id);
      const selectedAssigneeNames = state.participants
        .filter((p) => p.selected)
        .map((p) => p.name)
        .filter(Boolean);
      const response = await chrome.tabs.sendMessage(state.currentTabId, {
        action: 'getTickets',
        assigneeIds: selectedAssignees.length > 0 ? selectedAssignees : null,
        assigneeNames: selectedAssigneeNames.length > 0 ? selectedAssigneeNames : null
      });
      state.tickets = (response?.tickets || []).map((ticket) => ({ ...ticket, selected: true }));
      setStatus('online', state.tickets.length > 0 ? `${getSelectedTickets().length} ${t().ticketsSelected}` : t().noTickets);
    } catch (error) {
      state.tickets = [];
      setStatus('error', t().noTickets);
      showToast(String(error?.message || error), 'error');
    } finally {
      state.isLoadingTickets = false;
      render();
    }
  }

  async function refreshTickets() {
    await loadTickets();
  }

  function selectAllParticipants() {
    state.participants.forEach((participant) => {
      participant.selected = true;
    });
    loadTickets();
  }

  function clearAllParticipants() {
    state.participants.forEach((participant) => {
      participant.selected = false;
    });
    loadTickets();
  }

  function resetSelection() {
    state.participants.forEach((participant) => {
      participant.selected = !participant.isUnassigned;
    });
    state.tickets.forEach((ticket) => {
      ticket.selected = true;
    });
    render();
  }

  function getSelectedTickets() {
    return state.tickets.filter((ticket) => ticket.selected);
  }

  function generatePlanText() {
    const selected = getSelectedTickets();
    if (selected.length === 0) {
      return '';
    }

    const grouped = new Map();
    for (const ticket of selected) {
      const assigneeName = ticket.assigneeName || t().unassigned;
      if (!grouped.has(assigneeName)) {
        grouped.set(assigneeName, []);
      }
      grouped.get(assigneeName).push(ticket);
    }

    const lines = [`*${t().langTitle || ''}`];
    lines[0] = state.lang === 'es' ? '*PLAN DEL DÍA*' : '*DAILY PLAN*';
    lines.push('');

    grouped.forEach((tickets, assignee) => {
      lines.push(`*${assignee}*`);
      for (const ticket of tickets) {
        const translatedType = translateIssueType(ticket.issueType);
        const typeFragment = state.includeTypeInCopy && translatedType ? ` [${translatedType}]` : '';
        const parts = [`- *${ticket.key}*${typeFragment} — ${ticket.summary}`];
        if (ticket.estimate) {
          parts.push(`${t().estimate}: ${ticket.estimate}`);
        }
        if (ticket.dueDate) {
          parts.push(`${t().due}: ${ticket.dueDate}`);
        }
        lines.push(parts.join(' | '));
      }
      lines.push('');
    });

    return lines.join('\n').trim();
  }

  async function copyPlan() {
    const text = generatePlanText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(t().copied, 'success');
    } catch (_error) {
      showToast(t().copyFailed, 'error');
    }
  }

  function render() {
    if (!state.isJiraBoard) {
      showNotJira();
      return;
    }

    elements.notJiraState.hidden = true;
    elements.mainContent.hidden = false;

    elements.participantsHeading.textContent = t().projectParticipants;
    elements.jumpToPreview.textContent = t().jumpToPreview;
    elements.openInstructions.textContent = t().instructions;
    elements.openAbout.textContent = t().about;
    elements.selectAllParticipants.textContent = t().selectAll;
    elements.clearAllParticipants.textContent = t().clearAll;
    elements.participantsEmptyText.textContent = t().noParticipants;
    elements.ticketsHeading.textContent = `${t().ticketsInProgress}${state.tickets.length ? ` (${getSelectedTickets().length} ${t().ticketsSelected})` : ''}`;
    elements.retryTickets.textContent = t().retry;
    elements.ticketsEmptyText.textContent = t().noTickets;
    elements.outputHeading.textContent = t().preview;
    elements.includeTypeLabel.textContent = t().includeTypeInCopy;
    elements.includeTypeInCopy.checked = state.includeTypeInCopy;
    elements.copyPlan.textContent = t().copyPlan;
    elements.stickyCopyPlan.textContent = t().copyPlan;
    elements.stickyJumpToPreview.textContent = t().jumpToPreview;
    elements.resetSelection.textContent = t().clearAll;
    elements.closeHelp.textContent = t().close;

    renderParticipants();
    renderTickets();
    renderOutput();
  }

  function renderParticipants() {
    elements.participantsSection.hidden = false;
    elements.participantsList.innerHTML = '';

    if (state.participants.length === 0) {
      elements.participantsEmpty.hidden = false;
      return;
    }

    elements.participantsEmpty.hidden = true;

    state.participants.forEach((participant) => {
      const item = document.createElement('li');
      item.className = 'js-checkbox-item';
      if (participant.isUnassigned) item.classList.add('js-checkbox-item--unassigned');

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `participant-${cssSafeId(participant.id)}`;
      input.checked = participant.selected;
      input.setAttribute('aria-label', participant.name);
      input.addEventListener('change', () => {
        participant.selected = input.checked;
        loadTickets();
      });

      const avatar = document.createElement('label');
      avatar.className = 'js-checkbox-item__avatar';
      avatar.setAttribute('for', input.id);
      avatar.setAttribute('aria-hidden', 'true');

      if (participant.avatarUrl) {
        const image = document.createElement('img');
        image.src = participant.avatarUrl;
        image.alt = participant.name;
        image.loading = 'lazy';
        avatar.appendChild(image);
      } else {
        const initial = document.createElement('span');
        initial.textContent = (participant.name || '?').charAt(0).toUpperCase();
        avatar.appendChild(initial);
      }

      const label = document.createElement('label');
      label.className = 'js-checkbox-item__label';
      label.setAttribute('for', input.id);
      label.textContent = participant.name;

      item.appendChild(input);
      item.appendChild(avatar);
      item.appendChild(label);
      elements.participantsList.appendChild(item);
    });
  }

  function renderTickets() {
    elements.ticketsSection.hidden = false;
    elements.ticketsList.innerHTML = '';

    if (state.tickets.length === 0) {
      elements.ticketsEmpty.hidden = false;
      return;
    }

    elements.ticketsEmpty.hidden = true;

    state.tickets.forEach((ticket) => {
      const item = document.createElement('li');
      item.className = 'js-ticket-item';
      if (!ticket.selected) item.classList.add('excluded');

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `ticket-${cssSafeId(ticket.key)}`;
      input.checked = ticket.selected;
      input.setAttribute('aria-label', `${ticket.key}: ${ticket.summary}`);
      input.addEventListener('change', () => {
        ticket.selected = input.checked;
        render();
      });

      const body = document.createElement('label');
      body.className = 'js-ticket-item__body';
      body.setAttribute('for', input.id);

      const key = document.createElement('div');
      key.className = 'js-ticket-item__key';
      key.textContent = ticket.key;

      const summary = document.createElement('div');
      summary.className = 'js-ticket-item__summary';
      summary.textContent = ticket.summary;

      const type = document.createElement('div');
      type.className = 'js-ticket-item__type';
      type.textContent = translateIssueType(ticket.issueType);
      type.hidden = !ticket.issueType;

      const meta = document.createElement('div');
      meta.className = 'js-ticket-item__meta';
      const metaParts = [];
      if (ticket.estimate) metaParts.push(`${t().estimate}: ${ticket.estimate}`);
      if (ticket.dueDate) metaParts.push(`${t().due}: ${ticket.dueDate}`);
      meta.textContent = metaParts.join(' | ');

      body.appendChild(key);
      body.appendChild(type);
      body.appendChild(summary);
      body.appendChild(meta);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-ticket-remove';
      remove.title = t().remove;
      remove.setAttribute('aria-label', `${t().remove} ${ticket.key}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        state.tickets = state.tickets.filter((candidate) => candidate.key !== ticket.key);
        render();
      });

      item.appendChild(input);
      item.appendChild(body);
      item.appendChild(remove);
      elements.ticketsList.appendChild(item);
    });
  }

  function renderOutput() {
    const planText = generatePlanText();
    elements.outputSection.hidden = false;
    elements.outputPreview.textContent = planText || t().noTicketsForSelection;
    elements.actionsRow.hidden = !planText;
    elements.stickyActions.hidden = !planText;
    elements.stickySummary.textContent = planText ? `${getSelectedTickets().length} ${t().ticketsSelected}` : '';
  }

  function scrollToPreview() {
    elements.outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openInstructionsOverlay() {
    elements.helpTitle.textContent = t().instructions;
    elements.helpContent.innerHTML = state.lang === 'es'
      ? `<strong>Uso rápido</strong>\n\n1. Abre un board de Jira.\n2. Selecciona participantes.\n3. Revisa “Tickets en progreso”.\n4. Quita tickets que no deban ir en el plan.\n5. Revisa la previsualización.\n6. Activa o desactiva “Incluir tipo en el texto copiado”.\n7. Copia el plan y pégalo en Google Chat.\n\n<strong>Consejos</strong>\n- Si no aparecen tickets, refresca Jira y usa “Reintentar”.\n- Si el board está agrupado por historias, JiraSnap intenta detectar subtareas dentro del swimlane.\n- El texto copiado puede incluir o no el tipo del issue según la opción marcada.`
      : `<strong>Quick usage</strong>\n\n1. Open a Jira board.\n2. Select participants.\n3. Review “In progress tickets”.\n4. Remove tickets that should not be part of the plan.\n5. Review the preview.\n6. Enable or disable “Include issue type in copied text”.\n7. Copy the plan and paste it into Google Chat.\n\n<strong>Tips</strong>\n- If no tickets appear, refresh Jira and use “Retry”.\n- If the board is grouped by stories, JiraSnap tries to detect subtasks inside the swimlane.\n- The copied text can include or exclude the issue type based on the selected option.`;
    elements.helpOverlay.hidden = false;
  }

  function openAboutOverlay() {
    elements.helpTitle.textContent = t().about;
    elements.helpContent.innerHTML = state.lang === 'es'
      ? `<strong>JiraSnap</strong> ayuda a construir tu plan del día desde Jira.\n\n- Detecta participantes visibles del board.\n- Extrae tickets In Progress, incluidas subtareas.\n- Muestra tipo de issue: Subtarea, Historia, Tarea, Bug, etc.\n- Permite excluir tickets antes de copiar.\n- Genera salida en español o inglés.\n\nDerechos del proyecto: Ing. Gustavo Gutierrez — Bogotá, Colombia.`
      : `<strong>JiraSnap</strong> helps you build your daily plan from Jira.\n\n- Detects visible board participants.\n- Extracts In Progress tickets, including subtasks.\n- Shows issue type: Sub-task, Story, Task, Bug, and more.\n- Lets you exclude tickets before copying.\n- Generates output in Spanish or English.\n\nProject rights: Ing. Gustavo Gutierrez — Bogotá, Colombia.`;
    elements.helpOverlay.hidden = false;
  }

  function closeHelpOverlay() {
    elements.helpOverlay.hidden = true;
  }

  function showLoading(visible) {
    elements.loadingState.hidden = !visible;
    elements.loadingMessage.textContent = t().loading;
    if (visible) {
      elements.mainContent.hidden = true;
      elements.notJiraState.hidden = true;
    } else {
      elements.loadingState.hidden = true;
    }
  }

  function showNotJira() {
    elements.mainContent.hidden = true;
    elements.loadingState.hidden = true;
    elements.notJiraState.hidden = false;
    elements.notJiraMessage.textContent = t().notJira;
    setStatus('error', t().notJira);
  }

  function setStatus(type, message) {
    elements.statusMessage.textContent = message;
    elements.statusDot.className = 'js-status-dot';
    if (type === 'online') elements.statusDot.classList.add('online');
    else if (type === 'error') elements.statusDot.classList.add('error');
    else elements.statusDot.classList.add('loading');
  }

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `js-toast ${type || 'info'}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2400);
  }

  function cssSafeId(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
  }
})();
