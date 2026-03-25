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
}

// Thin wrapper that only subscribes to whether THIS sentence is selected
export const Sentence: React.FC<SentenceProps> = React.memo(({
  sentence,
  paragraphSentences,
  sentenceIndexInParagraph,
}) => {
  const isSelected = useReaderStore((s) => s.selectedSentenceId === sentence.id);

  if (isSelected) {
    return (
      <SelectedSentence
        sentence={sentence}
        paragraphSentences={paragraphSentences}
        sentenceIndexInParagraph={sentenceIndexInParagraph}
      />
    );
  }

  return (
    <InactiveSentence
      sentence={sentence}
      paragraphSentences={paragraphSentences}
      sentenceIndexInParagraph={sentenceIndexInParagraph}
    />
  );
});

// Lightweight component for non-selected sentences — zero store subscriptions
const InactiveSentence: React.FC<SentenceProps> = React.memo(({
  sentence,
  paragraphSentences,
  sentenceIndexInParagraph,
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

  return (
    <span className="relative inline">
      <span
        onClick={handleClick}
        className="cursor-pointer rounded-sm transition-colors duration-200 py-0.5 hover:bg-accent/50"
      >
        {sentence.text}
      </span>
      <span> </span>
    </span>
  );
});

// Full-featured component only mounted for the ONE selected sentence
const SelectedSentence: React.FC<SentenceProps> = ({ sentence, paragraphSentences, sentenceIndexInParagraph }) => {
  const sentenceRef = useRef<HTMLSpanElement>(null);
  const setSelectedSentenceId = useReaderStore((s) => s.setSelectedSentenceId);

  const parts = useMemo(() => sentence.text.split(/(\s+)/), [sentence.text]);

  const handleClose = useCallback(() => setSelectedSentenceId(null), [setSelectedSentenceId]);

  const prev = sentenceIndexInParagraph > 0
    ? paragraphSentences[sentenceIndexInParagraph - 1].text
    : undefined;
  const next = sentenceIndexInParagraph < paragraphSentences.length - 1
    ? paragraphSentences[sentenceIndexInParagraph + 1].text
    : undefined;

  return (
    <span className="relative inline">
      <span
        ref={sentenceRef}
        onClick={handleClose}
        className="cursor-pointer rounded-sm transition-colors duration-200 py-0.5 bg-primary/15 text-foreground"
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
