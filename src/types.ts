export interface Tile {
  /** Stable id for list keys and drag-and-drop. */
  id: string;
  svg: string;
  fileName: string;
  /** Per-instance rotation in degrees (0, 90, 180, or −90). Applied on top of pattern rotation. */
  tileRotationDeg?: number;
  /**
   * When true, circle / gradient / exponential ignore this tile’s list index for placement
   * and spread it uniformly across cells (still subject to spread-exempt rules unless listed
   * after the first spread-exempt tile).
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
