import React, { useRef, useState, useEffect } from 'react';
import { ParagraphData } from '../../lib/sentence-splitter';
import { Sentence } from './Sentence';

// Shared IntersectionObserver — one observer for ALL paragraphs
let sharedObserver: IntersectionObserver | null = null;
const callbacks = new Map<Element, (visible: boolean) => void>();

// Call this when book changes to free the old observer and all stale callbacks
export function resetSharedObserver(): void {
  if (sharedObserver) {
    sharedObserver.disconnect();
    sharedObserver = null;
  }
  callbacks.clear();
}

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cb = callbacks.get(entry.target);
          if (cb && entry.isIntersecting) {
            cb(true);
            // Once activated, stop observing — paragraph stays rendered forever
            sharedObserver!.unobserve(entry.target);
            callbacks.delete(entry.target);
          }
        }
      },
      { rootMargin: '600px 0px' }
    );
  }
  return sharedObserver;
}

interface ParagraphProps {
  paragraph: ParagraphData;
}

export const Paragraph: React.FC<ParagraphProps> = React.memo(({ paragraph }) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || activated) return;

    const observer = getSharedObserver();
    callbacks.set(el, () => setActivated(true));
    observer.observe(el);

    return () => {
      observer.unobserve(el);
      callbacks.delete(el);
    };
  }, [activated]);

  return (
    <p ref={ref} className="mb-4">
      {activated ? (
        paragraph.sentences.map((sentence, idx) => (
          <Sentence
            key={sentence.id}
            sentence={sentence}
            paragraphSentences={paragraph.sentences}
            sentenceIndexInParagraph={idx}
          />
        ))
      ) : (
        paragraph.text
      )}
    </p>
  );
});
