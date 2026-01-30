import { Paper } from '../types';

/**
 * Generate BibTeX citation format
 */
export const formatBibTeX = (paper: Paper): string => {
    const generateKey = (paper: Paper): string => {
        const author = paper.authors ? paper.authors.split(',')[0].split(' ').pop() || 'Unknown' : 'Unknown';
        const year = paper.published_year || 'n.d.';
        const titleWord = paper.title.split(' ')[0].replace(/[^a-zA-Z]/g, '');
        return `${author}${year}${titleWord}`.replace(/\s/g, '');
    };

    const key = generateKey(paper);
    const author = paper.authors || 'Unknown';
    const title = paper.title;
    const year = paper.published_year || '';
    const doi = paper.doi || '';
    const url = paper.url || '';

    let bibtex = `@article{${key},\n`;
    bibtex += `  author = {${author}},\n`;
    bibtex += `  title = {${title}},\n`;
    if (year) bibtex += `  year = {${year}},\n`;
    if (doi) bibtex += `  doi = {${doi}},\n`;
    if (url) bibtex += `  url = {${url}},\n`;
    bibtex += `}`;

    return bibtex;
};

/**
 * Generate APA format citation
 */
export const formatAPA = (paper: Paper): string => {
    const authors = paper.authors || 'Unknown Author';
    const year = paper.published_year ? `(${paper.published_year})` : '(n.d.)';
    const title = paper.title;
    const doi = paper.doi ? ` https://doi.org/${paper.doi}` : '';
    const url = !doi && paper.url ? ` Retrieved from ${paper.url}` : '';

    return `${authors} ${year}. ${title}.${doi}${url}`;
};

/**
 * Generate RIS format citation
 */
export const formatRIS = (paper: Paper): string => {
    let ris = 'TY  - JOUR\n'; // Journal Article type

    if (paper.authors) {
        const authorList = paper.authors.split(',').map(a => a.trim());
        authorList.forEach(author => {
            ris += `AU  - ${author}\n`;
        });
    }

    ris += `TI  - ${paper.title}\n`;

    if (paper.published_year) {
        ris += `PY  - ${paper.published_year}\n`;
    }

    if (paper.doi) {
        ris += `DO  - ${paper.doi}\n`;
    }

    if (paper.url) {
        ris += `UR  - ${paper.url}\n`;
    }

    if (paper.abstract) {
        ris += `AB  - ${paper.abstract}\n`;
    }

    ris += 'ER  - \n';

    return ris;
};

/**
 * Copy citation to clipboard with visual feedback
 */
export const copyCitation = async (text: string, format: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error(`Failed to copy ${format} citation:`, err);
        return false;
    }
};
