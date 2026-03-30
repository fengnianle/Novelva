import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useReaderStore } from '../../stores/reader-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useFileImport } from '../../hooks/use-file-import';
import { resetSharedObserver, VirtualizedParagraphs } from './Paragraph';
import { FolderOpen, BookOpen, Loader2, ArrowLeft, Bookmark } from 'lucide-react';
import { SelectionAskButton } from '../ai/SelectionAskButton';

function getScrollPercent(el: HTMLDivElement): number {
  if (el.scrollHeight <= el.clientHeight) return 100;
  return (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
}

function setScrollFromPercent(el: HTMLDivElement, pct: number) {
  el.scrollTop = (pct / 100) * (el.scrollHeight - el.clientHeight);
}

// ── Context Menu component ──
interface ContextMenuProps {
  x: number;
  y: number;
  sentenceId: string;
  isBookmarked: boolean;
  onBookmark: () => void;
  onClose: () => void;
}

const SentenceContextMenu: React.FC<ContextMenuProps> = ({ x, y, isBookmarked, onBookmark, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Adjust position to stay within viewport
  let top = y, left = x;
  if (left + 160 > window.innerWidth) left = window.innerWidth - 170;
  if (top + 40 > window.innerHeight) top = y - 40;

  return (
    <div
      ref={menuRef}
      className="fixed z-[80] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[140px] animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ top, left }}
    >
      <button
        onClick={() => { onBookmark(); onClose(); }}
        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
      >
        <Bookmark size={14} className={isBookmarked ? 'fill-yellow-400 text-yellow-500' : ''} />
        {isBookmarked ? '取消书签' : '添加书签'}
      </button>
    </div>
  );
};

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
  const readerFontColor = useSettingsStore((s) => s.readerFontColor);
  const readerBgColor = useSettingsStore((s) => s.readerBgColor);
  const { importFile, openRecentBook } = useFileImport();

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredScroll = useRef(false);
  const currentProgressRef = useRef(0);
  const rafRef = useRef<number>(0);
  const progressTextRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Bookmark state: one bookmark per file
  const [bookmarkSentenceId, setBookmarkSentenceId] = useState<string | null>(null);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; sentenceId: string } | null>(null);

  // Collected sentences & vocab words for hints (Feature 5)
  const [collectedSentences, setCollectedSentences] = useState<Set<string>>(new Set());
  const [vocabWords, setVocabWords] = useState<Set<string>>(new Set());

  // Load recent books on mount
  useEffect(() => {
    loadRecentBooks();
  }, [loadRecentBooks]);

  // Load bookmark, collected sentences, vocab words when book changes
  useEffect(() => {
    if (!currentBook) return;
    const api = (window as any).electronAPI;
    if (!api) return;

    // Load bookmark for this file
    api.dbQuery(
      'SELECT value FROM settings WHERE key = ?',
      ['bookmark_' + currentBook.filePath]
    ).then((rows: any[]) => {
      setBookmarkSentenceId(rows && rows.length > 0 ? rows[0].value : null);
    }).catch(() => {});

    // Load collected sentences (sentences that exist in vocabulary table)
    api.dbQuery('SELECT DISTINCT sentence FROM vocabulary').then((rows: any[]) => {
      const set = new Set<string>();
      if (rows) for (const r of rows) set.add(r.sentence);
      setCollectedSentences(set);
    }).catch(() => {});

    // Load vocab words
    api.dbQuery('SELECT DISTINCT LOWER(word) as w FROM vocabulary').then((rows: any[]) => {
      const set = new Set<string>();
      if (rows) for (const r of rows) set.add(r.w);
      setVocabWords(set);
    }).catch(() => {});
  }, [currentBook?.filePath]);

  // Handle bookmark toggle
  const handleBookmark = useCallback((sentenceId: string) => {
    if (!currentBook) return;
    const api = (window as any).electronAPI;
    if (!api) return;
    const key = 'bookmark_' + currentBook.filePath;
    if (bookmarkSentenceId === sentenceId) {
      // Remove bookmark
      api.dbRun('DELETE FROM settings WHERE key = ?', [key]);
      setBookmarkSentenceId(null);
    } else {
      // Set bookmark (replaces any existing)
      api.dbRun(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
        [key, sentenceId, sentenceId]
      );
      setBookmarkSentenceId(sentenceId);
    }
  }, [currentBook, bookmarkSentenceId]);

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, sentenceId: string) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, sentenceId });
  }, []);

  // Reset observer & restore scroll position when book changes
  useEffect(() => {
    if (!currentBook || !scrollRef.current) return;
    hasRestoredScroll.current = false;
    resetSharedObserver();

    const restore = async () => {
      const pct = await getScrollPosition(currentBook.filePath);
      if (pct > 0 && scrollRef.current) {
        setScrollFromPercent(scrollRef.current, pct);
      }
      currentProgressRef.current = pct;
      if (progressTextRef.current) progressTextRef.current.textContent = `${Math.round(pct)}%`;
      if (progressBarRef.current) progressBarRef.current.style.width = `${Math.min(pct, 100)}%`;
      hasRestoredScroll.current = true;
    };
    const timer = setTimeout(restore, 150);
    return () => clearTimeout(timer);
  }, [currentBook?.filePath, getScrollPosition]);

  // Save on window close
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

  // Cancel pending timers when app goes to background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (scrollTimerRef.current) { clearTimeout(scrollTimerRef.current); scrollTimerRef.current = null; }
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
        if (currentBook && currentProgressRef.current > 0) {
          saveScrollPosition(currentBook.filePath, currentProgressRef.current);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [currentBook, saveScrollPosition]);

  // RAF-throttled scroll handler
  const handleScroll = useCallback(() => {
    if (!currentBook || !scrollRef.current || !hasRestoredScroll.current) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const pct = getScrollPercent(scrollRef.current);
      currentProgressRef.current = pct;

      if (progressTextRef.current) progressTextRef.current.textContent = `${Math.round(pct)}%`;
      if (progressBarRef.current) progressBarRef.current.style.width = `${Math.min(pct, 100)}%`;

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

  // Empty state
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

  // Reader custom colors
  const readerStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    lineHeight: lineHeight,
  };
  if (readerFontColor) readerStyle.color = readerFontColor;
  if (readerBgColor) readerStyle.backgroundColor = readerBgColor;

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
          {bookmarkSentenceId && (
            <span className="text-xs text-yellow-500 flex items-center gap-0.5" title="已设置书签">
              <Bookmark size={12} className="fill-yellow-400" />
            </span>
          )}
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
        style={readerStyle}
      >
        <VirtualizedParagraphs
          paragraphs={currentBook.paragraphs}
          fontSize={fontSize}
          collectedSentences={collectedSentences}
          vocabWords={vocabWords}
          bookmarkSentenceId={bookmarkSentenceId}
          onContextMenu={handleContextMenu}
        />
      </div>
      <SelectionAskButton containerRef={scrollRef} />
      {ctxMenu && (
        <SentenceContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          sentenceId={ctxMenu.sentenceId}
          isBookmarked={bookmarkSentenceId === ctxMenu.sentenceId}
          onBookmark={() => handleBookmark(ctxMenu.sentenceId)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
};
