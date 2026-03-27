import React from 'react';
import { ParagraphData } from '../../lib/sentence-splitter';
import { Sentence } from './Sentence';

// Kept as no-op for callers that still reference it
export function resetSharedObserver(): void {}

interface ParagraphProps {
  paragraph: ParagraphData;
}

export const Paragraph: React.FC<ParagraphProps> = React.memo(({ paragraph }) => {
  return (
    <p className="mb-4">
      {paragraph.sentences.map((sentence, idx) => (
        <Sentence
          key={sentence.id}
          sentence={sentence}
          paragraphSentences={paragraph.sentences}
          sentenceIndexInParagraph={idx}
        />
      ))}
    </p>
  );
});
