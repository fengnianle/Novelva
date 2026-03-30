import { create } from 'zustand';
import { ParagraphData } from '@/lib/sentence-splitter';

export type ViewMode = 'reader' | 'vocabulary' | 'review' | 'settings';

export interface BookInfo {
  filePath: string;
  fileName: string;
  content: string;
  paragraphs: ParagraphData[];
}

export interface RecentBook {
  filePath: string;
  fileName: string;
  lastReadAt: string;
  readingProgress: number;
}

export interface ReviewSnapshot {
  queue: any[];
  currentIdx: number;
  showAnswer: boolean;
  reviewed: number;
  remembered: number;
  sessionComplete: boolean;
  filterLang: string;
  filterSource: string;
  forgottenWords: any[];
  passNumber: number;
  totalReviewed: number;
  totalRemembered: number;
}

export interface ReaderState {
  currentBook: BookInfo | null;
  viewMode: ViewMode;
  selectedSentenceId: string | null;
  selectedWord: string | null;
  recentBooks: RecentBook[];
  fileLoading: boolean;
  fileLoadingMessage: string;
  readingProgress: number;
  reviewDetailWord: string | null;
  reviewSnapshot: ReviewSnapshot | null;
  vocabRefreshCounter: number;
  readerDetailWord: string | null;

  setCurrentBook: (book: BookInfo | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedSentenceId: (id: string | null) => void;
  setSelectedWord: (word: string | null) => void;
  setFileLoading: (loading: boolean, message?: string) => void;
  addRecentBook: (filePath: string, fileName: string) => void;
  loadRecentBooks: () => Promise<void>;
  saveScrollPosition: (filePath: string, progress: number) => Promise<void>;
  getScrollPosition: (filePath: string) => Promise<number>;
  setReadingProgress: (progress: number) => void;
  openWordDetailFromReview: (word: string, snapshot: ReviewSnapshot) => void;
  returnToReview: () => void;
  bumpVocabRefresh: () => void;
  openWordDetailFromReader: (word: string) => void;
  returnToReader: () => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  currentBook: null,
  viewMode: 'reader',
  selectedSentenceId: null,
  selectedWord: null,
  recentBooks: [],
  fileLoading: false,
  fileLoadingMessage: '',
  readingProgress: 0,
  reviewDetailWord: null,
  reviewSnapshot: null,
  vocabRefreshCounter: 0,
  readerDetailWord: null,

  setCurrentBook: (book) => set({ currentBook: book }),
  setViewMode: (mode) => set({ viewMode: mode, selectedSentenceId: null, selectedWord: null }),
  openWordDetailFromReview: (word, snapshot) => set({ viewMode: 'vocabulary', reviewDetailWord: word, reviewSnapshot: snapshot }),
  returnToReview: () => set({ viewMode: 'review', reviewDetailWord: null }),
  bumpVocabRefresh: () => set((s) => ({ vocabRefreshCounter: s.vocabRefreshCounter + 1 })),
  openWordDetailFromReader: (word) => set({ viewMode: 'vocabulary', readerDetailWord: word }),
  returnToReader: () => set({ viewMode: 'reader', readerDetailWord: null }),
  setSelectedSentenceId: (id) => set({ selectedSentenceId: id, selectedWord: null }),
  setSelectedWord: (word) => set({ selectedWord: word }),
  setFileLoading: (loading, message = '') => set({ fileLoading: loading, fileLoadingMessage: message }),

  addRecentBook: async (filePath, fileName) => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      await api.dbRun(
        `INSERT INTO reading_progress (file_path, file_name, last_read_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(file_path) DO UPDATE SET file_name = ?, last_read_at = datetime('now')`,
        [filePath, fileName, fileName]
      );
      const rows = await api.dbQuery(
        'SELECT file_path, file_name, last_read_at, scroll_position FROM reading_progress ORDER BY last_read_at DESC LIMIT 20'
      );
      set({
        recentBooks: (rows || []).map((r: any) => ({
          filePath: r.file_path,
          fileName: r.file_name,
          lastReadAt: r.last_read_at,
          readingProgress: Number(r.scroll_position) || 0,
        })),
      });
    } catch (e) {
      console.error('Failed to save recent book:', e);
    }
  },

  loadRecentBooks: async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      const rows = await api.dbQuery(
        'SELECT file_path, file_name, last_read_at, scroll_position FROM reading_progress ORDER BY last_read_at DESC LIMIT 20'
      );
      set({
        recentBooks: (rows || []).map((r: any) => ({
          filePath: r.file_path,
          fileName: r.file_name,
          lastReadAt: r.last_read_at,
          readingProgress: Number(r.scroll_position) || 0,
        })),
      });
    } catch (e) {
      console.error('Failed to load recent books:', e);
    }
  },

  setReadingProgress: (progress) => set({ readingProgress: progress }),

  saveScrollPosition: async (filePath, progress) => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      await api.dbRun(
        `UPDATE reading_progress SET scroll_position = ?, last_read_at = datetime('now') WHERE file_path = ?`,
        [progress, filePath]
      );
    } catch (e) {
      console.error('Failed to save scroll position:', e);
    }
  },

  getScrollPosition: async (filePath) => {
    const api = (window as any).electronAPI;
    if (!api) return 0;
    try {
      const rows = await api.dbQuery(
        'SELECT scroll_position FROM reading_progress WHERE file_path = ?',
        [filePath]
      );
      return rows && rows.length > 0 ? Number(rows[0].scroll_position) || 0 : 0;
    } catch (e) {
      console.error('Failed to get scroll position:', e);
      return 0;
    }
  },
}));
