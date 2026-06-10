import type { MapDoc } from "./doc";

/** Snapshot-based undo/redo. The doc is small; clones are cheap and bug-proof. */
export class History {
  private undoStack: MapDoc[] = [];
  private redoStack: MapDoc[] = [];
  private readonly limit = 100;

  /** Call BEFORE mutating the doc. */
  push(doc: MapDoc): void {
    this.undoStack.push(structuredClone(doc));
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo(current: MapDoc): MapDoc | null {
    const prev = this.undoStack.pop();
    if (prev === undefined) return null;
    this.redoStack.push(structuredClone(current));
    return prev;
  }

  redo(current: MapDoc): MapDoc | null {
    const next = this.redoStack.pop();
    if (next === undefined) return null;
    this.undoStack.push(structuredClone(current));
    return next;
  }
}
