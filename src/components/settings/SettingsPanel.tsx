import React, { useEffect, useState } from 'react';
import { useSettingsStore, DEFAULT_SYSTEM_INSTRUCTION, DEFAULT_SENTENCE_INSTRUCTION, SYSTEM_PROMPT_FORMAT_SUFFIX, SENTENCE_PROMPT_FORMAT_SCHEMA, DEFAULT_DICTIONARY_APIS, DictionaryConfig, DEFAULT_VOCAB_ANALYSIS_PROMPTS, DEFAULT_VOCAB_ANALYSIS_FALLBACK } from '../../stores/settings-store';
import { Sun, Moon, Type, AlignJustify, Key, BarChart3, ChevronDown, ChevronRight, RotateCcw, GraduationCap, Sparkles, Eye, EyeOff, Globe, Plus, Trash2, Lock, BookOpen, Cpu, Download, RefreshCw, ExternalLink, Info } from 'lucide-react';

// Reusable settings card wrapper
const SettingsCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-card border border-border rounded-xl p-5 space-y-4">{children}</div>
);

const SettingsRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  description?: string;
  children: React.ReactNode;
}> = ({ icon, label, description, children }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground truncate">{description}</div>}
      </div>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

export const SettingsPanel: React.FC = () => {
  const {
    darkMode, fontSize, lineHeight, apiKey,
    aiProvider, aiModel, customBaseUrl, customModel,
    tokenUsage, systemInstruction, sentenceInstruction, dailyReviewCount,
    dictionaryApis, setDictionaryApis,
    vocabAnalysisPrompts, setVocabAnalysisPrompts,
    setDarkMode, setFontSize, setLineHeight, setApiKey,
    setAiProvider, setAiModel, setCustomBaseUrl, setCustomModel,
    setSystemInstruction, setSentenceInstruction, setDailyReviewCount,
    resetPrompts, refreshTokenUsage, resetTokenUsage,
  } = useSettingsStore();

  const providerOptions = [
    { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
    { id: 'openai', name: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'] },
    { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.0-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-1.5-flash'] },
    { id: 'grok', name: 'Grok (xAI)', models: ['grok-3-mini-fast', 'grok-3-fast', 'grok-3-mini'] },
    { id: 'kimi', name: 'Kimi (月之暗面)', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] },
    { id: 'qwen', name: 'Qwen (通义千问)', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'] },
    { id: 'custom', name: '自定义 (OpenAI 兼容)', models: [] },
  ];
  const currentProvider = providerOptions.find(p => p.id === aiProvider) || providerOptions[0];

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showDictConfig, setShowDictConfig] = useState(false);
  const [showVocabPrompts, setShowVocabPrompts] = useState(false);
  const [newDictLang, setNewDictLang] = useState('');
  const [newVocabLang, setNewVocabLang] = useState('');

  // Update check state
  const [appVersion, setAppVersion] = useState('');
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<any>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    refreshTokenUsage();
    // Load current app version
    (window as any).electronAPI?.getAppVersion?.().then((v: string) => setAppVersion(v || ''));
  }, [refreshTokenUsage]);

  const handleCheckUpdate = async () => {
    setUpdateChecking(true);
    setUpdateError(null);
    setUpdateResult(null);
    try {
      const api = (window as any).electronAPI;
      const result = await api?.checkForUpdate();
      if (!result) {
        setUpdateError('无法连接到 GitHub，请检查网络连接');
      } else {
        setUpdateResult(result);
      }
    } catch (err) {
      setUpdateError(`检查失败: ${(err as Error).message}`);
    }
    setUpdateChecking(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-10 pb-4 border-b border-border">
        <h1 className="text-lg font-semibold">设置</h1>
        <p className="text-xs text-muted-foreground mt-1">自定义阅读体验和 AI 功能</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-5">

          {/* Appearance */}
          <SettingsCard>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">外观</div>

            <SettingsRow icon={darkMode ? <Moon size={16} /> : <Sun size={16} />} label="深色模式" description="切换明暗主题">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`toggle-switch ${darkMode ? 'bg-primary' : 'bg-secondary'}`}
              >
                <span className={`toggle-knob ${darkMode ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
              </button>
            </SettingsRow>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Type size={16} />
                  </div>
                  <span className="text-sm font-medium">字体大小</span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-primary">{fontSize}px</span>
              </div>
              <input
                type="range" min={14} max={28} step={1} value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>14px</span><span>28px</span>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <AlignJustify size={16} />
                  </div>
                  <span className="text-sm font-medium">行距</span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-primary">{lineHeight}</span>
              </div>
              <input
                type="range" min={1.2} max={2.5} step={0.1} value={lineHeight}
                onChange={(e) => setLineHeight(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>紧凑 1.2</span><span>宽松 2.5</span>
              </div>
            </div>
          </SettingsCard>

          {/* AI Configuration */}
          <SettingsCard>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI 配置</div>

            {/* Provider Selection */}
            <div className="space-y-3">
              <SettingsRow icon={<Cpu size={16} />} label="AI 服务提供商" description="选择 AI API 服务">
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-shadow"
                >
                  {providerOptions.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </SettingsRow>

              {/* Model Selection */}
              {currentProvider.models.length > 0 && (
                <div className="flex items-center justify-between pl-11">
                  <span className="text-xs text-muted-foreground">模型</span>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    {currentProvider.models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Custom provider fields */}
              {aiProvider === 'custom' && (
                <div className="space-y-2 pl-11">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">API Base URL</label>
                    <input
                      type="text"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      placeholder="https://api.example.com"
                      className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">模型名称</label>
                    <input
                      type="text"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      placeholder="model-name"
                      className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">支持任何 OpenAI 兼容接口（如 Ollama、LM Studio、Azure 等）</p>
                </div>
              )}
            </div>

            {/* API Key */}
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Key size={16} />
                </div>
                <span className="text-sm font-medium">API Key</span>
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-shadow"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground pl-0.5">
                API Key 仅保存在本地，不会上传到任何服务器。
              </p>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <GraduationCap size={16} />
                  </div>
                  <span className="text-sm font-medium">每日复习数量</span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-primary">{dailyReviewCount} 个</span>
              </div>
              <input
                type="range" min={5} max={100} step={5} value={dailyReviewCount}
                onChange={(e) => setDailyReviewCount(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5 个</span><span>100 个</span>
              </div>
            </div>
          </SettingsCard>

          {/* Token Usage */}
          <SettingsCard>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 size={12} />
                AI 用量统计
              </div>
              <button
                onClick={resetTokenUsage}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10"
              >
                重置
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '调用次数', value: tokenUsage.callCount },
                { label: '总 Token', value: tokenUsage.totalTokens },
                { label: '输入 Token', value: tokenUsage.promptTokens },
                { label: '输出 Token', value: tokenUsage.completionTokens },
              ].map((item) => (
                <div key={item.label} className="bg-secondary/50 rounded-lg px-3.5 py-3">
                  <div className="text-[10px] text-muted-foreground mb-0.5">{item.label}</div>
                  <div className="text-base font-semibold tabular-nums">{item.value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </SettingsCard>

          {/* Dictionary API Config */}
          <SettingsCard>
            <button
              onClick={() => setShowDictConfig(!showDictConfig)}
              className="flex items-center justify-between w-full group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Globe size={16} />
                </div>
                <span className="text-sm font-medium group-hover:text-primary transition-colors">词典 API 配置</span>
              </div>
              {showDictConfig ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
            </button>

            {showDictConfig && (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  配置各语言的词典 API，在词汇详情页使用。URL 中用 <code className="text-primary">{'{word}'}</code> 作为单词占位符。
                </p>

                {Object.entries(dictionaryApis).map(([lang, url]) => (
                  <div key={lang} className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase bg-secondary px-2 py-1 rounded w-10 text-center shrink-0">{lang}</span>
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => {
                        const updated = { ...dictionaryApis, [lang]: e.target.value };
                        setDictionaryApis(updated);
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-md border border-input bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    <button
                      onClick={() => {
                        const updated = { ...dictionaryApis };
                        delete updated[lang];
                        setDictionaryApis(updated);
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newDictLang}
                    onChange={(e) => setNewDictLang(e.target.value.toLowerCase().trim())}
                    placeholder="语言代码 (如 de)"
                    className="w-20 px-2.5 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => {
                      if (newDictLang && !dictionaryApis[newDictLang]) {
                        setDictionaryApis({ ...dictionaryApis, [newDictLang]: 'https://api.example.com/{word}' });
                        setNewDictLang('');
                      }
                    }}
                    disabled={!newDictLang || !!dictionaryApis[newDictLang]}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-40 transition-colors px-2 py-1.5"
                  >
                    <Plus size={12} />
                    添加语言
                  </button>
                </div>

                <button
                  onClick={() => setDictionaryApis({ ...DEFAULT_DICTIONARY_APIS })}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg hover:bg-primary/10"
                >
                  <RotateCcw size={12} />
                  恢复默认
                </button>
              </div>
            )}
          </SettingsCard>

          {/* Advanced */}
          <SettingsCard>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </div>
                <span className="text-sm font-medium group-hover:text-primary transition-colors">高级 Prompt 设置</span>
              </div>
              {showAdvanced ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
            </button>

            {showAdvanced && (
              <div className="space-y-5 pt-2">
                <div className="flex justify-end">
                  <button
                    onClick={resetPrompts}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg hover:bg-primary/10"
                  >
                    <RotateCcw size={12} />
                    恢复默认
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">AI 系统提示词（可编辑部分）</label>
                  <textarea
                    value={systemInstruction}
                    onChange={(e) => setSystemInstruction(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-y transition-shadow"
                  />
                  <div className="flex items-start gap-1.5 px-3 py-2 rounded-lg bg-secondary/40 border border-border/50">
                    <Lock size={11} className="text-muted-foreground/60 shrink-0 mt-0.5" />
                    <span className="text-[10px] text-muted-foreground/60 font-mono">{SYSTEM_PROMPT_FORMAT_SUFFIX}</span>
                  </div>
                  {systemInstruction !== DEFAULT_SYSTEM_INSTRUCTION && (
                    <p className="text-xs text-amber-500 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                      已修改
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    句子分析提示词（可编辑部分）
                  </label>
                  <textarea
                    value={sentenceInstruction}
                    onChange={(e) => setSentenceInstruction(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-y transition-shadow"
                  />
                  <div className="flex items-start gap-1.5 px-3 py-2 rounded-lg bg-secondary/40 border border-border/50">
                    <Lock size={11} className="text-muted-foreground/60 shrink-0 mt-0.5" />
                    <div className="text-[10px] text-muted-foreground/60 font-mono whitespace-pre-wrap leading-relaxed max-h-[120px] overflow-y-auto">{SENTENCE_PROMPT_FORMAT_SCHEMA.trim()}</div>
                  </div>
                  {sentenceInstruction !== DEFAULT_SENTENCE_INSTRUCTION && (
                    <p className="text-xs text-amber-500 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                      已修改
                    </p>
                  )}
                </div>
              </div>
            )}
          </SettingsCard>

          {/* Vocabulary Analysis Prompts */}
          <SettingsCard>
            <button
              onClick={() => setShowVocabPrompts(!showVocabPrompts)}
              className="flex items-center justify-between w-full group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <BookOpen size={16} />
                </div>
                <span className="text-sm font-medium group-hover:text-primary transition-colors">词汇详解 AI 提示词</span>
              </div>
              {showVocabPrompts ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
            </button>

            {showVocabPrompts && (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-muted-foreground">
                  配置各语言的词汇深度解析提示词，在词汇详情页使用。支持占位符：<code className="text-primary">{'{word}'}</code>、<code className="text-primary">{'{meaning}'}</code>、<code className="text-primary">{'{sentence}'}</code>
                </p>

                {Object.entries(vocabAnalysisPrompts).map(([lang, prompt]) => (
                  <div key={lang} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase bg-secondary px-2 py-0.5 rounded">{lang}</span>
                      <button
                        onClick={() => {
                          const updated = { ...vocabAnalysisPrompts };
                          delete updated[lang];
                          setVocabAnalysisPrompts(updated);
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                        title="删除"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <textarea
                      value={prompt}
                      onChange={(e) => {
                        setVocabAnalysisPrompts({ ...vocabAnalysisPrompts, [lang]: e.target.value });
                      }}
                      rows={4}
                      className="w-full px-2.5 py-2 rounded-md border border-input bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y"
                    />
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newVocabLang}
                    onChange={(e) => setNewVocabLang(e.target.value.toLowerCase().trim())}
                    placeholder="语言代码 (如 ru)"
                    className="w-20 px-2.5 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => {
                      if (newVocabLang && !vocabAnalysisPrompts[newVocabLang]) {
                        const defaultPrompt = DEFAULT_VOCAB_ANALYSIS_PROMPTS[newVocabLang] || DEFAULT_VOCAB_ANALYSIS_FALLBACK;
                        setVocabAnalysisPrompts({ ...vocabAnalysisPrompts, [newVocabLang]: defaultPrompt });
                        setNewVocabLang('');
                      }
                    }}
                    disabled={!newVocabLang || !!vocabAnalysisPrompts[newVocabLang]}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-40 transition-colors px-2 py-1.5"
                  >
                    <Plus size={12} />
                    添加语言
                  </button>
                </div>

                <button
                  onClick={() => setVocabAnalysisPrompts({ ...DEFAULT_VOCAB_ANALYSIS_PROMPTS })}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg hover:bg-primary/10"
                >
                  <RotateCcw size={12} />
                  恢复默认
                </button>
              </div>
            )}
          </SettingsCard>

          {/* About & Update */}
          <SettingsCard>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">关于与更新</div>

            <SettingsRow icon={<Info size={16} />} label="Novelva" description={appVersion ? `当前版本 v${appVersion}` : '多语言 AI 阅读学习'}>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); (window as any).electronAPI?.openReleasePage('https://github.com/fengnianle/Novelva'); }}
                className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                <ExternalLink size={12} />
                GitHub
              </a>
            </SettingsRow>

            <div className="border-t border-border pt-4">
              <button
                onClick={handleCheckUpdate}
                disabled={updateChecking}
                className="w-full py-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {updateChecking ? (
                  <><RefreshCw size={14} className="animate-spin" /> 正在检查...</>
                ) : (
                  <><Download size={14} /> 检查更新</>
                )}
              </button>

              {updateError && (
                <div className="mt-3 text-xs text-destructive">{updateError}</div>
              )}

              {updateResult && !updateResult.isNewer && (
                <div className="mt-3 text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  ✓ 已是最新版本 (v{updateResult.version})
                </div>
              )}

              {updateResult && updateResult.isNewer && (
                <div className="mt-3 space-y-3 bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-primary">
                      发现新版本 {updateResult.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {updateResult.publishedAt ? new Date(updateResult.publishedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  {updateResult.body && (
                    <div className="text-xs text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {updateResult.body}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {updateResult.downloadUrl && (
                      <button
                        onClick={() => (window as any).electronAPI?.downloadUpdate(updateResult.downloadUrl)}
                        className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                      >
                        <Download size={14} />
                        下载更新
                      </button>
                    )}
                    <button
                      onClick={() => (window as any).electronAPI?.openReleasePage(updateResult.htmlUrl)}
                      className="py-2 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/50 transition-all flex items-center gap-1.5"
                    >
                      <ExternalLink size={13} />
                      查看详情
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SettingsCard>

        </div>
      </div>
    </div>
  );
};
