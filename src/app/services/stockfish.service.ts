import { Injectable, NgZone } from '@angular/core';
import { Evaluation } from '../models/analysis.model';

@Injectable({ providedIn: 'root' })
export class StockfishService {
  private worker: Worker | null = null;
  private isReady = false;
  private readonly DEFAULT_DEPTH = 16;

  constructor(private ngZone: NgZone) {}

  async init(): Promise<void> {
    if (this.worker) return;

    return new Promise<void>((resolve, reject) => {
      try {
        this.worker = new Worker('stockfish-18-lite-single.js');

        const onReady = (e: MessageEvent) => {
          const msg: string = typeof e.data === 'string' ? e.data : '';
          if (msg.includes('uciok')) {
            this.isReady = true;
            this.worker!.removeEventListener('message', onReady);
            // Request 2 principal variations for move quality analysis
            this.worker!.postMessage('setoption name MultiPV value 2');
            resolve();
          }
        };

        this.worker.addEventListener('message', onReady);
        this.worker.addEventListener('error', (err) => {
          reject(new Error(`Stockfish worker error: ${err.message}`));
        });

        this.worker.postMessage('uci');
      } catch (err) {
        reject(err);
      }
    });
  }

  async analyzePosition(fen: string, depth?: number): Promise<Evaluation> {
    if (!this.worker || !this.isReady) {
      await this.init();
    }

    const analysisDepth = depth ?? this.DEFAULT_DEPTH;
    const isBlackToMove = fen.split(' ')[1] === 'b';

    return new Promise<Evaluation>((resolve) => {
      // Track best info per PV line at deepest depth seen
      const pvData: Record<number, { depth: number; cp: number | null; mate: number | null; pv: string[] }> = {};
      let maxDepthSeen = 0;

      const onMessage = (e: MessageEvent) => {
        const msg: string = typeof e.data === 'string' ? e.data : '';

        if (msg.startsWith('info') && msg.includes(' pv ')) {
          const parsed = this.parseInfoLine(msg);
          if (parsed.depth >= maxDepthSeen) {
            maxDepthSeen = parsed.depth;
          }
          // Store latest info per multipv line at its depth
          if (parsed.depth >= (pvData[parsed.multipv]?.depth ?? 0)) {
            pvData[parsed.multipv] = {
              depth: parsed.depth,
              cp: parsed.cp,
              mate: parsed.mate,
              pv: parsed.pv,
            };
          }
        }

        if (msg.startsWith('bestmove')) {
          this.worker!.removeEventListener('message', onMessage);
          const bestMoveUci = msg.split(' ')[1] || null;

          const pv1 = pvData[1];
          const pv2 = pvData[2];

          const normSign = isBlackToMove ? -1 : 1;
          const bestCp = pv1?.cp !== null && pv1?.cp !== undefined ? normSign * pv1.cp : null;
          const bestMate = pv1?.mate !== null && pv1?.mate !== undefined ? normSign * pv1.mate : null;
          const secondBestCp = pv2?.cp !== null && pv2?.cp !== undefined ? normSign * pv2.cp : null;

          this.ngZone.run(() => {
            resolve({
              cp: bestCp,
              mate: bestMate,
              depth: maxDepthSeen,
              bestMove: bestMoveUci,
              pv: pv1?.pv ?? [],
              secondBestCp,
            });
          });
        }
      };

      this.worker!.addEventListener('message', onMessage);
      this.worker!.postMessage('position fen ' + fen);
      this.worker!.postMessage('go depth ' + analysisDepth);
    });
  }

  async analyzePositions(
    fens: string[],
    onProgress?: (progress: number) => void,
    depth?: number
  ): Promise<Evaluation[]> {
    await this.init();

    // Send "isready" and wait for "readyok" to sync state
    await this.sendIsReady();

    const evaluations: Evaluation[] = [];
    for (let i = 0; i < fens.length; i++) {
      const evaluation = await this.analyzePosition(fens[i], depth);
      evaluations.push(evaluation);

      if (onProgress) {
        onProgress(((i + 1) / fens.length) * 100);
      }
    }

    return evaluations;
  }

  private sendIsReady(): Promise<void> {
    return new Promise((resolve) => {
      const onMessage = (e: MessageEvent) => {
        if (typeof e.data === 'string' && e.data.includes('readyok')) {
          this.worker!.removeEventListener('message', onMessage);
          resolve();
        }
      };
      this.worker!.addEventListener('message', onMessage);
      this.worker!.postMessage('isready');
    });
  }

  private parseInfoLine(line: string): {
    depth: number;
    cp: number | null;
    mate: number | null;
    pv: string[];
    multipv: number;
  } {
    const tokens = line.split(' ');
    let depth = 0;
    let cp: number | null = null;
    let mate: number | null = null;
    let pv: string[] = [];
    let multipv = 1;

    for (let i = 0; i < tokens.length; i++) {
      switch (tokens[i]) {
        case 'depth':
          depth = parseInt(tokens[i + 1], 10);
          break;
        case 'cp':
          cp = parseInt(tokens[i + 1], 10);
          break;
        case 'mate':
          mate = parseInt(tokens[i + 1], 10);
          break;
        case 'multipv':
          multipv = parseInt(tokens[i + 1], 10);
          break;
        case 'pv':
          pv = tokens.slice(i + 1);
          break;
      }
    }

    return { depth, cp, mate, pv, multipv };
  }

  destroy(): void {
    if (this.worker) {
      this.worker.postMessage('quit');
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}
