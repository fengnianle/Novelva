import React, { useRef, useCallback, useMemo } from 'react';
import { SentenceData } from '../../lib/sentence-splitter';
import { useReaderStore } from '../../stores/reader-store';
import { analyzeSentence } from '../../hooks/use-ai-analysis';
import { WordSpan } from './WordSpan';
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

// Render text with vocab word hints inline (subtle styling for known words)
function renderTextWithVocabHints(text: string, vocabWords?: Set<string>): React.ReactNode {
  if (!vocabWords || vocabWords.size === 0) return text;
  // Split by word boundaries, check each token
  const parts = text.split(/(\b\w+\b)/);
  let hasMatch = false;
  for (const p of parts) {
    if (/^\w+$/.test(p) && vocabWords.has(p.toLowerCase())) { hasMatch = true; break; }
  }
  if (!hasMatch) return text;
  return parts.map((part, i) => {
    if (/^\w+$/.test(part) && vocabWords.has(part.toLowerCase())) {
      return <span key={i} className="font-semibold text-primary/70 dark:text-primary/60">{part}</span>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// Lightweight component for non-selected sentences — zero store subscriptions
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

  return (
    <span className="relative inline">
      <span
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={inactiveClass(isCollected, isBookmarked)}
      >
        {renderTextWithVocabHints(sentence.text, vocabWords)}
      </span>
      <span> </span>
    </span>
  );
});

// Full-featured component only mounted for the ONE selected sentence
const SelectedSentence: React.FC<SentenceProps> = ({ sentence, paragraphSentences, sentenceIndexInParagraph, isCollected, isBookmarked, onContextMenu }) => {
  const sentenceRef = useRef<HTMLSpanElement>(null);
  const setSelectedSentenceId = useReaderStore((s) => s.setSelectedSentenceId);

  const parts = useMemo(() => sentence.text.split(/(\s+)/), [sentence.text]);

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
        {parts.map((part, idx) => {
          if (/^\s+$/.test(part)) {
            return <span key={idx}>{part}</span>;
          }
          return (
            <WordSpan
              key={idx}
              word={part}
              sentence={sentence.text}
              isParentSelected={true}
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
