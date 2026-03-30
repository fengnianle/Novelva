import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useVocabulary, VocabularyRow } from '../../hooks/use-vocabulary';
import { useSettingsStore } from '../../stores/settings-store';
import { useReaderStore } from '../../stores/reader-store';
import { GraduationCap, ThumbsUp, ThumbsDown, RotateCw, CheckCircle2, Filter, ExternalLink } from 'lucide-react';

const LANG_LABELS: Record<string, string> = {
  en: 'English', ja: '日本語', de: 'Deutsch', fr: 'Français',
  es: 'Español', ko: '한국어', ru: 'Русский', it: 'Italiano', pt: 'Português',
};

interface ReviewWord extends VocabularyRow {
  ease_factor?: number;
  interval_days?: number;
  repetitions?: number;
}

export const FlashCard: React.FC = () => {
  const { rawItems, loadVocabulary } = useVocabulary();
  const { dailyReviewCount } = useSettingsStore();
  const reviewSnapshot = useReaderStore((s) => s.reviewSnapshot);
  const restoredFromSnapshot = useRef(false);

  const [queue, setQueue] = useState<ReviewWord[]>(() => reviewSnapshot?.queue ?? []);
  const [currentIdx, setCurrentIdx] = useState(() => reviewSnapshot?.currentIdx ?? 0);
  const [showAnswer, setShowAnswer] = useState(() => reviewSnapshot?.showAnswer ?? false);
  const [reviewed, setReviewed] = useState(() => reviewSnapshot?.reviewed ?? 0);
  const [remembered, setRemembered] = useState(() => reviewSnapshot?.remembered ?? 0);
  const [sessionComplete, setSessionComplete] = useState(() => reviewSnapshot?.sessionComplete ?? false);
  const [filterLang, setFilterLang] = useState<string>(() => reviewSnapshot?.filterLang ?? 'all');
  const [filterSource, setFilterSource] = useState<string>(() => reviewSnapshot?.filterSource ?? 'all');
  const initialized = useRef(!!reviewSnapshot);

  const viewMode = useReaderStore((s) => s.viewMode);

  // If restored from snapshot, clear it so future normal tab switches rebuild
  useEffect(() => {
    if (reviewSnapshot && !restoredFromSnapshot.current) {
      restoredFromSnapshot.current = true;
      useReaderStore.setState({ reviewSnapshot: null });
    }
  }, [reviewSnapshot]);

  // Reload vocabulary every time the review tab becomes visible (but skip if restored from snapshot)
  useEffect(() => {
    if (viewMode === 'review') {
      if (restoredFromSnapshot.current) {
        restoredFromSnapshot.current = false;
        return;
      }
      initialized.current = false;
      loadVocabulary();
    }
  }, [viewMode, loadVocabulary]);

  // Compute available languages and source files
  const { languages, sourceFiles } = useMemo(() => {
    const langSet = new Set<string>();
    const sourceSet = new Set<string>();
    for (const item of rawItems) {
      langSet.add(item.language || 'en');
      if (item.source_file) sourceSet.add(item.source_file);
    }
    return { languages: Array.from(langSet).sort(), sourceFiles: Array.from(sourceSet).sort() };
  }, [rawItems]);

  // Filter rawItems based on selected filters
  const filteredItems = useMemo(() => {
    let items = rawItems;
    if (filterLang !== 'all') items = items.filter((i) => (i.language || 'en') === filterLang);
    if (filterSource !== 'all') items = items.filter((i) => i.source_file === filterSource);
    return items;
  }, [rawItems, filterLang, filterSource]);

  // Build review queue using spaced repetition schedule
  const buildQueue = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api || filteredItems.length === 0) return;

    const filteredWordSet = new Set(filteredItems.map((i) => i.word.toLowerCase()));

    try {
      // Ensure all vocabulary words have a review_schedule entry
      for (const item of filteredItems) {
        await api.dbRun(
          'INSERT OR IGNORE INTO review_schedule (word) VALUES (?)',
          [item.word.toLowerCase()]
        );
      }

      // Get words due for review (next_review_date <= today), ordered by urgency
      const dueRows = await api.dbQuery(
        `SELECT rs.*, v.meaning, v.sentence, v.sentence_translation, v.source_file, v.language
         FROM review_schedule rs
         JOIN vocabulary v ON LOWER(v.word) = rs.word
         WHERE rs.next_review_date <= date('now')
         GROUP BY rs.word
         ORDER BY rs.next_review_date ASC, rs.ease_factor ASC
         LIMIT ?`,
        [dailyReviewCount * 2]
      );

      // Filter due rows by the current filter set
      const filteredDue = (dueRows || []).filter((r: any) => filteredWordSet.has(r.word.toLowerCase())).slice(0, dailyReviewCount);

      if (filteredDue.length > 0) {
        setQueue(filteredDue);
        setCurrentIdx(0);
        setShowAnswer(false);
        setReviewed(0);
        setRemembered(0);
        setSessionComplete(false);
      } else {
        // No words due — pick random from filtered vocab for extra practice
        const shuffled = [...filteredItems].sort(() => Math.random() - 0.5).slice(0, dailyReviewCount);
        setQueue(shuffled);
        setCurrentIdx(0);
        setShowAnswer(false);
        setReviewed(0);
        setRemembered(0);
        setSessionComplete(false);
      }
    } catch (e) {
      console.error('Failed to build review queue:', e);
      const shuffled = [...filteredItems].sort(() => Math.random() - 0.5).slice(0, dailyReviewCount);
      setQueue(shuffled);
    }
  }, [filteredItems, dailyReviewCount]);

  useEffect(() => {
    if (rawItems.length > 0 && !initialized.current) {
      initialized.current = true;
      buildQueue();
    }
  }, [rawItems, buildQueue]);

  // Rebuild queue when filters change
  useEffect(() => {
    if (rawItems.length > 0) {
      initialized.current = false;
    }
  }, [filterLang, filterSource]);

  // SM-2 algorithm: update schedule based on user response
  const handleResponse = useCallback(async (remembered: boolean) => {
    const current = queue[currentIdx];
    if (!current) return;

    const api = (window as any).electronAPI;
    if (api) {
      try {
        const ef = current.ease_factor || 2.5;
        const rep = current.repetitions || 0;
        const interval = current.interval_days || 0;

        let newEf = ef;
        let newInterval: number;
        let newRep: number;

        if (remembered) {
          // Quality = 4 (correct, some hesitation)
          newEf = Math.max(1.3, ef + (0.1 - (5 - 4) * (0.08 + (5 - 4) * 0.02)));
          if (rep === 0) {
            newInterval = 1;
          } else if (rep === 1) {
            newInterval = 3;
          } else {
            newInterval = Math.round(interval * newEf);
          }
          newRep = rep + 1;
        } else {
          // Quality = 1 (forgot)
          newEf = Math.max(1.3, ef - 0.2);
          newInterval = 0; // Review again today
          newRep = 0;
        }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newInterval);
        const nextDateStr = nextDate.toISOString().split('T')[0];

        await api.dbRun(
          `UPDATE review_schedule 
           SET ease_factor = ?, interval_days = ?, repetitions = ?, 
               next_review_date = ?, last_review_date = date('now')
           WHERE word = ?`,
          [newEf, newInterval, newRep, nextDateStr, current.word.toLowerCase()]
        );
      } catch (e) {
        console.error('Failed to update review schedule:', e);
      }
    }

    setReviewed((r) => r + 1);
    if (remembered) setRemembered((r) => r + 1);

    if (currentIdx + 1 >= queue.length) {
      setSessionComplete(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setShowAnswer(false);
    }
  }, [queue, currentIdx]);

  const startNewRound = useCallback(() => {
    initialized.current = false;
    buildQueue();
  }, [buildQueue]);

  if (rawItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <GraduationCap size={64} strokeWidth={1} />
        <p className="mt-4 text-lg">还没有可复习的词汇</p>
        <p className="text-sm mt-2">先去阅读并收藏一些单词吧</p>
      </div>
    );
  }

  if (sessionComplete) {
    const accuracy = reviewed > 0 ? Math.round((remembered / reviewed) * 100) : 0;
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6">
        <CheckCircle2 size={64} className="text-green-500" strokeWidth={1.5} />
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">本轮复习完成!</h2>
          <p className="text-muted-foreground">
            共复习 {reviewed} 个单词，记住 {remembered} 个
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${accuracy}%` }} />
            </div>
            <span className="text-sm font-medium tabular-nums">{accuracy}%</span>
          </div>
        </div>
        <button
          onClick={startNewRound}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
        >
          <RotateCw size={18} />
          再来一轮
        </button>
      </div>
    );
  }

  const current = queue[currentIdx];
  if (!current) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">复习模式</h1>
          <button
            onClick={startNewRound}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent"
          >
            重新抽取
          </button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          进度 {currentIdx + 1}/{queue.length} · 词库共 {filteredItems.length} 词
          {filteredItems.length !== rawItems.length && ` (全部 ${rawItems.length})`}
        </p>
        {(languages.length > 1 || sourceFiles.length > 0) && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Filter size={12} className="text-muted-foreground shrink-0" />
            {languages.length > 1 && (
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
            )}
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
          </div>
        )}
        <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((currentIdx) / queue.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm text-center min-h-[260px] flex flex-col justify-center">
            <div className="text-3xl font-bold mb-6">{current.word}</div>

            {showAnswer ? (
              <div className="space-y-4 animate-in fade-in-0 duration-300">
                <div className="text-lg">{current.meaning}</div>
                <div className="text-sm text-muted-foreground italic border-t border-border pt-4 mt-4">
                  "{current.sentence}"
                </div>
                {current.sentence_translation && (
                  <div className="text-sm text-muted-foreground">
                    {current.sentence_translation}
                  </div>
                )}
                <button
                  onClick={() => useReaderStore.getState().openWordDetailFromReview(current.word, {
                    queue, currentIdx, showAnswer, reviewed, remembered, sessionComplete, filterLang, filterSource,
                  })}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mx-auto mt-2"
                >
                  <ExternalLink size={12} />
                  查看详情
                </button>
              </div>
            ) : (
              <div className="py-4 text-muted-foreground text-sm">
                想一想这个词的意思，然后点击查看
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 mt-6">
            {!showAnswer ? (
              <button
                onClick={() => setShowAnswer(true)}
                className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                查看释义
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleResponse(false)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors font-medium"
                >
                  <ThumbsDown size={18} />
                  不记得
                </button>
                <button
                  onClick={() => handleResponse(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors font-medium"
                >
                  <ThumbsUp size={18} />
                  记得
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
