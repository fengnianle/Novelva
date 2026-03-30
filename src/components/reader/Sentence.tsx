import React, { useRef, useCallback, useMemo, useState } from 'react';
import { SentenceData } from '../../lib/sentence-splitter';
import { useReaderStore } from '../../stores/reader-store';
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

// HoverWordWrapper: after 1.5s hover the word becomes clickable (activated).
// Clicking an activated word opens WordPopover for individual word translation.
// Popover stays open until user explicitly closes it.
interface HoverWordWrapperProps {
  word: string;
  sentence: string;
  isVocab?: boolean;
  onPopoverChange?: (open: boolean) => void;
}
const HoverWordWrapper: React.FC<HoverWordWrapperProps> = React.memo(({ word, sentence, isVocab, onPopoverChange }) => {
  const [activated, setActivated] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const cleanWord = word.replace(/[^a-zA-Z\u00C0-\u024F\u0400-\u04FF'-]/g, '').toLowerCase();
  const canHover = cleanWord.length >= 2;

  const handleMouseEnter = useCallback(() => {
    if (!canHover || activated) return;
    timerRef.current = setTimeout(() => setActivated(true), 1500);
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

// Lightweight text renderer for INACTIVE sentences — plain spans, no state/timers.
// Only highlights vocab words with CSS; hover interaction is reserved for SelectedSentence.
function renderTextWithHighlights(text: string, vocabWords?: Set<string>): React.ReactNode {
  if (!vocabWords || vocabWords.size === 0) return text;
  const parts = text.split(/(\b\w+\b)/);
  let hasVocab = false;
  for (let i = 0; i < parts.length; i++) {
    if (/^\w+$/.test(parts[i]) && vocabWords.has(parts[i].toLowerCase())) { hasVocab = true; break; }
  }
  if (!hasVocab) return text;
  return parts.map((part, i) => {
    if (/^\w+$/.test(part) && vocabWords.has(part.toLowerCase())) {
      return <span key={i} className="font-semibold text-primary/70 dark:text-primary/60">{part}</span>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// Render text with hover-word support — only used after lazy activation
function renderTextWithHoverWords(text: string, sentence: string, vocabWords?: Set<string>, onPopoverChange?: (open: boolean) => void): React.ReactNode {
  const parts = text.split(/(\b\w+\b)/);
  return parts.map((part, i) => {
    if (/^\w+$/.test(part)) {
      const isVocab = vocabWords ? vocabWords.has(part.toLowerCase()) : false;
      return <HoverWordWrapper key={i} word={part} sentence={sentence} isVocab={isVocab} onPopoverChange={onPopoverChange} />;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// Lightweight component for non-selected sentences — zero store subscriptions.
// Mounts HoverWordWrapper immediately on hover (no sentence-level delay).
// The 1.5s delay is handled per-word inside HoverWordWrapper.
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
  const openPopoverCount = useRef(0);

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
          ? renderTextWithHoverWords(sentence.text, sentence.text, vocabWords, handlePopoverChange)
          : renderTextWithHighlights(sentence.text, vocabWords)}
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
