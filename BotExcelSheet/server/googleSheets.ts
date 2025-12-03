import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

export async function getGoogleSheetsClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

const SPREADSHEET_ID = '17VeQQWTGotofrpNbUHDhUFhCc3qjLdwoesTxDDfJ7h4';

function columnLetterToIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
}

function columnIndexToLetter(index: number): string {
  let letter = '';
  let temp = index;
  
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  
  return letter;
}

const TK_START_COLUMN = 'R';
const TK_END_COLUMN = 'GN';
const TK_START_INDEX = columnLetterToIndex(TK_START_COLUMN);
const TK_END_INDEX = columnLetterToIndex(TK_END_COLUMN);

interface SheetInfo {
  sheetId: number;
  title: string;
}

async function getFirstSheetInfo(): Promise<SheetInfo> {
  const sheets = await getGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  
  const firstSheet = response.data.sheets?.[0];
  if (!firstSheet || !firstSheet.properties) {
    throw new Error('No sheets found in spreadsheet');
  }
  
  return {
    sheetId: firstSheet.properties.sheetId || 0,
    title: firstSheet.properties.title || 'Sheet1'
  };
}

export async function findCampaignRow(campaignName: string): Promise<number | null> {
  const sheets = await getGoogleSheetsClient();
  const sheetInfo = await getFirstSheetInfo();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetInfo.title}'!A:A`,
  });
  
  const values = response.data.values;
  if (!values) return null;
  
  const normalizedSearch = campaignName.trim().toLowerCase();
  
  for (let i = 0; i < values.length; i++) {
    if (values[i][0]) {
      const cellValue = values[i][0].toString().trim().toLowerCase();
      if (cellValue === normalizedSearch) {
        return i + 1;
      }
    }
  }
  
  return null;
}

export async function getTkColumnHeaders(): Promise<Map<string, number>> {
  const sheets = await getGoogleSheetsClient();
  const sheetInfo = await getFirstSheetInfo();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetInfo.title}'!${TK_START_COLUMN}1:${TK_END_COLUMN}1`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  
  const headers = response.data.values?.[0] || [];
  const tkMap = new Map<string, number>();
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]?.toString().trim();
    if (header) {
      tkMap.set(header, TK_START_INDEX + i);
      const normalized = header.replace(/^0+/, '') || '0';
      if (normalized !== header) {
        tkMap.set(normalized, TK_START_INDEX + i);
      }
    }
  }
  
  return tkMap;
}

export async function highlightCells(rowNumber: number, tkNumbers: string[]): Promise<{ highlighted: number; notFound: string[] }> {
  const sheets = await getGoogleSheetsClient();
  const sheetInfo = await getFirstSheetInfo();
  const tkHeaders = await getTkColumnHeaders();
  
  const requests: any[] = [];
  const notFound: string[] = [];
  let highlighted = 0;
  
  const processedTks = new Set<string>();
  
  for (const tk of tkNumbers) {
    const tkTrimmed = tk.toString().trim();
    if (!tkTrimmed || processedTks.has(tkTrimmed)) continue;
    processedTks.add(tkTrimmed);
    
    const columnIndex = tkHeaders.get(tkTrimmed);
    
    if (columnIndex !== undefined && columnIndex >= TK_START_INDEX && columnIndex <= TK_END_INDEX) {
      requests.push({
        repeatCell: {
          range: {
            sheetId: sheetInfo.sheetId,
            startRowIndex: rowNumber - 1,
            endRowIndex: rowNumber,
            startColumnIndex: columnIndex,
            endColumnIndex: columnIndex + 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: {
                red: 0.0,
                green: 1.0,
                blue: 0.0,
              },
            },
          },
          fields: 'userEnteredFormat.backgroundColor',
        },
      });
      highlighted++;
    } else {
      notFound.push(tkTrimmed);
    }
  }
  
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests,
      },
    });
  }
  
  return { highlighted, notFound };
}

export async function getSpreadsheetInfo(): Promise<{ title: string; url: string }> {
  const sheets = await getGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  
  return {
    title: response.data.properties?.title || 'Unknown',
    url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
  };
}

export interface VideoRecord {
  campaignName: string;
  tkType: string;
  duration: number;
  startDate: string;
  endDate: string;
  isPaid: string;
  rowNumber: number;
}

export interface QueryResult {
  records: VideoRecord[];
  totalDuration: number;
  count: number;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const trimmed = dateStr.toString().trim();
  
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  const yyyymmdd = trimmed.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  return null;
}

function formatDateForDisplay(dateStr: string): string {
  const date = parseDate(dateStr);
  if (!date) return dateStr;
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function isDateInRange(checkDate: Date, startDate: Date | null, endDate: Date | null): boolean {
  if (startDate && endDate) {
    return checkDate >= startDate && checkDate <= endDate;
  }
  if (startDate) {
    return checkDate >= startDate;
  }
  if (endDate) {
    return checkDate <= endDate;
  }
  return true;
}

export async function queryVideoDuration(options: {
  date?: string;
  tkType?: string;
  tkNumber?: string;
}): Promise<QueryResult> {
  const sheets = await getGoogleSheetsClient();
  const sheetInfo = await getFirstSheetInfo();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetInfo.title}'!A:H`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  
  const rows = response.data.values || [];
  const records: VideoRecord[] = [];
  
  let tkColumnIndex: number | undefined;
  let highlightedRows: Set<number> = new Set();
  
  if (options.tkNumber) {
    const tkHeaders = await getTkColumnHeaders();
    tkColumnIndex = tkHeaders.get(options.tkNumber.trim());
    
    if (tkColumnIndex !== undefined) {
      const colLetter = columnIndexToLetter(tkColumnIndex);
      const valuesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetInfo.title}'!${colLetter}2:${colLetter}`,
        valueRenderOption: 'FORMATTED_VALUE',
      });
      
      const colValues = valuesResponse.data.values || [];
      
      for (let i = 0; i < colValues.length; i++) {
        const cellValue = colValues[i]?.[0]?.toString().trim();
        if (cellValue && cellValue !== '' && cellValue !== '0') {
          highlightedRows.add(i + 2);
        }
      }
    }
  }
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    
    const campaignName = row[0]?.toString().trim() || '';
    const tkType = row[1]?.toString().trim() || '';
    const durationStr = row[2]?.toString().trim() || '0';
    const startDateStr = row[5]?.toString().trim() || '';
    const endDateStr = row[6]?.toString().trim() || '';
    const isPaid = row[7]?.toString().trim() || '';
    
    const duration = parseFloat(durationStr.replace(',', '.')) || 0;
    
    if (!campaignName && !duration) continue;
    
    let matches = true;
    
    if (options.date) {
      const queryDate = parseDate(options.date);
      const recordStartDate = parseDate(startDateStr);
      const recordEndDate = parseDate(endDateStr);
      
      if (queryDate) {
        if (recordStartDate || recordEndDate) {
          matches = isDateInRange(queryDate, recordStartDate, recordEndDate);
        } else {
          matches = false;
        }
      }
    }
    
    if (options.tkType && matches) {
      const normalizedQuery = options.tkType.toLowerCase().trim();
      const normalizedType = tkType.toLowerCase();
      matches = normalizedType.includes(normalizedQuery) || normalizedQuery.includes(normalizedType);
    }
    
    if (options.tkNumber && matches) {
      if (tkColumnIndex === undefined) {
        matches = false;
      } else {
        matches = highlightedRows.has(i + 1);
      }
    }
    
    if (matches) {
      records.push({
        campaignName,
        tkType,
        duration,
        startDate: formatDateForDisplay(startDateStr),
        endDate: formatDateForDisplay(endDateStr),
        isPaid,
        rowNumber: i + 1,
      });
    }
  }
  
  const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);
  
  return {
    records,
    totalDuration,
    count: records.length,
  };
}
