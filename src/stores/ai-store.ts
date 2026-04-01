import { create } from 'zustand';

export interface WordAnalysis {
  word: string;
  surface?: string;
  meaning: string;
  pos: string;
}

export interface KeyExpression {
  expression: string;
  meaning: string;
  usage: string;
}

export interface GrammarPoint {
  point: string;
  explanation: string;
  example?: string;
}

export interface SentenceAnalysis {
  language?: string;
  translation: string;
  grammar_points: GrammarPoint[];
  key_expressions: KeyExpression[];
  explanation?: string;
  words: WordAnalysis[];
}

export interface AiState {
  loading: boolean;
  currentAnalysis: SentenceAnalysis | null;
  streamingTranslation: string | null;
  error: string | null;
  wordCache: Map<string, WordAnalysis>;

  setLoading: (loading: boolean) => void;
  setCurrentAnalysis: (analysis: SentenceAnalysis | null) => void;
  setStreamingTranslation: (t: string | null) => void;
  setError: (error: string | null) => void;
  addToWordCache: (word: string, analysis: WordAnalysis) => void;
  getFromWordCache: (word: string) => WordAnalysis | undefined;
}

export const useAiStore = create<AiState>((set, get) => ({
  loading: false,
  currentAnalysis: null,
  streamingTranslation: null,
  error: null,
  wordCache: new Map(),

  setLoading: (loading) => set({ loading, error: null, streamingTranslation: null }),
  setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis, loading: false, streamingTranslation: null }),
  setStreamingTranslation: (t) => set({ streamingTranslation: t }),
  setError: (error) => set({ error, loading: false, streamingTranslation: null }),
  addToWordCache: (word, analysis) => {
    const cache = new Map(get().wordCache);
    cache.set(word.toLowerCase(), analysis);
    set({ wordCache: cache });
  },
  getFromWordCache: (word) => {
    return get().wordCache.get(word.toLowerCase());
  },
}));
