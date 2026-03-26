import { create } from 'zustand';

// ── System Prompt: editable instruction + locked format suffix ──
export const DEFAULT_SYSTEM_INSTRUCTION = '你是多语言教师，帮助中文母语者理解外语。';
export const SYSTEM_PROMPT_FORMAT_SUFFIX = '以纯JSON回复，不要多余文字或markdown代码块。';

// Build final system prompt from user instruction + locked format
export function buildSystemPrompt(instruction: string): string {
  return `${instruction.trim()}\n${SYSTEM_PROMPT_FORMAT_SUFFIX}`;
}

// For backward compat: the full default
export const DEFAULT_SYSTEM_PROMPT = buildSystemPrompt(DEFAULT_SYSTEM_INSTRUCTION);

// ── Sentence Prompt: editable analysis instructions + locked JSON schema ──
export const DEFAULT_SENTENCE_INSTRUCTION = `分析以下外语句子。自动识别语言。
要求：
- grammar_points: 最多2个最重要的语法点，简明扼要
- key_expressions: 仅当有固定搭配/习语时列出，最多2个，无则空数组
- words: 仅列出最有学习价值的实义词（最多5个），排除基础功能词。日语标注读音，德语名词带冠词(der/die/das)
- 每个word的meaning必须是该词在此语境下的具体含义
- explanation: 一句话概括，不超过50字`;

export const SENTENCE_PROMPT_FORMAT_SCHEMA = `
{context}

JSON格式返回（无多余文字）：
{"language":"ISO 639-1代码","translation":"中文翻译","grammar_points":[{"point":"名称","explanation":"说明"}],"key_expressions":[{"expression":"搭配","meaning":"含义"}],"explanation":"一句话概括","words":[{"word":"原形","surface":"句中形态","meaning":"语境含义","pos":"词性"}]}`;

export function buildSentencePrompt(instruction: string): string {
  return `${instruction.trim()}\n${SENTENCE_PROMPT_FORMAT_SCHEMA}`;
}

export const DEFAULT_SENTENCE_PROMPT = buildSentencePrompt(DEFAULT_SENTENCE_INSTRUCTION);

// ── Vocabulary Analysis Prompts (per-language, configurable) ──
export const DEFAULT_VOCAB_ANALYSIS_PROMPTS: Record<string, string> = {
  en: `请对以下英语单词进行深度解析，帮助中文母语学习者全面掌握该词：

单词: "{word}"
已知含义: "{meaning}"
例句: "{sentence}"

请详细分析以下内容（用中文回答，Markdown 格式）：

## 基本信息
- 音标（美式 & 英式）
- 词性与所有常见含义

## 词根词缀
- 拆解词根、前缀、后缀，说明各部分含义和来源
- 列出同词根的常见单词（至少3个）

## 用法与搭配
- 常见固定搭配（至少3个，附中文释义和例句）
- 常见句型
- 正式/非正式语境区别

## 近义词与反义词
- 列出近义词（至少3个），说明细微区别
- 列出反义词（如有）

## 词形变化
- 列出所有词形变化（复数、时态、比较级等）

## 助记
- 提供1-2个记忆技巧或联想方法`,

  de: `请对以下德语单词进行深度解析，帮助中文母语学习者全面掌握该词：

单词: "{word}"
已知含义: "{meaning}"
例句: "{sentence}"

请详细分析以下内容（用中文回答，Markdown 格式）：

## 基本信息
- 发音（IPA 音标）
- 词性（名词请标注性：der/die/das）
- 所有常见含义

## 名词变格 / 动词变位
- 如果是名词：列出完整变格表（单数/复数 × 四格：Nominativ, Akkusativ, Dativ, Genitiv）
- 如果是动词：
  - 是否可分动词（trennbar）？前缀是什么？
  - 列出现在时人称变位表（ich/du/er/wir/ihr/sie）
  - Perfekt 形式（助动词 haben/sein + Partizip II）
  - Präteritum 形式
  - 是否为不规则动词？
- 如果是形容词：列出比较级和最高级

## 用法与搭配
- 常见固定搭配（至少3个，附中文释义和例句）
- 支配的介词和格（如有）
- 常见句型

## 近义词与反义词
- 列出近义词（至少2个），说明区别
- 列出反义词（如有）

## 词族与构词
- 相关派生词和复合词（至少3个）
- 词根来源简述

## 助记
- 提供1-2个记忆技巧或联想方法`,

  ja: `请对以下日语单词进行深度解析，帮助中文母语学习者全面掌握该词：

单词: "{word}"
已知含义: "{meaning}"
例句: "{sentence}"

请详细分析以下内容（用中文回答，Markdown 格式）：

## 基本信息
- 读音（平假名注音）
- 声调（アクセント）
- 词性与所有常见含义

## 动词活用 / 形容词活用
- 如果是动词：
  - 动词分类（五段/一段/サ変/カ変）
  - 列出主要活用形：ます形、て形、た形、ない形、可能形、受身形、使役形、意志形、命令形、仮定形
  - 自动词还是他动词？对应的自/他动词是什么？
- 如果是い形容词/な形容词：列出活用形

## 用法与搭配
- 常见搭配（至少3个，附中文释义和例句）
- 敬语表达（如有）
- 口语 vs 书面语的区别

## 近义词辨析
- 列出近义词（至少2个），说明使用场景和语感的差异

## 相关表达
- 惯用句、谚语中的用法（如有）
- 相关复合词（至少2个）

## 助记
- 汉字来源或字形联想
- 提供1-2个记忆技巧`,

  fr: `请对以下法语单词进行深度解析，帮助中文母语学习者全面掌握该词：

单词: "{word}"
已知含义: "{meaning}"
例句: "{sentence}"

请详细分析以下内容（用中文回答，Markdown 格式）：

## 基本信息
- 发音（IPA 音标）
- 词性（名词请标注阴阳性 m./f.）
- 所有常见含义

## 词形变化
- 名词：复数形式、阴阳性变化
- 动词：所属变位组（-er/-ir/-re），列出直陈式现在时变位表，过去分词，常用时态
- 形容词：阴阳性和复数变化

## 用法与搭配
- 常见固定搭配（至少3个，附中文释义和例句）
- 常见句型和介词搭配

## 近义词与反义词
- 近义词（至少2个）及区别
- 反义词（如有）

## 词源与词族
- 简述词源
- 相关派生词

## 助记
- 提供1-2个记忆技巧`,

  es: `请对以下西班牙语单词进行深度解析，帮助中文母语学习者全面掌握该词：

单词: "{word}"
已知含义: "{meaning}"
例句: "{sentence}"

请详细分析以下内容（用中文回答，Markdown 格式）：

## 基本信息
- 发音与重音
- 词性（名词请标注阴阳性）
- 所有常见含义

## 词形变化
- 名词：复数规则、阴阳性
- 动词：所属变位类型（-ar/-er/-ir），直陈式现在时变位表，过去分词，常用时态变位
- 形容词：性数变化

## 用法与搭配
- 常见搭配（至少3个，附例句）
- 介词搭配

## 近义词与反义词

## 助记
- 提供记忆技巧`,

  ko: `请对以下韩语单词进行深度解析，帮助中文母语学习者全面掌握该词：

单词: "{word}"
已知含义: "{meaning}"
例句: "{sentence}"

请详细分析以下内容（用中文回答，Markdown 格式）：

## 基本信息
- 发音
- 词性与所有常见含义
- 汉字词来源（如有）

## 活用变化
- 如果是动词/形容词：列出主要活用形（해요体、합니다体、过去式、否定形等）

## 用法与搭配
- 常见搭配（至少3个，附例句）
- 敬语层级

## 近义词辨析
- 近义词及使用差异

## 助记
- 提供记忆技巧`,
};

// Fallback prompt for languages not explicitly configured
export const DEFAULT_VOCAB_ANALYSIS_FALLBACK = `请对以下单词进行深度解析，帮助中文母语学习者全面掌握该词：

单词: "{word}"
已知含义: "{meaning}"
例句: "{sentence}"

请详细分析以下内容（用中文回答，Markdown 格式）：

## 基本信息
- 发音
- 词性与所有常见含义

## 词形变化
- 列出该词的主要变化形式

## 用法与搭配
- 常见搭配（至少3个，附例句）

## 近义词与反义词

## 助记
- 提供记忆技巧`;

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
}

export interface DictionaryConfig {
  [lang: string]: string; // language code -> API URL template, use {word} as placeholder
}

export const DEFAULT_DICTIONARY_APIS: DictionaryConfig = {
  en: 'https://api.dictionaryapi.dev/api/v2/entries/en/{word}',
  ja: 'https://jisho.org/api/v1/search/words?keyword={word}',
  de: 'https://en.wiktionary.org/api/rest_v1/page/definition/{word}',
};

export interface VocabAnalysisPromptsConfig {
  [lang: string]: string;
}

export interface SettingsState {
  darkMode: boolean;
  fontSize: number;
  lineHeight: number;
  apiKey: string;
  aiProvider: string;
  aiModel: string;
  customBaseUrl: string;
  customModel: string;
  tokenUsage: TokenUsage;
  systemInstruction: string;
  sentenceInstruction: string;
  dailyReviewCount: number;
  dictionaryApis: DictionaryConfig;
  vocabAnalysisPrompts: VocabAnalysisPromptsConfig;

  // Computed full prompts (instruction + locked format)
  getSystemPrompt: () => string;
  getSentencePrompt: () => string;
  // Get effective provider base URL and model for AI calls
  getProviderConfig: () => { baseUrl: string; model: string };

  setDarkMode: (dark: boolean) => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setApiKey: (key: string) => void;
  setAiProvider: (provider: string) => void;
  setAiModel: (model: string) => void;
  setCustomBaseUrl: (url: string) => void;
  setCustomModel: (model: string) => void;
  setSystemInstruction: (instruction: string) => void;
  setSentenceInstruction: (instruction: string) => void;
  setDailyReviewCount: (count: number) => void;
  setDictionaryApis: (apis: DictionaryConfig) => void;
  setVocabAnalysisPrompts: (prompts: VocabAnalysisPromptsConfig) => void;
  resetPrompts: () => void;
  loadSettings: () => Promise<void>;
  refreshTokenUsage: () => Promise<void>;
  resetTokenUsage: () => Promise<void>;
}

// Provider base URLs lookup
const PROVIDER_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  grok: 'https://api.x.ai',
  kimi: 'https://api.moonshot.cn',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
};

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  deepseek: 'deepseek-chat',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  grok: 'grok-3-mini-fast',
  kimi: 'moonshot-v1-8k',
  qwen: 'qwen-turbo',
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  darkMode: false,
  fontSize: 18,
  lineHeight: 1.8,
  apiKey: '',
  aiProvider: 'deepseek',
  aiModel: 'deepseek-chat',
  customBaseUrl: '',
  customModel: '',
  tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 },
  systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
  sentenceInstruction: DEFAULT_SENTENCE_INSTRUCTION,
  dailyReviewCount: 20,
  dictionaryApis: { ...DEFAULT_DICTIONARY_APIS },
  vocabAnalysisPrompts: { ...DEFAULT_VOCAB_ANALYSIS_PROMPTS },

  getSystemPrompt: () => buildSystemPrompt(get().systemInstruction),
  getSentencePrompt: () => buildSentencePrompt(get().sentenceInstruction),
  getProviderConfig: () => {
    const { aiProvider, aiModel, customBaseUrl, customModel } = get();
    if (aiProvider === 'custom') {
      return { baseUrl: customBaseUrl, model: customModel };
    }
    return {
      baseUrl: PROVIDER_URLS[aiProvider] || PROVIDER_URLS.deepseek,
      model: aiModel || PROVIDER_DEFAULT_MODELS[aiProvider] || 'deepseek-chat',
    };
  },

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

  setAiProvider: (provider) => {
    const model = PROVIDER_DEFAULT_MODELS[provider] || '';
    set({ aiProvider: provider, aiModel: model });
    (window as any).electronAPI?.saveSetting('aiProvider', provider);
    (window as any).electronAPI?.saveSetting('aiModel', model);
  },

  setAiModel: (model) => {
    set({ aiModel: model });
    (window as any).electronAPI?.saveSetting('aiModel', model);
  },

  setCustomBaseUrl: (url) => {
    set({ customBaseUrl: url });
    (window as any).electronAPI?.saveSetting('customBaseUrl', url);
  },

  setCustomModel: (model) => {
    set({ customModel: model });
    (window as any).electronAPI?.saveSetting('customModel', model);
  },

  setSystemInstruction: (instruction) => {
    set({ systemInstruction: instruction });
    (window as any).electronAPI?.saveSetting('systemInstruction', instruction);
  },

  setSentenceInstruction: (instruction) => {
    set({ sentenceInstruction: instruction });
    (window as any).electronAPI?.saveSetting('sentenceInstruction', instruction);
  },

  setDailyReviewCount: (count) => {
    set({ dailyReviewCount: count });
    (window as any).electronAPI?.saveSetting('dailyReviewCount', String(count));
  },

  setDictionaryApis: (apis) => {
    set({ dictionaryApis: apis });
    (window as any).electronAPI?.saveSetting('dictionaryApis', JSON.stringify(apis));
  },

  setVocabAnalysisPrompts: (prompts) => {
    set({ vocabAnalysisPrompts: prompts });
    (window as any).electronAPI?.saveSetting('vocabAnalysisPrompts', JSON.stringify(prompts));
  },

  resetPrompts: () => {
    set({ systemInstruction: DEFAULT_SYSTEM_INSTRUCTION, sentenceInstruction: DEFAULT_SENTENCE_INSTRUCTION });
    (window as any).electronAPI?.saveSetting('systemInstruction', DEFAULT_SYSTEM_INSTRUCTION);
    (window as any).electronAPI?.saveSetting('sentenceInstruction', DEFAULT_SENTENCE_INSTRUCTION);
  },

  loadSettings: async () => {
    try {
      const settings = await (window as any).electronAPI?.getSettings();
      if (settings) {
        const dark = settings.darkMode === 'true';
        // Migrate old verbose prompts to new streamlined versions
        const OLD_SYS_PREFIX = '你是一位专业的多语言教师';
        const OLD_SENT_PREFIX = '请分析以下外语句子，帮助中文母语学习者理解';
        let sysInstr = settings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
        let sentInstr = settings.sentenceInstruction || DEFAULT_SENTENCE_INSTRUCTION;
        // Auto-migrate if user hasn't customized (still using old default)
        if (sysInstr.startsWith(OLD_SYS_PREFIX)) sysInstr = DEFAULT_SYSTEM_INSTRUCTION;
        if (sentInstr.startsWith(OLD_SENT_PREFIX)) sentInstr = DEFAULT_SENTENCE_INSTRUCTION;
        set({
          darkMode: dark,
          fontSize: settings.fontSize ? Number(settings.fontSize) : 18,
          lineHeight: settings.lineHeight ? Number(settings.lineHeight) : 1.8,
          apiKey: settings.apiKey || '',
          aiProvider: settings.aiProvider || 'deepseek',
          aiModel: settings.aiModel || PROVIDER_DEFAULT_MODELS[settings.aiProvider || 'deepseek'] || 'deepseek-chat',
          customBaseUrl: settings.customBaseUrl || '',
          customModel: settings.customModel || '',
          systemInstruction: sysInstr,
          sentenceInstruction: sentInstr,
          dailyReviewCount: settings.dailyReviewCount ? Number(settings.dailyReviewCount) : 20,
          dictionaryApis: settings.dictionaryApis ? JSON.parse(settings.dictionaryApis) : { ...DEFAULT_DICTIONARY_APIS },
          vocabAnalysisPrompts: settings.vocabAnalysisPrompts ? JSON.parse(settings.vocabAnalysisPrompts) : { ...DEFAULT_VOCAB_ANALYSIS_PROMPTS },
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
