import React, { useEffect, useRef, useCallback } from 'react';
import { useReaderStore } from '../../stores/reader-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useFileImport } from '../../hooks/use-file-import';
import { Paragraph, resetSharedObserver } from './Paragraph';
import { FolderOpen, BookOpen, Loader2, ArrowLeft } from 'lucide-react';
import { SelectionAskButton } from '../ai/SelectionAskButton';

function getScrollPercent(el: HTMLDivElement): number {
  if (el.scrollHeight <= el.clientHeight) return 100;
  return (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
}

function setScrollFromPercent(el: HTMLDivElement, pct: number) {
  el.scrollTop = (pct / 100) * (el.scrollHeight - el.clientHeight);
}

// Separate component for the reading content to isolate re-renders
const ReaderContent = React.memo<{ paragraphs: import('../../lib/sentence-splitter').ParagraphData[] }>(
  ({ paragraphs }) => (
    <div className="max-w-3xl mx-auto">
      {paragraphs.map((paragraph) => (
        <Paragraph key={paragraph.id} paragraph={paragraph} />
      ))}
    </div>
  )
);

export const ReaderView: React.FC = () => {
  const currentBook = useReaderStore((s) => s.currentBook);
  const recentBooks = useReaderStore((s) => s.recentBooks);
  const fileLoading = useReaderStore((s) => s.fileLoading);
  const fileLoadingMessage = useReaderStore((s) => s.fileLoadingMessage);
  const loadRecentBooks = useReaderStore((s) => s.loadRecentBooks);
  const saveScrollPosition = useReaderStore((s) => s.saveScrollPosition);
  const getScrollPosition = useReaderStore((s) => s.getScrollPosition);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const { importFile, openRecentBook } = useFileImport();

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredScroll = useRef(false);
  const currentProgressRef = useRef(0);
  const rafRef = useRef<number>(0);
  // Direct DOM refs for progress display (avoid Zustand re-renders on scroll)
  const progressTextRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Load recent books on mount
  useEffect(() => {
    loadRecentBooks();
  }, [loadRecentBooks]);

  // Reset observer & restore scroll position when book changes
  useEffect(() => {
    if (!currentBook || !scrollRef.current) return;
    hasRestoredScroll.current = false;
    resetSharedObserver(); // Free stale observer entries from previous book

    const restore = async () => {
      const pct = await getScrollPosition(currentBook.filePath);
      if (pct > 0 && scrollRef.current) {
        setScrollFromPercent(scrollRef.current, pct);
      }
      currentProgressRef.current = pct;
      // Update DOM directly
      if (progressTextRef.current) progressTextRef.current.textContent = `${Math.round(pct)}%`;
      if (progressBarRef.current) progressBarRef.current.style.width = `${Math.min(pct, 100)}%`;
      hasRestoredScroll.current = true;
    };
    const timer = setTimeout(restore, 150);
    return () => clearTimeout(timer);
  }, [currentBook?.filePath, getScrollPosition]);

  // Save on window close / navigate away
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentBook && currentProgressRef.current > 0) {
        const api = (window as any).electronAPI;
        api?.dbRun(
          `UPDATE reading_progress SET scroll_position = ?, last_read_at = datetime('now') WHERE file_path = ?`,
          [currentProgressRef.current, currentBook.filePath]
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentBook]);

  // Cancel pending timers when app goes to background to prevent freeze
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        // App went to background — cancel any pending work
        if (scrollTimerRef.current) {
          clearTimeout(scrollTimerRef.current);
          scrollTimerRef.current = null;
        }
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
        // Save current progress immediately before going to background
        if (currentBook && currentProgressRef.current > 0) {
          saveScrollPosition(currentBook.filePath, currentProgressRef.current);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [currentBook, saveScrollPosition]);

  // RAF-throttled scroll handler — updates DOM directly, no React state changes
  const handleScroll = useCallback(() => {
    if (!currentBook || !scrollRef.current || !hasRestoredScroll.current) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const pct = getScrollPercent(scrollRef.current);
      currentProgressRef.current = pct;

      // Update progress display via direct DOM manipulation (zero re-renders)
      if (progressTextRef.current) progressTextRef.current.textContent = `${Math.round(pct)}%`;
      if (progressBarRef.current) progressBarRef.current.style.width = `${Math.min(pct, 100)}%`;

      // Debounced DB save
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        if (currentBook) {
          saveScrollPosition(currentBook.filePath, pct);
        }
      }, 1500);
    });
  }, [currentBook, saveScrollPosition]);

  // Loading overlay
  if (fileLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <Loader2 size={40} className="animate-spin text-primary" />
        <p className="text-sm">{fileLoadingMessage || '加载中...'}</p>
      </div>
    );
  }

  // Empty state: show bookshelf + open button
  if (!currentBook) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
        <FolderOpen size={56} strokeWidth={1} className="text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-xl font-medium mb-2">开始阅读</h2>
          <p className="text-sm text-muted-foreground mb-4">导入 TXT、PDF 或 EPUB 文件</p>
        </div>
        <button
          onClick={importFile}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
        >
          打开文件
        </button>

        {recentBooks.length > 0 && (
          <div className="w-full max-w-md mt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
              <BookOpen size={14} />
              最近阅读
            </h3>
            <div className="space-y-1.5">
              {recentBooks.map((book) => (
                <button
                  key={book.filePath}
                  onClick={() => openRecentBook(book.filePath, book.fileName)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-accent transition-colors group border border-transparent hover:border-border"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium truncate group-hover:text-accent-foreground flex-1 mr-3">
                      {book.fileName}
                    </div>
                    {book.readingProgress > 0 && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {Math.round(book.readingProgress)}%
                      </span>
                    )}
                  </div>
                  {book.readingProgress > 0 && (
                    <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all"
                        style={{ width: `${Math.min(book.readingProgress, 100)}%` }}
                      />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-2.5 pr-[150px] border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
          <button
            onClick={() => useReaderStore.getState().setCurrentBook(null)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-accent shrink-0"
            title="返回书架"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-medium truncate text-muted-foreground">
            {currentBook.fileName}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span ref={progressTextRef} className="text-xs text-muted-foreground tabular-nums">
            0%
          </span>
          <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              ref={progressBarRef}
              className="h-full bg-primary rounded-full transition-none"
              style={{ width: '0%' }}
            />
          </div>
          <button
            onClick={importFile}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded hover:bg-accent"
          >
            打开其他文件
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-8 py-6 md:px-16 lg:px-24"
        style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
      >
        <ReaderContent paragraphs={currentBook.paragraphs} />
      </div>
      <SelectionAskButton containerRef={scrollRef} />
    </div>
  );
};
