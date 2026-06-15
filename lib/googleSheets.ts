import { Paper, Folder } from '../types';
import { sheetRowToPaper, paperToSheetRow } from './bibtexParser';

let tokenClient: any = null;
let accessToken: string | null = null;
let tokenExpiry: number | null = null;
let authListeners: ((signedIn: boolean) => void)[] = [];
let sheetIdMap: Record<string, number> = {};

/**
 * Get active access token if not expired.
 */
export function getAccessToken(): string | null {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }
  // Clear expired token
  if (accessToken) {
    signOut();
  }
  return null;
}

/**
 * Check if the user is currently signed in.
 */
export function isSignedIn(): boolean {
  return getAccessToken() !== null;
}

/**
 * Sign out from Google.
 */
export function signOut(): void {
  accessToken = null;
  tokenExpiry = null;
  localStorage.removeItem('google_oauth_token');
  localStorage.removeItem('google_oauth_token_expiry');
  authListeners.forEach(listener => listener(false));
}

/**
 * Initialize Google Identity Services (GIS) client.
 */
export function initGoogleApi(clientId: string): Promise<void> {
  return new Promise((resolve) => {
    const checkGis = () => {
      const google = (window as any).google;
      if (google?.accounts?.oauth2) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/spreadsheets',
          callback: (tokenResponse: any) => {
            if (tokenResponse.error) {
              return;
            }
            accessToken = tokenResponse.access_token;
            tokenExpiry = Date.now() + parseInt(tokenResponse.expires_in) * 1000;
            localStorage.setItem('google_oauth_token', accessToken!);
            localStorage.setItem('google_oauth_token_expiry', tokenExpiry.toString());
            authListeners.forEach(listener => listener(true));
          }
        });

        // Restore saved session if valid
        const savedToken = localStorage.getItem('google_oauth_token');
        const savedExpiry = localStorage.getItem('google_oauth_token_expiry');
        if (savedToken && savedExpiry) {
          const expiry = parseInt(savedExpiry);
          if (Date.now() < expiry) {
            accessToken = savedToken;
            tokenExpiry = expiry;
            authListeners.forEach(listener => listener(true));
          }
        }
        resolve();
      } else {
        setTimeout(checkGis, 100);
      }
    };
    checkGis();
  });
}

/**
 * Sign in using Google Identity Services (GIS).
 */
export function signIn(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google OAuth client not initialized'));
      return;
    }

    const originalCallback = tokenClient.callback;
    tokenClient.callback = (tokenResponse: any) => {
      tokenClient.callback = originalCallback; // Restore original callback
      if (tokenResponse.error) {
        reject(tokenResponse);
      } else {
        accessToken = tokenResponse.access_token;
        tokenExpiry = Date.now() + parseInt(tokenResponse.expires_in) * 1000;
        localStorage.setItem('google_oauth_token', accessToken!);
        localStorage.setItem('google_oauth_token_expiry', tokenExpiry.toString());
        authListeners.forEach(listener => listener(true));
        resolve();
      }
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Register auth state listener.
 */
export function onAuthChange(callback: (signedIn: boolean) => void): () => void {
  authListeners.push(callback);
  callback(isSignedIn());
  return () => {
    authListeners = authListeners.filter(l => l !== callback);
  };
}

/**
 * Set target Spreadsheet ID.
 */
export function setSpreadsheetId(id: string): void {
  localStorage.setItem('google_spreadsheet_id', id);
}

/**
 * Get configured Spreadsheet ID.
 */
export function getSpreadsheetId(): string | null {
  return localStorage.getItem('google_spreadsheet_id');
}

/**
 * Helper to make authorized fetch requests to Google APIs.
 */
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not signed in with Google');
  }
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Google Sheets API Error (${response.status}): ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch (_) {}
    throw new Error(errorMessage);
  }
  return response.json();
}

/**
 * Fetch all sheet names (tabs) from the spreadsheet.
 */
export async function fetchSheetNames(): Promise<string[]> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not configured');
  }

  const data = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`
  );
  const sheets = data.sheets || [];

  sheetIdMap = {};
  const names: string[] = [];

  sheets.forEach((sheet: any) => {
    const title = sheet.properties.title;
    const id = sheet.properties.sheetId;
    sheetIdMap[title] = id;
    names.push(title);
  });

  return names;
}

/**
 * Resolve sheet name to its sheetId.
 */
async function getSheetId(sheetName: string): Promise<number> {
  if (sheetIdMap[sheetName] !== undefined) {
    return sheetIdMap[sheetName];
  }
  await fetchSheetNames();
  const id = sheetIdMap[sheetName];
  if (id === undefined) {
    throw new Error(`Sheet tab "${sheetName}" not found in spreadsheet`);
  }
  return id;
}

/**
 * Fetch paper entries from a specific sheet.
 */
export async function fetchSheetData(sheetName: string): Promise<Paper[]> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not configured');
  }

  const data = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2:F`
  );

  const rows = data.values || [];
  return rows.map((row: string[], index: number) => {
    return sheetRowToPaper(row, sheetName, index + 2); // Row 2 maps to index 0, so index + 2
  });
}

/**
 * Fetch folders and papers across all sheet tabs.
 */
export async function fetchAllPapers(): Promise<{ folders: Folder[]; papers: Paper[] }> {
  const sheetNames = await fetchSheetNames();

  const folders: Folder[] = sheetNames.map(name => ({
    id: name,
    name: name,
    parent_id: null
  }));

  const papersPromises = sheetNames.map(name => fetchSheetData(name));
  const results = await Promise.all(papersPromises);
  const papers = results.flat();

  return { folders, papers };
}

/**
 * Append a paper as a new row in a sheet.
 */
export async function appendPaper(sheetName: string, paper: Paper): Promise<Paper> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not configured');
  }

  const row = paperToSheetRow(paper);

  const data = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:F:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );

  const range = data.updates?.updatedRange || '';
  const rowMatch = range.match(/A(\d+):/);
  const rowIndex = rowMatch ? parseInt(rowMatch[1]) : undefined;

  return {
    ...paper,
    folder_id: sheetName,
    _sheetName: sheetName,
    _rowIndex: rowIndex,
    id: rowIndex ? `${sheetName}::${rowIndex}` : paper.id
  };
}

/**
 * Update an existing paper row in a sheet.
 */
export async function updatePaper(sheetName: string, rowIndex: number, paper: Paper): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not configured');
  }

  const row = paperToSheetRow(paper);

  await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A${rowIndex}:F${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );
}

/**
 * Delete a paper row and shift subsequent rows up.
 */
export async function deletePaper(sheetName: string, rowIndex: number): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not configured');
  }

  const sheetId = await getSheetId(sheetName);

  await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex
              }
            }
          }
        ]
      })
    }
  );
}

/**
 * Move a paper from one sheet tab to another.
 */
export async function movePaper(fromSheet: string, toSheet: string, rowIndex: number, paper: Paper): Promise<Paper> {
  // Append to destination sheet
  const newPaper = await appendPaper(toSheet, paper);

  // Delete from source sheet
  await deletePaper(fromSheet, rowIndex);

  return newPaper;
}
