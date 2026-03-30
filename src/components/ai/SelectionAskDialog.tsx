import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Send, Loader2, MessageSquare } from 'lucide-react';

const SYSTEM_PROMPT_FOR_QA = '你是一位专业的多语言教师和语言顾问，帮助中文母语学习者理解外语文本。请用清晰、简洁的中文回答问题。如果问题涉及某段文本，请结合上下文进行分析。';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Position dialog below selection
  useEffect(() => {
    const dialogWidth = 440;
    const dialogHeight = dialogRef.current?.offsetHeight || 400;

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
  }, [anchorRect, messages.length, loading]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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

    const userQ = question.trim();
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', content: userQ }]);
    setLoading(true);
    setError(null);

    try {
      // Build full conversation context for the AI
      const contextPrefix = `以下是用户选中的文本：\n---\n${selectedText}\n---\n\n`;

      // Build conversation history as a single prompt
      const historyLines: string[] = [];
      for (const msg of messages) {
        if (msg.role === 'user') historyLines.push(`用户: ${msg.content}`);
        else historyLines.push(`助手: ${msg.content}`);
      }
      historyLines.push(`用户: ${userQ}`);

      const fullPrompt = contextPrefix + (historyLines.length > 1
        ? '以下是之前的对话记录:\n' + historyLines.join('\n') + '\n\n请回答用户最新的问题。'
        : `用户的问题：${userQ}`);

      const { baseUrl, model } = settings.getProviderConfig();
      const rawResponse = await api.callAI(fullPrompt, apiKey, SYSTEM_PROMPT_FOR_QA, baseUrl, model);
      const reply = rawResponse.trim();
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(`请求失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [question, selectedText, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div
      ref={dialogRef}
      className="fixed z-[70] w-[440px] bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl animate-in fade-in-0 slide-in-from-top-2 duration-200 flex flex-col"
      style={{ top: position.top, left: position.left, maxHeight: 'min(520px, 70vh)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MessageSquare size={12} />
          自由提问
          {messages.length > 0 && <span className="text-[10px] opacity-60">({Math.floor(messages.length / 2)} 轮对话)</span>}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded">
          <X size={14} />
        </button>
      </div>

      {/* Selected text preview */}
      <div className="px-4 py-2 border-b border-border bg-secondary/30 shrink-0">
        <div className="text-xs text-muted-foreground mb-0.5">选中文本</div>
        <div className="text-sm line-clamp-2 italic text-muted-foreground">
          "{selectedText.length > 150 ? selectedText.slice(0, 150) + '...' : selectedText}"
        </div>
      </div>

      {/* Chat messages area */}
      {(messages.length > 0 || loading || error) && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.map((msg, idx) => (
            <div key={idx} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              {msg.role === 'user' ? (
                <div className="max-w-[85%] text-sm bg-primary/10 text-foreground rounded-lg px-3 py-2">
                  {msg.content}
                </div>
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap bg-secondary/30 rounded-lg px-3.5 py-3">
                  {msg.content}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-sm">思考中...</span>
            </div>
          )}
          {error && <div className="text-sm text-destructive py-1">{error}</div>}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Question input */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={messages.length === 0 ? "输入你的问题...（Enter 发送）" : "继续提问...（Enter 发送）"}
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
    </div>
  );
};
