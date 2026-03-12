import { buildCitationStyles, formatBibtex } from "../lib/formatters.js";
import { fetchBibtex, hydrateWorkDetails, searchWorks } from "../lib/providers.js";

const THEME_STORAGE_KEY = "sidepanelTheme";
const tabStatus = document.getElementById("tab-status");
const queryInput = document.getElementById("reference-query");
const searchButton = document.getElementById("search-button");
const pasteButton = document.getElementById("paste-button");
const useSelectionButton = document.getElementById("use-selection-button");
const resultsContainer = document.getElementById("results");
const template = document.getElementById("result-template");
const themeToggle = document.getElementById("theme-toggle");
const themeText = themeToggle.querySelector(".theme-text");

initialize();

searchButton.addEventListener("click", () => {
  runSearch(queryInput.value);
});

pasteButton.addEventListener("click", async () => {
  const clipboardText = await readClipboardText();
  if (!clipboardText) {
    tabStatus.textContent = "Clipboard read failed or clipboard text is empty.";
    return;
  }

  queryInput.value = clipboardText;
  tabStatus.textContent = "Pasted text from clipboard.";
});

useSelectionButton.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({
    type: "consume-pending-reference-query"
  });

  if (response?.query) {
    queryInput.value = response.query;
    tabStatus.textContent = "Loaded stored selected text.";
    runSearch(response.query);
    return;
  }

  const clipboardText = await readClipboardText();
  if (clipboardText) {
    queryInput.value = clipboardText;
    tabStatus.textContent = "No stored selection was found. Loaded clipboard text instead.";
    runSearch(clipboardText);
    return;
  }

  tabStatus.textContent =
    "No stored selection was found. In the browser's native PDF viewer, use the context menu on selected text or copy the text first.";
});

themeToggle.addEventListener("click", async () => {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  await chrome.storage.local.set({ [THEME_STORAGE_KEY]: nextTheme });
});

async function initialize() {
  await loadTheme();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const context = await chrome.runtime.sendMessage({ type: "pdf-tab-context" });

  if (!context?.ok) {
    tabStatus.textContent = context?.error || "Unable to resolve tab context.";
    return;
  }

  const displayTitle = context.title || tab?.title || "Untitled tab";
  if (context.isLikelyPdf) {
    tabStatus.textContent = `Active tab looks like a PDF: ${displayTitle}`;
  } else {
    tabStatus.textContent = `Active tab is not a direct PDF URL: ${displayTitle}`;
  }
}

async function loadTheme() {
  const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);
  const theme = stored[THEME_STORAGE_KEY] || "light";
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeText.textContent = theme === "dark" ? "Light mode" : "Dark mode";
}

async function runSearch(rawQuery) {
  const query = rawQuery.trim();
  if (!query) {
    renderEmpty("Enter a title, DOI, or full reference text.");
    return;
  }

  searchButton.disabled = true;
  searchButton.textContent = "Searching...";
  renderEmpty("Searching citation databases...");

  try {
    const works = await searchWorks(query);
    if (!works.length) {
      renderEmpty("No likely matches found.");
      return;
    }

    await renderResults(works);
  } catch (error) {
    renderEmpty(error.message || "Search failed.");
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = "Search citation";
  }
}

function renderEmpty(message) {
  resultsContainer.innerHTML = `<p class="empty">${escapeHtml(message)}</p>`;
}

async function renderResults(works) {
  resultsContainer.innerHTML = "";

  for (const work of works) {
    const hydratedWork = await hydrateWorkDetails(work);
    const fragment = template.content.cloneNode(true);
    const root = fragment.querySelector(".result");
    const title = fragment.querySelector(".result-title");
    const link = fragment.querySelector(".result-link");
    const venue = fragment.querySelector(".result-venue");
    const doi = fragment.querySelector(".result-doi");
    const abstract = fragment.querySelector(".result-abstract");
    const abstractToggle = fragment.querySelector(".toggle-abstract");
    const citationSelect = fragment.querySelector(".citation-select");
    const copyCitationButton = fragment.querySelector(".copy-citation");
    const citationPreview = fragment.querySelector(".citation-preview");

    title.textContent = hydratedWork.title || "Untitled";
    link.href = hydratedWork.url || (hydratedWork.doi ? `https://doi.org/${hydratedWork.doi}` : "#");
    venue.textContent = hydratedWork.venue || "Unavailable";
    doi.textContent = hydratedWork.doi || "Unavailable";

    if (hydratedWork.abstract) {
      abstract.textContent = hydratedWork.abstract;
      abstractToggle.addEventListener("click", () => {
        const isHidden = abstract.classList.toggle("hidden");
        abstractToggle.textContent = isHidden ? "Show abstract" : "Hide abstract";
      });
    } else {
      abstractToggle.disabled = true;
      abstractToggle.textContent = "Abstract unavailable";
      abstract.textContent = "";
    }

    citationPreview.textContent = "Loading BibTeX...";
    copyCitationButton.disabled = true;

    const bibtex = await loadBibtex(hydratedWork);
    const styles = buildCitationStyles(hydratedWork, bibtex);

    citationPreview.textContent = styles.bibtex || "BibTeX unavailable.";
    copyCitationButton.disabled = false;

    citationSelect.addEventListener("change", () => {
      const selectedStyle = citationSelect.value;
      citationPreview.textContent = styles[selectedStyle] || "Citation unavailable.";
    });

    copyCitationButton.addEventListener("click", () => {
      const selectedStyle = citationSelect.value;
      copyText(styles[selectedStyle] || "");
    });

    resultsContainer.appendChild(root);
  }
}

async function loadBibtex(work) {
  if (!work.doi) {
    return "";
  }

  try {
    const rawBibtex = await fetchBibtex(work.doi);
    return formatBibtex(rawBibtex);
  } catch {
    return "";
  }
}

async function copyText(value) {
  if (!value) {
    return;
  }

  await navigator.clipboard.writeText(value);
}

async function readClipboardText() {
  try {
    const clipboardText = await navigator.clipboard.readText();
    return clipboardText.trim() ? clipboardText : "";
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
