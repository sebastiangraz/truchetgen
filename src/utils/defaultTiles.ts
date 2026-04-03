import type { Tile } from "../types";

const EMPTY_TILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none" /></svg>`;

/** Stable id for the built-in transparent tile (first in the catalog). */
export const PRELOADED_EMPTY_TILE_ID = "preloaded-empty";

/** Same SVG as empty; ring index is spread-exempt (hard boundary for shape spread). */
export const PRELOADED_SPREAD_EXEMPT_TILE_ID = "preloaded-spread-exempt";

/** Match on `fileName` for uploaded duplicates and catalog entry. */
export const SPREAD_EXEMPT_FILE_NAME = "exempt";

const emptyCatalogTile: Tile = {
  id: PRELOADED_EMPTY_TILE_ID,
  fileName: "empty",
  svg: EMPTY_TILE_SVG,
};

const spreadExemptCatalogTile: Tile = {
  id: PRELOADED_SPREAD_EXEMPT_TILE_ID,
  fileName: SPREAD_EXEMPT_FILE_NAME,
  svg: EMPTY_TILE_SVG,
};

/**
 * Preloaded SVGs from `src/assets/tiles/*.svg` (bundled at build time).
 * Add or replace files in that folder; order follows sorted paths.
 * The empty transparent tile is always listed first, then the spread-exempt tile.
 */
const rawTileModules = import.meta.glob<string>("../assets/tiles/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
});

const pathToFileName = (path: string): string => {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? "tile.svg";
};

const pathToStableId = (path: string): string =>
  `preloaded-${path.replace(/[^a-zA-Z0-9]/g, "-")}`;

export const getPreloadedTiles = (): Tile[] => {
  const paths = Object.keys(rawTileModules).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  const fromAssets = paths.map((path) => {
    const svg = rawTileModules[path];
    return {
      id: pathToStableId(path),
      fileName: pathToFileName(path),
      svg,
    };
  });

  return [emptyCatalogTile, spreadExemptCatalogTile, ...fromAssets];
};
