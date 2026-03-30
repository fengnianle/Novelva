import { ipcMain, BrowserWindow } from 'electron';
import { runSql, queryAll } from '../database/index';

// Track active stream AbortControllers so they can be cancelled from renderer
const activeStreams = new Map<string, AbortController>();

// ── Provider configurations ──
export interface AiProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
}

export const AI_PROVIDERS: AiProviderConfig[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-1.5-flash'],
  },
  {
    id: 'grok',
    name: 'Grok (xAI)',
    baseUrl: 'https://api.x.ai',
    defaultModel: 'grok-3-mini-fast',
    models: ['grok-3-mini-fast', 'grok-3-fast', 'grok-3-mini'],
  },
  {
    id: 'kimi',
    name: 'Kimi (月之暗面)',
    baseUrl: 'https://api.moonshot.cn',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  {
    id: 'qwen',
    name: 'Qwen (通义千问)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
    defaultModel: 'qwen-turbo',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
  },
  {
    id: 'custom',
    name: '自定义 (OpenAI 兼容)',
    baseUrl: '',
    defaultModel: '',
    models: [],
  },
];

function trackTokenUsage(usage: any) {
  if (!usage) return;
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

export function registerAiHandlers(): void {
  // Non-streaming call (backward compat + JSON responses)
  ipcMain.handle(
    'ai:call',
    async (_event, prompt: string, apiKey: string, systemPrompt?: string, providerBaseUrl?: string, model?: string) => {
      try {
        const sysContent = systemPrompt ||
          'You are a professional English teacher helping Chinese-speaking learners. Always respond in valid JSON format only, with no extra text.';

        const baseUrl = providerBaseUrl || 'https://api.deepseek.com';
        const modelName = model || 'deepseek-chat';

        const response = await fetch(
          `${baseUrl}/v1/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                { role: 'system', content: sysContent },
                { role: 'user', content: prompt },
              ],
              temperature: 0.2,
              max_tokens: 1200,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        trackTokenUsage(data.usage);
        return content;
      } catch (err) {
        console.error('AI call error:', err);
        throw new Error(`AI call failed: ${(err as Error).message}`);
      }
    }
  );

  // Streaming call — sends chunks to renderer via IPC events
  ipcMain.handle(
    'ai:call-stream',
    async (event, prompt: string, apiKey: string, systemPrompt?: string, providerBaseUrl?: string, model?: string, streamId?: string) => {
      try {
        const sysContent = systemPrompt ||
          'You are a professional language teacher. Respond in Markdown format.';

        const baseUrl = providerBaseUrl || 'https://api.deepseek.com';
        const modelName = model || 'deepseek-chat';
        const sid = streamId || 'default';

        const controller = new AbortController();
        activeStreams.set(sid, controller);

        const response = await fetch(
          `${baseUrl}/v1/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                { role: 'system', content: sysContent },
                { role: 'user', content: prompt },
              ],
              temperature: 0.2,
              max_tokens: 1200,
              stream: true,
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed (${response.status}): ${errorText}`);
        }

        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) throw new Error('No BrowserWindow found');

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullContent += delta;
                win.webContents.send(`ai:stream-chunk:${sid}`, delta);
              }
            } catch (_) { /* skip malformed chunks */ }
          }
        }

        // Track usage (estimate for streaming — exact usage not always provided)
        trackTokenUsage({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, callCount: 0 });
        activeStreams.delete(sid);
        // Signal completion
        win.webContents.send(`ai:stream-done:${sid}`, fullContent);
        return fullContent;
      } catch (err) {
        activeStreams.delete(streamId || 'default');
        // Silently ignore AbortError — it means the user intentionally cancelled
        if ((err as any)?.name === 'AbortError') return '';
        console.error('AI stream error:', err);
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
          win.webContents.send(`ai:stream-error:${streamId || 'default'}`, (err as Error).message);
        }
        throw new Error(`AI stream failed: ${(err as Error).message}`);
      }
    }
  );

  // Abort an active stream
  ipcMain.handle('ai:abort-stream', (_event, streamId: string) => {
    const controller = activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      activeStreams.delete(streamId);
      return true;
    }
    return false;
  });

  // Return provider list
  ipcMain.handle('ai:get-providers', () => AI_PROVIDERS);
}
