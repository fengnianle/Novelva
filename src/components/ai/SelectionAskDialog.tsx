import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Send, Loader2, MessageSquare } from 'lucide-react';

const SYSTEM_PROMPT_FOR_QA = '你是一位专业的多语言教师和语言顾问，帮助中文母语学习者理解外语文本。请用清晰、简洁的中文回答问题。如果问题涉及某段文本，请结合上下文进行分析。';

interface SelectionAskDialogProps {
  selectedText: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

export const SelectionAskDialog: React.FC<SelectionAskDialogProps> = ({
  selectedText,
  anchorRect,
  onClose,
}) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Position dialog below selection
  useEffect(() => {
    const dialogWidth = 420;
    const dialogHeight = dialogRef.current?.offsetHeight || 300;

    let left = anchorRect.left + anchorRect.width / 2 - dialogWidth / 2;
    if (left < 10) left = 10;
    if (left + dialogWidth > window.innerWidth - 10) {
      left = window.innerWidth - dialogWidth - 10;
    }

    let top = anchorRect.bottom + 10;
    if (top + dialogHeight > window.innerHeight - 10) {
      top = anchorRect.top - dialogHeight - 10;
      if (top < 10) top = 10;
    }

    setPosition({ top, left });
  }, [anchorRect, answer, loading]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleAsk = useCallback(async () => {
    if (!question.trim() || loading) return;

    const api = (window as any).electronAPI;
    if (!api) return;

    const settings = await import('../../stores/settings-store').then(m => m.useSettingsStore.getState());
    const { apiKey } = settings;
    if (!apiKey) {
      setError('请先在设置中配置 API Key');
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer('');

    try {
      const userPrompt = `以下是用户选中的文本：
---
${selectedText}
---

用户的问题：${question}`;

      const { baseUrl, model } = settings.getProviderConfig();
      const rawResponse = await api.callAI(userPrompt, apiKey, SYSTEM_PROMPT_FOR_QA, baseUrl, model);
      setAnswer(rawResponse.trim());
    } catch (err) {
      setError(`请求失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [question, selectedText, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div
      ref={dialogRef}
      className="fixed z-[70] w-[420px] bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl animate-in fade-in-0 slide-in-from-top-2 duration-200"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MessageSquare size={12} />
          自由提问
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded">
          <X size={14} />
        </button>
      </div>

      {/* Selected text preview */}
      <div className="px-4 py-2 border-b border-border bg-secondary/30">
        <div className="text-xs text-muted-foreground mb-0.5">选中文本</div>
        <div className="text-sm line-clamp-3 italic text-muted-foreground">
          "{selectedText.length > 200 ? selectedText.slice(0, 200) + '...' : selectedText}"
        </div>
      </div>

      {/* Question input */}
      <div className="px-4 py-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题...（Enter 发送，Shift+Enter 换行）"
            rows={2}
            className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-shadow"
          />
          <button
            onClick={handleAsk}
            disabled={!question.trim() || loading}
            className="self-end px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* Answer area */}
      {(answer || loading || error) && (
        <div className="px-4 pb-4 max-h-[300px] overflow-y-auto">
          {loading && !answer && (
            <div className="flex items-center gap-2 py-4 text-muted-foreground justify-center">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-sm">思考中...</span>
            </div>
          )}
          {error && <div className="text-sm text-destructive py-2">{error}</div>}
          {answer && (
            <div className="text-sm leading-relaxed whitespace-pre-wrap bg-secondary/30 rounded-lg px-3.5 py-3">
              {answer}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
