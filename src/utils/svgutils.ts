//svgutils.ts

import {
  Tile,
  ProcessedTile,
  RotationType,
  ShapeType,
  OpacityType,
} from "../types";
import {
  PRELOADED_SPREAD_EXEMPT_TILE_ID,
  SPREAD_EXEMPT_FILE_NAME,
} from "./defaultTiles";

export const isSpreadExempt = (tile: Pick<Tile, "fileName" | "id">): boolean =>
  tile.fileName === SPREAD_EXEMPT_FILE_NAME ||
  tile.id === PRELOADED_SPREAD_EXEMPT_TILE_ID;

/** Nearest ring index for circle mode (targets at (i+1)/n in cumulative area space). */
export const getIdealCircleRingIndex = (
  cumulativeAreaPercentage: number,
  numTiles: number
): number => {
  if (numTiles <= 1) return 0;
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < numTiles; i++) {
    const target = (i + 1) / numTiles;
    const d = Math.abs(cumulativeAreaPercentage - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
};

/** Nearest tile index along vertical gradient (targets at i/(n-1)). */
export const getIdealGradientTileIndex = (
  normalizedRow: number,
  numTiles: number
): number => {
  if (numTiles <= 1) return 0;
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < numTiles; i++) {
    const target = i / (numTiles - 1);
    const d = Math.abs(normalizedRow - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
};

/**
 * Deterministic global tile index for exponential shape (busy band vs empty band,
 * then row-based pick within that half). Uses same geometry as `selectTileExponential`.
 */
export const getIdealExponentialGlobalIndex = (
  tiles: ProcessedTile[],
  row: number,
  col: number,
  gridSize: number,
  shapeSpread: number
): number => {
  const n = tiles.length;
  if (n <= 1) return 0;
  const mid = Math.ceil(n / 2);
  const normalizedRow = row / Math.max(1, gridSize - 1);
  const exponent = (1 - shapeSpread) * 4 + 1;
  const fractionOfBusyTiles = Math.pow(normalizedRow, exponent);
  const numBusyTiles = Math.round(fractionOfBusyTiles * gridSize);
  const busyTilesCount = Math.min(numBusyTiles, gridSize);
  const startCol = Math.floor((gridSize - busyTilesCount) / 2);
  const endCol = startCol + busyTilesCount - 1;

  const busyIndices = Array.from({ length: mid }, (_, i) => i);
  const emptyIndices = Array.from({ length: n - mid }, (_, i) => i + mid);

  if (col >= startCol && col <= endCol) {
    if (busyIndices.length === 0) return 0;
    const local =
      busyIndices.length === 1
        ? 0
        : Math.min(
            busyIndices.length - 1,
            Math.max(0, Math.round(normalizedRow * (busyIndices.length - 1)))
          );
    return busyIndices[local];
  }
  if (emptyIndices.length === 0) return Math.min(row, n - 1);
  const local =
    emptyIndices.length === 1
      ? 0
      : Math.min(
          emptyIndices.length - 1,
          Math.max(0, Math.round(normalizedRow * (emptyIndices.length - 1)))
        );
  return emptyIndices[local];
};

const applySpreadExemptMask = (
  weights: { index: number; weight: number }[],
  orderedTiles: ProcessedTile[],
  idealIndex: number
): { index: number; weight: number }[] => {
  const idealTile = orderedTiles[idealIndex];

  // Ideal ring is spread-exempt: act as a hard mask — only that ring, no blur from inner rings.
  if (isSpreadExempt(idealTile)) {
    return weights.map((w) => ({
      ...w,
      weight: w.index === idealIndex ? 1 : 0,
    }));
  }

  const masked = weights.map((w) => {
    if (isSpreadExempt(orderedTiles[w.index]) && w.index !== idealIndex) {
      return { ...w, weight: 0 };
    }
    return w;
  });
  const sum = masked.reduce((s, w) => s + w.weight, 0);
  if (sum <= 0) {
    return [{ index: idealIndex, weight: 1 }];
  }
  return masked.map((w) => ({ ...w, weight: w.weight / sum }));
};

const pickTileByNormalizedWeights = (
  normalizedWeights: { index: number; weight: number }[],
  orderedTiles: ProcessedTile[],
  fallbackIndex: number
): ProcessedTile => {
  const rand = Math.random();
  let cumulative = 0;
  for (const w of normalizedWeights) {
    cumulative += w.weight;
    if (rand <= cumulative) {
      return orderedTiles[w.index];
    }
  }
  return orderedTiles[fallbackIndex];
};

export const traverseAndRemoveFills = (element: Element) => {
  element.setAttribute("fill", "none");
  element.childNodes.forEach((child) => {
    if (child instanceof Element) {
      traverseAndRemoveFills(child);
    }
  });
};

/**
 * Gamma-style remap on linear opacity [0, 1]. Lower sigma → sharper ramp (more contrast);
 * higher sigma → closer to linear (1.0 = identity).
 */
export const applyOpacitySigma = (raw: number, opacitySigma: number): number => {
  const s = Math.max(0.01, Math.min(1, opacitySigma));
  const t = Math.max(0, Math.min(1, raw));
  return Math.pow(t, 1 / s);
};

/**
 * Narrows the transition band of spatial opacity (gradient / orb / diamond).
 * Higher contrast stretches values away from mid-opacity, like gradient stops moved closer together.
 */
export const applyOpacityContrast = (raw: number, contrast: number): number => {
  const c = Math.max(0, Math.min(1, contrast));
  if (c <= 0) return Math.max(0, Math.min(1, raw));
  const t = Math.max(0, Math.min(1, raw));
  const factor = 1 + c * 9;
  return Math.max(0, Math.min(1, (t - 0.5) * factor + 0.5));
};

/** Uniform noise in [-opacityRandomness, +opacityRandomness], then clamped to [0, 1]. */
export const applyOpacityRandomness = (
  base: number,
  opacityRandomness: number
): number => {
  const r = Math.max(0, Math.min(1, opacityRandomness));
  if (r <= 0) return base;
  const noise = (Math.random() - 0.5) * 2 * r;
  return Math.max(0, Math.min(1, base + noise));
};

/** Per-cell opacity in [0, 1] for SVG `opacity` attribute. */
export const getOpacityForPosition = (
  opacity: OpacityType,
  row: number,
  col: number,
  gridSize: number,
  opacitySigma: number,
  opacityContrast: number
): number => {
  if (opacity === "uniform") return 1;

  if (opacity === "gradient") {
    if (gridSize <= 1) return applyOpacitySigma(1, opacitySigma);
    const raw = row / (gridSize - 1);
    return applyOpacitySigma(
      applyOpacityContrast(raw, opacityContrast),
      opacitySigma
    );
  }

  if (opacity === "orb" || opacity === "orb-inverted") {
    if (gridSize <= 1) return applyOpacitySigma(1, opacitySigma);
    const cx = gridSize / 2;
    const cy = gridSize / 2;
    const x = col + 0.5;
    const y = row + 0.5;
    const dist = Math.hypot(x - cx, y - cy);
    const corners: [number, number][] = [
      [0.5, 0.5],
      [gridSize - 0.5, 0.5],
      [0.5, gridSize - 0.5],
      [gridSize - 0.5, gridSize - 0.5],
    ];
    let maxDist = 0;
    for (const [px, py] of corners) {
      maxDist = Math.max(maxDist, Math.hypot(px - cx, py - cy));
    }
    if (maxDist <= 0) return applyOpacitySigma(1, opacitySigma);
    const t = Math.max(0, Math.min(1, 1 - dist / maxDist));
    const raw = opacity === "orb-inverted" ? 1 - t : t;
    return applyOpacitySigma(
      applyOpacityContrast(raw, opacityContrast),
      opacitySigma
    );
  }

  if (opacity === "diamond") {
    if (gridSize <= 1) return applyOpacitySigma(1, opacitySigma);
    const cx = gridSize / 2;
    const cy = gridSize / 2;
    const x = col + 0.5;
    const y = row + 0.5;
    const manhattan = Math.abs(x - cx) + Math.abs(y - cy);
    const corners: [number, number][] = [
      [0.5, 0.5],
      [gridSize - 0.5, 0.5],
      [0.5, gridSize - 0.5],
      [gridSize - 0.5, gridSize - 0.5],
    ];
    let maxManhattan = 0;
    for (const [px, py] of corners) {
      maxManhattan = Math.max(
        maxManhattan,
        Math.abs(px - cx) + Math.abs(py - cy)
      );
    }
    if (maxManhattan <= 0) return applyOpacitySigma(1, opacitySigma);
    const raw = Math.max(0, Math.min(1, 1 - manhattan / maxManhattan));
    return applyOpacitySigma(
      applyOpacityContrast(raw, opacityContrast),
      opacitySigma
    );
  }

  return 1;
};

// 6. Generate Tiled SVG Function
export const generateTiledSVG = (
  tiles: ProcessedTile[],
  gridSize: number,
  tileSize: number,
  shape: ShapeType,
  rotation: RotationType,
  shapeSpread: number,
  rotationRandomness: number,
  opacity: OpacityType,
  opacitySigma: number,
  opacityRandomness: number,
  opacityContrast: number
): string => {
  const svgWidth = gridSize * tileSize;
  const svgHeight = gridSize * tileSize;

  let svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      // Select tile based on shape
      const selectedTile = selectTileForPosition(
        tiles,
        row,
        col,
        gridSize,
        shape,
        shapeSpread
      );

      const patternRotation = getRotationAngle(rotation, row, col, gridSize);
      const tileOffset = getTileRotationOffset(
        selectedTile.tileRotationDeg,
        rotationRandomness
      );
      const rotationAngle = patternRotation + tileOffset;

      const xPos = col * tileSize;
      const yPos = row * tileSize;

      // Sanitize fileName for ID
      const sanitizedFileName = sanitizeForId(selectedTile.fileName);

      // Ensure uniqueness
      const uniqueId = `${sanitizedFileName}`;

      const transform = `translate(${xPos}, ${yPos}) rotate(${rotationAngle}, ${
        tileSize / 2
      }, ${tileSize / 2})`;

      let cellOpacity = getOpacityForPosition(
        opacity,
        row,
        col,
        gridSize,
        opacitySigma,
        opacityContrast
      );
      cellOpacity = applyOpacityRandomness(cellOpacity, opacityRandomness);

      svgString += `<g id="${uniqueId}" transform="${transform}" opacity="${cellOpacity}">${selectedTile.processedSVG}</g>`;
    }
  }

  svgString += `</svg>`;
  return svgString;
};

export const sanitizeForId = (input: string): string => {
  return input
    .replace(/[^a-zA-Z0-9\-_:.]/g, "")
    .replace(/\s+/g, "_")
    .trim();
};

// 3. Extract Inner SVG
export const extractInnerSVG = (tile: Tile, tileSize: number): string => {
  const { svg } = tile;
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  const svgElement = doc.querySelector("svg");
  if (!svgElement) return "";

  let viewBox = svgElement.getAttribute("viewBox");
  let origWidth = 24;
  let origHeight = 24;
  if (viewBox) {
    const vbValues = viewBox.split(" ").map(parseFloat);
    if (vbValues.length === 4) {
      origWidth = vbValues[2];
      origHeight = vbValues[3];
    }
  } else {
    const widthAttr = svgElement.getAttribute("width");
    const heightAttr = svgElement.getAttribute("height");
    const width = widthAttr ? parseFloat(widthAttr) : 24;
    const height = heightAttr ? parseFloat(heightAttr) : 24;
    origWidth = width;
    origHeight = height;
    svgElement.setAttribute("viewBox", `0 0 ${origWidth} ${origHeight}`);
  }

  svgElement.removeAttribute("width");
  svgElement.removeAttribute("height");

  traverseAndRemoveFills(svgElement);

  const scale = Math.min(24 / origWidth, 24 / origHeight);

  const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
  const translateX = (24 - origWidth * scale) / 2;
  const translateY = (24 - origHeight * scale) / 2;
  g.setAttribute(
    "transform",
    `translate(${translateX}, ${translateY}) scale(${scale})`
  );

  while (svgElement.firstChild) {
    g.appendChild(svgElement.firstChild);
  }

  const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", "24");
  rect.setAttribute("height", "24");
  rect.setAttribute("fill", "none");
  svgElement.appendChild(rect);
  svgElement.appendChild(g);

  let modifiedSVG = new XMLSerializer().serializeToString(svgElement);

  modifiedSVG = modifiedSVG.replace(/xmlns=".*?"/g, "");

  const innerContentMatch = modifiedSVG.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  const innerContent = innerContentMatch ? innerContentMatch[1] : modifiedSVG;

  return `
      <svg width="${tileSize}" height="${tileSize}" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" overflow="hidden">
        ${innerContent}
      </svg>
    `;
};

export const processUploadedTiles = (
  tiles: Tile[],
  tileSize: number
): ProcessedTile[] => {
  return tiles.map((tile) => {
    const processedSVG = extractInnerSVG(tile, tileSize);
    return {
      ...tile,
      processedSVG,
    };
  });
};

// 7. Select Tile for Position
export const selectTileForPosition = (
  tiles: ProcessedTile[],
  row: number,
  col: number,
  gridSize: number,
  shape: ShapeType,
  shapeSpread: number
): ProcessedTile => {
  switch (shape) {
    case "random":
      return selectTileRandom(tiles);
    case "circle":
      return selectTileCircle(tiles, row, col, gridSize, shapeSpread);
    case "gradient":
      return selectTileGradient(tiles, row, gridSize, shapeSpread);
    case "exponential":
      return selectTileExponential(tiles, row, col, gridSize, shapeSpread);
    default:
      return selectTileRandom(tiles);
  }
};

// 7a. Select Tile Randomly
export const selectTileRandom = (tiles: ProcessedTile[]): ProcessedTile => {
  const randomIndex = Math.floor(Math.random() * tiles.length);
  return tiles[randomIndex];
};

// 7b. Select Tile for Circle Shape
export const selectTileCircle = (
  tiles: ProcessedTile[],
  row: number,
  col: number,
  gridSize: number,
  shapeSpread: number
): ProcessedTile => {
  const centerX = gridSize / 2;
  const centerY = gridSize / 2;
  const totalRadius = gridSize / 2;

  // Tile order follows the user’s list order (first = innermost ring)
  const orderedTiles = tiles.slice();
  const numTiles = orderedTiles.length;

  // Precompute the cumulative area percentages for each ring
  const ringAreaPercentages = [];
  for (let i = 1; i <= numTiles; i++) {
    ringAreaPercentages.push(i / numTiles);
  }

  // Calculate distance from center for the current cell
  const x = col + 0.5;
  const y = row + 0.5;
  const dx = x - centerX;
  const dy = y - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const normalizedDistance = distance / totalRadius;
  const cumulativeAreaPercentage = normalizedDistance * normalizedDistance;

  const idealRingIndex = getIdealCircleRingIndex(
    cumulativeAreaPercentage,
    numTiles
  );

  // Gaussian spread for ring weights (shapeSpread controls transition width)

  // Calculate weights for each ring using Gaussian function
  const weights = ringAreaPercentages.map((ringAreaPercentage, index) => {
    const diff = cumulativeAreaPercentage - ringAreaPercentage;
    const exponent = -(diff * diff) / (2 * shapeSpread * shapeSpread);
    const weight = Math.exp(exponent);
    return {
      index,
      weight,
    };
  });

  // Normalize weights
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  const preMask = weights.map((w) => ({
    index: w.index,
    weight: w.weight / totalWeight,
  }));
  const normalizedWeights = applySpreadExemptMask(
    preMask,
    orderedTiles,
    idealRingIndex
  );

  return pickTileByNormalizedWeights(
    normalizedWeights,
    orderedTiles,
    idealRingIndex
  );
};

// 7c. Select Tile for Gradient Shape
export const selectTileGradient = (
  tiles: ProcessedTile[],
  row: number,
  gridSize: number,
  shapeSpread: number
): ProcessedTile => {
  const normalizedRow =
    gridSize <= 1 ? 0 : row / (gridSize - 1); // 0 at top, 1 at bottom

  // Tile order follows the user’s list order (first = top of gradient)
  const orderedTiles = tiles.slice();
  const numTiles = orderedTiles.length;

  const idealTileIndex = getIdealGradientTileIndex(normalizedRow, numTiles);

  // Precompute the positions for each tile along the gradient
  const tilePositions = [];
  for (let i = 0; i < numTiles; i++) {
    tilePositions.push(
      numTiles <= 1 ? 0 : i / (numTiles - 1)
    ); // Positions from 0 to 1
  }

  // Calculate weights for each tile using Gaussian function
  const weights = tilePositions.map((tilePosition, index) => {
    const diff = normalizedRow - tilePosition;
    const exponent = -(diff * diff) / (2 * shapeSpread * shapeSpread);
    const weight = Math.exp(exponent);
    return {
      index,
      weight,
    };
  });

  // Normalize weights
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  const preMask = weights.map((w) => ({
    index: w.index,
    weight: w.weight / totalWeight,
  }));
  const normalizedWeights = applySpreadExemptMask(
    preMask,
    orderedTiles,
    idealTileIndex
  );

  return pickTileByNormalizedWeights(
    normalizedWeights,
    orderedTiles,
    idealTileIndex
  );
};

export const selectTileExponential = (
  tiles: ProcessedTile[],
  row: number,
  col: number,
  gridSize: number,
  shapeSpread: number
): ProcessedTile => {
  const orderedTiles = tiles.slice();
  const n = orderedTiles.length;
  const idealGlobalIndex = getIdealExponentialGlobalIndex(
    orderedTiles,
    row,
    col,
    gridSize,
    shapeSpread
  );

  const normalizedRow = row / Math.max(1, gridSize - 1);

  // Exponent from shapeSpread (5 → 1 as spread goes 0 → 1)
  const exponent = (1 - shapeSpread) * 4 + 1;

  const fractionOfBusyTiles = Math.pow(normalizedRow, exponent);
  const numBusyTiles = Math.round(fractionOfBusyTiles * gridSize);

  const busyTilesCount = Math.min(numBusyTiles, gridSize);
  const startCol = Math.floor((gridSize - busyTilesCount) / 2);
  const endCol = startCol + busyTilesCount - 1;

  const mid = Math.ceil(n / 2);
  const busyIndices = Array.from({ length: mid }, (_, i) => i);
  const emptyIndices = Array.from({ length: n - mid }, (_, i) => i + mid);

  const poolIndices =
    col >= startCol && col <= endCol ? busyIndices : emptyIndices;

  if (poolIndices.length === 0) {
    return selectTileRandom(tiles);
  }

  const uniformWeights = poolIndices.map((idx) => ({
    index: idx,
    weight: 1 / poolIndices.length,
  }));
  const normalizedWeights = applySpreadExemptMask(
    uniformWeights,
    orderedTiles,
    idealGlobalIndex
  );

  return pickTileByNormalizedWeights(
    normalizedWeights,
    orderedTiles,
    idealGlobalIndex
  );
};

const QUARTER_TURNS = [0, 90, 180, -90] as const;

export const randomQuarterTurn = (): number =>
  QUARTER_TURNS[Math.floor(Math.random() * QUARTER_TURNS.length)];

/**
 * Per-tile rotation on top of pattern rotation. At 0, uses tileRotationDeg;
 * at 1, ignores it and uses a random quarter turn; in between, probability blend.
 */
export const getTileRotationOffset = (
  tileRotationDeg: number | undefined,
  rotationRandomness: number
): number => {
  const r = Math.max(0, Math.min(1, rotationRandomness));
  if (r <= 0) return tileRotationDeg ?? 0;
  if (r >= 1) return randomQuarterTurn();
  return Math.random() < r ? randomQuarterTurn() : (tileRotationDeg ?? 0);
};

// 8. Get Rotation Angle
export const getRotationAngle = (
  rotation: RotationType,
  row: number,
  col: number,
  gridSize: number
): number => {
  const centerX = gridSize / 2;
  const centerY = gridSize / 2;

  if (rotation === "random") {
    const rotationOptions = [0, 90, 180, -90];
    return rotationOptions[Math.floor(Math.random() * rotationOptions.length)];
  } else if (rotation === "pyramid") {
    const dx = col + 0.5 - centerX;
    const dy = row + 0.5 - centerY;
    const theta = Math.atan2(dy, dx) * (180 / Math.PI); // Convert radians to degrees

    if (theta >= -45 && theta < 45) {
      // East sector
      return 0;
    } else if (theta >= 45 && theta < 135) {
      // South sector
      return 90;
    } else if (theta >= -135 && theta < -45) {
      // North sector
      return -90;
    } else {
      // West sector
      return 180;
    }
  } else {
    // Default rotation
    return 0;
  }
};
