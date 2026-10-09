import fs from 'fs';
import path from 'path';
import { AnalysisRecord } from '@/lib/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'analyses.json');

const memoryCache = new Map<string, AnalysisRecord>();

function initStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const items: AnalysisRecord[] = JSON.parse(raw);
      items.forEach((item) => memoryCache.set(item.id, item));
    }
  } catch {
    // Ignore init errors
  }
}

initStore();

function persistToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const items = Array.from(memoryCache.values());
    fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

export function saveInMemory(record: AnalysisRecord) {
  memoryCache.set(record.id, record);
  persistToDisk();
}

export function getFromMemory(id: string, sessionId?: string): AnalysisRecord | null {
  // If not found in cache, re-read disk
  if (!memoryCache.has(id)) {
    initStore();
  }
  const item = memoryCache.get(id);
  if (!item) return null;
  return item;
}

export function getAllFromMemory(sessionId?: string): AnalysisRecord[] {
  initStore();
  const items: AnalysisRecord[] = [];
  Array.from(memoryCache.values()).forEach((item) => {
    if (!sessionId || item.sessionId === sessionId) {
      items.push(item);
    }
  });
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function deleteFromMemory(id: string): boolean {
  const result = memoryCache.delete(id);
  persistToDisk();
  return result;
}
