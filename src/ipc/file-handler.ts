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

  // Read container.xml to find the OPF file
  const containerEntry = zip.getEntry('META-INF/container.xml');
  if (!containerEntry) throw new Error('Invalid EPUB: missing container.xml');

  const containerXml = containerEntry.getData().toString('utf-8');
  const opfMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!opfMatch) throw new Error('Invalid EPUB: cannot find OPF path');

  const opfPath = opfMatch[1];
  const opfDir = path.dirname(opfPath).replace(/\\/g, '/');
  const opfEntry = zip.getEntry(opfPath);
  if (!opfEntry) throw new Error(`Invalid EPUB: missing OPF file at ${opfPath}`);

  const opfXml = opfEntry.getData().toString('utf-8');

  // Extract spine item IDs in order
  const spineMatches = [...opfXml.matchAll(/<itemref\s+idref="([^"]+)"/g)];
  const spineIds = spineMatches.map((m) => m[1]);

  // Build manifest map: id -> href
  const manifestMatches = [...opfXml.matchAll(/<item\s+[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*/g)];
  const manifest: Record<string, string> = {};
  for (const m of manifestMatches) {
    manifest[m[1]] = m[2];
  }

  // Read each spine item in order
  const textParts: string[] = [];
  for (const id of spineIds) {
    const href = manifest[id];
    if (!href) continue;

    const entryPath = opfDir ? `${opfDir}/${href}` : href;
    const entry = zip.getEntry(entryPath.replace(/\\/g, '/'));
    if (!entry) continue;

    const html = entry.getData().toString('utf-8');
    const text = stripHtmlTags(html);
    if (text.trim()) {
      textParts.push(text.trim());
    }
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
