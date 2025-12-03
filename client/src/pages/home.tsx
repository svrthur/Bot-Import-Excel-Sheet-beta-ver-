import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Bot, FileSpreadsheet, Send, RefreshCw, ExternalLink } from "lucide-react";
import { SiTelegram, SiGooglesheets } from "react-icons/si";

interface BotStatus {
  botActive: boolean;
  googleSheetsConnected: boolean;
  spreadsheet?: {
    title: string;
    url: string;
  };
  error?: string;
}

export default function Home() {
  const { data: status, isLoading, refetch, isRefetching } = useQuery<BotStatus>({
    queryKey: ['/api/status'],
    refetchInterval: 30000,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Bot className="h-10 w-10 text-muted-foreground" />
            <h1 className="text-3xl font-bold text-foreground">Telegram Bot</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Автоматизация выделения ячеек в Google Таблице
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Telegram Bot</CardTitle>
              <SiTelegram className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  <span className="text-muted-foreground">Проверка...</span>
                </div>
              ) : status?.botActive ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-foreground font-medium">Активен</span>
                  <Badge variant="secondary" className="ml-auto">Online</Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="text-foreground font-medium">Не активен</span>
                  <Badge variant="destructive" className="ml-auto">Offline</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Google Sheets</CardTitle>
              <SiGooglesheets className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  <span className="text-muted-foreground">Проверка...</span>
                </div>
              ) : status?.googleSheetsConnected ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-foreground font-medium">Подключено</span>
                  <Badge variant="secondary" className="ml-auto">Connected</Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="text-foreground font-medium">Не подключено</span>
                  <Badge variant="destructive" className="ml-auto">Error</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {status?.spreadsheet && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Подключенная таблица
              </CardTitle>
              <CardDescription>
                Бот работает с этой Google Таблицей
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground" data-testid="text-spreadsheet-title">
                    {status.spreadsheet.title}
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <a 
                    href={status.spreadsheet.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    data-testid="link-spreadsheet"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Открыть таблицу
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Как использовать бота
            </CardTitle>
            <CardDescription>
              Простая инструкция по работе с ботом
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li>
                <span className="text-foreground font-medium">Откройте Telegram бота</span>
                <p className="ml-6 text-sm mt-1">
                  Найдите бота в Telegram и нажмите /start
                </p>
              </li>
              <li>
                <span className="text-foreground font-medium">Подготовьте Excel файл</span>
                <p className="ml-6 text-sm mt-1">
                  Столбец A - название РК, Столбец B - номера ТК
                </p>
              </li>
              <li>
                <span className="text-foreground font-medium">Отправьте файл боту</span>
                <p className="ml-6 text-sm mt-1">
                  Бот обработает файл и выделит ячейки зеленым цветом
                </p>
              </li>
              <li>
                <span className="text-foreground font-medium">Проверьте результат</span>
                <p className="ml-6 text-sm mt-1">
                  Откройте Google Таблицу и убедитесь, что ячейки выделены
                </p>
              </li>
            </ol>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button 
            onClick={() => refetch()} 
            disabled={isRefetching}
            variant="outline"
            data-testid="button-refresh-status"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Обновить статус
          </Button>
        </div>

        {status?.error && (
          <Card className="mt-8 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Ошибка
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground" data-testid="text-error-message">
                {status.error}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
