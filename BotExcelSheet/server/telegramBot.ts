import TelegramBot from 'node-telegram-bot-api';
import * as XLSX from 'xlsx';
import { findCampaignRow, highlightCells, getSpreadsheetInfo, queryVideoDuration } from './googleSheets';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

let botHealthy = true;
let lastError: string | null = null;

bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error);
  botHealthy = false;
  lastError = error.message;
});

bot.on('error', (error) => {
  console.error('Telegram bot error:', error);
  lastError = error.message;
});

export function getBotStatus(): { healthy: boolean; lastError: string | null } {
  return { healthy: botHealthy, lastError };
}

interface UserState {
  awaitingFile: boolean;
  lastActivity: Date;
}

const userStates = new Map<number, UserState>();

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  botHealthy = true;
  
  try {
    const spreadsheetInfo = await getSpreadsheetInfo();
    
    const welcomeMessage = `
*Добро пожаловать в бот автоматизации Google Таблиц!*

Этот бот поможет вам автоматически выделять ячейки в Google Таблице.

*Как использовать:*
1. Отправьте мне Excel файл (.xlsx или .xls)
2. В файле должно быть:
   - Столбец A: Название рекламной кампании (РК)
   - Столбец B: Список номеров торговых точек (ТК)
3. Бот найдет РК в таблице и выделит зеленым соответствующие ТК

*Подключенная таблица:*
📊 ${spreadsheetInfo.title}

*Команды:*
/start - Показать это сообщение
/help - Подробная справка
/status - Статус подключения
/query - Запрос длительности роликов

Просто отправьте Excel файл, чтобы начать!
    `.trim();
    
    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in /start:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при получении информации о таблице. Проверьте подключение к Google Sheets.');
  }
  
  userStates.set(chatId, { awaitingFile: true, lastActivity: new Date() });
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  botHealthy = true;
  
  const helpMessage = `
*Подробная справка*

*Формат Excel файла:*
Файл должен содержать две колонки:
• Столбец A - название РК (рекламной кампании)
• Столбец B - номера ТК (торговых точек)

*Пример:*
\`\`\`
| A (РК)     | B (ТК)  |
|------------|---------|
| Кампания 1 | 12345   |
| Кампания 1 | 67890   |
| Кампания 1 | 11111   |
\`\`\`

*Что делает бот:*
1. Читает название РК из столбца A (первое непустое значение)
2. Собирает все номера ТК из столбца B
3. Находит строку с этой РК в Google Таблице
4. Выделяет зеленым ячейки под номерами найденных ТК (столбцы R-GN)

*Поддерживаемые форматы:*
• .xlsx (Excel 2007+)
• .xls (Excel 97-2003)

*Важно:*
• Номера ТК сохраняются как текст (ведущие нули не теряются)
• Название РК должно точно совпадать с названием в Google Таблице
• ТК выделяются только в диапазоне столбцов R-GN

*Команда /query:*
Позволяет узнать длительность роликов по фильтрам.

Примеры:
• \`/query дата 25.12.2024\` - ролики на эту дату
• \`/query тип ГМ\` - ролики для типа ТК "ГМ"
• \`/query тк 12345\` - ролики для ТК 12345
• \`/query тип СМ дата 01.01.2025\` - комбинация фильтров
  `.trim();
  
  await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  botHealthy = true;
  
  try {
    const spreadsheetInfo = await getSpreadsheetInfo();
    
    const statusMessage = `
*Статус бота*

✅ Бот активен и работает
✅ Google Sheets подключен

*Таблица:*
📊 ${spreadsheetInfo.title}
🔗 [Открыть таблицу](${spreadsheetInfo.url})
    `.trim();
    
    await bot.sendMessage(chatId, statusMessage, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
  } catch (error) {
    console.error('Error in /status:', error);
    await bot.sendMessage(chatId, `
*Статус бота*

✅ Бот активен
❌ Ошибка подключения к Google Sheets

Пожалуйста, проверьте настройки интеграции.
    `.trim(), { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/query(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  botHealthy = true;
  
  const argsText = match?.[1]?.trim() || '';
  
  if (!argsText) {
    await bot.sendMessage(chatId, `
*Команда /query - Запрос длительности роликов*

Используйте фильтры для поиска:

*По дате:*
\`/query дата 25.12.2024\`

*По типу ТК:*
\`/query тип ГМ\`
\`/query тип СМ\`
\`/query тип Частично ГМ\`

*По номеру ТК:*
\`/query тк 12345\`

*Комбинация фильтров:*
\`/query тип ГМ дата 01.01.2025\`
\`/query тк 12345 дата 15.03.2025\`

Результат покажет общую длительность роликов в секундах.
    `.trim(), { parse_mode: 'Markdown' });
    return;
  }
  
  const options: { date?: string; tkType?: string; tkNumber?: string } = {};
  
  const dateMatch = argsText.match(/дата\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})/i);
  if (dateMatch) {
    options.date = dateMatch[1];
  }
  
  const typeMatch = argsText.match(/тип\s+(ГМ\+СМ|ГМ|СМ|Частично\s*ГМ|Частично\s*СМ)/i);
  if (typeMatch) {
    options.tkType = typeMatch[1];
  }
  
  const tkMatch = argsText.match(/тк\s+(\d+)/i);
  if (tkMatch) {
    options.tkNumber = tkMatch[1];
  }
  
if (!options.date && !options.tkType && !options.tkNumber) {
    const dateInArgs = argsText.match(/дата\s+(\S+)/i);
    if (dateInArgs) {
      await bot.sendMessage(chatId, `
❌ Неверный формат даты: "${dateInArgs[1]}"

Используйте формат: ДД.ММ.ГГГГ
Пример: /query дата 25.12.2024
      `.trim());
      return;
    }
    
    await bot.sendMessage(chatId, `
❌ Не удалось распознать фильтры.

Примеры использования:
• /query дата 25.12.2024
• /query тип ГМ
• /query тк 12345
    `.trim());
    return;
  }
  
  await bot.sendMessage(chatId, '🔍 Выполняю запрос...');
  
  try {
    const result = await queryVideoDuration(options);
    
    let filterDesc = [];
    if (options.date) filterDesc.push(`Дата: ${options.date}`);
    if (options.tkType) filterDesc.push(`Тип ТК: ${options.tkType}`);
    if (options.tkNumber) filterDesc.push(`Номер ТК: ${options.tkNumber}`);
    
    if (result.count === 0) {
      await bot.sendMessage(chatId, `
📊 Результат запроса

Фильтры:
${filterDesc.map(f => `• ${f}`).join('\n')}

❌ Ролики не найдены по указанным критериям.
      `.trim());
      return;
    }
    
    const minutes = Math.floor(result.totalDuration / 60);
    const seconds = Math.round(result.totalDuration % 60);
    const timeFormatted = minutes > 0 ? `${minutes} мин ${seconds} сек` : `${seconds} сек`;
    
    let message = `
📊 Результат запроса

Фильтры:
${filterDesc.map(f => `• ${f}`).join('\n')}

Найдено роликов: ${result.count}
Общая длительность: ${result.totalDuration} сек (${timeFormatted})
    `.trim();
    
    if (result.count <= 10) {
      message += '\n\nСписок роликов:\n';
      for (const record of result.records) {
        const dates = record.startDate && record.endDate 
          ? `${record.startDate} - ${record.endDate}` 
          : record.startDate || record.endDate || 'Дата не указана';
        message += `• ${record.campaignName} | ${record.duration} сек | ${record.tkType} | ${dates}\n`;
      }
    } else {
      message += `\n\nПоказаны первые 10 из ${result.count} роликов:\n`;
      for (const record of result.records.slice(0, 10)) {
        const dates = record.startDate && record.endDate 
          ? `${record.startDate} - ${record.endDate}` 
          : record.startDate || record.endDate || 'Дата не указана';
        message += `• ${record.campaignName} | ${record.duration} сек | ${record.tkType} | ${dates}\n`;
      }
    }
    
    await bot.sendMessage(chatId, message);
    
  } catch (error) {
    console.error('Error in /query:', error);
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await bot.sendMessage(chatId, `❌ Ошибка при выполнении запроса:\n${errorMessage}`);
  }
});

function parseExcelFile(buffer: Buffer): { campaignName: string; tkNumbers: string[] } | { error: string } {
  const workbook = XLSX.read(buffer, { 
    type: 'buffer',
    raw: false,
    cellText: true,
  });
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    raw: false,
    defval: '',
  });
  
  if (data.length === 0) {
    return { error: 'Файл пустой или не содержит данных' };
  }
  
  const campaignNames: string[] = [];
  const tkNumbers: string[] = [];
  
  let startRow = 0;
  if (data.length > 0) {
    const firstRowA = data[0][0]?.toString().trim().toLowerCase();
    const firstRowB = data[0][1]?.toString().trim().toLowerCase();
    if (
      (firstRowA && (firstRowA.includes('рк') || firstRowA.includes('кампани') || firstRowA === 'a')) ||
      (firstRowB && (firstRowB.includes('тк') || firstRowB.includes('точ') || firstRowB === 'b'))
    ) {
      startRow = 1;
    }
  }
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    
    if (row[0]) {
      const campaign = row[0].toString().trim();
      if (campaign) {
        campaignNames.push(campaign);
      }
    }
    
    if (row[1]) {
      const tk = row[1].toString().trim();
      if (tk && tk !== '') {
        tkNumbers.push(tk);
      }
    }
  }
  
  if (campaignNames.length === 0) {
    return { error: 'Не найдено название РК в столбце A' };
  }
  
  const campaignCounts = new Map<string, number>();
  for (const name of campaignNames) {
    campaignCounts.set(name, (campaignCounts.get(name) || 0) + 1);
  }
  
  let campaignName = campaignNames[0];
  let maxCount = 0;
  for (const [name, count] of campaignCounts) {
    if (count > maxCount) {
      maxCount = count;
      campaignName = name;
    }
  }
  
  if (tkNumbers.length === 0) {
    return { error: 'Не найдены номера ТК в столбце B' };
  }
  
  const uniqueTks = [...new Set(tkNumbers)];
  
  return { campaignName, tkNumbers: uniqueTks };
}

bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const document = msg.document;
  botHealthy = true;
  
  if (!document) {
    await bot.sendMessage(chatId, '❌ Не удалось получить файл');
    return;
  }
  
  const fileName = document.file_name || '';
  const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
  
  if (!isExcel) {
    await bot.sendMessage(chatId, '❌ Пожалуйста, отправьте файл Excel (.xlsx или .xls)');
    return;
  }
  
  await bot.sendMessage(chatId, '📊 Обрабатываю файл...');
  
  try {
    const file = await bot.getFile(document.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const parseResult = parseExcelFile(buffer);
    
    if ('error' in parseResult) {
      await bot.sendMessage(chatId, `❌ ${parseResult.error}`);
      return;
    }
    
    const { campaignName, tkNumbers } = parseResult;
    
    await bot.sendMessage(chatId, `
📋 *Найдено в файле:*
• РК: \`${campaignName}\`
• Количество уникальных ТК: ${tkNumbers.length}

🔍 Ищу РК в Google Таблице...
    `.trim(), { parse_mode: 'Markdown' });
    
    const rowNumber = await findCampaignRow(campaignName);
    
    if (!rowNumber) {
      await bot.sendMessage(chatId, `❌ РК "${campaignName}" не найдена в Google Таблице.\n\nПроверьте правильность написания названия кампании.`);
      return;
    }
    
    await bot.sendMessage(chatId, `✅ РК найдена в строке ${rowNumber}\n\n🎨 Выделяю ячейки...`);
    
    const result = await highlightCells(rowNumber, tkNumbers);
    
    let resultMessage = `
✅ *Готово!*

📊 *Результат:*
• Выделено ячеек: ${result.highlighted}
    `.trim();
    
    if (result.notFound.length > 0) {
      resultMessage += `\n\n⚠️ *Не найдены ТК (${result.notFound.length}):*\n`;
      const maxShow = 10;
      const toShow = result.notFound.slice(0, maxShow);
      resultMessage += toShow.map(tk => `• ${tk}`).join('\n');
      if (result.notFound.length > maxShow) {
        resultMessage += `\n... и ещё ${result.notFound.length - maxShow}`;
      }
    }
    
    await bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error processing file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await bot.sendMessage(chatId, `❌ Ошибка при обработке файла:\n${errorMessage}`);
  }
});

bot.on('message', async (msg) => {
  if (msg.document || msg.text?.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  botHealthy = true;
  await bot.sendMessage(chatId, '📤 Отправьте Excel файл (.xlsx или .xls) для обработки.\n\nИспользуйте /help для подробной справки.');
});

console.log('Telegram bot started successfully');

export { bot };
