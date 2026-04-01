import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAiStore, WordAnalysis } from '../../stores/ai-store';
import { useVocabulary } from '../../hooks/use-vocabulary';
import { useReaderStore } from '../../stores/reader-store';
import { useSettingsStore } from '../../stores/settings-store';
import { X, BookPlus, BookMinus, Loader2, ExternalLink } from 'lucide-react';

interface WordPopoverProps {
  word: string;
  sentence: string;
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  onClose: () => void;
}

export const WordPopover: React.FC<WordPopoverProps> = ({
  word,
  sentence,
  anchorRef,
  onClose,
}) => {
  const { getFromWordCache, addToWordCache, currentAnalysis } = useAiStore();
  const { addToVocabulary, removeFromVocabulary } = useVocabulary();
  const { currentBook } = useReaderStore();
  const { apiKey, getProviderConfig } = useSettingsStore();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [added, setAdded] = useState(false);
  const [wordLoading, setWordLoading] = useState(false);
  const [wordData, setWordData] = useState<WordAnalysis | null>(null);
  const [wordError, setWordError] = useState<string | null>(null);

  // Position the popover: prefer below, flip above if overflows
  useEffect(() => {
    const updatePosition = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const popoverWidth = 260;
      const popoverHeight = popoverRef.current?.offsetHeight || 120;

      let left = rect.left + rect.width / 2 - popoverWidth / 2;
      if (left < 10) left = 10;
      if (left + popoverWidth > window.innerWidth - 10) {
        left = window.innerWidth - popoverWidth - 10;
      }

      let top = rect.bottom + 6;
      if (top + popoverHeight > window.innerHeight - 10) {
        top = rect.top - popoverHeight - 6;
        if (top < 10) top = 10;
      }

      setPosition({ top, left });
    };
    updatePosition();
    const timer = setTimeout(updatePosition, 100);
    return () => clearTimeout(timer);
  }, [anchorRef, wordData, wordLoading]);

  // Load word data: from cache, from AI analysis words, or via AI call
  useEffect(() => {
    const cached = getFromWordCache(word);
    if (cached) {
      setWordData(cached);
      return;
    }

    // Check if the word is in the current analysis words list
    const fromAnalysis = currentAnalysis?.words.find(
      (w) => w.word.toLowerCase() === word.toLowerCase()
    );
    if (fromAnalysis) {
      setWordData(fromAnalysis);
      addToWordCache(word, fromAnalysis);
      return;
    }

    // Try local DB before calling AI
    const fetchWord = async () => {
      const api = (window as any).electronAPI;
      if (!api) return;

      // 1. Check word_cache DB table
      try {
        const wcRows = await api.dbQuery(
          'SELECT word, meaning, pos FROM word_cache WHERE word = ?',
          [word.toLowerCase()]
        );
        if (wcRows && wcRows.length > 0) {
          const result: WordAnalysis = { word: wcRows[0].word, meaning: wcRows[0].meaning, pos: wcRows[0].pos || '' };
          setWordData(result);
          addToWordCache(word, result);
          return;
        }
      } catch (_) { /* ignore */ }

      // 2. Check vocabulary DB table
      try {
        const vRows = await api.dbQuery(
          'SELECT word, meaning, pos FROM vocabulary WHERE LOWER(word) = LOWER(?) LIMIT 1',
          [word]
        );
        if (vRows && vRows.length > 0) {
          const result: WordAnalysis = { word: vRows[0].word, meaning: vRows[0].meaning, pos: vRows[0].pos || '' };
          setWordData(result);
          addToWordCache(word, result);
          return;
        }
      } catch (_) { /* ignore */ }

      // 3. Not found locally — fetch via AI
      if (!apiKey) {
        setWordError('请先配置 API Key');
        return;
      }

      setWordLoading(true);
      try {
        const prompt = `请解释以下单词在句子中的含义（自动识别语言）：
单词: "${word}"
句子: "${sentence}"

要求：
- word必须是词典原形/词元形式（不是变体），如英语 went→go，德语 ging→gehen
- 英语词组动词(phrasal verb)请返回完整词组作为word，如 look up, give in
- 德语可分动词请返回不定式原形作为word，如 fängt...an → anfangen
- 德语名词请带冠词(der/die/das)
- surface为句中实际形态

请严格按以下 JSON 格式返回（不要添加任何其他内容，不要使用 markdown 代码块）：
{"word":"原形","surface":"句中形态","meaning":"在此语境下的中文含义","pos":"词性"}`;

        const { baseUrl, model } = getProviderConfig();
        const rawResponse = await api.callAI(prompt, apiKey, undefined, baseUrl, model);
        let jsonStr = rawResponse.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }
        const result: WordAnalysis = JSON.parse(jsonStr);
        setWordData(result);
        addToWordCache(word, result);

        try {
          await api.dbRun(
            'INSERT OR IGNORE INTO word_cache (word, meaning, pos) VALUES (?, ?, ?)',
            [word.toLowerCase(), result.meaning, result.pos]
          );
        } catch (_) { /* ignore */ }
      } catch (err) {
        setWordError('查询失败');
        console.error('Word lookup error:', err);
      } finally {
        setWordLoading(false);
      }
    };

    fetchWord();
  }, [word, sentence, apiKey, getFromWordCache, addToWordCache, currentAnalysis]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Check if already in vocabulary (by surface form or lemma)
  const [existingId, setExistingId] = useState<number | null>(null);
  useEffect(() => {
    const checkExists = async () => {
      const api = (window as any).electronAPI;
      if (!api) return;
      try {
        // Check both the clicked word and the AI-returned lemma
        const wordsToCheck = [word];
        if (wordData?.word && wordData.word.toLowerCase() !== word.toLowerCase()) {
          wordsToCheck.push(wordData.word);
        }
        const placeholders = wordsToCheck.map(() => 'LOWER(word) = LOWER(?)').join(' OR ');
        const rows = await api.dbQuery(
          `SELECT id FROM vocabulary WHERE (${placeholders}) AND sentence = ?`,
          [...wordsToCheck, sentence]
        );
        if (rows && rows.length > 0) {
          setAdded(true);
          setExistingId(rows[0].id);
        }
      } catch (_) { /* ignore */ }
    };
    checkExists();
  }, [word, wordData, sentence]);

  const handleAdd = useCallback(async () => {
    if (!wordData || added) return;
    const _api = (window as any).electronAPI;

    // Look up the actual translation & language for THIS sentence from sentence_cache,
    // not from currentAnalysis (which may belong to a different sentence).
    let sentenceTranslation: string | undefined = undefined;
    let sentenceLanguage: string | undefined = undefined;
    try {
      if (_api) {
        const cached = await _api.dbQuery(
          'SELECT translation, language FROM sentence_cache WHERE sentence_text = ? LIMIT 1',
          [sentence]
        );
        if (cached && cached.length > 0) {
          sentenceTranslation = cached[0].translation || undefined;
          sentenceLanguage = cached[0].language || undefined;
        }
      }
    } catch (_) { /* ignore */ }

    // Use the AI-returned lemma/base form (wordData.word), not the clicked surface form
    let saveWord = wordData.word || word;
    let savePos = wordData.pos || '';
    // For German nouns with articles: strip article from word, preserve in pos
    if (sentenceLanguage === 'de' || /^(der|die|das)\s+/i.test(saveWord)) {
      const articleMatch = saveWord.match(/^(der|die|das)\s+/i);
      if (articleMatch) {
        const article = articleMatch[1].toLowerCase();
        saveWord = saveWord.replace(/^(der|die|das)\s+/i, '');
        if (savePos && !savePos.toLowerCase().includes(article)) {
          savePos = `${article}, ${savePos}`;
        } else if (!savePos) {
          savePos = article;
        }
      }
    }
    await addToVocabulary(
      saveWord,
      wordData.meaning,
      sentence,
      sentenceTranslation,
      currentBook?.fileName,
      sentenceLanguage,
      savePos
    );
    setAdded(true);
    // Re-query the id so we can uncollect later
    try {
      if (_api) {
        const rows = await _api.dbQuery(
          'SELECT id FROM vocabulary WHERE LOWER(word) = LOWER(?) AND sentence = ?',
          [saveWord, sentence]
        );
        if (rows && rows.length > 0) setExistingId(rows[0].id);
      }
    } catch (_) { /* ignore */ }
    useReaderStore.getState().bumpVocabRefresh();
  }, [word, wordData, sentence, added, addToVocabulary, currentBook]);

  const handleRemove = useCallback(async () => {
    if (!added || existingId == null) return;
    await removeFromVocabulary(existingId);
    setAdded(false);
    setExistingId(null);
  }, [added, existingId, removeFromVocabulary]);

  return (
    <div
      ref={popoverRef}
      className="fixed z-[60] w-[260px] bg-popover text-popover-foreground border border-border rounded-lg shadow-lg animate-in fade-in-0 slide-in-from-top-1 duration-150"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="min-w-0 flex-1 mr-2">
          <span className="font-medium text-sm">{wordData?.word && wordData.word.toLowerCase() !== word.toLowerCase() ? wordData.word : word}</span>
          {wordData?.surface && wordData.word && wordData.word.toLowerCase() !== word.toLowerCase() && (
            <span className="text-xs text-muted-foreground/60 ml-1">[{word}]</span>
          )}
          {wordData?.pos && (
            <span className="text-xs text-muted-foreground ml-1.5">{wordData.pos}</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      <div className="px-3 py-2">
        {wordLoading && (
          <div className="flex items-center gap-2 py-2 text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">正在查询...</span>
          </div>
        )}
        {wordError && <div className="text-xs text-destructive py-1">{wordError}</div>}
        {wordData && (
          <>
            <div className="text-sm">{wordData.meaning}</div>
            <div className="mt-2 flex justify-end gap-3">
              {!added ? (
                <button
                  onClick={handleAdd}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <BookPlus size={12} />
                  加入词汇本
                </button>
              ) : (
                <>
                  <button
                    onClick={handleRemove}
                    className="inline-flex items-center gap-1 text-xs text-green-500 hover:text-red-500 transition-colors"
                  >
                    <BookMinus size={12} />
                    已收藏 ✓
                  </button>
                  <button
                    onClick={() => { onClose(); useReaderStore.getState().openWordDetailFromReader(wordData?.word || word); }}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink size={12} />
                    查看详情
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
