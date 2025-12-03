# Telegram Bot for Google Sheets Automation

## Overview

This is a Telegram bot application that automates Google Sheets operations by processing Excel files uploaded by users. The bot receives Excel files through Telegram, extracts campaign data, and highlights corresponding cells in a connected Google Sheets document. The application features a React-based web dashboard for monitoring bot status and a Node.js/Express backend that handles both the Telegram bot integration and Google Sheets API operations.

## User Preferences

Preferred communication style: Simple, everyday language (Russian).

## System Architecture

### Frontend Architecture

**Technology Stack**: React with TypeScript, Vite build system, and shadcn/ui component library

The frontend is a Single Page Application (SPA) that provides a monitoring dashboard for the Telegram bot. Key architectural decisions include:

- **UI Framework**: Uses shadcn/ui (Radix UI primitives) with Tailwind CSS for styling, providing a consistent design system with the "new-york" style variant
- **State Management**: React Query (@tanstack/react-query) handles server state and API data fetching with automatic caching and refetching
- **Routing**: Wouter for lightweight client-side routing
- **Build System**: Vite for fast development and optimized production builds

The frontend architecture is minimal, focusing on displaying bot status information rather than complex user interactions. The primary view is a status dashboard showing:
- Telegram bot connectivity status (real-time health check)
- Google Sheets connection status  
- Spreadsheet information with links

### Backend Architecture

**Technology Stack**: Node.js with Express, TypeScript, and ESM modules

The backend follows a modular Express application pattern with clear separation of concerns:

- **Server Entry Point** (`server/index.ts`): Sets up Express middleware, logging, and route registration
- **Telegram Bot Integration** (`server/telegramBot.ts`): Handles all Telegram bot logic using the `node-telegram-bot-api` library
  - Commands: /start, /help, /status, /query
  - Excel file processing with XLSX library
  - Real-time health status tracking
  - Video duration query by date, TK type, or TK number
- **Google Sheets Integration** (`server/googleSheets.ts`): Manages Google Sheets API authentication and operations using the official Google APIs client
  - Dynamic sheet ID detection (not hardcoded)
  - TK column range enforcement (R-GN only)
  - Campaign row search with case-insensitive matching
  - Cell highlighting with green background
- **API Routes** (`server/routes.ts`): Exposes REST endpoints for the frontend status dashboard
- **Static File Serving** (`server/static.ts`): Serves the built React application in production

**Key Design Patterns**:
- Real-time bot health monitoring (polling errors tracked)
- Excel parsing with text preservation (leading zeros maintained)
- Campaign name detection using frequency analysis
- TK number deduplication before processing
- Separation of external service integrations into dedicated modules

### Database & Data Storage

**Primary Storage**: PostgreSQL with Drizzle ORM (configured but minimal usage)

The application is configured to use PostgreSQL via Drizzle ORM, though the current implementation focuses on stateless bot operations:

- **Schema Definition** (`shared/schema.ts`): Defines a basic users table
- **Database Provider**: Neon Database serverless PostgreSQL (via `@neondatabase/serverless`)

**In-Memory Storage**: The bot operates statelessly - no persistent user session storage required.

### Authentication & Authorization

**Google Sheets Authentication**: OAuth 2.0 token-based authentication via Replit Connectors

The application uses Replit's connector system for Google Sheets authentication:
- Access tokens are fetched from Replit's connector API using deployment identity headers
- Tokens are cached in memory with expiration checking to minimize API calls
- OAuth2Client is configured with dynamic access tokens for each API request
- Scopes: drive.file, spreadsheets.readonly, drive.appdata, spreadsheets

**Telegram Bot Authentication**: Token-based bot authentication via environment variable (`TELEGRAM_BOT_TOKEN`)

## External Dependencies

### Third-Party Services

1. **Telegram Bot API**
   - Library: `node-telegram-bot-api`
   - Purpose: Receives file uploads and sends messages to users
   - Integration: Polling mode for receiving updates
   - Commands: `/start`, `/help`, `/status`, `/query`

2. **Google Sheets API**
   - Library: `googleapis` (Google's official Node.js client)
   - Purpose: Read and update specific Google Sheets spreadsheet
   - Authentication: OAuth 2.0 via Replit Connectors
   - Spreadsheet ID: `17VeQQWTGotofrpNbUHDhUFhCc3qjLdwoesTxDDfJ7h4` (Календарь роликов)
   - TK Column Range: R to GN

3. **Replit Connectors**
   - Purpose: Provides OAuth token management for Google Sheets
   - Authentication: Uses `REPL_IDENTITY` or `WEB_REPL_RENEWAL` environment variables
   - Endpoint: Fetches connection settings including access tokens

### File Processing

- **Library**: `xlsx` 
- **Purpose**: Parse Excel files uploaded through Telegram to extract campaign data
- **Features**: 
  - Preserves text formatting (leading zeros in TK numbers)
  - Detects and skips header rows automatically
  - Handles multiple campaign entries (uses most frequent)
  - Deduplicates TK numbers

## Environment Variables

Required secrets:
- `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather

Automatically provided by Replit:
- `REPLIT_CONNECTORS_HOSTNAME`: Connectors API hostname
- `REPL_IDENTITY` / `WEB_REPL_RENEWAL`: Authentication for connectors

## Google Sheet Structure

The bot works with Google Sheet "Календарь роликов" with the following columns:
- Column A: Campaign Name (РК - рекламная кампания)
- Column B: TK Type (тип ТК: ГМ, СМ, Частично ГМ, Частично СМ, ГМ+СМ)
- Column C: Duration (длительность ролика в секундах)
- Column F: Start Date (дата старта)
- Column G: End Date (дата окончания)
- Column H: Payment Status (платник/не платник)
- Columns R-GN: TK Numbers (номера торговых точек в заголовке, ячейки подсвечиваются)

## How It Works

### Excel File Processing
1. User sends Excel file to Telegram bot
2. Bot parses file: Column A = Campaign Name (РК), Column B = TK Numbers
3. Bot searches Google Sheet for matching campaign row
4. Bot highlights cells in columns R-GN where headers match TK numbers
5. Bot sends confirmation with count of highlighted cells and any not-found TKs

### Video Duration Query (/query command)
1. User sends `/query` with filters (date, TK type, or TK number)
2. Bot reads data from columns A-H
3. For TK number filter: checks cell background color (green = highlighted)
4. Returns total duration in seconds and list of matching videos

Query examples:
- `/query дата 25.12.2024` - videos active on this date
- `/query тип ГМ` - videos for TK type "ГМ"
- `/query тк 12345` - videos for TK number 12345
- `/query тип СМ дата 01.01.2025` - combined filters

## Deployment

The application runs on Replit with:
- Frontend: Vite dev server / static build in production
- Backend: Express server on port 5000
- Bot: Runs 24/7 via polling (no webhook required)

To deploy: Use Replit's built-in publishing to keep the bot running continuously.
