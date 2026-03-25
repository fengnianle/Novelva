import { useCallback } from 'react';
import { useReaderStore } from '../stores/reader-store';
import { splitIntoParagraphs, splitIntoSentences, splitIntoWords } from '../lib/sentence-splitter';
import { hashSentence } from '../lib/hash';
import type { ParagraphData, SentenceData } from '../lib/sentence-splitter';

function parseContent(content: string): ParagraphData[] {
  const rawParagraphs = splitIntoParagraphs(content);
  let globalSentenceIndex = 0;

  const paragraphs: ParagraphData[] = [];

  for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
    const text = rawParagraphs[pIdx];
    const rawSentences = splitIntoSentences(text);
    const sentences: SentenceData[] = [];

    for (let sIdx = 0; sIdx < rawSentences.length; sIdx++) {
      const sText = rawSentences[sIdx];
      sentences.push({
        id: hashSentence(pIdx, globalSentenceIndex),
        text: sText,
        index: globalSentenceIndex,
        words: splitIntoWords(sText),
      });
      globalSentenceIndex++;
    }

    paragraphs.push({
      id: `p-${pIdx}`,
      text,
      sentences,
    });
  }

  return paragraphs;
}

export function useFileImport() {
  const { setCurrentBook, addRecentBook, setFileLoading } = useReaderStore();

  const importFile = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;

    const result = await api.openFile();
    if (!result) return;

    const { filePath, fileName } = result;
    const ext = fileName.split('.').pop()?.toLowerCase();

    setFileLoading(true, `正在加载 ${fileName}...`);

    try {
      let content: string = result.content || '';

      if (ext === 'pdf') {
        setFileLoading(true, '正在解析 PDF，请稍候...');
        content = await api.readPdf(filePath);
      } else if (ext === 'epub') {
        setFileLoading(true, '正在解析 EPUB，请稍候...');
        content = await api.readEpub(filePath);
      }

      if (!content || typeof content !== 'string') {
        setFileLoading(false);
        return;
      }

      setFileLoading(true, '正在分析文本结构...');
      const paragraphs = parseContent(content);

      setCurrentBook({ filePath, fileName, content, paragraphs });
      addRecentBook(filePath, fileName);
    } catch (err) {
      console.error('File parsing error:', err);
    } finally {
      setFileLoading(false);
    }
  }, [setCurrentBook, addRecentBook, setFileLoading]);

  const openRecentBook = useCallback(async (filePath: string, fileName: string) => {
    const api = (window as any).electronAPI;
    if (!api) return;

    const ext = fileName.split('.').pop()?.toLowerCase();
    setFileLoading(true, `正在加载 ${fileName}...`);

    try {
      let content = '';

      if (ext === 'txt') {
        setFileLoading(true, '正在读取文本文件...');
        content = await api.readFile(filePath);
      } else if (ext === 'pdf') {
        setFileLoading(true, '正在解析 PDF，请稍候...');
        content = await api.readPdf(filePath);
      } else if (ext === 'epub') {
        setFileLoading(true, '正在解析 EPUB，请稍候...');
        content = await api.readEpub(filePath);
      }

      if (!content || typeof content !== 'string') {
        setFileLoading(false);
        return;
      }

      setFileLoading(true, '正在分析文本结构...');
      const paragraphs = parseContent(content);

      setCurrentBook({ filePath, fileName, content, paragraphs });
      addRecentBook(filePath, fileName);
    } catch (err) {
      console.error('File open error:', err);
    } finally {
      setFileLoading(false);
    }
  }, [setCurrentBook, addRecentBook, setFileLoading]);

  return { importFile, openRecentBook };
}
