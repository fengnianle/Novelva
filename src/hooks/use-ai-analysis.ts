import { useAiStore, SentenceAnalysis } from '../stores/ai-store';
import { useSettingsStore } from '../stores/settings-store';

function buildPrompt(
  template: string,
  currentSentence: string,
  prevSentence?: string,
  nextSentence?: string
): string {
  const context = `${prevSentence ? `【上文】${prevSentence}` : '【上文】无'}
【当前句】${currentSentence}
${nextSentence ? `【下文】${nextSentence}` : '【下文】无'}`;

  return template.replace('{context}', context);
}

// Plain function — reads store state imperatively, no React subscriptions.
// This avoids hundreds of sentence components subscribing to settings/ai stores.
export async function analyzeSentence(
  sentenceHash: string,
  currentSentence: string,
  prevSentence?: string,
  nextSentence?: string
): Promise<void> {
  const { setLoading, setCurrentAnalysis, setError, addToWordCache } = useAiStore.getState();
  const { apiKey, systemPrompt, sentencePrompt } = useSettingsStore.getState();

  if (!apiKey) {
    setError('请先在设置中配置 DeepSeek API Key');
    return;
  }

  const api = (window as any).electronAPI;
  if (!api) return;

  // Check cache first
  try {
    const cached = await api.dbQuery(
      'SELECT * FROM sentence_cache WHERE sentence_hash = ?',
      [sentenceHash]
    );
    if (cached && cached.length > 0) {
      const row = cached[0];
      const analysis: SentenceAnalysis = {
        translation: row.translation,
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

  // Call AI
  setLoading(true);
  try {
    const prompt = buildPrompt(sentencePrompt, currentSentence, prevSentence, nextSentence);
    const rawResponse = await api.callAI(prompt, apiKey, systemPrompt);

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = rawResponse.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const analysis: SentenceAnalysis = JSON.parse(jsonStr);
    setCurrentAnalysis(analysis);

    // Cache the result
    try {
      await api.dbRun(
        `INSERT OR REPLACE INTO sentence_cache 
         (sentence_hash, sentence_text, context_prev, context_next, translation, key_expressions, explanation, word_analyses)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sentenceHash,
          currentSentence,
          prevSentence || null,
          nextSentence || null,
          analysis.translation,
          JSON.stringify(analysis.key_expressions),
          analysis.explanation,
          JSON.stringify(analysis.words),
        ]
      );
    } catch (e) {
      console.error('Failed to cache analysis:', e);
    }

    // Cache words
    for (const w of analysis.words) {
      addToWordCache(w.word, w);
      try {
        await api.dbRun(
          'INSERT OR IGNORE INTO word_cache (word, meaning, pos) VALUES (?, ?, ?)',
          [w.word.toLowerCase(), w.meaning, w.pos]
        );
      } catch (e) {
        // ignore duplicate
      }
    }
  } catch (err) {
    setError(`AI 解析失败: ${(err as Error).message}`);
  }
}

// Hook wrapper for backward compatibility (use sparingly — subscribes to stores)
export function useAiAnalysis() {
  return { analyzeSentence };
}
