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

  importFromPgn(pgn: string, color: 'w' | 'b'): number {
    const data = this.loadRepertoire(color);
    let count = 0;

    const games = this.splitPgnGames(pgn);
    for (const gamePgn of games) {
      count += this.importGameWithVariations(gamePgn, color, data);
    }

    if (count > 0) {
      this.saveRepertoire(color, data);
    }
    return count;
  }

  exportToPgn(color: 'w' | 'b'): string {
    const tree = this.buildTree(color);
    if (tree.length === 0) return '';

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    const lines: string[] = [
      `[Event "Répertoire ${color === 'w' ? 'Blancs' : 'Noirs'}"]`,
      `[Site "Chess Analyser"]`,
      `[Date "${date}"]`,
      `[White "${color === 'w' ? 'Répertoire' : '?'}"]`,
      `[Black "${color === 'b' ? 'Répertoire' : '?'}"]`,
      `[Result "*"]`,
      '',
      this.generatePgnMoves(tree, true) + ' *',
    ];
    return lines.join('\n') + '\n';
  }

  private splitPgnGames(pgn: string): string[] {
    const parts = pgn.split(/\n(?=\[Event\s)/);
    return parts.map(p => p.trim()).filter(p => p.length > 0);
  }

  private importGameWithVariations(pgn: string, color: 'w' | 'b', data: RepertoireData): number {
    const moveText = pgn.replace(/\[[^\]]*\]/g, '').trim();
    const tokens = this.tokenizePgn(moveText);

    let count = 0;
    const chess = new Chess();
    const stack: string[] = [];

    for (const token of tokens) {
      if (token === '(') {
        // Save current position, rewind to branch point
        stack.push(chess.fen());
        chess.undo();
      } else if (token === ')') {
        if (stack.length > 0) {
          chess.load(stack.pop()!);
        }
      } else {
        const turn = chess.turn();
        const fenBefore = chess.fen();
        try {
          const move = chess.move(token);
          if (move && turn === color) {
            const key = this.normalizeFen(fenBefore);
            if (!data[key]) {
              data[key] = move.san;
              count++;
            }
          }
        } catch {
          // Invalid move token, skip
        }
      }
    }

    return count;
  }

  private tokenizePgn(text: string): string[] {
    const tokens: string[] = [];
    let i = 0;

    while (i < text.length) {
      const ch = text[i];

      if (/\s/.test(ch)) { i++; continue; }

      // Brace comments
      if (ch === '{') {
        const end = text.indexOf('}', i + 1);
        i = end >= 0 ? end + 1 : text.length;
        continue;
      }

      // Line comments
      if (ch === ';') {
        const end = text.indexOf('\n', i + 1);
        i = end >= 0 ? end + 1 : text.length;
        continue;
      }

      // Variation delimiters
      if (ch === '(' || ch === ')') {
        tokens.push(ch);
        i++;
        continue;
      }

      // NAGs ($1, $2, etc.)
      if (ch === '$') {
        i++;
        while (i < text.length && /\d/.test(text[i])) i++;
        continue;
      }

      // Read a word token
      let word = '';
      while (i < text.length && !/[\s{}();$]/.test(text[i])) {
        word += text[i];
        i++;
      }
      if (!word) continue;

      // Skip move numbers (1. or 1...) and results
      if (/^\d+\.+$/.test(word)) continue;
      if (['1-0', '0-1', '1/2-1/2', '*'].includes(word)) continue;

      tokens.push(word);
    }

    return tokens;
  }

  private generatePgnMoves(nodes: RepertoireTreeNode[], forceNumber: boolean): string {
    if (nodes.length === 0) return '';

    const parts: string[] = [];
    const main = nodes[0];
    parts.push(this.moveToString(main, forceNumber));

    for (let i = 1; i < nodes.length; i++) {
      parts.push('(' + this.generatePgnMoves([nodes[i]], true) + ')');
    }

    if (main.children.length > 0) {
      parts.push(this.generatePgnMoves(main.children, nodes.length > 1));
    }

    return parts.join(' ');
  }

  private moveToString(node: RepertoireTreeNode, forceNumber: boolean): string {
    if (node.color === 'w') {
      return `${node.moveNumber}. ${node.san}`;
    }
    return forceNumber ? `${node.moveNumber}... ${node.san}` : node.san;
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
