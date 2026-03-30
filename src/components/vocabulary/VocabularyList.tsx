import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useVocabulary, VocabularyEntry, VocabMeaning } from '../../hooks/use-vocabulary';
import { useReaderStore } from '../../stores/reader-store';
import { Trash2, BookOpen, Search, ChevronDown, ChevronRight, X, ArrowLeft, ExternalLink, Filter, Award, Clock } from 'lucide-react';
import { DictionaryDetail } from './DictionaryDetail';
import { VocabAIAnalysis } from './VocabAIAnalysis';

// Extract German article (der/die/das) from POS string if present
function extractGermanArticle(pos: string): string | null {
  if (!pos) return null;
  const match = pos.match(/\b(der|die|das)\b/i);
  return match ? match[1].toLowerCase() : null;
}

// German gender badge colors
const GENDER_COLORS: Record<string, string> = {
  der: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  die: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  das: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

// Highlight a word within a sentence (case-insensitive)
function highlightWord(sentence: string, word: string): React.ReactNode {
  if (!word || !sentence) return sentence;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = sentence.split(regex);
  if (parts.length <= 1) return sentence;
  const lower = word.toLowerCase();
  return parts.map((part, i) =>
    part.toLowerCase() === lower
      ? <mark key={i} className="bg-primary/20 text-primary rounded-sm px-0.5">{part}</mark>
      : part
  );
}

const LANG_LABELS: Record<string, string> = {
  en: 'English', ja: '日本語', de: 'Deutsch', fr: 'Français',
  es: 'Español', ko: '한국어', ru: 'Русский', it: 'Italiano', pt: 'Português',
};

const PAGE_SIZE = 40;

export const VocabularyList: React.FC = () => {
  const { entries, loading, loadVocabulary, removeWord, removeFromVocabulary } = useVocabulary();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterLang, setFilterLang] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [expandedWord, setExpandedWord] = useState<string | null>(null);
  const [detailWord, setDetailWord] = useState<VocabularyEntry | null>(null);
  const [reviewStats, setReviewStats] = useState<{ mastered: number; consecutive_correct: number; last_review_date: string | null; repetitions: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useRef(0);
  const detailWordRef = useRef<string | null>(null);

  const viewMode = useReaderStore((s) => s.viewMode);
  const reviewDetailWord = useReaderStore((s) => s.reviewDetailWord);
  const returnToReview = useReaderStore((s) => s.returnToReview);
  const readerDetailWord = useReaderStore((s) => s.readerDetailWord);
  const returnToReader = useReaderStore((s) => s.returnToReader);

  // Auto-open detail when navigating from review mode or reader mode
  useEffect(() => {
    const targetWord = reviewDetailWord || readerDetailWord;
    if (viewMode === 'vocabulary' && targetWord && entries.length > 0) {
      const entry = entries.find((e) => e.word.toLowerCase() === targetWord.toLowerCase());
      if (entry) {
        setDetailWord(entry);
        detailWordRef.current = entry.word;
      }
    }
  }, [viewMode, reviewDetailWord, readerDetailWord, entries]);

  // Debounce search to avoid re-filtering on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Reload every time the vocabulary tab becomes visible
  useEffect(() => {
    if (viewMode === 'vocabulary') {
      loadVocabulary();
    }
  }, [viewMode, loadVocabulary]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearch, filterLang, filterSource]);

  // Compute available languages and source files from entries
  const { languages, sourceFiles } = useMemo(() => {
    const langSet = new Set<string>();
    const sourceSet = new Set<string>();
    for (const e of entries) {
      langSet.add(e.language || 'en');
      for (const m of e.meanings) {
        for (const s of m.sentences) {
          if (s.source_file) sourceSet.add(s.source_file);
        }
      }
    }
    return {
      languages: Array.from(langSet).sort(),
      sourceFiles: Array.from(sourceSet).sort(),
    };
  }, [entries]);

  const filtered = useMemo(() => {
    let result = entries;

    // Apply language filter
    if (filterLang !== 'all') {
      result = result.filter((e) => (e.language || 'en') === filterLang);
    }

    // Apply source file filter
    if (filterSource !== 'all') {
      result = result.filter((e) =>
        e.meanings.some((m) => m.sentences.some((s) => s.source_file === filterSource))
      );
    }

    // Apply search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.word.includes(q) ||
          e.meanings.some(
            (m) =>
              m.meaning.toLowerCase().includes(q) ||
              m.sentences.some((s) => s.sentence.toLowerCase().includes(q))
          )
      );
    }

    return result;
  }, [entries, debouncedSearch, filterLang, filterSource]);

  // Only render a window of items
  const visibleItems = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const totalSentences = useMemo(
    () => entries.reduce((sum, e) => sum + e.ids.length, 0),
    [entries]
  );

  // Load more items when scrolling near bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length));
    }
  }, [filtered.length]);

  const openDetail = useCallback((entry: VocabularyEntry) => {
    if (scrollRef.current) savedScrollTop.current = scrollRef.current.scrollTop;
    detailWordRef.current = entry.word;
    setDetailWord(entry);
  }, []);

  const closeDetail = useCallback(() => {
    if (reviewDetailWord) {
      returnToReview();
    } else if (readerDetailWord) {
      returnToReader();
    }
    detailWordRef.current = null;
    setDetailWord(null);
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = savedScrollTop.current;
    });
  }, [reviewDetailWord, returnToReview, readerDetailWord, returnToReader]);

  // Sync detailWord with updated entries only when word key matches
  useEffect(() => {
    if (detailWordRef.current) {
      const updated = entries.find((e) => e.word === detailWordRef.current);
      if (updated) {
        setDetailWord(updated);
      } else {
        detailWordRef.current = null;
        setDetailWord(null);
      }
    }
  }, [entries]);

  // Load review stats when detail word changes
  useEffect(() => {
    if (!detailWord) { setReviewStats(null); return; }
    const api = (window as any).electronAPI;
    if (!api) return;
    api.dbQuery(
      'SELECT mastered, consecutive_correct, last_review_date, repetitions FROM review_schedule WHERE word = ?',
      [detailWord.word.toLowerCase()]
    ).then((rows: any[]) => {
      if (rows && rows.length > 0) {
        setReviewStats({
          mastered: rows[0].mastered || 0,
          consecutive_correct: rows[0].consecutive_correct || 0,
          last_review_date: rows[0].last_review_date || null,
          repetitions: rows[0].repetitions || 0,
        });
      } else {
        setReviewStats(null);
      }
    }).catch(() => setReviewStats(null));
  }, [detailWord?.word]);

  // Toggle mastery for the detail word
  const toggleMastery = useCallback(async () => {
    if (!detailWord) return;
    const api = (window as any).electronAPI;
    if (!api) return;
    const wordKey = detailWord.word.toLowerCase();
    const newMastered = reviewStats?.mastered ? 0 : 1;
    // Ensure review_schedule entry exists
    await api.dbRun('INSERT OR IGNORE INTO review_schedule (word) VALUES (?)', [wordKey]);
    await api.dbRun(
      'UPDATE review_schedule SET mastered = ?, consecutive_correct = ? WHERE word = ?',
      [newMastered, newMastered ? (reviewStats?.consecutive_correct || 0) : 0, wordKey]
    );
    setReviewStats((prev) => prev ? { ...prev, mastered: newMastered, consecutive_correct: newMastered ? prev.consecutive_correct : 0 } : null);
  }, [detailWord, reviewStats]);

  // Stable callbacks for VocabularyCard to make React.memo effective
  const handleToggle = useCallback((word: string) => {
    setExpandedWord((prev) => (prev === word ? null : word));
  }, []);

  const handleRemoveWord = useCallback((word: string) => {
    removeWord(word);
  }, [removeWord]);

  const handleRemoveSentence = useCallback((id: number) => {
    removeFromVocabulary(id);
  }, [removeFromVocabulary]);

  // ── Detail View ──
  if (detailWord) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-6 pt-10 pb-4 border-b border-border flex items-center gap-3">
          <button
            onClick={closeDetail}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors shrink-0 text-muted-foreground hover:text-foreground"
            title={reviewDetailWord ? '返回复习' : readerDetailWord ? '返回阅读' : '返回列表'}
          >
            <ArrowLeft size={16} />
            {reviewDetailWord && <span className="text-xs">返回复习</span>}
            {readerDetailWord && !reviewDetailWord && <span className="text-xs">返回阅读</span>}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* German gender badge (der/die/das) — shown prominently */}
              {detailWord.language === 'de' && (() => {
                const article = extractGermanArticle(detailWord.pos);
                return article ? (
                  <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${GENDER_COLORS[article] || 'bg-secondary text-muted-foreground'}`}>
                    {article}
                  </span>
                ) : null;
              })()}
              <h1 className="text-xl font-bold">{detailWord.word}</h1>
              {detailWord.pos && (
                <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {detailWord.pos}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {detailWord.meanings.length} 个义项 · {detailWord.ids.length} 条例句
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl space-y-6">
            {/* Dictionary API detail */}
            <div className="bg-card border border-border rounded-xl p-5">
              <DictionaryDetail word={detailWord.word} language={detailWord.language || 'en'} />
            </div>

            {/* AI Vocabulary Analysis */}
            <div className="bg-card border border-border rounded-xl p-5">
              <VocabAIAnalysis entry={detailWord} />
            </div>

            {/* Review Stats / Mastery */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Award size={15} className={reviewStats?.mastered ? 'text-amber-500' : 'text-muted-foreground'} />
                  背诵情况
                </div>
                <button
                  onClick={toggleMastery}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                    reviewStats?.mastered
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                      : 'bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  {reviewStats?.mastered ? '已掌握 ✓ （点击取消）' : '标记为已掌握'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-secondary/40 rounded-lg p-3">
                  <div className="text-lg font-bold tabular-nums">{reviewStats?.consecutive_correct ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">连续记对</div>
                </div>
                <div className="bg-secondary/40 rounded-lg p-3">
                  <div className="text-lg font-bold tabular-nums">{reviewStats?.repetitions ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">复习次数</div>
                </div>
                <div className="bg-secondary/40 rounded-lg p-3">
                  <div className="text-xs font-medium tabular-nums flex items-center justify-center gap-1 h-[28px]">
                    {reviewStats?.last_review_date ? (
                      <><Clock size={11} className="text-muted-foreground" />{new Date(reviewStats.last_review_date).toLocaleDateString()}</>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">上次复习</div>
                </div>
              </div>
              {!reviewStats?.mastered && (reviewStats?.consecutive_correct ?? 0) > 0 && (
                <div className="mt-2 text-[10px] text-muted-foreground text-center">
                  再连续记对 {5 - (reviewStats?.consecutive_correct ?? 0)} 次将自动标记为已掌握
                </div>
              )}
            </div>

            {detailWord.meanings.map((meaning, mIdx) => (
              <div key={mIdx} className="bg-card border border-border rounded-xl p-5">
                <div className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  {detailWord.meanings.length > 1 && (
                    <span className="text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                      义项 {mIdx + 1}
                    </span>
                  )}
                  {meaning.pos && (
                    <span className="text-xs font-medium bg-secondary text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
                      {meaning.pos}
                    </span>
                  )}
                  <span>{meaning.meaning}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {meaning.sentences.map((s) => (
                    <div key={s.id} className="group/sentence bg-secondary/30 rounded-lg p-4 relative">
                      <div className="text-sm leading-relaxed italic">
                        "{highlightWord(s.sentence, detailWord.word)}"
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
          <>
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
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Filter size={12} className="text-muted-foreground shrink-0" />
              <select
                value={filterLang}
                onChange={(e) => setFilterLang(e.target.value)}
                className="text-xs bg-secondary/50 border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="all">全部语言</option>
                {languages.map((l) => (
                  <option key={l} value={l}>{LANG_LABELS[l] || l.toUpperCase()}</option>
                ))}
              </select>
              {sourceFiles.length > 0 && (
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className="text-xs bg-secondary/50 border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50 max-w-[200px] truncate"
                >
                  <option value="all">全部来源</option>
                  {sourceFiles.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              )}
              {(filterLang !== 'all' || filterSource !== 'all') && (
                <button
                  onClick={() => { setFilterLang('all'); setFilterSource('all'); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  清除筛选
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-6 py-4">
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

        {!loading && visibleItems.length > 0 && (
          <div className="space-y-2">
            {visibleItems.map((entry) => (
              <VocabularyCard
                key={entry.word}
                entry={entry}
                isExpanded={expandedWord === entry.word}
                onToggle={handleToggle}
                onRemoveWord={handleRemoveWord}
                onRemoveSentence={handleRemoveSentence}
                onOpenDetail={openDetail}
              />
            ))}
            {visibleCount < filtered.length && (
              <div className="text-center text-xs text-muted-foreground py-4">
                已显示 {visibleCount} / {filtered.length} 个词汇，下滑加载更多
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface VocabularyCardProps {
  entry: VocabularyEntry;
  isExpanded: boolean;
  onToggle: (word: string) => void;
  onRemoveWord: (word: string) => void;
  onRemoveSentence: (id: number) => void;
  onOpenDetail: (entry: VocabularyEntry) => void;
}

const VocabularyCard: React.FC<VocabularyCardProps> = React.memo(({
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
        onClick={() => onToggle(entry.word)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-muted-foreground shrink-0">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          {entry.language === 'de' && (() => {
            const a = extractGermanArticle(entry.pos);
            return a ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${GENDER_COLORS[a]}`}>{a}</span> : null;
          })()}
          <span className="font-semibold text-base">{entry.word}</span>
          {entry.pos && (
            <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
              {entry.pos}
            </span>
          )}
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
              onOpenDetail(entry);
            }}
            className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100 p-1 rounded"
            title="查看详情"
          >
            <ExternalLink size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveWord(entry.word);
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
              word={entry.word}
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
                onOpenDetail(entry);
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
});

interface MeaningSectionProps {
  meaning: VocabMeaning;
  showLabel: boolean;
  index: number;
  word: string;
  onRemoveSentence: (id: number) => void;
}

const MeaningSection: React.FC<MeaningSectionProps> = React.memo(({
  meaning,
  showLabel,
  index,
  word,
  onRemoveSentence,
}) => {
  return (
    <div>
      <div className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
        {showLabel && (
          <span className="text-xs text-primary mr-0.5">义项{index + 1}.</span>
        )}
        {meaning.pos && (
          <span className="text-[10px] font-medium bg-secondary text-muted-foreground px-1.5 py-0.5 rounded shrink-0">
            {meaning.pos}
          </span>
        )}
        <span>{meaning.meaning}</span>
      </div>
      <div className="mt-1.5 space-y-1.5 ml-3">
        {meaning.sentences.map((s) => (
          <div key={s.id} className="group/sentence flex items-start gap-1.5">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-muted-foreground italic">
                "{highlightWord(s.sentence, word)}"
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
});
