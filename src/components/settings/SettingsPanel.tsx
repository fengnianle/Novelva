import React, { useEffect, useState } from 'react';
import { useSettingsStore, DEFAULT_SYSTEM_PROMPT, DEFAULT_SENTENCE_PROMPT } from '../../stores/settings-store';
import { Sun, Moon, Type, AlignJustify, Key, BarChart3, ChevronDown, ChevronRight, RotateCcw, GraduationCap, Sparkles, Eye, EyeOff } from 'lucide-react';

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
    tokenUsage, systemPrompt, sentencePrompt, dailyReviewCount,
    setDarkMode, setFontSize, setLineHeight, setApiKey,
    setSystemPrompt, setSentencePrompt, setDailyReviewCount,
    resetPrompts, refreshTokenUsage, resetTokenUsage,
  } = useSettingsStore();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    refreshTokenUsage();
  }, [refreshTokenUsage]);

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

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Key size={16} />
                </div>
                <span className="text-sm font-medium">DeepSeek API Key</span>
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
                  <label className="text-xs font-medium text-muted-foreground">AI 系统提示词</label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-y transition-shadow"
                  />
                  {systemPrompt !== DEFAULT_SYSTEM_PROMPT && (
                    <p className="text-xs text-amber-500 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                      已修改
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    句子分析提示词模板
                    <span className="text-muted-foreground/60 ml-1">（{'{context}'} 将被替换）</span>
                  </label>
                  <textarea
                    value={sentencePrompt}
                    onChange={(e) => setSentencePrompt(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-y transition-shadow"
                  />
                  {sentencePrompt !== DEFAULT_SENTENCE_PROMPT && (
                    <p className="text-xs text-amber-500 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                      已修改
                    </p>
                  )}
                </div>
              </div>
            )}
          </SettingsCard>

        </div>
      </div>
    </div>
  );
};
