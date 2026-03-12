export function buildCitationStyles(work, bibtex = "") {
  return {
    bibtex: formatBibtex(bibtex),
    apa: formatApa(work),
    mla: formatMla(work),
    chicago: formatChicago(work)
  };
}

export function formatBibtex(rawBibtex) {
  const input = (rawBibtex || "").trim();
  if (!input) {
    return "";
  }

  const collapsed = input.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  const start = collapsed.indexOf("{");
  const end = collapsed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return collapsed;
  }

  const header = collapsed.slice(0, start).trim();
  const body = collapsed.slice(start + 1, end).trim();
  const entryParts = splitTopLevel(body);
  if (!entryParts.length) {
    return collapsed;
  }

  const [entryKey, ...fields] = entryParts;
  const lines = [`${header}{${entryKey.trim()},`];

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index].trim();
    if (!field) {
      continue;
    }

    const suffix = index === fields.length - 1 ? "" : ",";
    lines.push(`  ${field}${suffix}`);
  }

  lines.push("}");
  return lines.join("\n");
}

function splitTopLevel(value) {
  const parts = [];
  let current = "";
  let depth = 0;
  let inQuotes = false;
  let previous = "";

  for (const char of value) {
    if (char === '"' && previous !== "\\") {
      inQuotes = !inQuotes;
    }

    if (!inQuotes) {
      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth = Math.max(0, depth - 1);
      } else if (char === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
        previous = char;
        continue;
      }
    }

    current += char;
    previous = char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function formatApa(work) {
  const authors = formatAuthorList(work.authors, "apa");
  const year = work.year ? `(${work.year}).` : "(n.d.).";
  const venue = work.venue ? ` ${work.venue}.` : "";
  const doi = work.doi ? ` https://doi.org/${work.doi}` : work.url ? ` ${work.url}` : "";
  return `${authors} ${year} ${work.title}.${venue}${doi}`.replace(/\s+/g, " ").trim();
}

function formatMla(work) {
  const authors = formatAuthorList(work.authors, "mla");
  const venue = work.venue ? ` ${work.venue},` : "";
  const year = work.year ? ` ${work.year},` : "";
  const locator = work.doi ? ` https://doi.org/${work.doi}.` : work.url ? ` ${work.url}.` : "";
  return `${authors} "${work.title}."${venue}${year}${locator}`.replace(/\s+/g, " ").trim();
}

function formatChicago(work) {
  const authors = formatAuthorList(work.authors, "chicago");
  const year = work.year ? ` ${work.year}.` : "";
  const venue = work.venue ? ` ${work.venue}.` : "";
  const locator = work.doi ? ` https://doi.org/${work.doi}.` : work.url ? ` ${work.url}.` : "";
  return `${authors} "${work.title}."${year}${venue}${locator}`.replace(/\s+/g, " ").trim();
}

function formatAuthorList(authors, style) {
  if (!authors?.length) {
    return "";
  }

  if (style === "apa") {
    return authors.map(formatApaAuthor).join(", ");
  }

  if (authors.length === 1) {
    return authors[0];
  }

  return `${authors[0]} et al.`;
}

function formatApaAuthor(name) {
  const parts = name.split(" ").filter(Boolean);
  const family = parts.pop();
  const initials = parts.map((part) => `${part[0]}.`).join(" ");
  return [family ? `${family},` : "", initials].filter(Boolean).join(" ").trim();
}
