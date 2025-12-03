import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getBotStatus } from './telegramBot';
import { getSpreadsheetInfo } from './googleSheets';

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get('/api/status', async (req, res) => {
    try {
      const spreadsheetInfo = await getSpreadsheetInfo();
      const botStatus = getBotStatus();
      
      res.json({
        botActive: botStatus.healthy,
        botError: botStatus.lastError,
        googleSheetsConnected: true,
        spreadsheet: spreadsheetInfo
      });
    } catch (error) {
      const botStatus = getBotStatus();
      res.json({
        botActive: botStatus.healthy,
        botError: botStatus.lastError,
        googleSheetsConnected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}
