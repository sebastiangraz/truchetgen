export interface Tile {
  svg: string;
  busyness: number;
  processedSVG?: string;
  fileName: string;
}

export type ShapeType = "random" | "circle" | "gradient" | "exponential";
export type RotationType = "default" | "random" | "pyramid";
