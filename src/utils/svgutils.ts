//svgutils.ts

import { Tile, ProcessedTile, RotationType, ShapeType } from "../types";

export const traverseAndRemoveFills = (element: Element) => {
  element.setAttribute("fill", "none");
  element.childNodes.forEach((child) => {
    if (child instanceof Element) {
      traverseAndRemoveFills(child);
    }
  });
};

// 6. Generate Tiled SVG Function
export const generateTiledSVG = (
  tiles: ProcessedTile[],
  gridSize: number,
  tileSize: number,
  shape: ShapeType,
  rotation: RotationType,
  sigma: number
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
        sigma
      );

      // Get rotation angle
      const rotationAngle = getRotationAngle(rotation, row, col, gridSize);

      const xPos = col * tileSize;
      const yPos = row * tileSize;

      // Sanitize fileName for ID
      const sanitizedFileName = sanitizeForId(selectedTile.fileName);

      // Ensure uniqueness
      const uniqueId = `${sanitizedFileName}`;

      const transform = `translate(${xPos}, ${yPos}) rotate(${rotationAngle}, ${
        tileSize / 2
      }, ${tileSize / 2})`;

      svgString += `<g id="${uniqueId}" transform="${transform}">${selectedTile.processedSVG}</g>`;
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
  return tiles
    .map((tile) => {
      const processedSVG = extractInnerSVG(tile, tileSize);
      return {
        ...tile,
        processedSVG,
      };
    })
    .filter((tile) => tile.processedSVG.trim() !== "");
};

// 7. Select Tile for Position
export const selectTileForPosition = (
  tiles: ProcessedTile[],
  row: number,
  col: number,
  gridSize: number,
  shape: ShapeType,
  sigma: number
): ProcessedTile => {
  switch (shape) {
    case "random":
      return selectTileRandom(tiles);
    case "circle":
      return selectTileCircle(tiles, row, col, gridSize, sigma);
    case "gradient":
      return selectTileGradient(tiles, row, gridSize, sigma);
    case "exponential":
      return selectTileExponential(tiles, row, col, gridSize, sigma);
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
  sigma: number
): ProcessedTile => {
  const centerX = gridSize / 2;
  const centerY = gridSize / 2;
  const totalRadius = gridSize / 2;

  // Sort tiles by busyness in descending order
  const sortedTiles = tiles.slice().sort((a, b) => b.busyness - a.busyness);
  const numTiles = sortedTiles.length;

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

  // Define sigma for the Gaussian (controls the amount of noise)

  // Calculate weights for each ring using Gaussian function
  const weights = ringAreaPercentages.map((ringAreaPercentage, index) => {
    const diff = cumulativeAreaPercentage - ringAreaPercentage;
    const exponent = -(diff * diff) / (2 * sigma * sigma);
    const weight = Math.exp(exponent);
    return {
      index,
      weight,
    };
  });

  // Normalize weights
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  const normalizedWeights = weights.map((w) => ({
    index: w.index,
    weight: w.weight / totalWeight,
  }));

  // Randomly select a ring based on weights
  const rand = Math.random();
  let cumulative = 0;
  let ringIndex = numTiles - 1; // Default to outermost ring
  for (const w of normalizedWeights) {
    cumulative += w.weight;
    if (rand <= cumulative) {
      ringIndex = w.index;
      break;
    }
  }

  // Select the tile corresponding to the ring
  return sortedTiles[ringIndex];
};

// 7c. Select Tile for Gradient Shape
export const selectTileGradient = (
  tiles: ProcessedTile[],
  row: number,
  gridSize: number,
  sigma: number // Accept sigma here
): ProcessedTile => {
  const normalizedRow = row / (gridSize - 1); // 0 at top, 1 at bottom

  // Sort tiles by busyness in descending order
  const sortedTiles = tiles.slice().sort((a, b) => b.busyness - a.busyness);
  const numTiles = sortedTiles.length;

  // Precompute the positions for each tile along the gradient
  const tilePositions = [];
  for (let i = 0; i < numTiles; i++) {
    tilePositions.push(i / (numTiles - 1)); // Positions from 0 to 1
  }

  // Calculate weights for each tile using Gaussian function
  const weights = tilePositions.map((tilePosition, index) => {
    const diff = normalizedRow - tilePosition;
    const exponent = -(diff * diff) / (2 * sigma * sigma);
    const weight = Math.exp(exponent);
    return {
      index,
      weight,
    };
  });

  // Normalize weights
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  const normalizedWeights = weights.map((w) => ({
    index: w.index,
    weight: w.weight / totalWeight,
  }));

  // Randomly select a tile based on weights
  const rand = Math.random();
  let cumulative = 0;
  for (const w of normalizedWeights) {
    cumulative += w.weight;
    if (rand <= cumulative) {
      return sortedTiles[w.index];
    }
  }

  // Fallback
  return selectTileRandom(tiles);
};

export const selectTileExponential = (
  tiles: ProcessedTile[],
  row: number,
  col: number,
  gridSize: number,
  sigma: number // Accept sigma here
): ProcessedTile => {
  const normalizedRow = row / Math.max(1, gridSize - 1);

  // Calculate exponent based on sigma
  const exponent = (1 - sigma) * 4 + 1; // Exponent ranges from 5 to 1 as sigma goes from 0 to 1

  const fractionOfBusyTiles = Math.pow(normalizedRow, exponent);
  const numBusyTiles = Math.round(fractionOfBusyTiles * gridSize);

  const busyTilesCount = Math.min(numBusyTiles, gridSize);
  const startCol = Math.floor((gridSize - busyTilesCount) / 2);
  const endCol = startCol + busyTilesCount - 1;

  if (col >= startCol && col <= endCol) {
    const busyTiles = tiles.filter((tile) => tile.busyness === 10);
    if (busyTiles.length > 0) {
      const busyIndex = Math.floor(Math.random() * busyTiles.length);
      return busyTiles[busyIndex];
    } else {
      return selectTileRandom(tiles);
    }
  } else {
    const emptyTiles = tiles.filter((tile) => tile.busyness === 0);
    if (emptyTiles.length > 0) {
      const emptyIndex = Math.floor(Math.random() * emptyTiles.length);
      return emptyTiles[emptyIndex];
    } else {
      return selectTileRandom(tiles);
    }
  }
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
