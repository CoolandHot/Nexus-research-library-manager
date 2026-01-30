import { Paper } from '../types';
import { marked } from 'marked';

// Configure marked for safe HTML output
marked.setOptions({
  breaks: true,
  gfm: true
});

const markdownToHtml = (text: string): string => {
  return marked.parse(text) as string;
};

export const generateAnnotatedBibliography = (papers: Paper[], title: string = 'Annotated Bibliography'): string => {
  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Sort papers by author name, then year
  const sortedPapers = [...papers].sort((a, b) => {
    const authorA = (a.authors || 'Unknown').split(',')[0].trim();
    const authorB = (b.authors || 'Unknown').split(',')[0].trim();
    if (authorA !== authorB) return authorA.localeCompare(authorB);
    return (b.published_year || '').localeCompare(a.published_year || '');
  });

  const paperEntries = sortedPapers.map((paper, index) => {
    const citation = formatCitation(paper);
    const abstract = paper.abstract ? `<div class="section"><strong>Abstract:</strong> <div class="markdown-content">${markdownToHtml(paper.abstract)}</div></div>` : '';
    const summary = paper.summary ? `<div class="section"><strong>Summary:</strong> <div class="markdown-content">${markdownToHtml(paper.summary)}</div></div>` : '';
    const evaluation = paper.critical_evaluation ? `<div class="section"><strong>Critical Evaluation:</strong> <div class="markdown-content">${markdownToHtml(paper.critical_evaluation)}</div></div>` : '';
    const remarks = paper.remarks ? `<div class="section"><strong>Remarks:</strong> <div class="markdown-content">${markdownToHtml(paper.remarks)}</div></div>` : '';
    const label = paper.userLabel ? `<div class="label">${escapeHtml(paper.userLabel)}</div>` : '';

    return `
      <div class="entry">
        <div class="entry-number">[${index + 1}]</div>
        <div class="entry-content">
          ${label}
          <div class="citation">${citation}</div>
          ${abstract}
          ${summary}
          ${evaluation}
          ${remarks}
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.6;
      color: #1e293b;
      background: #f8fafc;
      padding: 40px 20px;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 60px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    h1 {
      font-size: 2.5em;
      margin-bottom: 0.3em;
      color: #0f172a;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 0.3em;
    }
    
    .meta {
      color: #64748b;
      margin-bottom: 3em;
      font-size: 0.95em;
    }
    
    .entry {
      margin-bottom: 2.5em;
      display: flex;
      gap: 15px;
      page-break-inside: avoid;
    }
    
    .entry-number {
      font-weight: bold;
      color: #3b82f6;
      min-width: 40px;
      font-size: 0.9em;
    }
    
    .entry-content {
      flex: 1;
    }
    
    .label {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 0.75em;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    .citation {
      font-weight: bold;
      margin-bottom: 1em;
      color: #0f172a;
    }
    
    .citation a {
      color: #3b82f6;
      text-decoration: none;
    }
    
    .citation a:hover {
      text-decoration: underline;
    }
    
    .section {
      margin-bottom: 1em;
      text-align: justify;
    }
    
    .section > strong {
      color: #475569;
      display: block;
      margin-bottom: 0.3em;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    .markdown-content {
      line-height: 1.7;
    }
    
    .markdown-content p {
      margin-bottom: 0.8em;
    }
    
    .markdown-content strong {
      font-weight: bold;
      color: inherit;
    }
    
    .markdown-content em {
      font-style: italic;
    }
    
    .markdown-content ul, .markdown-content ol {
      margin-left: 1.5em;
      margin-bottom: 0.8em;
    }
    
    .markdown-content li {
      margin-bottom: 0.3em;
    }
    
    .markdown-content code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    .markdown-content a {
      color: #3b82f6;
      text-decoration: none;
    }
    
    .markdown-content a:hover {
      text-decoration: underline;
    }

    .markdown-content h1, .markdown-content h2, .markdown-content h3 {
      margin-top: 1em;
      margin-bottom: 0.5em;
      color: #334155;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .container {
        box-shadow: none;
        padding: 40px;
      }
      
      .entry {
        page-break-inside: avoid;
      }
    }
    
    @media (max-width: 768px) {
      .container {
        padding: 30px 20px;
      }
      
      h1 {
        font-size: 2em;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      Generated: ${formattedDate} | Total Entries: ${papers.length}
    </div>
    ${paperEntries}
  </div>
</body>
</html>`;
};

const formatCitation = (paper: Paper): string => {
  const authors = paper.authors || 'Unknown Author';
  const year = paper.published_year ? ` (${paper.published_year})` : '';
  const title = paper.title;
  const doi = paper.doi ? ` DOI: ${paper.doi}` : '';
  const url = paper.url ? ` <a href="${escapeHtml(paper.url)}" target="_blank">[Link]</a>` : '';

  return `${escapeHtml(authors)}${year}. <em>${escapeHtml(title)}</em>.${doi}${url}`;
};

const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const downloadBibliography = (papers: Paper[], filename: string = 'annotated_bibliography') => {
  const html = generateAnnotatedBibliography(papers);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.html`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};
