import { Component, EventEmitter, HostListener, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChessBoardComponent } from '../chess-board/chess-board.component';
import { RepertoireService, RepertoireTreeNode } from '../../services/repertoire.service';

interface PathEntry {
  node: RepertoireTreeNode;
  chosenVariantIndex: number;
}

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
  treeRoots: RepertoireTreeNode[] = [];
  currentPath: PathEntry[] = [];
  currentMoveIndex = -1;

  private readonly START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  constructor(
    private repertoireService: RepertoireService,
    private snackBar: MatSnackBar
  ) {
    this.rebuildTree();
  }

  get currentFen(): string {
    if (this.currentMoveIndex < 0) return this.START_FEN;
    return this.currentPath[this.currentMoveIndex]?.node.fenAfter || this.START_FEN;
  }

  get lastMoveFrom(): string | null {
    if (this.currentMoveIndex < 0) return null;
    return this.currentPath[this.currentMoveIndex]?.node.from || null;
  }

  get lastMoveTo(): string | null {
    if (this.currentMoveIndex < 0) return null;
    return this.currentPath[this.currentMoveIndex]?.node.to || null;
  }

  get arrowUci(): string | null {
    if (this.currentMoveIndex < 0) return null;
    const node = this.currentPath[this.currentMoveIndex]?.node;
    if (!node) return null;
    return node.from + node.to;
  }

  get totalMoves(): number {
    return this.currentPath.length;
  }

  get movePairs(): { number: number; white: PathEntry | null; black: PathEntry | null; whiteIdx: number; blackIdx: number }[] {
    const pairs = [];
    for (let i = 0; i < this.currentPath.length; i += 2) {
      pairs.push({
        number: this.currentPath[i]?.node.moveNumber || Math.floor(i / 2) + 1,
        white: this.currentPath[i] || null,
        black: this.currentPath[i + 1] || null,
        whiteIdx: i,
        blackIdx: i + 1,
      });
    }
    return pairs;
  }

  hasVariants(pathIndex: number): boolean {
    if (pathIndex === 0) {
      return this.treeRoots.length > 1;
    }
    const parentEntry = this.currentPath[pathIndex - 1];
    return parentEntry.node.children.length > 1;
  }

  getVariants(pathIndex: number): RepertoireTreeNode[] {
    if (pathIndex === 0) {
      return this.treeRoots;
    }
    return this.currentPath[pathIndex - 1].node.children;
  }

  getChosenVariantIndex(pathIndex: number): number {
    return this.currentPath[pathIndex]?.chosenVariantIndex || 0;
  }

  onColorChange(color: 'w' | 'b'): void {
    this.selectedColor = color;
    this.rebuildTree();
  }

  selectMove(index: number): void {
    if (index >= 0 && index < this.currentPath.length) {
      this.currentMoveIndex = index;
    }
  }

  switchVariant(pathIndex: number, variantIndex: number): void {
    const variants = this.getVariants(pathIndex);
    if (variantIndex < 0 || variantIndex >= variants.length) return;

    // Truncate path from this point and rebuild with new variant
    this.currentPath = this.currentPath.slice(0, pathIndex);
    this.currentPath.push({ node: variants[variantIndex], chosenVariantIndex: variantIndex });
    this.extendPath();

    if (this.currentMoveIndex >= this.currentPath.length) {
      this.currentMoveIndex = this.currentPath.length - 1;
    }
  }

  nextMove(): void {
    if (this.currentMoveIndex < this.currentPath.length - 1) {
      this.currentMoveIndex++;
    }
  }

  previousMove(): void {
    if (this.currentMoveIndex > -1) {
      this.currentMoveIndex--;
    }
  }

  goToStart(): void {
    this.currentMoveIndex = -1;
  }

  goToEnd(): void {
    this.currentMoveIndex = this.currentPath.length - 1;
  }

  deleteCurrentMove(): void {
    if (this.currentMoveIndex < 0) return;
    const entry = this.currentPath[this.currentMoveIndex];
    if (!entry.node.isPlayerMove) {
      this.snackBar.open('Seuls les coups du joueur peuvent être supprimés', 'OK', { duration: 2000 });
      return;
    }

    // Find the FEN before this move
    const fenBefore = this.currentMoveIndex === 0
      ? this.START_FEN
      : this.currentPath[this.currentMoveIndex - 1].node.fenAfter;

    this.repertoireService.removeMove(fenBefore, this.selectedColor);
    this.snackBar.open(`${entry.node.san} supprimé du répertoire`, 'OK', { duration: 2000 });
    this.rebuildTree();
  }

  isActive(index: number): boolean {
    return index === this.currentMoveIndex;
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.previousMove();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.nextMove();
        break;
      case 'Home':
        event.preventDefault();
        this.goToStart();
        break;
      case 'End':
        event.preventDefault();
        this.goToEnd();
        break;
    }
  }

  private rebuildTree(): void {
    this.treeRoots = this.repertoireService.buildTree(this.selectedColor);
    this.currentPath = [];
    this.currentMoveIndex = -1;

    if (this.treeRoots.length > 0) {
      this.currentPath.push({ node: this.treeRoots[0], chosenVariantIndex: 0 });
      this.extendPath();
    }
  }

  private extendPath(): void {
    let lastNode = this.currentPath[this.currentPath.length - 1]?.node;
    while (lastNode && lastNode.children.length > 0) {
      this.currentPath.push({ node: lastNode.children[0], chosenVariantIndex: 0 });
      lastNode = lastNode.children[0];
    }
  }
}
