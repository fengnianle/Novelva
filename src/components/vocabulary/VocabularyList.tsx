import React, { useEffect, useState, useMemo } from 'react';
import { useVocabulary, VocabularyEntry, VocabMeaning } from '../../hooks/use-vocabulary';
import { Trash2, BookOpen, Search, ChevronDown, ChevronRight, X } from 'lucide-react';

export const VocabularyList: React.FC = () => {
  const { entries, loading, loadVocabulary, removeWord, removeFromVocabulary } = useVocabulary();
  const [search, setSearch] = useState('');
  const [expandedWord, setExpandedWord] = useState<string | null>(null);

  useEffect(() => {
    loadVocabulary();
  }, [loadVocabulary]);

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

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-border">
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

      <div className="flex-1 overflow-y-auto px-6 py-4">
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
}

const VocabularyCard: React.FC<VocabularyCardProps> = ({
  entry,
  isExpanded,
  onToggle,
  onRemoveWord,
  onRemoveSentence,
}) => {
  const mainMeaning = entry.meanings[0]?.meaning || '';

  return (
    <div className="bg-card border border-border rounded-lg hover:shadow-sm transition-shadow">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-muted-foreground">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="font-semibold text-base">{entry.word}</span>
          <span className="text-sm text-muted-foreground truncate">{mainMeaning}</span>
          {entry.meanings.length > 1 && (
            <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              {entry.meanings.length} 个义项
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {entry.ids.length} 句
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveWord();
          }}
          className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 ml-2 shrink-0"
          title="删除该词汇"
        >
          <Trash2 size={14} />
        </button>
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
          <div className="text-xs text-muted-foreground pt-1">
            添加于 {new Date(entry.latestDate).toLocaleDateString()}
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
