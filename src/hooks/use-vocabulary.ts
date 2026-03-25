import { useState, useCallback } from 'react';

export interface VocabularyRow {
  id: number;
  word: string;
  meaning: string;
  sentence: string;
  sentence_translation: string | null;
  source_file: string | null;
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
  sentences: VocabSentence[];
}

export interface VocabularyEntry {
  word: string;
  meanings: VocabMeaning[];
  latestDate: string;
  ids: number[];
}

function groupByWord(rows: VocabularyRow[]): VocabularyEntry[] {
  const map = new Map<string, VocabularyEntry>();

  for (const row of rows) {
    const key = row.word.toLowerCase();
    let entry = map.get(key);
    if (!entry) {
      entry = { word: key, meanings: [], latestDate: row.created_at, ids: [] };
      map.set(key, entry);
    }

    entry.ids.push(row.id);
    if (row.created_at > entry.latestDate) entry.latestDate = row.created_at;

    // Find or create meaning group
    let meaningGroup = entry.meanings.find((m) => m.meaning === row.meaning);
    if (!meaningGroup) {
      meaningGroup = { meaning: row.meaning, sentences: [] };
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
      sourceFile?: string
    ) => {
      const api = (window as any).electronAPI;
      if (!api) return;

      const normalizedWord = word.toLowerCase().trim();

      try {
        // Check if this exact word+sentence combo already exists
        const existing = await api.dbQuery(
          'SELECT id FROM vocabulary WHERE word = ? AND sentence = ?',
          [normalizedWord, sentence]
        );
        if (existing && existing.length > 0) {
          return; // Already saved
        }

        await api.dbRun(
          `INSERT INTO vocabulary (word, meaning, sentence, sentence_translation, source_file) 
           VALUES (?, ?, ?, ?, ?)`,
          [normalizedWord, meaning, sentence, sentenceTranslation || null, sourceFile || null]
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
        await api.dbRun('DELETE FROM vocabulary WHERE word = ?', [word.toLowerCase()]);
        await loadVocabulary();
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
