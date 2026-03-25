import { create } from 'zustand';

export interface WordAnalysis {
  word: string;
  meaning: string;
  pos: string;
}

export interface KeyExpression {
  expression: string;
  meaning: string;
  usage: string;
}

export interface SentenceAnalysis {
  translation: string;
  key_expressions: KeyExpression[];
  explanation: string;
  words: WordAnalysis[];
}

export interface AiState {
  loading: boolean;
  currentAnalysis: SentenceAnalysis | null;
  error: string | null;
  wordCache: Map<string, WordAnalysis>;

  setLoading: (loading: boolean) => void;
  setCurrentAnalysis: (analysis: SentenceAnalysis | null) => void;
  setError: (error: string | null) => void;
  addToWordCache: (word: string, analysis: WordAnalysis) => void;
  getFromWordCache: (word: string) => WordAnalysis | undefined;
}

export const useAiStore = create<AiState>((set, get) => ({
  loading: false,
  currentAnalysis: null,
  error: null,
  wordCache: new Map(),

  setLoading: (loading) => set({ loading, error: null }),
  setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis, loading: false }),
  setError: (error) => set({ error, loading: false }),
  addToWordCache: (word, analysis) => {
    const cache = new Map(get().wordCache);
    cache.set(word.toLowerCase(), analysis);
    set({ wordCache: cache });
  },
  getFromWordCache: (word) => {
    return get().wordCache.get(word.toLowerCase());
  },
}));
