import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChessBoardComponent } from '../chess-board/chess-board.component';
import { RepertoireService, RepertoireEntry } from '../../services/repertoire.service';
import { Chess } from 'chess.js';

@Component({
  selector: 'app-repertoire-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSnackBarModule,
    ChessBoardComponent,
  ],
  templateUrl: './repertoire-viewer.component.html',
  styleUrl: './repertoire-viewer.component.scss',
})
export class RepertoireViewerComponent {
  @Output() goBack = new EventEmitter<void>();

  selectedColor: 'w' | 'b' = 'w';
  entries: RepertoireEntry[] = [];
  selectedIndex = -1;

  constructor(
    private repertoireService: RepertoireService,
    private snackBar: MatSnackBar
  ) {
    this.loadEntries();
  }

  get selectedEntry(): RepertoireEntry | null {
    return this.selectedIndex >= 0 ? this.entries[this.selectedIndex] : null;
  }

  get boardFen(): string {
    const entry = this.selectedEntry;
    if (!entry) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    return entry.fen + ' 0 1';
  }

  get arrowUci(): string | null {
    const entry = this.selectedEntry;
    if (!entry) return null;
    return this.sanToUci(entry.fen + ' 0 1', entry.san);
  }

  onColorChange(color: 'w' | 'b'): void {
    this.selectedColor = color;
    this.selectedIndex = -1;
    this.loadEntries();
  }

  selectEntry(index: number): void {
    this.selectedIndex = index;
  }

  deleteEntry(event: Event, index: number): void {
    event.stopPropagation();
    const entry = this.entries[index];
    this.repertoireService.removeMove(entry.fen, this.selectedColor);
    if (this.selectedIndex === index) {
      this.selectedIndex = -1;
    } else if (this.selectedIndex > index) {
      this.selectedIndex--;
    }
    this.loadEntries();
    this.snackBar.open('Entrée supprimée du répertoire', 'OK', { duration: 2000 });
  }

  private loadEntries(): void {
    this.entries = this.repertoireService.getAllMoves(this.selectedColor);
  }

  private sanToUci(fen: string, san: string): string | null {
    try {
      const chess = new Chess(fen);
      const move = chess.move(san);
      if (!move) return null;
      return move.from + move.to + (move.promotion || '');
    } catch {
      return null;
    }
  }

  formatFenShort(fen: string): string {
    // Show just the piece placement part
    return fen.split(' ')[0];
  }
}
