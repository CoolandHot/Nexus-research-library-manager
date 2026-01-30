
export type PaperType = 'web' | 'pdf';

export interface Profile {
  id: string;
  username: string;
  library_url: string | null;
  library_key: string | null;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  user_id?: string;
}

export interface Paper {
  id: string;
  title: string;
  url: string;
  pdf_link?: string;
  doi?: string;
  folder_id: string | null;
  type: PaperType;
  authors?: string;
  published_year?: string;
  summary?: string;
  abstract?: string;
  userLabel?: string;
  importance?: number;
  critical_evaluation?: string;
  remarks?: string;
  useful_snippet?: string;
}

export interface TreeItem extends Folder {
  children: TreeItem[];
  papers: Paper[];
}

export interface ShareLink {
  id: string;
  share_id: string;
  title: string;
  description?: string;
  papers: Paper[];  // Full paper data, not just IDs
  created_by?: string;
  created_at: string;
  expires_at?: string;
  access_count: number;
}
