import { Injectable } from '@angular/core';

export interface RepertoireData {
  [fen: string]: string; // normalized FEN → SAN
}

@Injectable({ providedIn: 'root' })
export class RepertoireService {
  private readonly STORAGE_KEY_WHITE = 'chess-repertoire-white';
  private readonly STORAGE_KEY_BLACK = 'chess-repertoire-black';

  normalizeFen(fen: string): string {
    // Keep position + side to move + castling + en passant, drop halfmove/fullmove counters
    const parts = fen.split(' ');
    return parts.slice(0, 4).join(' ');
  }

  getMove(fen: string, color: 'w' | 'b'): string | null {
    const data = this.loadRepertoire(color);
    const key = this.normalizeFen(fen);
    return data[key] ?? null;
  }

  addMove(fen: string, color: 'w' | 'b', san: string): void {
    const data = this.loadRepertoire(color);
    const key = this.normalizeFen(fen);
    data[key] = san;
    this.saveRepertoire(color, data);
  }

  removeMove(fen: string, color: 'w' | 'b'): void {
    const data = this.loadRepertoire(color);
    const key = this.normalizeFen(fen);
    delete data[key];
    this.saveRepertoire(color, data);
  }

  private storageKey(color: 'w' | 'b'): string {
    return color === 'w' ? this.STORAGE_KEY_WHITE : this.STORAGE_KEY_BLACK;
  }

  private loadRepertoire(color: 'w' | 'b'): RepertoireData {
    try {
      const raw = localStorage.getItem(this.storageKey(color));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveRepertoire(color: 'w' | 'b', data: RepertoireData): void {
    localStorage.setItem(this.storageKey(color), JSON.stringify(data));
  }
}
