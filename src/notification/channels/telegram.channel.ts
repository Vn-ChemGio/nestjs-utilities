import type {
  SendNotificationInput,
  TelegramChannelConfig,
} from '../interfaces';
import type {
  NotificationChannel,
  SendChannelResult,
} from './channel.interface';

export class TelegramChannel implements NotificationChannel {
  readonly channelType = 'telegram';
  private apiBase: string;

  constructor(private config: TelegramChannelConfig) {
    this.apiBase =
      config.apiBaseUrl ?? `https://api.telegram.org/bot${config.botToken}`;
  }

  async send(input: SendNotificationInput): Promise<SendChannelResult> {
    try {
      const to = Array.isArray(input.to) ? input.to : [input.to];
      const results = await Promise.all(
        to.map((chatId) => this.sendToChat(chatId, input)),
      );

      const success = results.some((r) => r.success);
      const firstSuccess = results.find((r) => r.success);
      const errors = results.filter((r) => !r.success).map((r) => r.error);

      return {
        success,
        messageId: firstSuccess?.messageId,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  private async sendToChat(
    chatId: string,
    input: SendNotificationInput,
  ): Promise<SendChannelResult> {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: input.content,
      parse_mode: 'HTML',
    };

    if (input.sender) payload.username = input.sender;

    const response = await fetch(`${this.apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        error: `Telegram API ${response.status}: ${body}`,
      };
    }

    const data = (await response.json()) as {
      ok: boolean;
      result?: { message_id: number };
    };
    if (!data.ok) {
      return { success: false, error: 'Telegram API returned not ok' };
    }

    return { success: true, messageId: String(data.result?.message_id) };
  }
}
