import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useVocabulary, VocabularyEntry, VocabMeaning } from '../../hooks/use-vocabulary';
import { useReaderStore } from '../../stores/reader-store';
import { Trash2, BookOpen, Search, ChevronDown, ChevronRight, X, ArrowLeft, ExternalLink } from 'lucide-react';

export const VocabularyList: React.FC = () => {
  const { entries, loading, loadVocabulary, removeWord, removeFromVocabulary } = useVocabulary();
  const [search, setSearch] = useState('');
  const [expandedWord, setExpandedWord] = useState<string | null>(null);
  const [detailWord, setDetailWord] = useState<VocabularyEntry | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useRef(0);

  const viewMode = useReaderStore((s) => s.viewMode);

  // Reload every time the vocabulary tab becomes visible
  useEffect(() => {
    if (viewMode === 'vocabulary') {
      loadVocabulary();
    }
  }, [viewMode, loadVocabulary]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase().trim();
    return entries.filter(
      (e) =>
        e.word.includes(q) ||
        e.meanings.some(
          (m) =>
            m.meaning.toLowerCase().includes(q) ||
            m.sentences.some((s) => s.sentence.toLowerCase().includes(q))
        )
    );
  }, [entries, search]);

  const totalSentences = useMemo(
    () => entries.reduce((sum, e) => sum + e.ids.length, 0),
    [entries]
  );

  const openDetail = useCallback((entry: VocabularyEntry) => {
    if (scrollRef.current) savedScrollTop.current = scrollRef.current.scrollTop;
    setDetailWord(entry);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailWord(null);
    // Restore scroll position after React re-renders the list
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = savedScrollTop.current;
    });
  }, []);

  // Sync detailWord with updated entries (in case data changed while viewing detail)
  useEffect(() => {
    if (detailWord) {
      const updated = entries.find((e) => e.word === detailWord.word);
      if (updated) {
        setDetailWord(updated);
      } else {
        setDetailWord(null); // word was deleted
      }
    }
  }, [entries]);

  // ── Detail View ──
  if (detailWord) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-6 pt-10 pb-4 border-b border-border flex items-center gap-3">
          <button
            onClick={closeDetail}
            className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{detailWord.word}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {detailWord.meanings.length} 个义项 · {detailWord.ids.length} 条例句
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl space-y-6">
            {detailWord.meanings.map((meaning, mIdx) => (
              <div key={mIdx} className="bg-card border border-border rounded-xl p-5">
                <div className="text-base font-semibold">
                  {detailWord.meanings.length > 1 && (
                    <span className="text-xs text-primary font-bold mr-2 bg-primary/10 px-2 py-0.5 rounded-full">
                      义项 {mIdx + 1}
                    </span>
                  )}
                  {meaning.meaning}
                </div>
                <div className="mt-4 space-y-3">
                  {meaning.sentences.map((s) => (
                    <div key={s.id} className="group/sentence bg-secondary/30 rounded-lg p-4 relative">
                      <div className="text-sm leading-relaxed italic">
                        "{s.sentence}"
                      </div>
                      {s.sentence_translation && (
                        <div className="text-sm text-muted-foreground mt-2">
                          {s.sentence_translation}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        {s.source_file ? (
                          <span className="text-xs text-muted-foreground/60">— {s.source_file}</span>
                        ) : <span />}
                        <button
                          onClick={() => removeFromVocabulary(s.id)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/sentence:opacity-100 flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          删除例句
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2 pb-4">
              <span className="text-xs text-muted-foreground">
                添加于 {new Date(detailWord.latestDate).toLocaleDateString()}
              </span>
              <button
                onClick={() => {
                  removeWord(detailWord.word);
                  setDetailWord(null);
                }}
                className="text-xs text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-destructive/10"
              >
                <Trash2 size={12} />
                删除该词汇
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-10 pb-4 border-b border-border">
        <h1 className="text-lg font-semibold">词汇本</h1>
        <p className="text-sm text-muted-foreground mt-1">
          共 {entries.length} 个词汇，{totalSentences} 条例句
        </p>
        {entries.length > 0 && (
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索单词、释义或例句..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="text-center text-muted-foreground py-8">加载中...</div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BookOpen size={48} strokeWidth={1} />
            <p className="mt-4 text-sm">还没有收藏的词汇</p>
            <p className="text-xs mt-1">在阅读中点击单词即可添加</p>
          </div>
        )}

        {!loading && filtered.length === 0 && entries.length > 0 && (
          <div className="text-center text-muted-foreground py-8 text-sm">
            没有找到匹配的词汇
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((entry) => (
              <VocabularyCard
                key={entry.word}
                entry={entry}
                isExpanded={expandedWord === entry.word}
                onToggle={() =>
                  setExpandedWord((prev) => (prev === entry.word ? null : entry.word))
                }
                onRemoveWord={() => removeWord(entry.word)}
                onRemoveSentence={(id) => removeFromVocabulary(id)}
                onOpenDetail={() => openDetail(entry)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface VocabularyCardProps {
  entry: VocabularyEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onRemoveWord: () => void;
  onRemoveSentence: (id: number) => void;
  onOpenDetail: () => void;
}

const VocabularyCard: React.FC<VocabularyCardProps> = ({
  entry,
  isExpanded,
  onToggle,
  onRemoveWord,
  onRemoveSentence,
  onOpenDetail,
}) => {
  const mainMeaning = entry.meanings[0]?.meaning || '';

  return (
    <div className="bg-card border border-border rounded-lg hover:shadow-sm transition-shadow group">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-muted-foreground shrink-0">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="font-semibold text-base">{entry.word}</span>
          <span className="text-sm text-muted-foreground truncate">{mainMeaning}</span>
          {entry.meanings.length > 1 && (
            <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">
              {entry.meanings.length} 个义项
            </span>
          )}
          <span className="text-xs text-muted-foreground shrink-0">
            {entry.ids.length} 句
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail();
            }}
            className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100 p-1 rounded"
            title="查看详情"
          >
            <ExternalLink size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveWord();
            }}
            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 p-1 rounded"
            title="删除该词汇"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-3 border-t border-border pt-3 space-y-3">
          {entry.meanings.map((meaning, mIdx) => (
            <MeaningSection
              key={mIdx}
              meaning={meaning}
              showLabel={entry.meanings.length > 1}
              index={mIdx}
              onRemoveSentence={onRemoveSentence}
            />
          ))}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              添加于 {new Date(entry.latestDate).toLocaleDateString()}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail();
              }}
              className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              查看完整详情
              <ExternalLink size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface MeaningSectionProps {
  meaning: VocabMeaning;
  showLabel: boolean;
  index: number;
  onRemoveSentence: (id: number) => void;
}

const MeaningSection: React.FC<MeaningSectionProps> = ({
  meaning,
  showLabel,
  index,
  onRemoveSentence,
}) => {
  return (
    <div>
      <div className="text-sm font-medium">
        {showLabel && (
          <span className="text-xs text-primary mr-1.5">义项{index + 1}.</span>
        )}
        {meaning.meaning}
      </div>
      <div className="mt-1.5 space-y-1.5 ml-3">
        {meaning.sentences.map((s) => (
          <div key={s.id} className="group/sentence flex items-start gap-1.5">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-muted-foreground italic">
                "{s.sentence}"
              </div>
              {s.sentence_translation && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {s.sentence_translation}
                </div>
              )}
              {s.source_file && (
                <div className="text-xs text-muted-foreground/60 mt-0.5">
                  — {s.source_file}
                </div>
              )}
            </div>
            <button
              onClick={() => onRemoveSentence(s.id)}
              className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/sentence:opacity-100 shrink-0 mt-0.5"
              title="删除此例句"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
