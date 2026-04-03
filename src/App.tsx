import {
  useState,
  useEffect,
  ChangeEvent,
  useMemo,
  useRef,
  DragEvent,
} from "react";
import {
  generateTiledSVG,
  isSpreadExempt,
  processUploadedTiles,
} from "./utils/svgutils";
import { handleFileUpload } from "./utils/fileutils";
import {
  getPreloadedTiles,
  PRELOADED_EMPTY_TILE_ID,
  PRELOADED_SPREAD_EXEMPT_TILE_ID,
} from "./utils/defaultTiles";
import { Tile, ShapeType, RotationType, OpacityType } from "./types";

import "./styles.css";

interface TruchetGeneratorProps {
  tileSize?: number;
}

const TILE_ROTATION_CYCLE = [0, 90, 180, -90] as const;

const normalizeStoredTileRotation = (v: unknown): number | undefined => {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  if (v === 270) return -90;
  if (v === 0 || v === 90 || v === 180 || v === -90) {
    return v;
  }
  return undefined;
};

const parseStoredTiles = (raw: string): Tile[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const result: Tile[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (typeof o.svg !== "string" || typeof o.fileName !== "string") continue;
      const rot = normalizeStoredTileRotation(o.tileRotationDeg);
      result.push({
        id: typeof o.id === "string" ? o.id : crypto.randomUUID(),
        svg: o.svg,
        fileName: o.fileName,
        ...(rot !== undefined ? { tileRotationDeg: rot } : {}),
        ...(o.distribute === true ? { distribute: true } : {}),
      });
    }
    return result;
  } catch {
    return [];
  }
};

const readInitialActiveTiles = (): Tile[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("uploadedTiles");
  if (!stored) return [];
  const parsed = parseStoredTiles(stored);
  return parsed.length > 0 ? parsed : [];
};

const TruchetGenerator = ({ tileSize = 24 }: TruchetGeneratorProps) => {
  const [activeTiles, setActiveTiles] = useState<Tile[]>(
    readInitialActiveTiles,
  );
  const [error, setError] = useState<string>("");
  const [gridSize, setGridSize] = useState<number>(8);
  const [shape, setShape] = useState<ShapeType>("random");
  const [rotation, setRotation] = useState<RotationType>("default");
  const [opacity, setOpacity] = useState<OpacityType>("uniform");
  const [shapeSpread, setShapeSpread] = useState<number>(0.15);
  const [rotationRandomness, setRotationRandomness] = useState<number>(0);
  const [opacitySigma, setOpacitySigma] = useState<number>(0.15);
  const [opacityRandomness, setOpacityRandomness] = useState<number>(0);
  const [opacityContrast, setOpacityContrast] = useState<number>(0);
  const dragFromIndex = useRef<number | null>(null);

  const catalogTiles = useMemo(() => getPreloadedTiles(), []);
  const hasAssetCatalogTiles = useMemo(
    () =>
      catalogTiles.some(
        (t) =>
          t.id !== PRELOADED_EMPTY_TILE_ID &&
          t.id !== PRELOADED_SPREAD_EXEMPT_TILE_ID,
      ),
    [catalogTiles],
  );

  const processedCatalogTiles = useMemo(
    () => processUploadedTiles(catalogTiles, tileSize),
    [catalogTiles, tileSize],
  );

  useEffect(() => {
    localStorage.setItem("uploadedTiles", JSON.stringify(activeTiles));
  }, [activeTiles]);

  const processedTiles = useMemo(
    () => processUploadedTiles(activeTiles, tileSize),
    [activeTiles, tileSize],
  );

  const tilesForGeneration = useMemo(
    () => processedTiles.filter((t) => t.processedSVG.trim() !== ""),
    [processedTiles],
  );

  const tiledSVG = useMemo(() => {
    if (tilesForGeneration.length === 0) return "";

    return generateTiledSVG(
      tilesForGeneration,
      gridSize,
      tileSize,
      shape,
      rotation,
      shapeSpread,
      rotationRandomness,
      opacity,
      opacitySigma,
      opacityRandomness,
      opacityContrast,
    );
  }, [
    tilesForGeneration,
    gridSize,
    tileSize,
    shape,
    rotation,
    shapeSpread,
    rotationRandomness,
    opacity,
    opacitySigma,
    opacityRandomness,
    opacityContrast,
  ]);

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value, 10);
    setGridSize(newSize);
  };

  const handleShapeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const selectedShape = e.target.value as ShapeType;
    setShape(selectedShape);
  };

  const handleRotationChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const selectedRotation = e.target.value as RotationType;
    setRotation(selectedRotation);
  };

  const handleOpacityChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setOpacity(e.target.value as OpacityType);
  };

  const handleShapeSpreadChange = (e: ChangeEvent<HTMLInputElement>) => {
    setShapeSpread(parseFloat(e.target.value));
  };

  const handleRotationRandomnessChange = (e: ChangeEvent<HTMLInputElement>) => {
    setRotationRandomness(parseFloat(e.target.value));
  };

  const handleOpacitySigmaChange = (e: ChangeEvent<HTMLInputElement>) => {
    setOpacitySigma(parseFloat(e.target.value));
  };

  const handleOpacityRandomnessChange = (e: ChangeEvent<HTMLInputElement>) => {
    setOpacityRandomness(parseFloat(e.target.value));
  };

  const handleOpacityContrastChange = (e: ChangeEvent<HTMLInputElement>) => {
    setOpacityContrast(parseFloat(e.target.value));
  };

  const addCatalogTileToActive = (tile: Tile) => {
    setActiveTiles((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        svg: tile.svg,
        fileName: tile.fileName,
      },
    ]);
  };

  const reorderTiles = (from: number, to: number) => {
    if (from === to) return;
    setActiveTiles((prev) => {
      const next = [...prev];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      return next;
    });
  };

  const handleDragStart = (index: number) => (e: DragEvent<HTMLDivElement>) => {
    dragFromIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (dropIndex: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const from = dragFromIndex.current;
    dragFromIndex.current = null;
    if (from === null || from === dropIndex) return;
    reorderTiles(from, dropIndex);
  };

  const handleDragEnd = () => {
    dragFromIndex.current = null;
  };

  const deleteTile = (index: number) => {
    setActiveTiles((prevTiles) => {
      const updatedTiles = [...prevTiles];
      updatedTiles.splice(index, 1);
      return updatedTiles;
    });
  };

  const clearAllTiles = () => {
    setActiveTiles([]);
    localStorage.removeItem("uploadedTiles");
  };

  const resetAllRotations = () => {
    setActiveTiles((prev) =>
      prev.map((t) => {
        const next = { ...t };
        delete next.tileRotationDeg;
        return next;
      }),
    );
  };

  const rotateTileAt = (index: number) => {
    setActiveTiles((prev) => {
      const next = [...prev];
      const t = next[index];
      const cur = t.tileRotationDeg ?? 0;
      const idx = TILE_ROTATION_CYCLE.indexOf(
        cur as (typeof TILE_ROTATION_CYCLE)[number],
      );
      const safeIdx = idx === -1 ? 0 : idx;
      const nextDeg = TILE_ROTATION_CYCLE[(safeIdx + 1) % 4];
      next[index] = { ...t, tileRotationDeg: nextDeg };
      return next;
    });
  };

  const toggleDistributeAt = (index: number) => {
    setActiveTiles((prev) => {
      const next = [...prev];
      const t = next[index];
      const on = !t.distribute;
      next[index] = on ? { ...t, distribute: true } : { ...t };
      if (!on) {
        delete next[index].distribute;
      }
      return next;
    });
  };

  const displayName = (fileName: string) =>
    fileName.substring(0, fileName.lastIndexOf(".")) || fileName;

  return (
    <div className="generator">
      <div className="app-grid">
        <div className="app-grid__cell app-grid__cell--title">
          <div className="multi-container">
            <h1>
              Truchet
              <br /> Generator
            </h1>
          </div>
        </div>
        <div className="app-grid__cell app-grid__cell--upload">
          <div className="upload-container">
            <input
              type="file"
              accept=".svg"
              multiple
              onChange={(e) => handleFileUpload(e, setActiveTiles, setError)}
            />
          </div>
        </div>
        <div className="app-grid__cell app-grid__cell--shape">
          <div className="multi-container">
            <div>
              <label htmlFor="shape">Shape</label>
              <select
                id="shape"
                name="shape"
                value={shape}
                onChange={handleShapeChange}
              >
                <option value="random">Random</option>
                <option value="circle">Circle</option>
                <option value="gradient">Gradient</option>
                <option value="exponential">Exponential</option>
              </select>
            </div>
            <div>
              <label htmlFor="rotation">Rotation</label>
              <select
                id="rotation"
                name="rotation"
                value={rotation}
                onChange={handleRotationChange}
              >
                <option value="default">Default</option>
                <option value="random">Random</option>
                <option value="pyramid">Pyramid</option>
              </select>
            </div>
            <div>
              <label htmlFor="opacity">Opacity</label>
              <select
                id="opacity"
                name="opacity"
                value={opacity}
                onChange={handleOpacityChange}
              >
                <option value="uniform">Uniform</option>
                <option value="gradient">Gradient</option>
                <option value="orb">Orb</option>
                <option value="orb-inverted">Orb (inverted)</option>
                <option value="diamond">Diamond</option>
              </select>
            </div>
          </div>
        </div>
        <div className="app-grid__cell app-grid__cell--sliders">
          <div className="multi-container">
            <div>
              <label htmlFor="gridSize">
                Grid Size {gridSize}x{gridSize}
              </label>
              <input
                type="range"
                id="gridSize"
                name="gridSize"
                min="8"
                max="56"
                value={gridSize}
                onChange={handleSliderChange}
              />
            </div>
            <div>
              <label htmlFor="shapeSpread">
                Shape Spread {shapeSpread.toFixed(2)}
              </label>
              <input
                type="range"
                id="shapeSpread"
                name="shapeSpread"
                min="0"
                max="1.0"
                step="0.01"
                value={shapeSpread}
                onChange={handleShapeSpreadChange}
              />
            </div>
            <div>
              <label htmlFor="rotationRandomness">
                Rotation Randomness {rotationRandomness.toFixed(2)}
              </label>
              <input
                type="range"
                id="rotationRandomness"
                name="rotationRandomness"
                min="0"
                max="1.0"
                step="0.01"
                value={rotationRandomness}
                onChange={handleRotationRandomnessChange}
              />
            </div>
            {opacity !== "uniform" && (
              <div>
                <label htmlFor="opacitySigma">
                  Opacity Sigma {opacitySigma.toFixed(2)}
                </label>
                <input
                  type="range"
                  id="opacitySigma"
                  name="opacitySigma"
                  min="0"
                  max="1.0"
                  step="0.01"
                  value={opacitySigma}
                  onChange={handleOpacitySigmaChange}
                />
              </div>
            )}
            <div>
              <label htmlFor="opacityRandomness">
                Opacity Randomness {opacityRandomness.toFixed(2)}
              </label>
              <input
                type="range"
                id="opacityRandomness"
                name="opacityRandomness"
                min="0"
                max="1.0"
                step="0.01"
                value={opacityRandomness}
                onChange={handleOpacityRandomnessChange}
              />
            </div>
            {opacity !== "uniform" && (
              <div>
                <label htmlFor="opacityContrast">
                  Opacity Contrast {opacityContrast.toFixed(2)}
                </label>
                <input
                  type="range"
                  id="opacityContrast"
                  name="opacityContrast"
                  min="0"
                  max="1.0"
                  step="0.01"
                  value={opacityContrast}
                  onChange={handleOpacityContrastChange}
                />
              </div>
            )}
          </div>
        </div>

        <div className="app-grid__cell app-grid__cell--catalog tiles-column tiles-column--catalog">
          <p className="tiles-column-heading">Default tiles</p>
          {!hasAssetCatalogTiles && (
            <p className="tiles-column-empty">No assets in src/assets/tiles</p>
          )}
          <ul className="default-tile-list">
            {catalogTiles.map((tile, index) => {
              const processedSVG =
                processedCatalogTiles[index]?.processedSVG || "";
              return (
                <li key={tile.id}>
                  <button
                    type="button"
                    className="default-tile-item"
                    onClick={() => addCatalogTileToActive(tile)}
                    title="Add to sequence"
                  >
                    <div
                      className={
                        tile.id === PRELOADED_SPREAD_EXEMPT_TILE_ID
                          ? "default-tile-thumb default-tile-thumb--spread-exempt"
                          : "default-tile-thumb"
                      }
                      dangerouslySetInnerHTML={{ __html: processedSVG }}
                    />
                    <span className="default-tile-name">
                      {displayName(tile.fileName)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="app-grid__cell app-grid__cell--active tiles-column tiles-column--active">
          <p className="tiles-column-heading">Tiles in use</p>
          <div className="active-tiles-inner">
            {activeTiles.length > 0 && (
              <div className="tile-list">
                {activeTiles.map((tile, index) => {
                  const processedSVG =
                    processedTiles[index]?.processedSVG || "";
                  const tileDeg = tile.tileRotationDeg ?? 0;
                  return (
                    <div
                      key={tile.id}
                      className="tile-item"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop(index)}
                    >
                      <div className="tile-item-body">
                        <div
                          className={
                            isSpreadExempt(tile)
                              ? "tile-svg-wrap tile-svg-wrap--spread-exempt"
                              : "tile-svg-wrap"
                          }
                          draggable
                          onDragStart={handleDragStart(index)}
                          onDragEnd={handleDragEnd}
                          title="Drag to reorder"
                        >
                          <div
                            className="tile-svg"
                            style={{
                              transform: `rotate(${tileDeg}deg)`,
                              transformOrigin: "center center",
                            }}
                            dangerouslySetInnerHTML={{ __html: processedSVG }}
                          />
                          <span className="tile-drag-icon" aria-hidden="true">
                            ⋮⋮
                          </span>
                        </div>
                        <p className="file-name">
                          {displayName(tile.fileName)}
                        </p>
                        <button
                          type="button"
                          className="tile-rotate"
                          onClick={() => rotateTileAt(index)}
                          aria-label="Rotate tile 90 degrees clockwise"
                        >
                          Rotate
                        </button>
                        <button
                          type="button"
                          className={
                            tile.distribute
                              ? "tile-distribute tile-distribute--on"
                              : "tile-distribute"
                          }
                          onClick={() => toggleDistributeAt(index)}
                          aria-pressed={tile.distribute ?? false}
                          aria-label={
                            tile.distribute
                              ? "Distribute on: band-sized count, random cells; omitted from shape hierarchy"
                              : "Distribute off: tile follows list order in the shape"
                          }
                        >
                          Distribute
                        </button>
                        <button
                          type="button"
                          className="tile-delete"
                          onClick={() => deleteTile(index)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="active-tiles-actions">
              <button
                type="button"
                className="reset-rotations-button"
                onClick={resetAllRotations}
              >
                Reset all rotations
              </button>
              <button
                type="button"
                className="clear-all-button"
                onClick={clearAllTiles}
              >
                Clear All Tiles
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {activeTiles.length > 0 && (
        <div>
          <div className="output">
            {tiledSVG && (
              <div
                className="svg-container"
                dangerouslySetInnerHTML={{ __html: tiledSVG }}
              />
            )}
          </div>
          <a
            className="download-svg-button"
            target="_blank"
            href={`data:image/svg+xml;base64,${btoa(tiledSVG)}`}
            download={`${shape}-o${opacity}-os${opacitySigma}-ornd${opacityRandomness}-oc${opacityContrast}-spread${shapeSpread}-rr${rotationRandomness}-${gridSize}x${gridSize}-truchet.svg`}
          >
            Download SVG
          </a>
        </div>
      )}
    </div>
  );
};

export default TruchetGenerator;
