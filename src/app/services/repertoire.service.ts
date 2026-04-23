import { Injectable } from '@angular/core';
import { Chess } from 'chess.js';

export interface RepertoireEntry {
  fen: string;
  san: string;
}

export interface RepertoireData {
  [fen: string]: string; // normalized FEN → SAN
}

export interface RepertoireTreeNode {
  san: string;
  from: string;
  to: string;
  fenAfter: string;
  moveNumber: number;
  color: 'w' | 'b';
  isPlayerMove: boolean;
  children: RepertoireTreeNode[];
}

@Injectable({ providedIn: 'root' })
export class RepertoireService {
  private readonly STORAGE_KEY_WHITE = 'chess-repertoire-white';
  private readonly STORAGE_KEY_BLACK = 'chess-repertoire-black';

  normalizeFen(fen: string): string {
    const parts = fen.split(' ');
    return parts.slice(0, 4).join(' ');
  }

  getMove(fen: string, color: 'w' | 'b'): string | null {
    const data = this.loadRepertoire(color);
    const key = this.normalizeFen(fen);
    return data[key] ?? null;
  }

  getAllMoves(color: 'w' | 'b'): RepertoireEntry[] {
    const data = this.loadRepertoire(color);
    return Object.entries(data).map(([fen, san]) => ({ fen, san }));
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

  buildTree(playerColor: 'w' | 'b'): RepertoireTreeNode[] {
    const repertoire = this.loadRepertoire(playerColor);
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const visited = new Set<string>();
    return this.buildChildren(startFen, playerColor, repertoire, visited);
  }

  private buildChildren(
    fen: string,
    playerColor: 'w' | 'b',
    repertoire: RepertoireData,
    visited: Set<string>
  ): RepertoireTreeNode[] {
    const normalizedFen = this.normalizeFen(fen);
    if (visited.has(normalizedFen)) return [];
    visited.add(normalizedFen);

    const chess = new Chess(fen);
    const sideToMove = chess.turn();
    const isPlayerTurn = sideToMove === playerColor;
    const fenParts = fen.split(' ');
    const fullMoveNum = parseInt(fenParts[5] || '1', 10);

    if (isPlayerTurn) {
      const san = repertoire[normalizedFen];
      if (!san) return [];

      try {
        const move = chess.move(san);
        if (!move) return [];
        const node: RepertoireTreeNode = {
          san: move.san,
          from: move.from,
          to: move.to,
          fenAfter: chess.fen(),
          moveNumber: fullMoveNum,
          color: sideToMove,
          isPlayerMove: true,
          children: this.buildChildren(chess.fen(), playerColor, repertoire, visited),
        };
        return [node];
      } catch {
        return [];
      }
    } else {
      const nodes: RepertoireTreeNode[] = [];
      const legalMoves = chess.moves({ verbose: true });

      for (const legalMove of legalMoves) {
        const testChess = new Chess(fen);
        const move = testChess.move(legalMove.san);
        if (!move) continue;

        const nextNormalized = this.normalizeFen(testChess.fen());
        if (repertoire[nextNormalized]) {
          const node: RepertoireTreeNode = {
            san: move.san,
            from: move.from,
            to: move.to,
            fenAfter: testChess.fen(),
            moveNumber: fullMoveNum,
            color: sideToMove,
            isPlayerMove: false,
            children: this.buildChildren(testChess.fen(), playerColor, repertoire, visited),
          };
          nodes.push(node);
        }
      }
      return nodes;
    }
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
