import { Injectable } from '@angular/core';
import { RepertoireData } from './repertoire.service';

const DB_NAME = 'chess-analyser-sync';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'sync-folder';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private folderHandle: FileSystemDirectoryHandle | null = null;

  static isSupported(): boolean {
    return 'showDirectoryPicker' in window;
  }

  async pickFolder(): Promise<string> {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    this.folderHandle = handle;
    await this.storeHandle(handle);
    return handle.name;
  }

  async hasFolder(): Promise<boolean> {
    if (this.folderHandle) return true;
    const handle = await this.loadHandle();
    return handle !== null;
  }

  async getFolderName(): Promise<string | null> {
    const handle = await this.getHandle();
    return handle?.name ?? null;
  }

  async ensurePermission(): Promise<boolean> {
    const handle = await this.getHandle();
    if (!handle) return false;

    const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    return (await handle.requestPermission(opts)) === 'granted';
  }

  async saveRepertoire(color: 'w' | 'b', data: RepertoireData): Promise<void> {
    const handle = await this.getHandle();
    if (!handle) throw new Error('Aucun dossier configuré');
    if (!(await this.ensurePermission())) throw new Error('Permission refusée');

    const fileName = this.fileName(color);
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  }

  async loadRepertoire(color: 'w' | 'b'): Promise<RepertoireData | null> {
    const handle = await this.getHandle();
    if (!handle) throw new Error('Aucun dossier configuré');
    if (!(await this.ensurePermission())) throw new Error('Permission refusée');

    const fileName = this.fileName(color);
    try {
      const fileHandle = await handle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text) as RepertoireData;
    } catch {
      return null;
    }
  }

  async disconnect(): Promise<void> {
    this.folderHandle = null;
    await this.removeHandle();
  }

  private fileName(color: 'w' | 'b'): string {
    return color === 'w' ? 'repertoire-blancs.json' : 'repertoire-noirs.json';
  }

  private async getHandle(): Promise<FileSystemDirectoryHandle | null> {
    if (this.folderHandle) return this.folderHandle;
    this.folderHandle = await this.loadHandle();
    return this.folderHandle;
  }

  // IndexedDB persistence for the directory handle
  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  private async loadHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
        req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    } catch {
      return null;
    }
  }

  private async removeHandle(): Promise<void> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    } catch {
      // ignore
    }
  }
}
