const CROSSREF_API = "https://api.crossref.org/works";
const OPENALEX_API = "https://api.openalex.org/works";

export async function searchWorks(rawQuery) {
  const query = rawQuery.trim();
  if (!query) {
    return [];
  }

  const [crossrefResults, openAlexResults] = await Promise.allSettled([
    searchCrossref(query),
    searchOpenAlex(query)
  ]);

  const merged = mergeByDoi(
    crossrefResults.status === "fulfilled" ? crossrefResults.value : [],
    openAlexResults.status === "fulfilled" ? openAlexResults.value : []
  );

  return merged.slice(0, 8);
}

export async function hydrateWorkDetails(work) {
  if (work.abstract) {
    return work;
  }

  const detailedWork = await fetchOpenAlexWork(work);
  if (!detailedWork) {
    return work;
  }

  return {
    ...work,
    abstract: detailedWork.abstract || work.abstract,
    venue: work.venue || detailedWork.venue,
    url: work.url || detailedWork.url,
    doi: work.doi || detailedWork.doi,
    openAlexId: work.openAlexId || detailedWork.openAlexId
  };
}

export async function fetchBibtex(doi) {
  if (!doi) {
    return "";
  }

  const response = await fetch(`${CROSSREF_API}/${encodeURIComponent(doi)}/transform`, {
    headers: {
      Accept: "application/x-bibtex"
    }
  });

  if (!response.ok) {
    throw new Error(`BibTeX lookup failed: ${response.status}`);
  }

  return response.text();
}

async function searchCrossref(query) {
  const url = new URL(CROSSREF_API);
  url.searchParams.set("query.bibliographic", query);
  url.searchParams.set("rows", "5");
  url.searchParams.set("select", "DOI,title,author,issued,container-title,URL");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Crossref search failed: ${response.status}`);
  }

  const payload = await response.json();
  return (payload.message?.items || []).map((item) => ({
    doi: item.DOI || "",
    title: item.title?.[0] || "Untitled",
    authors: normalizeCrossrefAuthors(item.author || []),
    year: item.issued?.["date-parts"]?.[0]?.[0] || "",
    venue: item["container-title"]?.[0] || "",
    url: item.URL || "",
    source: "Crossref",
    abstract: ""
  }));
}

async function searchOpenAlex(query) {
  const url = new URL(OPENALEX_API);
  url.searchParams.set("search", query);
  url.searchParams.set("per-page", "5");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenAlex search failed: ${response.status}`);
  }

  const payload = await response.json();
  return (payload.results || []).map((item) => ({
    doi: normalizeOpenAlexDoi(item.doi),
    openAlexId: item.id || "",
    title: item.title || "Untitled",
    authors: (item.authorships || []).map((author) => author.author?.display_name).filter(Boolean),
    year: item.publication_year || "",
    venue: item.primary_location?.source?.display_name || "",
    url: item.primary_location?.landing_page_url || item.id || "",
    source: "OpenAlex",
    abstract: invertAbstract(item.abstract_inverted_index)
  }));
}

function mergeByDoi(crossrefResults, openAlexResults) {
  const byKey = new Map();

  for (const item of [...crossrefResults, ...openAlexResults]) {
    const key = item.doi || item.title.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

      byKey.set(key, {
      ...existing,
      ...item,
      authors: existing.authors.length ? existing.authors : item.authors,
      abstract: existing.abstract || item.abstract,
      url: existing.url || item.url,
      venue: existing.venue || item.venue,
      year: existing.year || item.year,
      openAlexId: existing.openAlexId || item.openAlexId
    });
  }

  return [...byKey.values()];
}

function normalizeCrossrefAuthors(authors) {
  return authors
    .map((author) => [author.given, author.family].filter(Boolean).join(" ").trim())
    .filter(Boolean);
}

function normalizeOpenAlexDoi(doi) {
  if (!doi) {
    return "";
  }
  return doi.replace(/^https?:\/\/doi.org\//i, "");
}

function invertAbstract(index) {
  if (!index) {
    return "";
  }

  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) {
      words[position] = word;
    }
  }

  return words.filter(Boolean).join(" ");
}

async function fetchOpenAlexWork(work) {
  if (work.openAlexId) {
    return fetchOpenAlexByUrl(work.openAlexId);
  }

  if (work.doi) {
    return fetchOpenAlexByUrl(`https://doi.org/${work.doi}`);
  }

  return null;
}

async function fetchOpenAlexByUrl(idOrUrl) {
  const response = await fetch(`${OPENALEX_API}/${encodeURIComponent(idOrUrl)}`);
  if (!response.ok) {
    return null;
  }

  const item = await response.json();
  return {
    doi: normalizeOpenAlexDoi(item.doi),
    openAlexId: item.id || "",
    title: item.title || "Untitled",
    authors: (item.authorships || []).map((author) => author.author?.display_name).filter(Boolean),
    year: item.publication_year || "",
    venue: item.primary_location?.source?.display_name || "",
    url: item.primary_location?.landing_page_url || item.id || "",
    source: "OpenAlex",
    abstract: invertAbstract(item.abstract_inverted_index)
  };
}
