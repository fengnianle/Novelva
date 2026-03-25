import React, { useEffect, useState } from 'react';
import { useSettingsStore, DEFAULT_SYSTEM_PROMPT, DEFAULT_SENTENCE_PROMPT } from '../../stores/settings-store';
import { Sun, Moon, Type, AlignJustify, Key, BarChart3, ChevronDown, ChevronRight, RotateCcw, GraduationCap, Sparkles } from 'lucide-react';

export const SettingsPanel: React.FC = () => {
  const {
    darkMode, fontSize, lineHeight, apiKey,
    tokenUsage, systemPrompt, sentencePrompt, dailyReviewCount,
    setDarkMode, setFontSize, setLineHeight, setApiKey,
    setSystemPrompt, setSentencePrompt, setDailyReviewCount,
    resetPrompts, refreshTokenUsage, resetTokenUsage,
  } = useSettingsStore();

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    refreshTokenUsage();
  }, [refreshTokenUsage]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold">设置</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-lg space-y-8">
          {/* Dark Mode */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              {darkMode ? <Moon size={16} /> : <Sun size={16} />}
              深色模式
            </label>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                darkMode ? 'bg-primary' : 'bg-secondary'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Type size={16} />
              字体大小: {fontSize}px
            </label>
            <input
              type="range" min={14} max={28} step={1} value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>14px</span><span>28px</span>
            </div>
          </div>

          {/* Line Height */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <AlignJustify size={16} />
              行距: {lineHeight}
            </label>
            <input
              type="range" min={1.2} max={2.5} step={0.1} value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1.2</span><span>2.5</span>
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Key size={16} />
              DeepSeek API Key
            </label>
            <input
              type="password" value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入你的 DeepSeek API Key"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              用于调用 AI 解析功能。API Key 仅保存在本地。
            </p>
          </div>

          {/* Daily Review Count */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <GraduationCap size={16} />
              每日复习数量: {dailyReviewCount} 个
            </label>
            <input
              type="range" min={5} max={100} step={5} value={dailyReviewCount}
              onChange={(e) => setDailyReviewCount(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5个</span><span>100个</span>
            </div>
          </div>

          {/* Token Usage Stats */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 size={16} />
              AI 用量统计
            </label>
            <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">调用次数</div>
                  <div className="font-medium tabular-nums">{tokenUsage.callCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">总 Token</div>
                  <div className="font-medium tabular-nums">{tokenUsage.totalTokens.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">输入 Token</div>
                  <div className="font-medium tabular-nums">{tokenUsage.promptTokens.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">输出 Token</div>
                  <div className="font-medium tabular-nums">{tokenUsage.completionTokens.toLocaleString()}</div>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <button
                  onClick={resetTokenUsage}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  重置统计
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-3">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            >
              <Sparkles size={16} />
              高级设置
              {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {showAdvanced && (
              <div className="space-y-4 pl-1">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">AI 系统提示词</label>
                    <button
                      onClick={resetPrompts}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <RotateCcw size={12} />
                      恢复默认
                    </button>
                  </div>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  />
                  {systemPrompt !== DEFAULT_SYSTEM_PROMPT && (
                    <p className="text-xs text-amber-500">已修改（与默认不同）</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    句子分析提示词模板
                    <span className="text-muted-foreground/60 ml-1">（{'{context}'} 将被替换为句子内容）</span>
                  </label>
                  <textarea
                    value={sentencePrompt}
                    onChange={(e) => setSentencePrompt(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  />
                  {sentencePrompt !== DEFAULT_SENTENCE_PROMPT && (
                    <p className="text-xs text-amber-500">已修改（与默认不同）</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
