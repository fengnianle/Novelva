import { useAiStore, SentenceAnalysis } from '../stores/ai-store';
import { useSettingsStore } from '../stores/settings-store';
import { useReaderStore } from '../stores/reader-store';

function buildPrompt(
  template: string,
  currentSentence: string,
  prevSentence?: string,
  nextSentence?: string
): string {
  // Minimal context to reduce tokens — only include prev/next if present
  let context = '';
  if (prevSentence) context += `上文:${prevSentence}\n`;
  context += `句子:${currentSentence}`;
  if (nextSentence) context += `\n下文:${nextSentence}`;

  return template.replace('{context}', context);
}

// Cleanup function for active stream listeners
let activeStreamCleanup: (() => void) | null = null;
let activeStreamId: string | null = null;

// Abort the current analysis stream (call from popover close to save tokens)
export function abortAnalysis(): void {
  activeStreamCleanup?.();
  activeStreamCleanup = null;
  if (activeStreamId) {
    const api = (window as any).electronAPI;
    api?.abortStream(activeStreamId);
    activeStreamId = null;
  }
  const { loading, setLoading } = useAiStore.getState();
  if (loading) setLoading(false);
}

function parseAnalysisResponse(rawResponse: string): SentenceAnalysis {
  let jsonStr = rawResponse.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  const parsed = JSON.parse(jsonStr);
  return {
    language: parsed.language || 'en',
    translation: parsed.translation || '',
    grammar_points: parsed.grammar_points || [],
    key_expressions: parsed.key_expressions || [],
    explanation: parsed.explanation || '',
    words: parsed.words || [],
  };
}

async function cacheAnalysis(
  api: any,
  sentenceHash: string,
  currentSentence: string,
  prevSentence: string | undefined,
  nextSentence: string | undefined,
  analysis: SentenceAnalysis
): Promise<void> {
  const { addToWordCache } = useAiStore.getState();
  try {
    await api.dbRun(
      `INSERT OR REPLACE INTO sentence_cache 
       (sentence_hash, sentence_text, context_prev, context_next, translation, key_expressions, explanation, word_analyses, language, grammar_points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sentenceHash,
        currentSentence,
        prevSentence || null,
        nextSentence || null,
        analysis.translation,
        JSON.stringify(analysis.key_expressions),
        analysis.explanation,
        JSON.stringify(analysis.words),
        analysis.language || 'en',
        JSON.stringify(analysis.grammar_points),
      ]
    );
  } catch (e) {
    console.error('Failed to cache analysis:', e);
  }

  for (const w of analysis.words) {
    addToWordCache(w.word, w);
    try {
      await api.dbRun(
        'INSERT OR IGNORE INTO word_cache (word, meaning, pos) VALUES (?, ?, ?)',
        [w.word.toLowerCase(), w.meaning, w.pos]
      );
    } catch (_) { /* ignore duplicate */ }
  }
}

// Plain function — reads store state imperatively, no React subscriptions.
// This avoids hundreds of sentence components subscribing to settings/ai stores.
export async function analyzeSentence(
  sentenceHash: string,
  currentSentence: string,
  prevSentence?: string,
  nextSentence?: string,
  skipCache = false
): Promise<void> {
  const { setLoading, setCurrentAnalysis, setError, addToWordCache } = useAiStore.getState();
  const settings = useSettingsStore.getState();
  const { apiKey } = settings;
  const systemPrompt = settings.getSystemPrompt();
  const sentencePrompt = settings.getSentencePrompt();
  const { baseUrl, model } = settings.getProviderConfig();

  if (!apiKey) {
    setError('请先在设置中配置 API Key');
    return;
  }

  const api = (window as any).electronAPI;
  if (!api) return;

  // Cleanup previous stream if still active
  abortAnalysis();

  // Check cache first (skip if regenerating)
  if (!skipCache) {
    try {
      const cached = await api.dbQuery(
        'SELECT * FROM sentence_cache WHERE sentence_hash = ?',
        [sentenceHash]
      );
      if (cached && cached.length > 0) {
        const row = cached[0];
        const analysis: SentenceAnalysis = {
          language: row.language || 'en',
          translation: row.translation,
          grammar_points: row.grammar_points ? JSON.parse(row.grammar_points) : [],
          key_expressions: JSON.parse(row.key_expressions),
          explanation: row.explanation,
          words: JSON.parse(row.word_analyses),
        };
        setCurrentAnalysis(analysis);

        // Load words into cache
        for (const w of analysis.words) {
          addToWordCache(w.word, w);
        }
        return;
      }
    } catch (e) {
      console.error('Cache lookup failed:', e);
    }
  }

  // Use streaming for faster perceived speed
  setLoading(true);

  const streamId = `sentence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  activeStreamId = streamId;
  let cleanupFn: (() => void) | null = null;

  try {
    const prompt = buildPrompt(sentencePrompt, currentSentence, prevSentence, nextSentence);

    // Set up stream listeners — extract translation early for perceived speed
    let streamBuffer = '';
    let translationExtracted = false;
    const { setStreamingTranslation } = useAiStore.getState();
    const removeChunkListener = api.onStreamChunk(streamId, (chunk: string) => {
      if (translationExtracted) return;
      streamBuffer += chunk;
      // Try to extract "translation":"..." from partial JSON
      const match = streamBuffer.match(/"translation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (match) {
        translationExtracted = true;
        setStreamingTranslation(match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'));
      }
    });

    const streamDonePromise = new Promise<string>((resolve, reject) => {
      const removeDone = api.onStreamDone(streamId, (full: string) => {
        removeDone();
        resolve(full);
      });
      const removeError = api.onStreamError(streamId, (err: string) => {
        removeError();
        reject(new Error(err));
      });

      cleanupFn = () => {
        removeChunkListener();
        removeDone();
        removeError();
      };
      activeStreamCleanup = cleanupFn;
    });

    // Kick off the stream (don't await the IPC handle — await the done event instead)
    api.callAIStream(prompt, apiKey, systemPrompt, baseUrl, model, streamId).catch(() => {
      // Error is also emitted via stream-error event, handled above
    });

    const rawResponse = await streamDonePromise;

    // Clean up listeners
    removeChunkListener();
    activeStreamCleanup = null;
    activeStreamId = null;
    cleanupFn = null;

    const analysis = parseAnalysisResponse(rawResponse);
    setCurrentAnalysis(analysis);

    // Cache in background, then refresh underlines
    cacheAnalysis(api, sentenceHash, currentSentence, prevSentence, nextSentence, analysis).then(() => {
      useReaderStore.getState().bumpVocabRefresh();
    });
  } catch (err) {
    if (cleanupFn) {
      (cleanupFn as () => void)();
      activeStreamCleanup = null;
    }
    // Silently ignore abort — user intentionally cancelled
    const msg = (err as Error).message || '';
    if (msg.includes('aborted') || msg.includes('Abort')) return;
    setError(`AI 解析失败: ${msg}`);
  }
}

// Hook wrapper for backward compatibility (use sparingly — subscribes to stores)
export function useAiAnalysis() {
  return { analyzeSentence };
}
