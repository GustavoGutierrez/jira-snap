/**
 * @fileoverview Internationalisation (i18n) utility for JiraSnap.
 * Provides bilingual strings (ES/EN) with runtime language switching.
 * No external dependencies — fully self-contained.
 *
 * @author Ing. Gustavo Gutierrez — Bogotá, Colombia
 */

/**
 * @typedef {Object} LocaleStrings
 * @property {string} extensionName
 * @property {string} projectParticipants
 * @property {string} ticketsInProgress
 * @property {string} preview
 * @property {string} copyPlan
 * @property {string} copied
 * @property {string} planTitle
 * @property {string} estimate
 * @property {string} due
 * @property {string} remove
 * @property {string} noTickets
 * @property {string} notJira
 * @property {string} loading
 * @property {string} selectAll
 * @property {string} clearAll
 * @property {string} noParticipants
 * @property {string} retry
 * @property {string} estimateAbbr
 * @property {string} dueAbbr
 * @property {string} filterByAssignee
 * @property {string} unassigned
 * @property {string} ticketsSelected
 * @property {string} noTicketsForSelection
 */

/**
 * @type {{es: LocaleStrings, en: LocaleStrings}}
 */
export const strings = {
  es: {
    extensionName: 'JiraSnap',
    projectParticipants: 'Participantes',
    ticketsInProgress: 'Tickets en progreso',
    preview: 'Previsualización',
    copyPlan: 'Copiar plan',
    copied: '¡Copiado!',
    planTitle: 'PLAN DEL DÍA',
    estimate: 'Estimado',
    due: 'Vence',
    remove: 'Quitar',
    noTickets: 'No se encontraron tickets en progreso',
    notJira: 'La pestaña actual no es un board de Jira soportado',
    loading: 'Cargando...',
    selectAll: 'Seleccionar todos',
    clearAll: 'Limpiar selección',
    noParticipants: 'No se detectaron participantes',
    retry: 'Reintentar',
    estimateAbbr: 'Est',
    dueAbbr: 'Vence',
    filterByAssignee: 'Filtrar por responsable',
    unassigned: 'Sin asignar',
    ticketsSelected: 'tickets seleccionados',
    noTicketsForSelection: 'No hay tickets para los participantes seleccionados'
  },
  en: {
    extensionName: 'JiraSnap',
    projectParticipants: 'Participants',
    ticketsInProgress: 'In progress tickets',
    preview: 'Preview',
    copyPlan: 'Copy plan',
    copied: 'Copied!',
    planTitle: 'DAILY PLAN',
    estimate: 'Estimate',
    due: 'Due',
    remove: 'Remove',
    noTickets: 'No in-progress tickets found',
    notJira: 'The current tab is not a supported Jira board',
    loading: 'Loading...',
    selectAll: 'Select all',
    clearAll: 'Clear selection',
    noParticipants: 'No participants detected',
    retry: 'Retry',
    estimateAbbr: 'Est',
    dueAbbr: 'Due',
    filterByAssignee: 'Filter by assignee',
    unassigned: 'Unassigned',
    ticketsSelected: 'tickets selected',
    noTicketsForSelection: 'No tickets for selected participants'
  }
};

/**
 * Current active language code ('es' | 'en')
 * @type {string}
 */
let currentLang = 'es';

/**
 * Returns the translation for the given key in the current language.
 * Falls back to 'es' if the key is not found.
 * @param {string} key - The string key to translate.
 * @returns {string} The translated string.
 */
export function t(key) {
  const langStrings = strings[currentLang] || strings.es;
  return langStrings[key] || strings.es[key] || key;
}

/**
 * Returns the current language code.
 * @returns {string}
 */
export function getLang() {
  return currentLang;
}

/**
 * Sets the current language and persists it to chrome.storage.local.
 * @param {'es' | 'en'} lang
 * @returns {Promise<void>}
 */
export function setLang(lang) {
  currentLang = lang;
  return new Promise((resolve) => {
    chrome.storage.local.set({ jiraSnapLang: lang }, resolve);
  });
}

/**
 * Loads the persisted language from chrome.storage.local.
 * Must be called before the popup UI renders.
 * @returns {Promise<void>}
 */
export function initLang() {
  return new Promise((resolve) => {
    chrome.storage.local.get('jiraSnapLang', (data) => {
      if (data.jiraSnapLang && strings[data.jiraSnapLang]) {
        currentLang = data.jiraSnapLang;
      }
      resolve();
    });
  });
}

/**
 * Toggles between ES and EN.
 * @returns {'es' | 'en'} The new language code.
 */
export function toggleLang() {
  currentLang = currentLang === 'es' ? 'en' : 'es';
  chrome.storage.local.set({ jiraSnapLang: currentLang });
  return currentLang;
}