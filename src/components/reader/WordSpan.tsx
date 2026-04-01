import React, { useState, useRef, useCallback } from 'react';
import { WordPopover } from '../ai/WordPopover';
import { cn } from '../../lib/utils';

interface WordSpanProps {
  word: string;
  sentence: string;
  isParentSelected: boolean;
  lookupWord?: string;
}

export const WordSpan: React.FC<WordSpanProps> = ({ word, sentence, isParentSelected, lookupWord }) => {
  const [showPopover, setShowPopover] = useState(false);
  const wordRef = useRef<HTMLSpanElement>(null);

  // Clean word for lookup (remove punctuation). Use lookupWord if provided (e.g. for grouped phrasal verbs).
  const cleanWord = lookupWord || word.replace(/[^a-zA-Z'-]/g, '').toLowerCase();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isParentSelected) return;
      e.stopPropagation();
      if (!cleanWord || cleanWord.length < 2) return;
      setShowPopover((prev) => !prev);
    },
    [isParentSelected, cleanWord]
  );

  return (
    <span className="relative inline">
      <span
        ref={wordRef}
        onClick={handleClick}
        className={cn(
          'transition-colors duration-150',
          isParentSelected && cleanWord && cleanWord.length >= 2 && 'hover:text-primary hover:underline cursor-pointer'
        )}
      >
        {word}
      </span>
      {showPopover && (
        <WordPopover
          word={cleanWord}
          sentence={sentence}
          anchorRef={wordRef}
          onClose={() => setShowPopover(false)}
        />
      )}
    </span>
  );
};
