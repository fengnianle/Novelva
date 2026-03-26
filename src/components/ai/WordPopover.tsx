import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAiStore, WordAnalysis } from '../../stores/ai-store';
import { useVocabulary } from '../../hooks/use-vocabulary';
import { useReaderStore } from '../../stores/reader-store';
import { useSettingsStore } from '../../stores/settings-store';
import { X, BookPlus, Loader2 } from 'lucide-react';

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
  const { addToVocabulary } = useVocabulary();
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

    // Not cached — fetch via AI
    const fetchWord = async () => {
      const api = (window as any).electronAPI;
      if (!api || !apiKey) {
        setWordError('请先配置 API Key');
        return;
      }

      setWordLoading(true);
      try {
        const prompt = `请解释以下单词在句子中的含义（自动识别语言）：
单词: "${word}"
句子: "${sentence}"

请严格按以下 JSON 格式返回（不要添加任何其他内容，不要使用 markdown 代码块）：
{"word": "${word}", "meaning": "在此语境下的中文含义", "pos": "词性"}`;

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

  // Check if already in vocabulary
  useEffect(() => {
    const checkExists = async () => {
      const api = (window as any).electronAPI;
      if (!api) return;
      try {
        const rows = await api.dbQuery(
          'SELECT id FROM vocabulary WHERE LOWER(word) = LOWER(?) AND sentence = ?',
          [word, sentence]
        );
        if (rows && rows.length > 0) setAdded(true);
      } catch (_) { /* ignore */ }
    };
    checkExists();
  }, [word, sentence]);

  const handleAdd = useCallback(async () => {
    if (!wordData || added) return;
    let saveWord = word;
    let savePos = wordData.pos || '';
    if (currentAnalysis?.language === 'de') {
      const articleMatch = word.match(/^(der|die|das)\s+/i);
      if (articleMatch) {
        const article = articleMatch[1].toLowerCase();
        saveWord = word.replace(/^(der|die|das|ein|eine|einen|einem|einer|eines)\s+/i, '');
        if (savePos && !savePos.toLowerCase().includes(article)) {
          savePos = `${article}, ${savePos}`;
        } else if (!savePos) {
          savePos = article;
        }
      } else {
        saveWord = word.replace(/^(ein|eine|einen|einem|einer|eines)\s+/i, '');
      }
    }
    await addToVocabulary(
      saveWord,
      wordData.meaning,
      sentence,
      currentAnalysis?.translation,
      currentBook?.fileName,
      currentAnalysis?.language,
      savePos
    );
    setAdded(true);
  }, [word, wordData, sentence, added, addToVocabulary, currentAnalysis, currentBook]);

  return (
    <div
      ref={popoverRef}
      className="fixed z-[60] w-[260px] bg-popover text-popover-foreground border border-border rounded-lg shadow-lg animate-in fade-in-0 slide-in-from-top-1 duration-150"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div>
          <span className="font-medium text-sm">{word}</span>
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
            <div className="mt-2 flex justify-end">
              {!added ? (
                <button
                  onClick={handleAdd}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <BookPlus size={12} />
                  加入词汇本
                </button>
              ) : (
                <span className="text-xs text-green-500">已收藏 ✓</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
