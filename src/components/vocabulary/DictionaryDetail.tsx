import React, { useEffect, useState } from 'react';
import { useSettingsStore, DEFAULT_DICTIONARY_APIS } from '../../stores/settings-store';
import { BookOpen, Volume2, Loader2, Globe } from 'lucide-react';

interface DictionaryDetailProps {
  word: string;
  language: string;
}

interface EnDictEntry {
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: Array<{
    partOfSpeech: string;
    definitions: Array<{ definition: string; example?: string; synonyms?: string[] }>;
    synonyms?: string[];
    antonyms?: string[];
  }>;
  origin?: string;
  sourceUrls?: string[];
}

interface JaDictEntry {
  slug: string;
  japanese: Array<{ word?: string; reading?: string }>;
  senses: Array<{
    english_definitions: string[];
    parts_of_speech: string[];
    tags: string[];
  }>;
}

interface DictResult {
  phonetic?: string;
  audioUrl?: string;
  meanings: Array<{
    pos: string;
    definitions: Array<{ definition: string; example?: string }>;
    synonyms?: string[];
  }>;
  origin?: string;
  extra?: string;
}

function parseEnglishResponse(data: any[]): DictResult | null {
  if (!data || data.length === 0) return null;
  const entry: EnDictEntry = data[0];

  const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text;
  const audioUrl = entry.phonetics?.find((p) => p.audio && p.audio.length > 0)?.audio;

  const meanings = (entry.meanings || []).map((m) => ({
    pos: m.partOfSpeech,
    definitions: m.definitions.slice(0, 4).map((d) => ({
      definition: d.definition,
      example: d.example,
    })),
    synonyms: [...(m.synonyms || [])].slice(0, 6),
  }));

  return { phonetic, audioUrl, meanings, origin: entry.origin };
}

function parseJapaneseResponse(data: any): DictResult | null {
  if (!data?.data || data.data.length === 0) return null;
  const entries: JaDictEntry[] = data.data.slice(0, 3);

  const meanings = entries.flatMap((entry) => {
    const reading = entry.japanese?.[0]?.reading || '';
    return entry.senses.slice(0, 3).map((s) => ({
      pos: s.parts_of_speech.join(', ') || '—',
      definitions: s.english_definitions.map((d) => ({ definition: d })),
      synonyms: [] as string[],
    }));
  });

  const mainReading = entries[0]?.japanese?.[0]?.reading;
  return { phonetic: mainReading, meanings };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// Strip wikitext markup: [[link|text]] -> text, [[text]] -> text, ''italic'' -> italic, etc.
function stripWikitext(text: string): string {
  return text
    .replace(/\{\{K\|([^}]*)\}\}/g, '($1)') // {{K|context}} -> (context)
    .replace(/\{\{[^}]*\}\}/g, '')           // remove other templates
    .replace(/\[\[[^\]]*\|([^\]]+)\]\]/g, '$1') // [[link|display]] -> display
    .replace(/\[\[([^\]]+)\]\]/g, '$1')       // [[text]] -> text
    .replace(/''+/g, '')                         // ''italic'' -> italic
    .trim();
}

// Parse MediaWiki wikitext from de.wiktionary.org
function parseDeWiktionaryWikitext(wikitext: string): DictResult | null {
  // Find German section
  const deSection = wikitext.match(/== \w+ \(\{\{Sprache\|Deutsch\}\}\) ==(.*?)(?=\n== \w|$)/s);
  const text = deSection ? deSection[1] : wikitext;

  // Extract POS and gender
  const posMatch = text.match(/\{\{Wortart\|([^|]+)\|/);
  const genderMatch = text.match(/\{\{(m|f|n)\}\}/);
  const pos = posMatch?.[1] || '';
  const genderMap: Record<string, string> = { m: 'der', f: 'die', n: 'das' };
  const gender = genderMatch ? genderMap[genderMatch[1]] || '' : '';
  const posLabel = gender ? `${pos} (${gender})` : pos;

  // Extract IPA
  const ipaMatch = text.match(/\{\{Lautschrift\|([^}]+)\}\}/);
  const phonetic = ipaMatch ? `/${ipaMatch[1]}/` : undefined;

  // Extract meanings: lines starting with :[N]
  const meaningLines = text.split('\n').filter(l => /^:\[\d+\]/.test(l));
  // Filter to only definition lines (under {{Bedeutungen}} section)
  const bedeutungenIdx = text.indexOf('{{Bedeutungen}}');
  const nextSectionIdx = text.indexOf('\n{{', bedeutungenIdx + 15);
  const bedeutungenText = bedeutungenIdx >= 0
    ? text.substring(bedeutungenIdx, nextSectionIdx >= 0 ? nextSectionIdx : undefined)
    : '';
  const defLines = bedeutungenText.split('\n').filter(l => /^:\[\d+\]/.test(l));

  if (defLines.length === 0 && meaningLines.length === 0) return null;

  const defs = (defLines.length > 0 ? defLines : meaningLines).slice(0, 5).map(line => {
    const cleaned = line.replace(/^:\[\d+\]\s*/, '');
    return { definition: stripWikitext(cleaned) };
  }).filter(d => d.definition.length > 0);

  if (defs.length === 0) return null;

  return {
    phonetic,
    meanings: [{ pos: posLabel || '—', definitions: defs, synonyms: [] }],
  };
}

// Parse MediaWiki API response (de.wiktionary.org/w/api.php?action=parse)
function parseMediaWikiResponse(data: any): DictResult | null {
  // If it has wikitext prop
  if (data.parse?.wikitext?.['*']) {
    return parseDeWiktionaryWikitext(data.parse.wikitext['*']);
  }
  // If it has HTML text prop, try to extract from HTML
  if (data.parse?.text?.['*']) {
    // For HTML: basic extraction of list items from the page
    const html = data.parse.text['*'] as string;
    const stripped = stripHtml(html);
    if (stripped.length > 10) {
      // Very basic: return the first chunk as a single definition
      return {
        meanings: [{ pos: '—', definitions: [{ definition: stripped.substring(0, 200) }], synonyms: [] }],
      };
    }
  }
  return null;
}

function parseWiktionaryResponse(data: any, langCode: string): DictResult | null {
  // Wiktionary REST API returns { en: [...], de: [...], ja: [...], ... }
  const langEntries = data[langCode];
  if (!langEntries || langEntries.length === 0) return null;

  const meanings: DictResult['meanings'] = [];
  for (const entry of langEntries) {
    if (!entry.definitions || entry.definitions.length === 0) continue;
    const defs = entry.definitions.slice(0, 5).map((d: any) => {
      const def = stripHtml(d.definition || '');
      const example = d.parsedExamples?.[0]?.example ? stripHtml(d.parsedExamples[0].example) : undefined;
      return { definition: def, example };
    }).filter((d: any) => d.definition);

    if (defs.length > 0) {
      meanings.push({
        pos: entry.partOfSpeech || '—',
        definitions: defs,
        synonyms: [],
      });
    }
  }

  if (meanings.length === 0) return null;
  return { meanings };
}

async function tryFetchUrl(url: string): Promise<any | null> {
  try {
    // Use IPC proxy to fetch through main process (avoids CORS)
    const api = (window as any).electronAPI;
    if (api?.dictFetch) {
      return await api.dictFetch(url);
    }
    // Fallback to direct fetch
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// Strip German articles (der/die/das/ein/eine/einen/einem/einer/eines) from word
function stripGermanArticle(word: string): string {
  return word.replace(/^(der|die|das|ein|eine|einen|einem|einer|eines)\s+/i, '');
}

async function fetchDictionary(word: string, language: string, apiUrl: string): Promise<DictResult | null> {
  const isWiktionaryRest = apiUrl.includes('wiktionary.org/api/rest_v1/page/definition/');
  const isMediaWiki = apiUrl.includes('wiktionary.org/w/api.php');
  const isWiktionary = isWiktionaryRest || isMediaWiki;

  if (isWiktionary) {
    // Strip article if present (German nouns stored as "der Hund")
    const baseWord = (language === 'de') ? stripGermanArticle(word) : word;

    const variants = new Set<string>();
    variants.add(baseWord);
    variants.add(baseWord.charAt(0).toUpperCase() + baseWord.slice(1)); // Capitalized (German nouns)
    variants.add(baseWord.toLowerCase());
    if (baseWord !== word) variants.add(word);

    for (const variant of variants) {
      let url: string;
      if (isMediaWiki) {
        // For MediaWiki API: inject &prop=wikitext for better parsing
        const baseUrl = apiUrl.replace('{word}', encodeURIComponent(variant));
        url = baseUrl.includes('prop=') ? baseUrl : baseUrl + '&prop=wikitext';
      } else {
        url = apiUrl.replace('{word}', encodeURIComponent(variant));
      }
      const data = await tryFetchUrl(url);
      if (data) {
        // Detect response format and parse accordingly
        let result: DictResult | null = null;
        if (data.parse) {
          // MediaWiki API response
          result = parseMediaWikiResponse(data);
        } else {
          // REST API response
          result = parseWiktionaryResponse(data, language);
        }
        if (result) return result;
      }
    }
    return null;
  }

  // Non-Wiktionary APIs: strip article for German, lowercase for others
  let lookupWord = word.toLowerCase();
  if (language === 'de') {
    lookupWord = stripGermanArticle(lookupWord);
  }
  const url = apiUrl.replace('{word}', encodeURIComponent(lookupWord));
  const data = await tryFetchUrl(url);
  if (!data) return null;

  if (language === 'en') return parseEnglishResponse(data);
  if (language === 'ja') return parseJapaneseResponse(data);

  // For other APIs, try to return raw JSON as a generic result
  if (Array.isArray(data) && data.length > 0) return parseEnglishResponse(data);
  return null;
}

export const DictionaryDetail: React.FC<DictionaryDetailProps> = ({ word, language }) => {
  const { dictionaryApis } = useSettingsStore();
  const [result, setResult] = useState<DictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const apiUrl = dictionaryApis[language] || DEFAULT_DICTIONARY_APIS[language];

  useEffect(() => {
    if (!apiUrl) {
      setError(null);
      setResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);

    fetchDictionary(word, language, apiUrl).then((res) => {
      if (cancelled) return;
      if (res) {
        setResult(res);
      } else {
        setError('词典中未找到该词');
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setError('词典查询失败');
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [word, language, apiUrl]);

  const playAudio = () => {
    if (!result?.audioUrl || audioPlaying) return;
    setAudioPlaying(true);
    const audio = new Audio(result.audioUrl);
    audio.onended = () => setAudioPlaying(false);
    audio.onerror = () => setAudioPlaying(false);
    audio.play().catch(() => setAudioPlaying(false));
  };

  if (!apiUrl) {
    return (
      <div className="text-xs text-muted-foreground/60 flex items-center gap-1.5 py-2">
        <Globe size={12} />
        该语言暂无词典 API，可在设置中配置
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-xs">正在查询词典...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-muted-foreground/60 py-2">{error}</div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen size={14} className="text-primary shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">词典详情</span>
      </div>

      {/* Phonetic & Audio */}
      {(result.phonetic || result.audioUrl) && (
        <div className="flex items-center gap-2">
          {result.phonetic && (
            <span className="text-sm text-muted-foreground font-mono">{result.phonetic}</span>
          )}
          {result.audioUrl && (
            <button
              onClick={playAudio}
              disabled={audioPlaying}
              className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors disabled:opacity-50"
              title="播放发音"
            >
              <Volume2 size={12} />
            </button>
          )}
        </div>
      )}

      {/* Meanings */}
      {result.meanings.map((m, mIdx) => (
        <div key={mIdx}>
          <div className="text-xs font-semibold text-primary mb-1">{m.pos}</div>
          <div className="space-y-1.5 ml-2">
            {m.definitions.map((d, dIdx) => (
              <div key={dIdx}>
                <div className="text-sm">{dIdx + 1}. {d.definition}</div>
                {d.example && (
                  <div className="text-xs text-muted-foreground italic ml-3 mt-0.5">"{d.example}"</div>
                )}
              </div>
            ))}
          </div>
          {m.synonyms && m.synonyms.length > 0 && (
            <div className="mt-1.5 ml-2">
              <span className="text-xs text-muted-foreground">近义词: </span>
              <span className="text-xs text-primary">{m.synonyms.join(', ')}</span>
            </div>
          )}
        </div>
      ))}

      {/* Origin / Etymology */}
      {result.origin && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-0.5">词源</div>
          <div className="text-xs text-muted-foreground leading-relaxed">{result.origin}</div>
        </div>
      )}
    </div>
  );
};
