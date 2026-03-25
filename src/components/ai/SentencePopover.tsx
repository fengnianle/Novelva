import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAiStore } from '../../stores/ai-store';
import { useVocabulary } from '../../hooks/use-vocabulary';
import { useReaderStore } from '../../stores/reader-store';
import { SentenceData } from '../../lib/sentence-splitter';
import { analyzeSentence } from '../../hooks/use-ai-analysis';
import { X, Loader2, BookPlus, Check, RotateCw } from 'lucide-react';

interface SentencePopoverProps {
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  sentence: SentenceData;
  prevSentence?: string;
  nextSentence?: string;
  onClose: () => void;
}

export const SentencePopover: React.FC<SentencePopoverProps> = ({
  anchorRef,
  sentence,
  prevSentence,
  nextSentence,
  onClose,
}) => {
  const { loading, currentAnalysis, error } = useAiStore();
  const { addToVocabulary } = useVocabulary();
  const { currentBook } = useReaderStore();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set());

  const handleRegenerate = useCallback(() => {
    analyzeSentence(sentence.id, sentence.text, prevSentence, nextSentence, true);
  }, [sentence, prevSentence, nextSentence]);

  // Check which words are already in vocabulary for this sentence
  useEffect(() => {
    if (!currentAnalysis?.words.length) return;
    const checkExisting = async () => {
      const api = (window as any).electronAPI;
      if (!api) return;
      const existing = new Set<string>();
      for (const w of currentAnalysis.words) {
        try {
          const rows = await api.dbQuery(
            'SELECT id FROM vocabulary WHERE word = ? AND sentence = ?',
            [w.word.toLowerCase(), sentence.text]
          );
          if (rows && rows.length > 0) existing.add(w.word);
        } catch (_) { /* ignore */ }
      }
      if (existing.size > 0) setAddedWords(existing);
    };
    checkExisting();
  }, [currentAnalysis, sentence.text]);

  // Position popover: prefer below, flip above if overflows bottom
  useEffect(() => {
    const updatePosition = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const popoverWidth = 380;
      const popoverHeight = popoverRef.current?.offsetHeight || 300;

      let left = rect.left + rect.width / 2 - popoverWidth / 2;
      if (left < 10) left = 10;
      if (left + popoverWidth > window.innerWidth - 10) {
        left = window.innerWidth - popoverWidth - 10;
      }

      let top = rect.bottom + 8;
      if (top + popoverHeight > window.innerHeight - 10) {
        top = rect.top - popoverHeight - 8;
        if (top < 10) top = 10;
      }

      setPosition({ top, left });
    };
    updatePosition();
    // Re-position after content loads
    const timer = setTimeout(updatePosition, 100);
    return () => clearTimeout(timer);
  }, [anchorRef, loading, currentAnalysis]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, anchorRef]);

  const handleAddWord = async (word: string, meaning: string) => {
    await addToVocabulary(
      word,
      meaning,
      sentence.text,
      currentAnalysis?.translation,
      currentBook?.fileName
    );
    setAddedWords((prev) => new Set([...prev, word]));
  };

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[380px] bg-popover text-popover-foreground border border-border rounded-xl shadow-xl animate-in fade-in-0 slide-in-from-top-2 duration-200"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">AI 解析</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRegenerate}
            disabled={loading}
            className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 p-0.5 rounded"
            title="重新生成"
          >
            <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 max-h-[400px] overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">正在解析...</span>
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive py-2">{error}</div>
        )}

        {!loading && !error && currentAnalysis && (
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">翻译</div>
              <div className="text-sm">{currentAnalysis.translation}</div>
            </div>

            {currentAnalysis.key_expressions.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  关键表达
                </div>
                <div className="space-y-1.5">
                  {currentAnalysis.key_expressions.map((expr, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium text-primary">{expr.expression}</span>
                      <span className="text-muted-foreground"> — {expr.meaning}</span>
                      {expr.usage && (
                        <div className="text-xs text-muted-foreground mt-0.5 ml-2">
                          {expr.usage}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">说明</div>
              <div className="text-sm text-muted-foreground">
                {currentAnalysis.explanation}
              </div>
            </div>

            {currentAnalysis.words.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  词汇
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {currentAnalysis.words.map((w, idx) => (
                    <span
                      key={idx}
                      className="group inline-flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded-md"
                    >
                      <span className="font-medium">{w.word}</span>
                      <span className="text-muted-foreground">
                        ({w.pos}) {w.meaning}
                      </span>
                      {!addedWords.has(w.word) && (
                        <button
                          onClick={() => handleAddWord(w.word, w.meaning)}
                          className="ml-0.5 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                          title="加入词汇本"
                        >
                          <BookPlus size={12} />
                        </button>
                      )}
                      {addedWords.has(w.word) && (
                        <span className="ml-0.5 text-xs text-green-500">✓</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
