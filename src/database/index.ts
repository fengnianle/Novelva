import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

let db: any = null;

function getSqlJs() {
  const appRequire = createRequire(path.join(app.getAppPath(), 'package.json'));
  // Use the Node.js-compatible build
  return appRequire('sql.js/dist/sql-wasm.js');
}

function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'reading-app.db');
}

function getWasmPath(): string {
  // In development, resolve from node_modules
  const devPath = path.join(
    app.getAppPath(),
    'node_modules',
    'sql.js',
    'dist',
    'sql-wasm.wasm'
  );
  if (fs.existsSync(devPath)) return devPath;

  // In production (asar), look in app.asar.unpacked or resources
  const prodPath = path.join(
    path.dirname(app.getPath('exe')),
    'resources',
    'sql-wasm.wasm'
  );
  if (fs.existsSync(prodPath)) return prodPath;

  // Fallback: let sql.js try to find it itself
  return '';
}

export async function initDatabase(): Promise<any> {
  if (db) return db;

  const wasmPath = getWasmPath();
  const initOptions: any = {};
  if (wasmPath) {
    initOptions.locateFile = () => wasmPath;
  }

  const initSqlJs = getSqlJs();
  const SQL = await (typeof initSqlJs === 'function' ? initSqlJs(initOptions) : initSqlJs.default(initOptions));
  const dbPath = getDbPath();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  createTables(db);
  migrateSchema(db);
  saveDatabase();

  return db;
}

function createTables(database: any): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS sentence_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sentence_hash TEXT UNIQUE NOT NULL,
      sentence_text TEXT NOT NULL,
      context_prev TEXT,
      context_next TEXT,
      translation TEXT NOT NULL,
      key_expressions TEXT NOT NULL,
      explanation TEXT NOT NULL,
      word_analyses TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS word_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      meaning TEXT NOT NULL,
      phonetic TEXT,
      pos TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS vocabulary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      meaning TEXT NOT NULL,
      sentence TEXT NOT NULL,
      sentence_translation TEXT,
      source_file TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS reading_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE NOT NULL,
      file_name TEXT NOT NULL,
      scroll_position REAL DEFAULT 0,
      last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS review_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      ease_factor REAL DEFAULT 2.5,
      interval_days INTEGER DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      next_review_date TEXT DEFAULT (date('now')),
      last_review_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS vocab_analysis_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      language TEXT DEFAULT 'en',
      analysis_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Add columns introduced after initial schema — safe to run repeatedly
function migrateSchema(database: any): void {
  const addColumn = (table: string, column: string, type: string) => {
    try {
      database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch (_) { /* column already exists — ignore */ }
  };

  addColumn('vocabulary', 'language', "TEXT DEFAULT 'en'");
  addColumn('vocabulary', 'pos', "TEXT DEFAULT ''");
  addColumn('sentence_cache', 'language', "TEXT DEFAULT 'en'");
  addColumn('sentence_cache', 'grammar_points', "TEXT DEFAULT '[]'");
  addColumn('reading_progress', 'language', "TEXT DEFAULT 'en'");
}

export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, buffer);
}

export function getDatabase(): any {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function queryAll(sql: string, params?: any[]): any[] {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  if (params) stmt.bind(params);

  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function runSql(sql: string, params?: any[]): void {
  const database = getDatabase();
  database.run(sql, params);
  saveDatabase();
}
