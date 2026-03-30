import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ParagraphData } from '../../lib/sentence-splitter';
import { Sentence } from './Sentence';

// Kept as no-op for callers that still reference it
export function resetSharedObserver(): void {}

interface ParagraphProps {
  paragraph: ParagraphData;
  collectedSentences?: Set<string>;
  vocabWords?: Set<string>;
  bookmarkSentenceId?: string | null;
  onContextMenu?: (e: React.MouseEvent, sentenceId: string) => void;
}

export const Paragraph: React.FC<ParagraphProps> = React.memo(({ paragraph, collectedSentences, vocabWords, bookmarkSentenceId, onContextMenu }) => {
  return (
    <p className="mb-4">
      {paragraph.sentences.map((sentence, idx) => (
        <Sentence
          key={sentence.id}
          sentence={sentence}
          paragraphSentences={paragraph.sentences}
          sentenceIndexInParagraph={idx}
          isCollected={collectedSentences ? collectedSentences.has(sentence.text) : false}
          vocabWords={vocabWords}
          isBookmarked={bookmarkSentenceId === sentence.id}
          onContextMenu={onContextMenu}
        />
      ))}
    </p>
  );
}, (prev, next) => {
  if (prev.paragraph !== next.paragraph) return false;
  if (prev.bookmarkSentenceId !== next.bookmarkSentenceId) return false;
  if (prev.onContextMenu !== next.onContextMenu) return false;
  // Compare Sets by reference — they are stabilized in ReaderView
  if (prev.collectedSentences !== next.collectedSentences) return false;
  if (prev.vocabWords !== next.vocabWords) return false;
  return true;
});

// ── Virtualized paragraph list ──
// Only renders paragraphs within/near the scroll viewport.
// Uses estimated heights with measurement correction.

const ESTIMATED_LINE_HEIGHT = 28; // px per line of text
const CHARS_PER_LINE = 80;
const OVERSCAN = 5; // extra paragraphs above/below viewport

function estimateHeight(p: ParagraphData, fontSize: number): number {
  const lineH = fontSize * 1.8;
  const charsPerLine = Math.max(40, Math.floor(700 / (fontSize * 0.55)));
  const lines = Math.max(1, Math.ceil(p.text.length / charsPerLine));
  return lines * lineH + 16; // 16 = mb-4
}

interface VirtualizedParagraphsProps {
  paragraphs: ParagraphData[];
  fontSize: number;
  collectedSentences?: Set<string>;
  vocabWords?: Set<string>;
  bookmarkSentenceId?: string | null;
  onContextMenu?: (e: React.MouseEvent, sentenceId: string) => void;
}

export const VirtualizedParagraphs: React.FC<VirtualizedParagraphsProps> = React.memo(({
  paragraphs,
  fontSize,
  collectedSentences,
  vocabWords,
  bookmarkSentenceId,
  onContextMenu,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);
  const heightsRef = useRef<number[]>([]);
  const measuredRef = useRef<Map<number, number>>(new Map());

  // Compute estimated heights
  const heights = useMemo(() => {
    return paragraphs.map((p, i) => measuredRef.current.get(i) || estimateHeight(p, fontSize));
  }, [paragraphs, fontSize]);
  heightsRef.current = heights;

  // Prefix sums for fast offset lookup
  const offsets = useMemo(() => {
    const arr = new Array(heights.length + 1);
    arr[0] = 0;
    for (let i = 0; i < heights.length; i++) {
      arr[i + 1] = arr[i] + heights[i];
    }
    return arr;
  }, [heights]);

  const totalHeight = offsets[offsets.length - 1] || 0;

  // Find visible range using binary search
  const { startIdx, endIdx } = useMemo(() => {
    if (paragraphs.length === 0) return { startIdx: 0, endIdx: 0 };
    // Binary search for first visible
    let lo = 0, hi = paragraphs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid + 1] < scrollTop) lo = mid + 1;
      else hi = mid;
    }
    const start = Math.max(0, lo - OVERSCAN);
    // Find last visible
    const bottom = scrollTop + viewportHeight;
    let end = lo;
    while (end < paragraphs.length && offsets[end] < bottom) end++;
    end = Math.min(paragraphs.length, end + OVERSCAN);
    return { startIdx: start, endIdx: end };
  }, [paragraphs.length, offsets, scrollTop, viewportHeight]);

  // Listen to parent scroll container (RAF-throttled to avoid per-pixel re-renders)
  const rafRef = useRef(0);
  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setScrollTop(el.scrollTop);
        setViewportHeight(el.clientHeight);
      });
    };
    // init
    setScrollTop(el.scrollTop);
    setViewportHeight(el.clientHeight);
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Measure rendered paragraphs to correct height estimates
  const measureCallback = useCallback((idx: number, el: HTMLElement | null) => {
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    if (Math.abs(h - (heightsRef.current[idx] || 0)) > 2) {
      measuredRef.current.set(idx, h);
    }
  }, []);

  const topPad = offsets[startIdx] || 0;
  const bottomPad = totalHeight - (offsets[endIdx] || totalHeight);

  return (
    <div ref={containerRef} className="max-w-3xl mx-auto" style={{ position: 'relative' }}>
      {topPad > 0 && <div style={{ height: topPad }} />}
      {paragraphs.slice(startIdx, endIdx).map((p, i) => {
        const realIdx = startIdx + i;
        return (
          <div key={p.id} ref={(el) => measureCallback(realIdx, el)}>
            <Paragraph
              paragraph={p}
              collectedSentences={collectedSentences}
              vocabWords={vocabWords}
              bookmarkSentenceId={bookmarkSentenceId}
              onContextMenu={onContextMenu}
            />
          </div>
        );
      })}
      {bottomPad > 0 && <div style={{ height: bottomPad }} />}
    </div>
  );
});
