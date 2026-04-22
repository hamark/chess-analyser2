import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MoveQuality, MOVE_QUALITY_INFO } from '../../models/analysis.model';

interface Square {
  file: number;
  rank: number;
  piece: string;
  isBlackPiece: boolean;
  isLight: boolean;
  algebraic: string;
  isHighlighted: boolean;
  isLastMoveFrom: boolean;
  isLastMoveTo: boolean;
}

const PIECE_UNICODE: Record<string, string> = {
  K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

@Component({
  selector: 'app-chess-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board.component.html',
  styleUrl: './chess-board.component.scss',
})
export class ChessBoardComponent implements OnChanges {
  @Input() fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  @Input() lastMoveFrom: string | null = null;
  @Input() lastMoveTo: string | null = null;
  @Input() bestMoveUci: string | null = null;
  @Input() moveQuality: MoveQuality | null = null;
  @Input() flipped = false;

  squares: Square[][] = [];
  fileLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  rankLabels = ['8', '7', '6', '5', '4', '3', '2', '1'];

  // Arrow coordinates (percentage-based)
  arrowFrom: { x: number; y: number } | null = null;
  arrowTo: { x: number; y: number } | null = null;

  ngOnChanges(_changes: SimpleChanges): void {
    this.buildBoard();
    this.updateArrow();
  }

  private updateArrow(): void {
    if (!this.bestMoveUci || this.bestMoveUci.length < 4) {
      this.arrowFrom = null;
      this.arrowTo = null;
      return;
    }

    const from = this.bestMoveUci.substring(0, 2);
    const to = this.bestMoveUci.substring(2, 4);

    this.arrowFrom = this.squareToCoords(from);
    this.arrowTo = this.squareToCoords(to);
  }

  private squareToCoords(sq: string): { x: number; y: number } {
    const fileIdx = sq.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankIdx = parseInt(sq[1], 10) - 1;

    const displayFile = this.flipped ? 7 - fileIdx : fileIdx;
    const displayRank = this.flipped ? rankIdx : 7 - rankIdx;

    return {
      x: (displayFile + 0.5) * 12.5,
      y: (displayRank + 0.5) * 12.5,
    };
  }

  private buildBoard(): void {
    const board = this.parseFen(this.fen);
    const squares: Square[][] = [];

    for (let rank = 7; rank >= 0; rank--) {
      const row: Square[] = [];
      for (let file = 0; file < 8; file++) {
        const displayRank = this.flipped ? 7 - rank : rank;
        const displayFile = this.flipped ? 7 - file : file;
        const algebraic =
          this.fileLabels[displayFile] + (displayRank + 1).toString();

        row.push({
          file: displayFile,
          rank: displayRank,
          piece: board[displayRank][displayFile].piece,
          isBlackPiece: board[displayRank][displayFile].isBlack,
          isLight: (displayFile + displayRank) % 2 === 1,
          algebraic,
          isHighlighted: false,
          isLastMoveFrom: algebraic === this.lastMoveFrom,
          isLastMoveTo: algebraic === this.lastMoveTo,
        });
      }
      squares.push(row);
    }

    this.squares = squares;
    this.rankLabels = this.flipped
      ? ['1', '2', '3', '4', '5', '6', '7', '8']
      : ['8', '7', '6', '5', '4', '3', '2', '1'];
    this.fileLabels = this.flipped
      ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
      : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  }

  private parseFen(fen: string): { piece: string; isBlack: boolean }[][] {
    const board: { piece: string; isBlack: boolean }[][] = Array.from(
      { length: 8 },
      () => Array.from({ length: 8 }, () => ({ piece: '', isBlack: false }))
    );
    const ranks = fen.split(' ')[0].split('/');

    for (let r = 0; r < 8; r++) {
      let file = 0;
      for (const ch of ranks[r]) {
        if (ch >= '1' && ch <= '8') {
          file += parseInt(ch, 10);
        } else {
          board[7 - r][file] = {
            piece: PIECE_UNICODE[ch] || '',
            isBlack: ch === ch.toLowerCase(),
          };
          file++;
        }
      }
    }

    return board;
  }

  getSquareClass(square: Square): string {
    const classes = [square.isLight ? 'light' : 'dark'];
    if (square.isLastMoveFrom || square.isLastMoveTo) {
      classes.push('last-move');
    }
    return classes.join(' ');
  }

  get qualityBadge(): { symbol: string; color: string } | null {
    if (!this.moveQuality || !this.lastMoveTo) return null;
    const info = MOVE_QUALITY_INFO[this.moveQuality];
    if (!info || !info.symbol) return null;
    return { symbol: info.symbol, color: info.color };
  }

  get qualityBadgeCoords(): { x: number; y: number } | null {
    if (!this.lastMoveTo) return null;
    const coords = this.squareToCoords(this.lastMoveTo);
    return { x: coords.x + 5.5, y: coords.y - 5.5 };
  }
}
