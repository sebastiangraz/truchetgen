export interface Tile {
  /** Stable id for list keys and drag-and-drop. */
  id: string;
  svg: string;
  fileName: string;
  /** Per-instance rotation in degrees (0, 90, 180, or −90). Applied on top of pattern rotation. */
  tileRotationDeg?: number;
}

export interface ProcessedTile extends Tile {
  processedSVG: string;
}

export type ShapeType = "random" | "circle" | "gradient" | "exponential";
export type RotationType = "default" | "random" | "pyramid";
