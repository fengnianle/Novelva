import { useState, useCallback } from 'react';
import { useReaderStore } from '../stores/reader-store';

export interface VocabularyRow {
  id: number;
  word: string;
  meaning: string;
  pos: string;
  sentence: string;
  sentence_translation: string | null;
  source_file: string | null;
  language: string;
  created_at: string;
}

export interface VocabSentence {
  id: number;
  sentence: string;
  sentence_translation: string | null;
  source_file: string | null;
  created_at: string;
}

export interface VocabMeaning {
  meaning: string;
  pos: string;
  sentences: VocabSentence[];
}

export interface VocabularyEntry {
  word: string;
  language: string;
  pos: string;
  meanings: VocabMeaning[];
  latestDate: string;
  ids: number[];
}

function groupByWord(rows: VocabularyRow[]): VocabularyEntry[] {
  const map = new Map<string, VocabularyEntry>();

  for (const row of rows) {
    // Use lowercase key for grouping, but display the original stored word
    const key = row.word.toLowerCase();
    let entry = map.get(key);
    if (!entry) {
      entry = { word: row.word, language: row.language || 'en', pos: '', meanings: [], latestDate: row.created_at, ids: [] };
      map.set(key, entry);
    }

    // Collect all unique POS values
    if (row.pos && !entry.pos.split(', ').includes(row.pos)) {
      entry.pos = entry.pos ? `${entry.pos}, ${row.pos}` : row.pos;
    }

    entry.ids.push(row.id);
    if (row.created_at > entry.latestDate) entry.latestDate = row.created_at;

    // Find or create meaning group (group by meaning text)
    let meaningGroup = entry.meanings.find((m) => m.meaning === row.meaning);
    if (!meaningGroup) {
      meaningGroup = { meaning: row.meaning, pos: row.pos || '', sentences: [] };
      entry.meanings.push(meaningGroup);
    }

    meaningGroup.sentences.push({
      id: row.id,
      sentence: row.sentence,
      sentence_translation: row.sentence_translation,
      source_file: row.source_file,
      created_at: row.created_at,
    });
  }

  // Sort by latest date descending
  return Array.from(map.values()).sort(
    (a, b) => b.latestDate.localeCompare(a.latestDate)
  );
}

export function useVocabulary() {
  const [rawItems, setRawItems] = useState<VocabularyRow[]>([]);
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadVocabulary = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;

    setLoading(true);
    try {
      const rows: VocabularyRow[] = (await api.dbQuery(
        'SELECT * FROM vocabulary ORDER BY created_at DESC'
      )) || [];
      setRawItems(rows);
      setEntries(groupByWord(rows));
    } catch (e) {
      console.error('Failed to load vocabulary:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const addToVocabulary = useCallback(
    async (
      word: string,
      meaning: string,
      sentence: string,
      sentenceTranslation?: string,
      sourceFile?: string,
      language?: string,
      pos?: string
    ) => {
      const api = (window as any).electronAPI;
      if (!api) return;

      // For German: capitalize first letter of nouns; for others: lowercase
      let normalizedWord = word.trim();
      if (language === 'de') {
        // Capitalize first letter (German nouns), keep rest as-is
        normalizedWord = normalizedWord.charAt(0).toUpperCase() + normalizedWord.slice(1);
      } else {
        normalizedWord = normalizedWord.toLowerCase();
      }

      try {
        // Check if this exact word+sentence combo already exists (case-insensitive match)
        const existing = await api.dbQuery(
          'SELECT id FROM vocabulary WHERE LOWER(word) = LOWER(?) AND sentence = ?',
          [normalizedWord, sentence]
        );
        if (existing && existing.length > 0) {
          return; // Already saved
        }

        await api.dbRun(
          `INSERT INTO vocabulary (word, meaning, sentence, sentence_translation, source_file, language, pos) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [normalizedWord, meaning, sentence, sentenceTranslation || null, sourceFile || null, language || 'en', pos || '']
        );
        await loadVocabulary();
      } catch (e) {
        console.error('Failed to add to vocabulary:', e);
      }
    },
    [loadVocabulary]
  );

  const removeFromVocabulary = useCallback(
    async (id: number) => {
      const api = (window as any).electronAPI;
      if (!api) return;

      try {
        await api.dbRun('DELETE FROM vocabulary WHERE id = ?', [id]);
        await loadVocabulary();
        useReaderStore.getState().bumpVocabRefresh();
      } catch (e) {
        console.error('Failed to remove from vocabulary:', e);
      }
    },
    [loadVocabulary]
  );

  const removeWord = useCallback(
    async (word: string) => {
      const api = (window as any).electronAPI;
      if (!api) return;

      try {
        await api.dbRun('DELETE FROM vocabulary WHERE LOWER(word) = LOWER(?)', [word]);
        await loadVocabulary();
        useReaderStore.getState().bumpVocabRefresh();
      } catch (e) {
        console.error('Failed to remove word:', e);
      }
    },
    [loadVocabulary]
  );

  const getRandomWord = useCallback(async (): Promise<VocabularyRow | null> => {
    const api = (window as any).electronAPI;
    if (!api) return null;

    try {
      const rows = await api.dbQuery(
        'SELECT * FROM vocabulary ORDER BY RANDOM() LIMIT 1'
      );
      return rows && rows.length > 0 ? rows[0] : null;
    } catch (e) {
      console.error('Failed to get random word:', e);
      return null;
    }
  }, []);

  return { entries, rawItems, loading, loadVocabulary, addToVocabulary, removeFromVocabulary, removeWord, getRandomWord };
}
