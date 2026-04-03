export interface Tile {
  /** Stable id for list keys and drag-and-drop. */
  id: string;
  svg: string;
  fileName: string;
}

export interface ProcessedTile extends Tile {
  processedSVG: string;
}

export type ShapeType = "random" | "circle" | "gradient" | "exponential";
export type RotationType = "default" | "random" | "pyramid";
