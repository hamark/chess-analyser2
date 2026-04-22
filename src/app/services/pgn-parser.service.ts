import { Injectable } from '@angular/core';
import { Chess, Move } from 'chess.js';
import { AnalyzedMove } from '../models/analysis.model';

export interface ParsedGame {
  moves: AnalyzedMove[];
  headers: Record<string, string | null>;
  fens: string[];
}

@Injectable({ providedIn: 'root' })
export class PgnParserService {
  parsePgn(pgn: string): ParsedGame {
    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
    } catch {
      throw new Error('PGN invalide');
    }

    const headers = chess.header();
    const history: Move[] = chess.history({ verbose: true });

    chess.reset();
    const fens: string[] = [chess.fen()];
    const moves: AnalyzedMove[] = [];

    for (const move of history) {
      const fenBefore = chess.fen();
      chess.move(move.san);
      const fenAfter = chess.fen();
      fens.push(fenAfter);

      moves.push({
        san: move.san,
        from: move.from,
        to: move.to,
        moveNumber: Math.ceil(moves.length / 2) + 1,
        color: move.color,
        fenBefore,
        fenAfter,
        evalBefore: null,
        evalAfter: null,
        quality: null,
        cpLoss: null,
      });
    }

    return { moves, headers, fens };
  }

  validatePgn(pgn: string): boolean {
    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      return chess.history().length > 0;
    } catch {
      return false;
    }
  }
}
