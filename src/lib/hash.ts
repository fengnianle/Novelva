export function hashSentence(paragraphIndex: number, sentenceIndex: number): string {
  return `p${paragraphIndex}-s${sentenceIndex}`;
}

export function hashWord(word: string): string {
  return word.toLowerCase().trim();
}
