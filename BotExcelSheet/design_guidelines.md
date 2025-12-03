# Design Guidelines: Telegram Bot for Google Sheets Automation

## Design Approach

**System: Telegram Bot Interface Pattern** - This is a utility-focused automation tool. The primary interface is Telegram's native UI, so design focuses on conversation flow, message clarity, and user feedback patterns.

## Bot Interaction Design

### Conversation Flow
1. **Welcome Message**: Clear introduction explaining bot capabilities and simple usage instructions
2. **Two-Step Process**:
   - Step 1: User uploads Excel file
   - Step 2: Bot confirms receipt, processes file, updates Google Sheet
3. **Confirmation & Feedback**: Success/error messages with actionable next steps

### Message Formatting
- **Headers**: Use bold text (`*text*`) for important information
- **Lists**: Use bullet points for multiple items or instructions
- **Code blocks**: Use monospace (`` `text` ``) for campaign names and TK numbers
- **Emojis**: Use sparingly for status indicators:
  - ✅ Success
  - ⚠️ Warning/Validation issues
  - ❌ Error
  - 📊 Processing data
  - 📤 Upload prompt

## Typography & Content Structure

### Message Hierarchy
1. **Primary Messages**: 14-16pt equivalent, bold for status updates
2. **Instructions**: Regular weight, clear step-by-step format
3. **Technical Details**: Smaller, monospace for data references

### Content Principles
- **Concise**: Maximum 2-3 sentences per message
- **Progressive Disclosure**: Show details only when needed
- **Bilingual Support**: All messages in Russian (user's language)

## Component Library

### Core Bot Components

**1. Command Interface**
- `/start` - Welcome and instructions
- `/help` - Detailed usage guide
- `/status` - Show last operation status

**2. File Upload Flow**
```
User uploads Excel → 
Bot acknowledges → 
Bot validates file → 
Bot confirms RK found → 
Bot processes highlighting → 
Bot sends success confirmation
```

**3. Response Templates**
- **Success**: "✅ Обработано! Выделено [N] ячеек для РК '[название]'"
- **Error**: "❌ Ошибка: [описание]. Пожалуйста, проверьте файл"
- **Progress**: "📊 Обрабатываю файл..."

**4. Error Handling**
- File format validation messages
- Campaign name not found alerts
- Google Sheets access error notifications
- Clear remediation steps for each error type

## Spacing & Layout (for potential web dashboard)

**If a simple web monitoring dashboard is added later:**
- Spacing units: Tailwind 4, 6, 8, 12, 16
- Container max-width: max-w-4xl
- Card padding: p-6
- Section spacing: space-y-8

### Dashboard Components (Optional Future Enhancement)
- **Activity Log**: Recent bot operations in table format
- **Statistics**: Total files processed, success rate
- **User List**: Active users and their last activity
- **Manual Override**: Button to trigger highlighting without Excel file

## Accessibility & UX Principles

1. **Immediate Feedback**: Acknowledge every user action within 1 second
2. **Error Recovery**: Provide clear next steps for every error
3. **Progress Indicators**: Use typing indicator for processing tasks
4. **Confirmation**: Always confirm successful operations with details
5. **Language Consistency**: All messages in Russian, matching user's preference

## Technical Response Guidelines

- **File Size Limits**: Communicate max Excel file size clearly
- **Processing Time**: Set expectations (e.g., "Обработка займёт до 30 секунд")
- **Rate Limiting**: Gentle messaging if user sends too many requests
- **Maintenance Mode**: Informative message if Google Sheets API is unavailable

## Animation & Interactions

- **None required** - Telegram handles all UI animations natively
- Focus on response timing and message sequencing

This is a function-first automation tool where clarity, reliability, and helpful error messages are the primary "design" elements. The Telegram interface provides all visual components; design effort focuses on conversation flow and user guidance.