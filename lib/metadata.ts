
export const parseBibTeX = (bibtex: string) => {
  const papers: any[] = [];
  const entries = bibtex.split(/@\w+\s*{/);

  entries.forEach(entry => {
    if (!entry.trim()) return;

    const extract = (key: string) => {
      const regex = new RegExp(`${key}\\s*=\\s*[{"](.*?)[}"]`, 'i');
      const match = entry.match(regex);
      return match ? match[1].replace(/{|}/g, '') : '';
    };

    const title = extract('title');
    const author = extract('author');
    const year = extract('year');
    const url = extract('url') || extract('doi');

    if (title) {
      papers.push({
        title,
        authors: author,
        published_year: year,
        url: url.startsWith('http') ? url : (url ? `https://doi.org/${url}` : 'https://example.com/no-url-provided'),
        doi: url.startsWith('10.') ? url : '',
        type: url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'web',
        abstract: extract('abstract') || ''
      });
    }
  });
  return papers;
};

export const fetchCrossRefMetadata = async (input: string) => {
  const doiRegex = /10.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
  const match = input.match(doiRegex);

  if (!match) return null;
  const doi = match[0];

  try {
    const response = await fetch(`https://api.crossref.org/works/${doi}`);
    if (!response.ok) return null;

    const { message } = await response.json();

    return {
      title: message.title?.[0] || '',
      authors: message.author?.map((a: any) => `${a.given} ${a.family}`).join(', ') || '',
      published_year: message.published?.['date-parts']?.[0]?.[0]?.toString() || '',
      url: message.URL || `https://doi.org/${doi}`,
      doi: doi,
      type: 'web' as const,
      abstract: message.abstract ? message.abstract.replace(/<[^>]*>/g, '') : ''
    };
  } catch (e) {
    console.error("CrossRef Error:", e);
    return null;
  }
};
