import { Injectable } from '@angular/core';
import {
  AnalyzedMove,
  Evaluation,
  MoveQuality,
} from '../models/analysis.model';

@Injectable({ providedIn: 'root' })
export class MoveClassifierService {
  classifyMoves(moves: AnalyzedMove[]): AnalyzedMove[] {
    return moves.map((move) => this.classifyMove(move));
  }

  private classifyMove(move: AnalyzedMove): AnalyzedMove {
    const evalBefore = move.evalBefore;
    const evalAfter = move.evalAfter;

    if (!evalBefore || !evalAfter) {
      return { ...move, quality: null, cpLoss: null };
    }

    const cpLoss = this.calculateCpLoss(evalBefore, evalAfter, move.color);
    const isPlayerBestMove = this.isEngineTopMove(move, evalBefore);
    const quality = this.determineQuality(
      cpLoss,
      isPlayerBestMove,
      evalBefore,
      evalAfter,
      move
    );

    return { ...move, quality, cpLoss };
  }

  private calculateCpLoss(
    evalBefore: Evaluation,
    evalAfter: Evaluation,
    color: 'w' | 'b'
  ): number {
    const scoreBefore = this.evalToScore(evalBefore, color);
    const scoreAfter = this.evalToScore(evalAfter, color);
    return Math.max(0, scoreBefore - scoreAfter);
  }

  /** Converts evaluation (White-perspective) to a score from the given player's perspective. */
  private evalToScore(evaluation: Evaluation, color: 'w' | 'b'): number {
    const sign = color === 'w' ? 1 : -1;

    if (evaluation.mate !== null) {
      if (evaluation.mate === 0) {
        return -10000;
      }
      const mateSign = evaluation.mate > 0 ? 1 : -1;
      return sign * mateSign * (10000 - Math.abs(evaluation.mate));
    }

    if (evaluation.cp !== null) {
      return sign * evaluation.cp;
    }

    return 0;
  }

  private isEngineTopMove(
    move: AnalyzedMove,
    evalBefore: Evaluation
  ): boolean {
    if (!evalBefore.bestMove) return false;
    return evalBefore.bestMove.startsWith(move.from + move.to);
  }

  /**
   * Gap (in cp) between the best move and second-best move,
   * from the perspective of the player who moved.
   * A large gap means this was the "only good move".
   */
  private getBestToSecondGap(evalBefore: Evaluation, color: 'w' | 'b'): number | null {
    if (evalBefore.cp === null || evalBefore.secondBestCp === null) return null;
    const sign = color === 'w' ? 1 : -1;
    return sign * (evalBefore.cp - evalBefore.secondBestCp);
  }

  private determineQuality(
    cpLoss: number,
    isEngineBest: boolean,
    evalBefore: Evaluation,
    evalAfter: Evaluation,
    move: AnalyzedMove
  ): MoveQuality {
    // Blunder: lost a winning mate or huge centipawn loss
    if (this.lostMate(evalBefore, evalAfter, move.color)) {
      return MoveQuality.Blunder;
    }

    if (cpLoss > 300) return MoveQuality.Blunder;
    if (cpLoss > 100) return MoveQuality.Mistake;
    if (cpLoss > 30) return MoveQuality.Inaccuracy;

    if (isEngineBest || cpLoss <= 5) {
      const gap = this.getBestToSecondGap(evalBefore, move.color);
      const isOnlyGoodMove = gap !== null && gap >= 150;

      if (this.isBrilliant(move, evalBefore, evalAfter, isOnlyGoodMove)) {
        return MoveQuality.Brilliant;
      }
      if (this.isGreat(evalBefore, evalAfter, move.color, isOnlyGoodMove)) {
        return MoveQuality.Great;
      }
      return MoveQuality.Best;
    }

    return MoveQuality.Good;
  }

  /**
   * Brilliant: a winning sacrifice — the player gives up material
   * but the engine confirms it's the best move and the position
   * improves or stays winning. Also must be the only good move.
   */
  private isBrilliant(
    move: AnalyzedMove,
    evalBefore: Evaluation,
    evalAfter: Evaluation,
    isOnlyGoodMove: boolean
  ): boolean {
    if (!isOnlyGoodMove) return false;

    // Must be a genuine sacrifice (giving up more material than captured)
    if (!this.isMaterialSacrifice(move)) return false;

    // Position must stay equal or improve for the player
    const scoreBefore = this.evalToScore(evalBefore, move.color);
    const scoreAfter = this.evalToScore(evalAfter, move.color);
    return scoreAfter >= scoreBefore - 50; // allow small tolerance
  }

  /**
   * A sacrifice means the moving piece is worth more than what it captures.
   * E.g. knight takes pawn = sacrifice, knight takes knight = equal trade.
   */
  private isMaterialSacrifice(move: AnalyzedMove): boolean {
    const san = move.san;
    if (!san.includes('x')) return false;

    const movingPieceValue = this.pieceValue(san.charAt(0));
    if (movingPieceValue <= 1) return false; // pawn captures aren't sacrifices

    const capturedValue = this.getCapturedPieceValue(move.fenBefore, move.to);
    return movingPieceValue > capturedValue;
  }

  private pieceValue(char: string): number {
    switch (char.toUpperCase()) {
      case 'Q': return 9;
      case 'R': return 5;
      case 'N': case 'B': return 3;
      default: return 1;
    }
  }

  private getCapturedPieceValue(fen: string, square: string): number {
    const file = square.charCodeAt(0) - 97; // 'a' = 0
    const rank = parseInt(square.charAt(1)) - 1;
    const rows = fen.split(' ')[0].split('/');
    const row = rows[7 - rank]; // FEN starts from rank 8

    let col = 0;
    for (const c of row) {
      if (col === file) {
        return this.pieceValue(c);
      }
      if (c >= '1' && c <= '8') {
        col += parseInt(c);
      } else {
        col++;
      }
      if (col > file) break;
    }
    return 0; // empty square (en passant)
  }

  /**
   * Great: the only good move in the position (all alternatives
   * are significantly worse), OR the move dramatically swings
   * the eval in the player's favor (≥ 200cp improvement).
   */
  private isGreat(
    evalBefore: Evaluation,
    evalAfter: Evaluation,
    color: 'w' | 'b',
    isOnlyGoodMove: boolean
  ): boolean {
    // Only good move in the position
    if (isOnlyGoodMove) return true;

    // Dramatic eval swing in player's favor
    const scoreBefore = this.evalToScore(evalBefore, color);
    const scoreAfter = this.evalToScore(evalAfter, color);
    const swing = scoreAfter - scoreBefore;
    return swing >= 200;
  }

  private lostMate(
    evalBefore: Evaluation,
    evalAfter: Evaluation,
    color: 'w' | 'b'
  ): boolean {
    const sign = color === 'w' ? 1 : -1;
    const hadMate =
      evalBefore.mate !== null && evalBefore.mate * sign > 0;
    const lostMate =
      evalAfter.mate === null || evalAfter.mate * sign <= 0;
    return hadMate && lostMate;
  }
}
