import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSettingsStore, DEFAULT_VOCAB_ANALYSIS_PROMPTS, DEFAULT_VOCAB_ANALYSIS_FALLBACK, SYSTEM_PROMPT_FORMAT_SUFFIX } from '../../stores/settings-store';
import { VocabularyEntry } from '../../hooks/use-vocabulary';
import { Sparkles, Loader2, RotateCw, ChevronDown, ChevronRight, Pencil } from 'lucide-react';

interface VocabAIAnalysisProps {
  entry: VocabularyEntry;
}

export const VocabAIAnalysis: React.FC<VocabAIAnalysisProps> = ({ entry }) => {
  const { apiKey, vocabAnalysisPrompts } = useSettingsStore();
  const getSystemPrompt = useSettingsStore((s) => s.getSystemPrompt);
  const getProviderConfig = useSettingsStore((s) => s.getProviderConfig);

  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [loadingFromCache, setLoadingFromCache] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const lang = entry.language || 'en';
  const firstMeaning = entry.meanings[0]?.meaning || '';
  const firstSentence = entry.meanings[0]?.sentences[0]?.sentence || '';

  // Get the effective prompt for this word
  const getEffectivePrompt = useCallback(() => {
    if (customPrompt !== null) return customPrompt;
    return vocabAnalysisPrompts[lang] || DEFAULT_VOCAB_ANALYSIS_PROMPTS[lang] || DEFAULT_VOCAB_ANALYSIS_FALLBACK;
  }, [customPrompt, vocabAnalysisPrompts, lang]);

  // Load cached result from DB on mount / word change
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(null);
    setCustomPrompt(null);
    setShowPromptEditor(false);
    setLoadingFromCache(true);

    const loadCache = async () => {
      const api = (window as any).electronAPI;
      if (!api) { setLoadingFromCache(false); return; }
      try {
        const rows = await api.dbQuery(
          'SELECT analysis_text FROM vocab_analysis_cache WHERE word = ?',
          [entry.word.toLowerCase()]
        );
        if (!cancelled && rows && rows.length > 0 && rows[0].analysis_text) {
          setResult(rows[0].analysis_text);
          setExpanded(false); // Collapse if cached
        } else if (!cancelled) {
          setExpanded(false); // Collapsed by default
        }
      } catch (_) { /* table may not exist yet */ }
      if (!cancelled) setLoadingFromCache(false);
    };
    loadCache();
    return () => { cancelled = true; };
  }, [entry.word]);

  // Cleanup stream listeners on unmount
  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  const generateAnalysis = useCallback(async (skipCache = false) => {
    const api = (window as any).electronAPI;
    if (!api || !apiKey) {
      setError('请先配置 API Key');
      return;
    }

    // Cleanup previous stream if any
    cleanupRef.current?.();

    setLoading(true);
    setError(null);
    setExpanded(true); // Auto-expand when generating
    if (skipCache) setResult(null);

    try {
      const promptTemplate = getEffectivePrompt();
      const prompt = promptTemplate
        .replace(/\{word\}/g, entry.word)
        .replace(/\{meaning\}/g, firstMeaning)
        .replace(/\{sentence\}/g, firstSentence);

      const systemPrompt = getSystemPrompt()
        .replace(SYSTEM_PROMPT_FORMAT_SUFFIX, '请以Markdown格式回复，结构清晰。不要返回JSON。');

      const { baseUrl, model } = getProviderConfig();
      const streamId = `vocab-${Date.now()}`;
      let accumulated = '';

      // Set up stream listeners
      const offChunk = api.onStreamChunk(streamId, (chunk: string) => {
        accumulated += chunk;
        setResult(accumulated);
      });
      const offDone = api.onStreamDone(streamId, async (full: string) => {
        setLoading(false);
        setResult(full);
        // Save to DB cache
        try {
          await api.dbRun(
            `INSERT OR REPLACE INTO vocab_analysis_cache (word, language, analysis_text, created_at) VALUES (?, ?, ?, datetime('now'))`,
            [entry.word.toLowerCase(), lang, full]
          );
        } catch (_) { /* ignore */ }
      });
      const offError = api.onStreamError(streamId, (errMsg: string) => {
        setLoading(false);
        setError(`生成失败: ${errMsg}`);
      });

      cleanupRef.current = () => {
        offChunk();
        offDone();
        offError();
      };

      // Start streaming call
      await api.callAIStream(prompt, apiKey, systemPrompt, baseUrl, model, streamId);
    } catch (err) {
      setError(`生成失败: ${(err as Error).message}`);
      setLoading(false);
    }
  }, [apiKey, entry.word, lang, firstMeaning, firstSentence, getEffectivePrompt, getSystemPrompt, getProviderConfig]);

  if (!apiKey) {
    return (
      <div className="text-xs text-muted-foreground/60 py-2">
        请先在设置中配置 API Key 以使用 AI 词汇详解
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="flex items-center justify-between cursor-pointer select-none group"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <Sparkles size={14} className="text-primary shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">AI 词汇详解</span>
          {result && !expanded && (
            <span className="text-[10px] text-muted-foreground/60">— 点击展开</span>
          )}
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {expanded && (
            <button
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              className="text-muted-foreground hover:text-primary transition-colors p-1 rounded"
              title="编辑提示词"
            >
              {showPromptEditor ? <ChevronDown size={13} /> : <Pencil size={12} />}
            </button>
          )}
          {result && (
            <button
              onClick={() => generateAnalysis(true)}
              disabled={loading}
              className="text-muted-foreground hover:text-primary transition-colors p-1 rounded disabled:opacity-40"
              title="重新生成"
            >
              <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Inline prompt editor */}
      {expanded && showPromptEditor && (
        <div className="space-y-2">
          <textarea
            value={customPrompt ?? getEffectivePrompt()}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={6}
            className="w-full px-2.5 py-2 rounded-md border border-input bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y"
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              支持占位符: {'{word}'}, {'{meaning}'}, {'{sentence}'}
            </span>
            {customPrompt !== null && (
              <button
                onClick={() => setCustomPrompt(null)}
                className="text-[10px] text-primary hover:text-primary/80 ml-auto"
              >
                恢复默认
              </button>
            )}
          </div>
        </div>
      )}

      {!result && !loading && !error && !loadingFromCache && expanded && (
        <button
          onClick={() => generateAnalysis()}
          className="w-full py-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-2"
        >
          <Sparkles size={14} />
          生成 AI 词汇详解
        </button>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs">正在生成词汇详解...</span>
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <div className="text-xs text-destructive">{error}</div>
          <button
            onClick={() => generateAnalysis()}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {expanded && result && (
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed
            prose-headings:text-base prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
            prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5
            prose-strong:text-primary prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:rounded"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(result) }}
        />
      )}
    </div>
  );
};

// Convert a JSON object to readable HTML (for cached results that are JSON instead of markdown)
function renderJsonAsHtml(obj: any, depth = 0): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return `<span>${obj}</span>`;
  if (typeof obj === 'number' || typeof obj === 'boolean') return `<span>${String(obj)}</span>`;

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '';
    // Check if array of simple strings
    if (obj.every(item => typeof item === 'string')) {
      return '<ul>' + obj.map(item => `<li>${item}</li>`).join('') + '</ul>';
    }
    // Array of objects — render each
    return obj.map(item => renderJsonAsHtml(item, depth + 1)).join('');
  }

  if (typeof obj === 'object') {
    let html = '';
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'string' || typeof value === 'number') {
        html += `<div class="my-1"><strong>${key}:</strong> ${String(value)}</div>`;
      } else if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
        html += `<div class="my-1"><strong>${key}:</strong> ${(value as string[]).join('、')}</div>`;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Nested object: render as a sub-table
        const tag = depth === 0 ? 'h2' : 'h3';
        html += `<${tag}>${key}</${tag}>`;
        const entries = Object.entries(value as Record<string, any>);
        // If all values are strings, render as a compact table
        if (entries.every(([, v]) => typeof v === 'string')) {
          html += '<table class="w-full border-collapse border border-border my-2">';
          for (const [k, v] of entries) {
            html += `<tr><td class="border border-border px-2 py-1 text-xs font-semibold bg-secondary/30 w-1/3">${k}</td><td class="border border-border px-2 py-1 text-xs">${v}</td></tr>`;
          }
          html += '</table>';
        } else {
          html += renderJsonAsHtml(value, depth + 1);
        }
      } else if (Array.isArray(value)) {
        const tag = depth === 0 ? 'h2' : 'h3';
        html += `<${tag}>${key}</${tag}>`;
        html += renderJsonAsHtml(value, depth + 1);
      }
    }
    return html;
  }
  return String(obj);
}

// Simple markdown renderer (no external deps)
function renderMarkdown(md: string): string {
  // Detect JSON content and render it as structured HTML
  const trimmed = md.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return renderJsonAsHtml(parsed);
    } catch { /* not valid JSON, continue as markdown */ }
  }
  // Also handle markdown-wrapped JSON (```json ... ```)
  const jsonInCode = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (jsonInCode) {
    try {
      const parsed = JSON.parse(jsonInCode[1].trim());
      return renderJsonAsHtml(parsed);
    } catch { /* not valid JSON */ }
  }

  // 1. Extract code blocks first (protect from further processing)
  const codeBlocks: string[] = [];
  let processed = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    codeBlocks.push(`<pre class="bg-secondary/50 rounded-lg p-3 text-xs overflow-x-auto my-2"><code>${code}</code></pre>`);
    return `\x00CODE${codeBlocks.length - 1}\x00`;
  });

  // 2. Extract tables as blocks (process before line-break handling)
  const tableBlocks: string[] = [];
  processed = processed.replace(/((?:^\|.+\|$\n?)+)/gm, (tableBlock) => {
    const rows = tableBlock.trim().split('\n');
    let tableHtml = '';
    let isHeader = true;
    for (const row of rows) {
      const cells = row.split('|').filter(c => c.trim() !== '');
      // Skip separator rows (e.g., |---|---|)
      if (cells.every(c => /^[\s:-]+$/.test(c))) {
        isHeader = false;
        continue;
      }
      const tag = isHeader ? 'th' : 'td';
      const cellClass = isHeader
        ? 'border border-border px-2 py-1 text-xs font-semibold bg-secondary/30'
        : 'border border-border px-2 py-1 text-xs';
      tableHtml += '<tr>' + cells.map(c => `<${tag} class="${cellClass}">${c.trim()}</${tag}>`).join('') + '</tr>';
      if (isHeader) isHeader = false; // first row after separator is data
    }
    tableBlocks.push(`<table class="w-full border-collapse border border-border my-2">${tableHtml}</table>`);
    return `\x00TABLE${tableBlocks.length - 1}\x00`;
  });

  // 3. Process inline markdown
  let html = processed
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap loose <li> in <ul>
  html = html.replace(/((?:<li>.*?<\/li>(?:<br\/>)?)+)/gs, '<ul>$1</ul>');
  html = html.replace(/<ul>([\s\S]*?)<\/ul>/g, (_m, inner) =>
    '<ul>' + inner.replace(/<br\/>/g, '') + '</ul>'
  );

  // 4. Restore tables and code blocks
  html = html.replace(/\x00TABLE(\d+)\x00/g, (_m, idx) => tableBlocks[Number(idx)]);
  html = html.replace(/\x00CODE(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)]);

  return `<p>${html}</p>`;
}
