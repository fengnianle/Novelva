import { create } from 'zustand';

export const DEFAULT_SYSTEM_PROMPT = 'You are a professional English teacher helping Chinese-speaking learners. Always respond in valid JSON format only, with no extra text.';

export const DEFAULT_SENTENCE_PROMPT = `请分析以下英语句子，帮助中文母语学习者理解。

{context}

请严格按以下 JSON 格式返回（不要添加任何其他内容，不要使用 markdown 代码块）：
{
  "translation": "准确的中文翻译",
  "key_expressions": [
    {"expression": "短语/表达", "meaning": "含义", "usage": "用法说明"}
  ],
  "explanation": "简洁语法/语境说明（不超过120字）",
  "words": [
    {"word": "单词", "meaning": "在此语境下的含义", "pos": "词性"}
  ]
}

注意：
- words 中应尽量包含句子中所有有学习价值的实义词（名词、动词、形容词、副词等），只排除最基础的虚词（a/the/is/are/am/was/were/be/in/on/at/to/of/and/or/but/it/I/he/she/they/we/you/this/that/not/no）
- 每个 word 对象的 meaning 必须是该词在此语境下的具体含义
- key_expressions 重点关注地道表达、搭配和习语
- explanation 侧重帮助理解句子结构和语境`;

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
}

export interface SettingsState {
  darkMode: boolean;
  fontSize: number;
  lineHeight: number;
  apiKey: string;
  tokenUsage: TokenUsage;
  systemPrompt: string;
  sentencePrompt: string;
  dailyReviewCount: number;

  setDarkMode: (dark: boolean) => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setApiKey: (key: string) => void;
  setSystemPrompt: (prompt: string) => void;
  setSentencePrompt: (prompt: string) => void;
  setDailyReviewCount: (count: number) => void;
  resetPrompts: () => void;
  loadSettings: () => Promise<void>;
  refreshTokenUsage: () => Promise<void>;
  resetTokenUsage: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  darkMode: false,
  fontSize: 18,
  lineHeight: 1.8,
  apiKey: '',
  tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  sentencePrompt: DEFAULT_SENTENCE_PROMPT,
  dailyReviewCount: 20,

  setDarkMode: (dark) => {
    set({ darkMode: dark });
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    (window as any).electronAPI?.saveSetting('darkMode', String(dark));
  },

  setFontSize: (size) => {
    set({ fontSize: size });
    (window as any).electronAPI?.saveSetting('fontSize', String(size));
  },

  setLineHeight: (height) => {
    set({ lineHeight: height });
    (window as any).electronAPI?.saveSetting('lineHeight', String(height));
  },

  setApiKey: (key) => {
    set({ apiKey: key });
    (window as any).electronAPI?.saveSetting('apiKey', key);
  },

  setSystemPrompt: (prompt) => {
    set({ systemPrompt: prompt });
    (window as any).electronAPI?.saveSetting('systemPrompt', prompt);
  },

  setSentencePrompt: (prompt) => {
    set({ sentencePrompt: prompt });
    (window as any).electronAPI?.saveSetting('sentencePrompt', prompt);
  },

  setDailyReviewCount: (count) => {
    set({ dailyReviewCount: count });
    (window as any).electronAPI?.saveSetting('dailyReviewCount', String(count));
  },

  resetPrompts: () => {
    set({ systemPrompt: DEFAULT_SYSTEM_PROMPT, sentencePrompt: DEFAULT_SENTENCE_PROMPT });
    (window as any).electronAPI?.saveSetting('systemPrompt', DEFAULT_SYSTEM_PROMPT);
    (window as any).electronAPI?.saveSetting('sentencePrompt', DEFAULT_SENTENCE_PROMPT);
  },

  loadSettings: async () => {
    try {
      const settings = await (window as any).electronAPI?.getSettings();
      if (settings) {
        const dark = settings.darkMode === 'true';
        set({
          darkMode: dark,
          fontSize: settings.fontSize ? Number(settings.fontSize) : 18,
          lineHeight: settings.lineHeight ? Number(settings.lineHeight) : 1.8,
          apiKey: settings.apiKey || '',
          systemPrompt: settings.systemPrompt || DEFAULT_SYSTEM_PROMPT,
          sentencePrompt: settings.sentencePrompt || DEFAULT_SENTENCE_PROMPT,
          dailyReviewCount: settings.dailyReviewCount ? Number(settings.dailyReviewCount) : 20,
        });
        if (dark) {
          document.documentElement.classList.add('dark');
        }
        // Load token usage
        if (settings.tokenUsage) {
          try {
            set({ tokenUsage: JSON.parse(settings.tokenUsage) });
          } catch (_) { /* ignore */ }
        }
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  },

  refreshTokenUsage: async () => {
    try {
      const settings = await (window as any).electronAPI?.getSettings();
      if (settings?.tokenUsage) {
        set({ tokenUsage: JSON.parse(settings.tokenUsage) });
      }
    } catch (_) { /* ignore */ }
  },

  resetTokenUsage: async () => {
    const empty = { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
    set({ tokenUsage: empty });
    (window as any).electronAPI?.saveSetting('tokenUsage', JSON.stringify(empty));
  },
}));
