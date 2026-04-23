import { Injectable } from '@angular/core';
import { AnalyzedMove, OpeningDetection } from '../models/analysis.model';
import { OPENINGS, OpeningTuple } from '../data/openings';

interface TrieNode {
  children: Map<string, TrieNode>;
  opening: OpeningTuple | null;
}

@Injectable({ providedIn: 'root' })
export class OpeningService {
  private root: TrieNode | null = null;

  detectOpening(moves: AnalyzedMove[]): OpeningDetection | null {
    if (!this.root) {
      this.root = this.buildTrie();
    }

    let node = this.root;
    let lastMatch: { tuple: OpeningTuple; depth: number } | null = null;

    for (let i = 0; i < moves.length; i++) {
      const san = moves[i].san;
      const child = node.children.get(san);
      if (!child) break;
      node = child;
      if (node.opening) {
        lastMatch = { tuple: node.opening, depth: i + 1 };
      }
    }

    if (!lastMatch) return null;

    return {
      eco: lastMatch.tuple[0],
      name: lastMatch.tuple[1],
      bookMoveCount: lastMatch.depth,
    };
  }

  private buildTrie(): TrieNode {
    const root: TrieNode = { children: new Map(), opening: null };

    for (const tuple of OPENINGS) {
      const moves = tuple[2].split(' ');
      let node = root;
      for (const move of moves) {
        let child = node.children.get(move);
        if (!child) {
          child = { children: new Map(), opening: null };
          node.children.set(move, child);
        }
        node = child;
      }
      if (!node.opening) {
        node.opening = tuple;
      }
    }

    return root;
  }
}
