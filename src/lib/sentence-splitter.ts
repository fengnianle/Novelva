export interface SentenceData {
  id: string;
  text: string;
  index: number;
  words: string[];
}

export interface ParagraphData {
  id: string;
  text: string;
  sentences: SentenceData[];
}

export function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Split on sentence-ending punctuation followed by space and capital letter
  // Handles: Mr. Mrs. Dr. etc. abbreviations, ellipsis, quotes
  const raw: string[] = [];
  let current = '';

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    current += ch;

    // Check if this is a sentence boundary
    if ((ch === '.' || ch === '!' || ch === '?') && i < trimmed.length - 1) {
      // Handle closing quotes/brackets after punctuation
      let endIdx = i + 1;
      while (endIdx < trimmed.length && /['")\]]/.test(trimmed[endIdx])) {
        current += trimmed[endIdx];
        endIdx++;
      }

      // Skip common abbreviations
      const lastWord = current.match(/(\w+)\.\s*$/);
      const abbrevs = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'vs', 'etc', 'i.e', 'e.g', 'St', 'Vol', 'No'];
      if (lastWord && abbrevs.includes(lastWord[1])) {
        i = endIdx - 1;
        continue;
      }

      // Check if next non-space char is uppercase (sentence start)
      let nextIdx = endIdx;
      while (nextIdx < trimmed.length && /\s/.test(trimmed[nextIdx])) nextIdx++;

      if (nextIdx < trimmed.length && /[A-Z"'\u201C\u201D]/.test(trimmed[nextIdx])) {
        raw.push(current.trim());
        current = '';
        i = endIdx - 1;
      } else {
        i = endIdx - 1;
      }
    }
  }

  if (current.trim()) {
    raw.push(current.trim());
  }

  // Merge very short fragments (< 15 chars) into adjacent sentences
  const merged: string[] = [];
  for (const s of raw) {
    if (s.length < 15 && merged.length > 0) {
      merged[merged.length - 1] += ' ' + s;
    } else {
      merged.push(s);
    }
  }

  return merged.filter((s) => s.trim().length > 0);
}

export function splitIntoWords(sentence: string): string[] {
  return sentence
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

export function splitIntoParagraphs(content: string): string[] {
  const normalized = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = normalized.split('\n');
  const paragraphs: string[] = [];
  let current: string[] = [];

  const flushCurrent = () => {
    if (current.length === 0) return;
    const text = current.join(' ').replace(/\s{2,}/g, ' ').trim();
    if (text.length >= 5) {
      paragraphs.push(text);
    }
    current = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line = paragraph break
    if (!trimmed) {
      flushCurrent();
      continue;
    }

    // Detect paragraph start: line starts with indent/spaces or uppercase after a short previous line
    const prevLine = i > 0 ? lines[i - 1]?.trim() : '';
    const startsWithIndent = /^\s{2,}/.test(line);
    const prevLineShort = prevLine.length > 0 && prevLine.length < 50;
    const startsWithCapital = /^[A-Z"\u201C]/.test(trimmed);

    // If current buffer has content and this looks like a new paragraph start
    if (current.length > 0 && (startsWithIndent || (prevLineShort && startsWithCapital && !prevLine.endsWith(',')))) {
      flushCurrent();
    }

    current.push(trimmed);
  }

  flushCurrent();
  return paragraphs;
}
