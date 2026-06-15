export type PaperType = 'web' | 'pdf';

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface Paper {
  id: string;              // Format: `${sheetName}::${rowIndex}`
  title: string;
  url: string;
  pdf_link?: string;
  doi?: string;
  folder_id: string | null;  // Matches the Google Sheet tab name
  type: PaperType;
  authors?: string;
  published_year?: string;
  summary?: string;
  abstract?: string;
  critical_evaluation?: string;
  remarks?: string;
  useful_snippet?: string;
  bibtex?: string;           // Raw BibTeX string from Column A
  _rowIndex?: number;        // Row index in sheet (1-based, typically 2 or greater)
  _sheetName?: string;       // Name of the sheet tab
}

export interface TreeItem extends Folder {
  children: TreeItem[];
  papers: Paper[];
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
}
