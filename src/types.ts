export interface Tile {
  /** Stable id for list keys and drag-and-drop. */
  id: string;
  svg: string;
  fileName: string;
  /** Per-instance rotation in degrees (0, 90, 180, or −90). Applied on top of pattern rotation. */
  tileRotationDeg?: number;
  /**
   * When true, this tile is omitted from shape hierarchy (remaining tiles expand to fill bands).
   * It is placed in a number of cells equal to its ideal band size (spread→0, full list), at
   * random positions across the grid, still subject to spread-exempt rules unless listed after
   * the first spread-exempt tile.
   */
  distribute?: boolean;
}

export interface ProcessedTile extends Tile {
  processedSVG: string;
}

export type ShapeType = "random" | "circle" | "gradient" | "exponential";
export type RotationType = "default" | "random" | "pyramid";
/** Tile opacity layout: uniform, row gradient, circular or diamond radial, or inverted orb. */
export type OpacityType =
  | "uniform"
  | "gradient"
  | "orb"
  | "orb-inverted"
  | "diamond";
