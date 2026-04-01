import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { SentenceData } from '../../lib/sentence-splitter';
import { useReaderStore } from '../../stores/reader-store';
import { useAiStore, SentenceAnalysis } from '../../stores/ai-store';
import { analyzeSentence } from '../../hooks/use-ai-analysis';
import { WordSpan } from './WordSpan';
import { WordPopover } from '../ai/WordPopover';
import { SentencePopover } from '../ai/SentencePopover';

interface SentenceProps {
  sentence: SentenceData;
  paragraphSentences: SentenceData[];
  sentenceIndexInParagraph: number;
  isCollected?: boolean;
  vocabWords?: Set<string>;
  isBookmarked?: boolean;
  onContextMenu?: (e: React.MouseEvent, sentenceId: string) => void;
}

// Thin wrapper that only subscribes to whether THIS sentence is selected
export const Sentence: React.FC<SentenceProps> = React.memo(({
  sentence,
  paragraphSentences,
  sentenceIndexInParagraph,
  isCollected,
  vocabWords,
  isBookmarked,
  onContextMenu,
}) => {
  const isSelected = useReaderStore((s) => s.selectedSentenceId === sentence.id);

  if (isSelected) {
    return (
      <SelectedSentence
        sentence={sentence}
        paragraphSentences={paragraphSentences}
        sentenceIndexInParagraph={sentenceIndexInParagraph}
        isCollected={isCollected}
        vocabWords={vocabWords}
        isBookmarked={isBookmarked}
        onContextMenu={onContextMenu}
      />
    );
  }

  return (
    <InactiveSentence
      sentence={sentence}
      paragraphSentences={paragraphSentences}
      sentenceIndexInParagraph={sentenceIndexInParagraph}
      isCollected={isCollected}
      vocabWords={vocabWords}
      isBookmarked={isBookmarked}
      onContextMenu={onContextMenu}
    />
  );
});

// Build class for inactive sentence based on collected/bookmark state
function inactiveClass(isCollected?: boolean, isBookmarked?: boolean): string {
  let cls = 'cursor-pointer rounded-sm transition-colors duration-200 py-0.5 hover:bg-accent/50';
  if (isBookmarked) {
    cls += ' bg-yellow-200/30 dark:bg-yellow-500/15 border-b-2 border-yellow-400/60';
  } else if (isCollected) {
    cls += ' border-b border-dashed border-muted-foreground/25';
  }
  return cls;
}

// HoverWordWrapper: after 1s hover the word becomes clickable (activated).
// Clicking an activated word opens a read-only WordPopover for instant translation.
// Popover stays open until user explicitly closes it.
interface HoverWordWrapperProps {
  word: string;
  sentence: string;
  isVocab?: boolean;
  onPopoverChange?: (open: boolean) => void;
  lookupWord?: string;
}
const HoverWordWrapper: React.FC<HoverWordWrapperProps> = React.memo(({ word, sentence, isVocab, onPopoverChange, lookupWord }) => {
  const [activated, setActivated] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const cleanWord = lookupWord || word.replace(/[^a-zA-Z\u00C0-\u024F\u0400-\u04FF' -]/g, '').trim().toLowerCase();
  const canHover = cleanWord.replace(/\s+/g, '').length >= 2;

  const handleMouseEnter = useCallback(() => {
    if (!canHover || activated) return;
    timerRef.current = setTimeout(() => setActivated(true), 1000);
  }, [canHover, activated]);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    // Only deactivate if popover is NOT showing
    if (!showPopover) setActivated(false);
  }, [showPopover]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!activated) return;
    e.stopPropagation();
    setShowPopover((prev) => {
      const next = !prev;
      onPopoverChange?.(next);
      return next;
    });
  }, [activated, onPopoverChange]);

  const handleClosePopover = useCallback(() => {
    setShowPopover(false);
    setActivated(false);
    onPopoverChange?.(false);
  }, [onPopoverChange]);

  return (
    <span className="relative inline">
      <span
        ref={spanRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={
          activated
            ? 'text-primary underline cursor-pointer'
            : isVocab
              ? 'font-semibold text-primary/70 dark:text-primary/60'
              : undefined
        }
      >
        {word}
      </span>
      {showPopover && (
        <WordPopover
          word={cleanWord}
          sentence={sentence}
          anchorRef={spanRef}
          onClose={handleClosePopover}
        />
      )}
    </span>
  );
});

// Build a regex that splits text into tokens, matching multi-word vocab entries first,
// then single words. This supports phrasal verbs ("look up") and compound entries.
// Cached at module level to avoid rebuilding per sentence.
let _cachedVocabSet: Set<string> | null = null;
let _cachedVocabPattern: string | null = null;
function getVocabSplitRegex(vocabWords: Set<string>): RegExp {
  if (_cachedVocabSet !== vocabWords || !_cachedVocabPattern) {
    // Separate multi-word and single-word entries
    const multiWord: string[] = [];
    for (const w of vocabWords) {
      if (w.includes(' ')) multiWord.push(w);
    }
    // Sort multi-word by length descending so longer phrases match first
    multiWord.sort((a, b) => b.length - a.length);
    // Build regex parts: multi-word phrases (with flexible whitespace), then single words
    const parts: string[] = [];
    for (const phrase of multiWord) {
      // Escape regex chars, allow flexible whitespace between words
      const escaped = phrase.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
      parts.push(`\\b${escaped}\\b`);
    }
    parts.push('\\b\\w+\\b');
    _cachedVocabPattern = `(${parts.join('|')})`;
    _cachedVocabSet = vocabWords;
  }
  // Return a new RegExp each time to avoid lastIndex issues with global flag
  return new RegExp(_cachedVocabPattern, 'gi');
}

// Lightweight text renderer for INACTIVE sentences — plain spans, no state/timers.
// Only highlights vocab words with CSS; hover interaction is reserved for SelectedSentence.
function renderTextWithHighlights(text: string, vocabWords?: Set<string>): React.ReactNode {
  if (!vocabWords || vocabWords.size === 0) return text;
  const regex = getVocabSplitRegex(vocabWords);
  const parts = text.split(regex);
  let hasVocab = false;
  for (const p of parts) {
    if (p && vocabWords.has(p.toLowerCase())) { hasVocab = true; break; }
  }
  if (!hasVocab) return text;
  return parts.map((part, i) => {
    if (part && vocabWords.has(part.toLowerCase())) {
      return <span key={i} className="font-semibold text-primary/70 dark:text-primary/60">{part}</span>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// Render text with hover-word support — supports grouped tokens from buildGroupedTokens
function renderTextWithHoverWords(
  text: string,
  sentence: string,
  vocabWords?: Set<string>,
  onPopoverChange?: (open: boolean) => void,
  cachedAnalysis?: SentenceAnalysis | null
): React.ReactNode {
  const tokens = buildGroupedTokens(text, cachedAnalysis);
  return tokens.map((token, i) => {
    if (!token.isWord) return <React.Fragment key={i}>{token.display}</React.Fragment>;
    const isVocab = vocabWords ? vocabWords.has(token.lookup.toLowerCase()) : false;
    return (
      <HoverWordWrapper
        key={i}
        word={token.display}
        sentence={sentence}
        isVocab={isVocab}
        onPopoverChange={onPopoverChange}
        lookupWord={token.lookup !== token.display.replace(/[^a-zA-Z\u00C0-\u024F\u0400-\u04FF' -]/g, '').trim().toLowerCase() ? token.lookup : undefined}
      />
    );
  });
}

// Load cached analysis from sentence_cache DB
async function loadCachedAnalysis(sentenceText: string): Promise<SentenceAnalysis | null> {
  try {
    const api = (window as any).electronAPI;
    if (!api) return null;
    const rows = await api.dbQuery(
      'SELECT translation, key_expressions, word_analyses, language, grammar_points FROM sentence_cache WHERE sentence_text = ? LIMIT 1',
      [sentenceText]
    );
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return {
      translation: row.translation || '',
      key_expressions: row.key_expressions ? JSON.parse(row.key_expressions) : [],
      words: row.word_analyses ? JSON.parse(row.word_analyses) : [],
      language: row.language,
      grammar_points: row.grammar_points ? JSON.parse(row.grammar_points) : [],
    };
  } catch (_) { return null; }
}

// Lightweight component for non-selected sentences — zero store subscriptions.
// Mounts HoverWordWrapper immediately on hover (no sentence-level delay).
// The 1s delay is handled per-word inside HoverWordWrapper.
const InactiveSentence: React.FC<SentenceProps> = React.memo(({
  sentence,
  paragraphSentences,
  sentenceIndexInParagraph,
  isCollected,
  vocabWords,
  isBookmarked,
  onContextMenu,
}) => {
  const setSelectedSentenceId = useReaderStore((s) => s.setSelectedSentenceId);
  const [hoverActive, setHoverActive] = useState(false);
  const [cachedAnalysis, setCachedAnalysis] = useState<SentenceAnalysis | null>(null);
  const openPopoverCount = useRef(0);

  // Load cached analysis once on first hover
  useEffect(() => {
    if (!hoverActive || cachedAnalysis) return;
    loadCachedAnalysis(sentence.text).then(a => { if (a) setCachedAnalysis(a); });
  }, [hoverActive, sentence.text, cachedAnalysis]);

  const handleClick = useCallback(() => {
    setSelectedSentenceId(sentence.id);

    const prev = sentenceIndexInParagraph > 0
      ? paragraphSentences[sentenceIndexInParagraph - 1].text
      : undefined;
    const next = sentenceIndexInParagraph < paragraphSentences.length - 1
      ? paragraphSentences[sentenceIndexInParagraph + 1].text
      : undefined;

    analyzeSentence(sentence.id, sentence.text, prev, next);
  }, [sentence, sentenceIndexInParagraph, paragraphSentences, setSelectedSentenceId]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, sentence.id);
    }
  }, [onContextMenu, sentence.id]);

  const handleSentenceMouseEnter = useCallback(() => {
    setHoverActive(true);
  }, []);

  const handleSentenceMouseLeave = useCallback(() => {
    // Keep HoverWordWrappers mounted if a popover is open
    if (openPopoverCount.current > 0) return;
    setHoverActive(false);
  }, []);

  const handlePopoverChange = useCallback((open: boolean) => {
    openPopoverCount.current += open ? 1 : -1;
    // When all popovers close and mouse is not over the sentence, deactivate
    if (openPopoverCount.current <= 0) {
      openPopoverCount.current = 0;
      setHoverActive(false);
    }
  }, []);

  return (
    <span className="relative inline">
      <span
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleSentenceMouseEnter}
        onMouseLeave={handleSentenceMouseLeave}
        className={inactiveClass(isCollected, isBookmarked)}
      >
        {hoverActive
          ? renderTextWithHoverWords(sentence.text, sentence.text, vocabWords, handlePopoverChange, cachedAnalysis)
          : renderTextWithHighlights(sentence.text, vocabWords)}
      </span>
      <span> </span>
    </span>
  );
});

// Build grouped tokens from sentence text using analysis data.
// Groups multi-word expressions (phrasal verbs, separable verbs, key expressions like "as well as")
// into single units so they render and click as one WordSpan.
// A multi-word pattern to search for in the sentence tokens
interface MultiWordPattern {
  // Parts to match against individual word tokens (e.g. ["as","well","as"])
  parts: string[];
  // The lookup string to pass to WordPopover (lemma or expression)
  lookup: string;
}

function collectMultiWordPatterns(analysis: SentenceAnalysis): MultiWordPattern[] {
  const patterns: MultiWordPattern[] = [];
  const seen = new Set<string>();

  const addPattern = (raw: string, lookup: string) => {
    // Split by "..." (separable verbs) or whitespace
    const parts = raw.split(/\.{2,}|\s+/).filter(Boolean);
    if (parts.length < 2) return;
    const key = parts.map(p => p.toLowerCase()).join('|');
    if (seen.has(key)) return;
    seen.add(key);
    patterns.push({ parts, lookup });
  };

  // From words: try surface first, fall back to word field
  if (analysis.words) {
    for (const w of analysis.words) {
      if (w.surface) addPattern(w.surface, w.word);
      // Also try the word (lemma) itself — e.g. "as well as" where surface equals word
      if (w.word) addPattern(w.word, w.word);
    }
  }
  // From key_expressions: group expressions like "as well as", "not only...but also"
  if (analysis.key_expressions) {
    for (const ke of analysis.key_expressions) {
      if (ke.expression) addPattern(ke.expression, ke.expression);
    }
  }
  // Sort by number of parts descending so longer patterns match first
  patterns.sort((a, b) => b.parts.length - a.parts.length);
  return patterns;
}

function buildGroupedTokens(text: string, analysis?: SentenceAnalysis | null): Array<{ display: string; lookup: string; isWord: boolean }> {
  const tokens = text.split(/(\s+)/);
  const patterns = analysis ? collectMultiWordPatterns(analysis) : [];

  if (patterns.length === 0) {
    return tokens.map(t => ({
      display: t,
      lookup: t.replace(/[^a-zA-Z\u00C0-\u024F\u0400-\u04FF'-]/g, '').toLowerCase(),
      isWord: !/^\s*$/.test(t),
    }));
  }

  // Build word-token index mapping
  const wordTokens: string[] = [];
  const wordTokenIndices: number[] = [];
  tokens.forEach((t, i) => {
    if (!/^\s+$/.test(t)) {
      wordTokens.push(t);
      wordTokenIndices.push(i);
    }
  });

  // Map from token index -> { groupId, lookup }
  const tokenGroupMap = new Map<number, { groupId: number; lookup: string }>();
  let groupCounter = 0;

  for (const pattern of patterns) {
    // Try to find the pattern's parts in order among word tokens
    let searchFrom = 0;
    const matchedWordIndices: number[] = [];
    let allFound = true;
    for (const sp of pattern.parts) {
      let found = false;
      for (let wi = searchFrom; wi < wordTokens.length; wi++) {
        // Skip tokens already claimed by a previous (longer) pattern
        if (tokenGroupMap.has(wordTokenIndices[wi])) continue;
        const clean = wordTokens[wi].replace(/[^a-zA-Z\u00C0-\u024F\u0400-\u04FF'-]/g, '').toLowerCase();
        if (clean === sp.toLowerCase()) {
          matchedWordIndices.push(wi);
          searchFrom = wi + 1;
          found = true;
          break;
        }
      }
      if (!found) { allFound = false; break; }
    }
    if (allFound && matchedWordIndices.length === pattern.parts.length) {
      const gid = groupCounter++;
      for (const wi of matchedWordIndices) {
        tokenGroupMap.set(wordTokenIndices[wi], { groupId: gid, lookup: pattern.lookup });
      }
    }
  }

  // Build output: for each group, check if matched parts are adjacent (phrasal verbs)
  // or separated (separable verbs). Adjacent parts merge into one display token;
  // separated parts each become their own token with the shared lookup,
  // while tokens in between are emitted independently.
  const result: Array<{ display: string; lookup: string; isWord: boolean }> = [];
  const processedGroups = new Set<number>();
  // Pre-compute: for each group, find its sorted matched token indices
  const groupIndicesMap = new Map<number, number[]>();
  for (const [idx, g] of tokenGroupMap.entries()) {
    if (!groupIndicesMap.has(g.groupId)) groupIndicesMap.set(g.groupId, []);
    groupIndicesMap.get(g.groupId)!.push(idx);
  }
  for (const indices of groupIndicesMap.values()) indices.sort((a, b) => a - b);

  for (let i = 0; i < tokens.length; i++) {
    const group = tokenGroupMap.get(i);
    if (group && !processedGroups.has(group.groupId)) {
      processedGroups.add(group.groupId);
      const indices = groupIndicesMap.get(group.groupId)!;
      // Check if all parts are adjacent (consecutive token indices with only whitespace between)
      let allAdjacent = true;
      for (let k = 0; k < indices.length - 1; k++) {
        const gap = indices[k + 1] - indices[k];
        // Adjacent means next index or next index +1 (with one whitespace token between)
        if (gap > 2) { allAdjacent = false; break; }
        // Check tokens between are only whitespace
        for (let g = indices[k] + 1; g < indices[k + 1]; g++) {
          if (!/^\s+$/.test(tokens[g])) { allAdjacent = false; break; }
        }
        if (!allAdjacent) break;
      }

      if (allAdjacent) {
        // Merge adjacent parts (e.g. "looked up", "as well as") into one display token
        const minIdx = indices[0];
        const maxIdx = indices[indices.length - 1];
        const display = tokens.slice(minIdx, maxIdx + 1).join('');
        result.push({ display, lookup: group.lookup, isWord: true });
        i = maxIdx;
      } else {
        // Separated parts (e.g. "fängt...an"): emit first matched part now,
        // remaining matched parts will be emitted when their index is reached
        result.push({ display: tokens[i], lookup: group.lookup, isWord: true });
      }
    } else if (group && processedGroups.has(group.groupId)) {
      const indices = groupIndicesMap.get(group.groupId)!;
      // Check adjacency again — if adjacent, this token was already merged (skip it)
      let allAdjacent = true;
      for (let k = 0; k < indices.length - 1; k++) {
        const gap = indices[k + 1] - indices[k];
        if (gap > 2) { allAdjacent = false; break; }
        for (let g = indices[k] + 1; g < indices[k + 1]; g++) {
          if (!/^\s+$/.test(tokens[g])) { allAdjacent = false; break; }
        }
        if (!allAdjacent) break;
      }
      if (!allAdjacent) {
        // This is a separated part — emit it with the shared lookup
        result.push({ display: tokens[i], lookup: group.lookup, isWord: true });
      }
      // If adjacent, it was already merged above — skip
    } else {
      result.push({
        display: tokens[i],
        lookup: tokens[i].replace(/[^a-zA-Z\u00C0-\u024F\u0400-\u04FF'-]/g, '').toLowerCase(),
        isWord: !/^\s+$/.test(tokens[i]),
      });
    }
  }
  return result;
}

// Full-featured component only mounted for the ONE selected sentence
const SelectedSentence: React.FC<SentenceProps> = ({ sentence, paragraphSentences, sentenceIndexInParagraph, isCollected, isBookmarked, onContextMenu }) => {
  const sentenceRef = useRef<HTMLSpanElement>(null);
  const setSelectedSentenceId = useReaderStore((s) => s.setSelectedSentenceId);
  const currentAnalysis = useAiStore((s) => s.currentAnalysis);

  const groupedTokens = useMemo(
    () => buildGroupedTokens(sentence.text, currentAnalysis),
    [sentence.text, currentAnalysis]
  );

  const handleClose = useCallback(() => setSelectedSentenceId(null), [setSelectedSentenceId]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, sentence.id);
    }
  }, [onContextMenu, sentence.id]);

  const prev = sentenceIndexInParagraph > 0
    ? paragraphSentences[sentenceIndexInParagraph - 1].text
    : undefined;
  const next = sentenceIndexInParagraph < paragraphSentences.length - 1
    ? paragraphSentences[sentenceIndexInParagraph + 1].text
    : undefined;

  let selectedClass = 'cursor-pointer rounded-sm transition-colors duration-200 py-0.5 bg-primary/15 text-foreground';
  if (isBookmarked) {
    selectedClass += ' border-b-2 border-yellow-400/60';
  }

  return (
    <span className="relative inline">
      <span
        ref={sentenceRef}
        onClick={handleClose}
        onContextMenu={handleContextMenu}
        className={selectedClass}
      >
        {groupedTokens.map((token, idx) => {
          if (!token.isWord) {
            return <span key={idx}>{token.display}</span>;
          }
          return (
            <WordSpan
              key={idx}
              word={token.display}
              sentence={sentence.text}
              isParentSelected={true}
              lookupWord={token.lookup}
            />
          );
        })}
      </span>
      <SentencePopover
        anchorRef={sentenceRef}
        sentence={sentence}
        prevSentence={prev}
        nextSentence={next}
        onClose={handleClose}
      />
      <span> </span>
    </span>
  );
};
