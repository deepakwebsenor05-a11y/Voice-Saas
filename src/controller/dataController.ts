import { Request, Response } from 'express';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import FileModel, { IFile } from '../models/File';
import SheetModel, { ISheet } from '../models/Sheet';
import { v4 as uuidv4 } from 'uuid';
import { startTwilioCallSession } from '../services/callWorkerTwilio';

// Helper to parse Excel files
const parseExcelFile = (filePath: string) => {
  try {
    console.log('Parsing Excel file:', filePath);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
  const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];
  const columns = data.length > 0 && typeof data[0] === 'object' ? Object.keys(data[0]) : [];

    console.log('Parsed Excel data:', {
      rowCount: data.length,
      columnsCount: columns.length,
      columns: columns,
      sampleRows: data.slice(0, 2)
    });

    return {
      columns: columns,
      rows: data,
      rowCount: data.length
    };
  } catch (error: any) {
    console.log('parse excel file error', error);
    throw new Error('Failed to parse Excel file: ' + (error.message || error));
  }
};

// Function to fetch data from Google Sheets (CSV export)
export const fetchGoogleSheetData = async (sheetId: string) => {
  try {
    console.log('Fetching data from Google Sheet ID:', sheetId);

    const https = require('https');
    const http = require('http');

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

    return new Promise<{ columns: string[]; rows: any[]; rowCount: number }>((resolve, reject) => {
      const makeRequest = (url: string, redirectCount = 0) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        const client = url.startsWith('https') ? https : http;

        const options = {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        };

        client.get(url, options, (response: any) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            console.log(`Redirect ${response.statusCode}: ${response.headers.location}`);
            makeRequest(response.headers.location, redirectCount + 1);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }

          let data = '';
          response.on('data', (chunk: any) => {
            data += chunk;
          });

          response.on('end', () => {
            try {
              if (data.trim().startsWith('<HTML>') || data.trim().startsWith('<!DOCTYPE')) {
                reject(new Error('Google Sheet is not public or accessible. Please make sure the sheet is set to "Anyone with the link can view".'));
                return;
              }

              const rows = data.split('\n').filter((row: string) => row.trim());
              if (rows.length === 0) {
                resolve({ columns: [], rows: [], rowCount: 0 });
                return;
              }

              const parseCSVRow = (row: string) => {
                const result: string[] = [];
                let current = '';
                let inQuotes = false;

                for (let i = 0; i < row.length; i++) {
                  const char = row[i];
                  if (char === '"') {
                    inQuotes = !inQuotes;
                  } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                  } else {
                    current += char;
                  }
                }
                result.push(current.trim());
                return result;
              };

              const headers = parseCSVRow(rows[0]).map((h) => h.replace(/"/g, '').trim());

              const parsedRows = rows
                .slice(1)
                .map((row) => {
                  const values = parseCSVRow(row).map((v) => v.replace(/"/g, '').trim());
                  const rowObj: any = {};
                  headers.forEach((header, index) => {
                    rowObj[header] = values[index] || '';
                  });
                  return rowObj;
                })
                .filter((row) => {
                  return Object.values(row).some((value) => value && String(value).trim());
                });

              console.log('Successfully parsed Google Sheet data:', {
                columns: headers.length,
                rows: parsedRows.length
              });

              resolve({ columns: headers, rows: parsedRows, rowCount: parsedRows.length });
            } catch (parseError: any) {
              console.error('Error parsing CSV data:', parseError);
              reject(new Error('Failed to parse sheet data: ' + (parseError.message || parseError)));
            }
          });
        }).on('error', (err: any) => {
          console.error('Error fetching from Google Sheets:', err);
          reject(new Error('Network error: ' + (err.message || err)));
        });
      };

      makeRequest(csvUrl);
    });
  } catch (error: any) {
    console.error('fetchGoogleSheetData error:', error);
    throw new Error('Failed to fetch Google Sheet data: ' + (error.message || error));
  }
};

export const uploadExcel = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user?.userId;
    const filePath = (req.file as Express.Multer.File).path;

    console.log('Uploading file for user:', userId, 'File path:', filePath);
    const parsedData = parseExcelFile(filePath);

    const fileObj = new FileModel({
      userId,
      name: (req.file as any).originalname,
      filename: (req.file as any).originalname,
      path: filePath,
      size: (req.file as Express.Multer.File).size,
      rowCount: parsedData.rowCount,
      columns: parsedData.columns,
      rows: parsedData.rows,
      data: parsedData.rows,
      type: 'excel'
    } as any);

    await fileObj.save();
    console.log('File saved successfully with ID:', fileObj._id);

    // Attempt to auto-start a call session if phone numbers are present
    let autoSessionId: string | null = null;
    try {
      const rows = parsedData.rows || [];
          // Robust number extraction: look for any column name containing 'phone' or 'mobile'
          const extractNumbers = (rows: any[]) => {
            if (!rows || rows.length === 0) return [];
            const first = rows[0];
            const cols = Object.keys(first || {});
            const phoneCols = cols.filter((c) => /phone|mobile|contact/i.test(c));
            let nums: any[] = [];
            if (phoneCols.length > 0) {
              nums = rows.map((r: any) => {
                for (const k of phoneCols) {
                  const v = r[k];
                  if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
                }
                return null;
              }).filter(Boolean);
            } else {
              // Fallback: try to find any value that looks like a phone number in the row
              nums = rows.map((r: any) => {
                for (const v of Object.values(r)) {
                  if (v === undefined || v === null) continue;
                  const s = String(v).trim();
                  // basic check: at least 6 digits total
                  const digits = (s.match(/\d/g) || []).length;
                  if (digits >= 6) return s;
                }
                return null;
              }).filter(Boolean);
            }
            return nums;
          };

          const numbers = extractNumbers(rows);
      if (numbers.length > 0) {
        autoSessionId = uuidv4();
        // use Twilio worker to place calls via ElevenLabs audio (and VAPI agents)
        startTwilioCallSession(autoSessionId, numbers, undefined, userId, fileObj._id as any, true)
          .catch((e) => console.error('Twilio session error', e));
        console.log('Auto-started Twilio call session:', autoSessionId, 'with', numbers.length, 'numbers');
      }
    } catch (e) {
      console.error('Failed to auto-start call session:', e);
    }
    res.json({
      success: true,
      data: {
        id: fileObj._id,
        name: (fileObj as any).name,
        rowCount: fileObj.rowCount,
        columns: fileObj.columns,
        rows: fileObj.rows,
        uploadedAt: (fileObj as any).createdAt
      },
      sessionId: autoSessionId
    });
  } catch (error: any) {
    console.log('Error in uploadExcel:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getFiles = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const files = await FileModel.find({ userId }).sort({ createdAt: -1 });

    const response = files.map((file) => ({
      id: file._id,
      name: (file as any).name || file.filename,
      rowCount: file.rowCount,
      uploadedAt: (file as any).createdAt,
      type: (file as any).type
    }));

    res.json({ success: true, data: response });
  } catch (error: any) {
    console.error('Error in getFiles:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getFile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const fileId = req.params.fileId;

    console.log('Getting file with ID:', fileId, 'for user:', userId);

    const file = await FileModel.findOne({ _id: fileId, userId });

    if (!file) {
      console.log('File not found');
      return res.status(404).json({ error: 'File not found' });
    }

    const actualData = (file as any).data || (file as any).rows || [];

    const responseData = {
      id: file._id,
      name: (file as any).name || file.filename,
      columns: file.columns,
      rows: actualData,
      rowCount: file.rowCount
    };

    res.json({ success: true, data: responseData });
  } catch (error: any) {
    console.error('Error in getFile:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const fileId = req.params.fileId;

    const file = await FileModel.findOne({ _id: fileId, userId });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (fs.existsSync((file as any).path)) {
      fs.unlinkSync((file as any).path);
    }

    await FileModel.deleteOne({ _id: fileId });

    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('Error in deleteFile:', error);
    res.status(500).json({ error: error.message });
  }
};

export const connectSheet = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sheetUrl = req.body.sheetUrl;

    if (!sheetUrl) {
      return res.status(400).json({ error: 'Sheet URL required' });
    }

    const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const extractedSheetId = sheetIdMatch ? sheetIdMatch[1] : null;

    if (!extractedSheetId) {
      return res.status(400).json({ error: 'Invalid Google Sheets URL' });
    }

    const sheetData = await fetchGoogleSheetData(extractedSheetId);

    const sheetObj = new SheetModel({
      userId,
      name: 'Google Sheet',
      url: sheetUrl,
      sheetId: extractedSheetId,
      type: 'sheet',
      columns: sheetData.columns,
      rows: sheetData.rows,
      data: sheetData.rows,
      rowCount: sheetData.rowCount,
      lastSync: new Date()
    } as any);

    await sheetObj.save();

    // Auto-start call session if phone numbers found in sheet
    let autoSessionId: string | null = null;
    try {
      const rows = sheetData.rows || [];
      // use same extraction logic as above
      const extractNumbers = (rows: any[]) => {
        if (!rows || rows.length === 0) return [];
        const first = rows[0];
        const cols = Object.keys(first || {});
        const phoneCols = cols.filter((c) => /phone|mobile|contact/i.test(c));
        let nums: any[] = [];
        if (phoneCols.length > 0) {
          nums = rows.map((r: any) => {
            for (const k of phoneCols) {
              const v = r[k];
              if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
            }
            return null;
          }).filter(Boolean);
        } else {
          nums = rows.map((r: any) => {
            for (const v of Object.values(r)) {
              if (v === undefined || v === null) continue;
              const s = String(v).trim();
              const digits = (s.match(/\d/g) || []).length;
              if (digits >= 6) return s;
            }
            return null;
          }).filter(Boolean);
        }
        return nums;
      };

      const numbers = extractNumbers(rows);
      if (numbers.length > 0) {
        autoSessionId = uuidv4();
        startTwilioCallSession(autoSessionId, numbers, undefined, userId, sheetObj._id as any, true)
          .catch((e) => console.error('Twilio session error', e));
        console.log('Auto-started Twilio call session from sheet:', autoSessionId, 'numbers:', numbers.length);
      }
    } catch (err) {
      console.error('Failed to auto-start session from sheet:', err);
    }

    res.json({
      success: true,
      data: {
        id: sheetObj._id,
        name: sheetObj.name,
        url: sheetObj.url,
        sheetId: sheetObj.sheetId,
        columns: sheetObj.columns,
        rows: sheetObj.rows,
        rowCount: sheetObj.rowCount,
        lastSync: sheetObj.lastSync
      },
      sessionId: autoSessionId
    });
  } catch (error: any) {
    console.error('Error in connectSheet:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getSheets = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sheets = await SheetModel.find({ userId }).sort({ lastSync: -1 });

    const response = sheets.map((sheet) => ({
      id: sheet._id,
      name: sheet.name,
      url: sheet.url,
      sheetId: sheet.sheetId,
      rowCount: sheet.rowCount,
      lastSync: sheet.lastSync,
      type: (sheet as any).type
    }));

    res.json({ success: true, data: response });
  } catch (error: any) {
    console.error('Error in getSheets:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getSheet = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sheetId = req.params.sheetId;

    const sheet = await SheetModel.findOne({ _id: sheetId, userId });

    if (!sheet) {
      return res.status(404).json({ error: 'Sheet not found' });
    }

    const actualData = (sheet as any).data || (sheet as any).rows || [];

    res.json({
      success: true,
      data: {
        id: sheet._id,
        name: sheet.name,
        columns: sheet.columns,
        rows: actualData,
        rowCount: sheet.rowCount,
        url: sheet.url,
        sheetId: sheet.sheetId,
        lastSync: sheet.lastSync
      }
    });
  } catch (error: any) {
    console.error('Error in getSheet:', error);
    res.status(500).json({ error: error.message });
  }
};

export const refreshSheet = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sheetId = req.params.sheetId;

    const sheet = await SheetModel.findOne({ _id: sheetId, userId });

    if (!sheet) {
      return res.status(404).json({ error: 'Sheet not found' });
    }

    const sheetData = await fetchGoogleSheetData((sheet as any).sheetId);

    (sheet as any).columns = sheetData.columns;
    (sheet as any).rows = sheetData.rows;
    (sheet as any).data = sheetData.rows;
    (sheet as any).rowCount = sheetData.rowCount;
    (sheet as any).lastSync = new Date();

    await sheet.save();

    res.json({
      success: true,
      message: 'Sheet refreshed successfully',
      data: {
        id: sheet._id,
        name: sheet.name,
        rowCount: sheet.rowCount,
        lastSync: sheet.lastSync
      }
    });
  } catch (error: any) {
    console.error('Error in refreshSheet:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteSheet = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sheetId = req.params.sheetId;

    const sheet = await SheetModel.findOne({ _id: sheetId, userId });

    if (!sheet) {
      return res.status(404).json({ error: 'Sheet not found' });
    }

    await SheetModel.deleteOne({ _id: sheetId });

    res.json({ success: true, message: 'Sheet deleted successfully' });
  } catch (error: any) {
    console.error('Error in deleteSheet:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    const files = await FileModel.find({ userId });
    const sheets = await SheetModel.find({ userId });

    const totalRows = files.reduce((sum: number, f: any) => sum + (f.rowCount || 0), 0) + sheets.reduce((sum: number, s: any) => sum + (s.rowCount || 0), 0);
    const totalSize = files.reduce((sum: number, f: any) => sum + (f.size || 0), 0);

    res.json({
      success: true,
      data: {
        totalFiles: files.length,
        totalSheets: sheets.length,
        totalRows: totalRows,
        totalSizeKB: Math.round(totalSize / 1024),
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
      }
    });
  } catch (error: any) {
    console.error('Error in getStats:', error);
    res.status(500).json({ error: error.message });
  }
};
