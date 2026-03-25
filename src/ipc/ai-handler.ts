import { ipcMain } from 'electron';
import { runSql, queryAll } from '../database/index';

export function registerAiHandlers(): void {
  ipcMain.handle(
    'ai:call',
    async (_event, prompt: string, apiKey: string, systemPrompt?: string) => {
      try {
        const sysContent = systemPrompt ||
          'You are a professional English teacher helping Chinese-speaking learners. Always respond in valid JSON format only, with no extra text.';

        const response = await fetch(
          'https://api.deepseek.com/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: sysContent },
                { role: 'user', content: prompt },
              ],
              temperature: 0.3,
              max_tokens: 2000,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';

        // Track token usage
        const usage = data.usage;
        if (usage) {
          try {
            const existing = queryAll('SELECT value FROM settings WHERE key = ?', ['tokenUsage']);
            const prev = existing.length > 0 ? JSON.parse(existing[0].value) : { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
            prev.promptTokens += usage.prompt_tokens || 0;
            prev.completionTokens += usage.completion_tokens || 0;
            prev.totalTokens += usage.total_tokens || 0;
            prev.callCount += 1;
            runSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tokenUsage', JSON.stringify(prev)]);
          } catch (_) { /* ignore */ }
        }

        return content;
      } catch (err) {
        console.error('AI call error:', err);
        throw new Error(`AI call failed: ${(err as Error).message}`);
      }
    }
  );
}
