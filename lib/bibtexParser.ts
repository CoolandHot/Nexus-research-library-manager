import { Paper } from '../types';

/**
 * Clean up authors from BibTeX format to a friendly comma-separated format.
 * - Replace ~ with space
 * - Split on " and " (case-insensitive)
 * - Join with ", "
 */
export function cleanBibtexAuthors(authorsStr: string): string {
  if (!authorsStr) return '';
  const clean = authorsStr.replace(/~/g, ' ');
  const parts = clean.split(/\s+and\s+/i);
  return parts.map(p => p.trim().replace(/\s+/g, ' ')).filter(Boolean).join(', ');
}

/**
 * Clean up title from BibTeX braces.
 */
export function cleanBibtexTitle(titleStr: string): string {
  if (!titleStr) return '';
  return titleStr.replace(/[{}]/g, '').trim().replace(/\s+/g, ' ');
}

/**
 * Normalize authors from comma-separated format to BibTeX format (using " and ").
 */
function normalizeAuthorsToBibtex(authorsStr: string): string {
  if (!authorsStr) return '';
  if (authorsStr.includes(' and ')) return authorsStr;
  const authors = authorsStr.split(',').map(a => a.trim()).filter(Boolean);
  return authors.join(' and ');
}

/**
 * Parse a raw BibTeX string into structured fields.
 */
export function parseBibTeX(raw: string): {
  entryType: string;
  entryKey: string;
  title: string;
  authors: string;
  year: string;
  doi: string;
  url: string;
  journal?: string;
  volume?: string;
  pages?: string;
  publisher?: string;
  raw: string;
} {
  let str = raw.trim();
  if (str.startsWith('"') && str.endsWith('"')) {
    str = str.slice(1, -1).trim();
  }

  const typeKeyRegex = /@([a-zA-Z0-9_-]+)\s*\{\s*([^\s,]+)\s*,/g;
  const match = typeKeyRegex.exec(str);
  if (!match) {
    return {
      entryType: '',
      entryKey: '',
      title: '',
      authors: '',
      year: '',
      doi: '',
      url: '',
      raw: raw
    };
  }

  const entryType = match[1];
  const entryKey = match[2];
  const fields: Record<string, string> = {};
  let index = typeKeyRegex.lastIndex;

  while (index < str.length) {
    const eqIndex = str.indexOf('=', index);
    if (eqIndex === -1) break;

    const keyPart = str.substring(index, eqIndex).trim();
    const lines = keyPart.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    const fieldNameMatch = lastLine.match(/([a-zA-Z0-9_-]+)$/);
    if (!fieldNameMatch) {
      index = eqIndex + 1;
      continue;
    }
    const fieldName = fieldNameMatch[1].toLowerCase();

    let valStart = eqIndex + 1;
    while (valStart < str.length && /\s/.test(str[valStart])) {
      valStart++;
    }

    let val = '';
    let nextIndex = valStart;

    if (str[valStart] === '{') {
      let braceCount = 1;
      let i = valStart + 1;
      while (i < str.length && braceCount > 0) {
        if (str[i] === '{') braceCount++;
        else if (str[i] === '}') braceCount--;
        i++;
      }
      val = str.substring(valStart + 1, i - 1);
      nextIndex = i;
    } else if (str[valStart] === '"') {
      let escaped = false;
      let i = valStart + 1;
      while (i < str.length) {
        if (str[i] === '"' && !escaped) {
          i++;
          break;
        }
        escaped = str[i] === '\\' && !escaped;
        i++;
      }
      val = str.substring(valStart + 1, i - 1);
      nextIndex = i;
    } else {
      let i = valStart;
      while (i < str.length && str[i] !== ',' && str[i] !== '}' && str[i] !== '\n') {
        i++;
      }
      val = str.substring(valStart, i).trim();
      nextIndex = i;
    }

    fields[fieldName] = val;
    index = nextIndex;
  }

  return {
    entryType,
    entryKey,
    title: fields['title'] || '',
    authors: fields['author'] || '',
    year: fields['year'] || '',
    doi: fields['doi'] || '',
    url: fields['url'] || '',
    journal: fields['journal'],
    volume: fields['volume'],
    pages: fields['pages'],
    publisher: fields['publisher'],
    raw
  };
}

/**
 * Generate or update a BibTeX string from Paper fields.
 */
export function serializeBibTeX(paper: Paper): string {
  let existingBibtex = paper.bibtex || '';
  if (existingBibtex.startsWith('"') && existingBibtex.endsWith('"')) {
    existingBibtex = existingBibtex.slice(1, -1);
  }

  if (!existingBibtex.trim()) {
    const entryType = paper.pdf_link || paper.url?.endsWith('.pdf') ? 'article' : 'misc';
    const authorLast = paper.authors 
      ? paper.authors.split(',')[0].split(' ').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'Unknown' 
      : 'Unknown';
    const entryKey = `${authorLast}${paper.published_year || new Date().getFullYear()}`;

    const fields = [
      `title = {${paper.title || ''}}`,
      paper.authors ? `author = {${normalizeAuthorsToBibtex(paper.authors)}}` : null,
      paper.published_year ? `year = {${paper.published_year}}` : null,
      paper.doi ? `doi = {${paper.doi}}` : null,
      paper.url ? `url = {${paper.url}}` : null
    ].filter(Boolean);

    return `@${entryType}{${entryKey},\n  ${fields.join(',\n  ')}\n}`;
  }

  const parsed = parseBibTeX(existingBibtex);
  let updatedBibtex = existingBibtex;

  const setField = (fieldName: string, newValue: string) => {
    const regex = new RegExp(`(${fieldName}\\s*=\\s*)({[\\s\\S]*?}|"[\\s\\S]*?"|[^,\\n\\}]+)`, 'i');
    const match = regex.exec(updatedBibtex);

    if (match) {
      const fieldStart = match.index;
      const prefix = match[1];
      const matchedValue = match[2];

      let valEnd = fieldStart + prefix.length;
      if (matchedValue.startsWith('{')) {
        let braceCount = 1;
        let i = valEnd + 1;
        while (i < updatedBibtex.length && braceCount > 0) {
          if (updatedBibtex[i] === '{') braceCount++;
          else if (updatedBibtex[i] === '}') braceCount--;
          i++;
        }
        valEnd = i;
      } else if (matchedValue.startsWith('"')) {
        let escaped = false;
        let i = valEnd + 1;
        while (i < updatedBibtex.length) {
          if (updatedBibtex[i] === '"' && !escaped) {
            i++;
            break;
          }
          escaped = updatedBibtex[i] === '\\' && !escaped;
          i++;
        }
        valEnd = i;
      } else {
        valEnd = fieldStart + match[0].length;
      }

      const before = updatedBibtex.substring(0, fieldStart + prefix.length);
      const after = updatedBibtex.substring(valEnd);
      updatedBibtex = `${before}{${newValue}}${after}`;
    } else {
      const insertIndex = updatedBibtex.indexOf(',');
      if (insertIndex !== -1) {
        const before = updatedBibtex.substring(0, insertIndex + 1);
        const after = updatedBibtex.substring(insertIndex + 1);
        updatedBibtex = `${before}\n  ${fieldName} = {${newValue}},${after}`;
      }
    }
  };

  if (paper.title !== cleanBibtexTitle(parsed.title)) {
    setField('title', paper.title);
  }
  if (paper.authors !== cleanBibtexAuthors(parsed.authors)) {
    setField('author', normalizeAuthorsToBibtex(paper.authors || ''));
  }
  if (paper.published_year !== parsed.year) {
    setField('year', paper.published_year || '');
  }
  if (paper.doi !== parsed.doi) {
    setField('doi', paper.doi || '');
  }
  if (paper.url !== parsed.url) {
    setField('url', paper.url || '');
  }

  return updatedBibtex;
}

/**
 * Parse "Title@year" fallback format.
 */
export function parseTitleAtYear(value: string): { title: string; year: string } {
  if (!value) return { title: '', year: '' };
  const lastIndex = value.lastIndexOf('@');
  if (lastIndex === -1) {
    return { title: value.trim(), year: '' };
  }
  const title = value.substring(0, lastIndex).trim();
  const year = value.substring(lastIndex + 1).trim();
  if (/^\d{4}$/.test(year)) {
    return { title, year };
  }
  return { title: value.trim(), year: '' };
}

/**
 * Convert a sheet row [A, B, C, D, E, F] into a Paper object.
 */
export function sheetRowToPaper(row: string[], sheetName: string, rowIndex: number): Paper {
  const rawBibtex = row[0] || '';
  const titleAtYear = row[1] || '';
  const summary = row[2] || '';
  const critical_evaluation = row[3] || '';
  const remarks = row[4] || '';
  const useful_snippet = row[5] || '';

  const parsed = parseBibTeX(rawBibtex);

  let title = cleanBibtexTitle(parsed.title);
  let year = parsed.year;

  if (!title || !year) {
    const fallback = parseTitleAtYear(titleAtYear);
    if (!title) title = fallback.title;
    if (!year) year = fallback.year;
  }

  const authors = cleanBibtexAuthors(parsed.authors);
  const url = parsed.url || '';
  const type = (url.toLowerCase().endsWith('.pdf') || (rawBibtex && rawBibtex.toLowerCase().includes('pdf_link'))) ? 'pdf' : 'web';

  return {
    id: `${sheetName}::${rowIndex}`,
    title: title || 'Untitled Paper',
    url: url || (parsed.doi ? `https://doi.org/${parsed.doi}` : ''),
    pdf_link: url.toLowerCase().endsWith('.pdf') ? url : undefined,
    doi: parsed.doi || undefined,
    folder_id: sheetName,
    type,
    authors: authors || undefined,
    published_year: year || undefined,
    summary: summary || undefined,
    critical_evaluation: critical_evaluation || undefined,
    remarks: remarks || undefined,
    useful_snippet: useful_snippet || undefined,
    bibtex: rawBibtex,
    _rowIndex: rowIndex,
    _sheetName: sheetName
  };
}

/**
 * Convert a Paper object back to a sheet row [A, B, C, D, E, F].
 */
export function paperToSheetRow(paper: Paper): string[] {
  const bibtex = serializeBibTeX(paper);
  const titleAtYear = paper.published_year 
    ? `${paper.title || ''}@${paper.published_year}` 
    : (paper.title || '');

  return [
    bibtex,
    titleAtYear,
    paper.summary || '',
    paper.critical_evaluation || '',
    paper.remarks || '',
    paper.useful_snippet || ''
  ];
}
