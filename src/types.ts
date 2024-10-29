export interface Tile {
  svg: string;
  busyness: number;
  fileName: string;
}

export interface ProcessedTile extends Tile {
  processedSVG: string;
}

export type ShapeType = "random" | "circle" | "gradient" | "exponential";
export type RotationType = "default" | "random" | "pyramid";
