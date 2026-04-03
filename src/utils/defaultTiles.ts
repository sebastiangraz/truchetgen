import type { Tile } from "../types";

/**
 * Preloaded SVGs from `src/assets/tiles/*.svg` (bundled at build time).
 * Add or replace files in that folder; order follows sorted paths.
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
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  return paths.map((path) => {
    const svg = rawTileModules[path];
    return {
      id: pathToStableId(path),
      fileName: pathToFileName(path),
      svg,
    };
  });
};
