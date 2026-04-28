import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

function getAdmZip() {
  try {
    const appRequire = createRequire(path.join(app.getAppPath(), 'package.json'));
    return appRequire('adm-zip');
  } catch {
    const pkgPath = path.join(path.dirname(app.getPath('exe')), 'resources', 'modules', 'package.json');
    const prodRequire = createRequire(pkgPath);
    return prodRequire('adm-zip');
  }
}

function stripHtmlTags(html: string): string {
  // Replace block-level tags with newlines, then strip all remaining tags
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

function parseEpub(filePath: string): string {
  const AdmZipClass = getAdmZip();
  const zip = new AdmZipClass(filePath);

  // Build a lookup map for zip entries (case-insensitive fallback)
  const entries = zip.getEntries();
  const entryMap = new Map<string, any>();
  for (const e of entries) {
    const name = e.entryName.replace(/\\/g, '/');
    entryMap.set(name, e);
    entryMap.set(name.toLowerCase(), e);
  }
  const findEntry = (p: string) => {
    const normalized = p.replace(/\\/g, '/');
    return entryMap.get(normalized) || entryMap.get(normalized.toLowerCase()) || null;
  };

  // Read container.xml to find the OPF file
  const containerEntry = findEntry('META-INF/container.xml');
  if (!containerEntry) throw new Error('Invalid EPUB: missing container.xml');

  const containerXml = containerEntry.getData().toString('utf-8');
  const opfMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!opfMatch) throw new Error('Invalid EPUB: cannot find OPF path');

  const opfPath = opfMatch[1];
  const opfDir = path.dirname(opfPath).replace(/\\/g, '/');
  const opfEntry = findEntry(opfPath);
  if (!opfEntry) throw new Error(`Invalid EPUB: missing OPF file at ${opfPath}`);

  const opfXml = opfEntry.getData().toString('utf-8');

  // Extract spine item IDs in order
  const spineMatches = [...opfXml.matchAll(/<itemref\s+[^>]*idref="([^"]+)"[^>]*/g)];
  const spineIds = spineMatches.map((m) => m[1]);

  // Build manifest map: id -> href
  // Handle both <item id="x" href="y"> and <item href="y" id="x"> attribute orders
  const manifest: Record<string, string> = {};
  const itemMatches = [...opfXml.matchAll(/<item\s+([^>]+)\/?>/g)];
  for (const m of itemMatches) {
    const attrs = m[1];
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    const hrefMatch = attrs.match(/\bhref="([^"]+)"/);
    if (idMatch && hrefMatch) {
      // Decode URL-encoded paths (e.g. %20 -> space)
      try {
        manifest[idMatch[1]] = decodeURIComponent(hrefMatch[1]);
      } catch {
        manifest[idMatch[1]] = hrefMatch[1];
      }
    }
  }

  // Read each spine item in order
  const textParts: string[] = [];
  for (const id of spineIds) {
    const href = manifest[id];
    if (!href) continue;

    // Resolve path relative to OPF directory
    let entryPath: string;
    if (opfDir && opfDir !== '.') {
      entryPath = `${opfDir}/${href}`;
    } else {
      entryPath = href;
    }

    const entry = findEntry(entryPath);
    if (!entry) continue;

    const html = entry.getData().toString('utf-8');
    const text = stripHtmlTags(html);
    if (text.trim()) {
      textParts.push(text.trim());
    }
  }

  if (textParts.length === 0) {
    throw new Error('EPUB 解析完成但未提取到任何文本内容');
  }

  return textParts.join('\n\n');
}

export function registerFileHandlers(): void {
  ipcMain.handle('file:open', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        {
          name: 'Supported Files',
          extensions: ['txt', 'pdf', 'epub'],
        },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'EPUB Files', extensions: ['epub'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    if (ext === '.txt') {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { filePath, content, fileName };
    }

    // For PDF and EPUB, return file path; content will be parsed separately
    return { filePath, content: '', fileName };
  });

  ipcMain.handle('file:exists', (_event, filePath: string) => {
    try {
      return fs.existsSync(filePath);
    } catch (_) {
      return false;
    }
  });

  ipcMain.handle('file:read-text', async (_event, filePath: string) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.error('Text file read error:', err);
      throw new Error(`Failed to read file: ${(err as Error).message}`);
    }
  });

  ipcMain.handle('file:read-pdf', async (_event, filePath: string) => {
    try {
      let pdfParse;
      try {
        const appRequire = createRequire(path.join(app.getAppPath(), 'package.json'));
        pdfParse = appRequire('pdf-parse');
      } catch {
        const pkgPath = path.join(path.dirname(app.getPath('exe')), 'resources', 'modules', 'package.json');
        const prodRequire = createRequire(pkgPath);
        pdfParse = prodRequire('pdf-parse');
      }
      const dataBuffer = fs.readFileSync(filePath);
      const result = await pdfParse(dataBuffer);
      return result.text || '';
    } catch (err) {
      console.error('PDF parsing error:', err);
      throw new Error(`Failed to parse PDF: ${(err as Error).message}`);
    }
  });

  ipcMain.handle('file:read-epub', async (_event, filePath: string) => {
    try {
      return parseEpub(filePath);
    } catch (err) {
      console.error('EPUB parsing error:', err);
      throw new Error(`Failed to parse EPUB: ${(err as Error).message}`);
    }
  });
}
