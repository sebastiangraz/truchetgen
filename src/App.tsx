import {
  useState,
  useEffect,
  ChangeEvent,
  useMemo,
  useRef,
  DragEvent,
} from "react";
import { generateTiledSVG, processUploadedTiles } from "./utils/svgutils";
import { handleFileUpload } from "./utils/fileutils";
import { getPreloadedTiles } from "./utils/defaultTiles";
import { Tile, ShapeType, RotationType } from "./types";

import "./styles.css";

interface TruchetGeneratorProps {
  tileSize?: number;
}

const parseStoredTiles = (raw: string): Tile[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const result: Tile[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (typeof o.svg !== "string" || typeof o.fileName !== "string") continue;
      result.push({
        id: typeof o.id === "string" ? o.id : crypto.randomUUID(),
        svg: o.svg,
        fileName: o.fileName,
      });
    }
    return result;
  } catch {
    return [];
  }
};

const readInitialTiles = (): Tile[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("uploadedTiles");
  if (stored) {
    const parsed = parseStoredTiles(stored);
    if (parsed.length > 0) return parsed;
  }
  return getPreloadedTiles();
};

const TruchetGenerator = ({ tileSize = 24 }: TruchetGeneratorProps) => {
  const [uploadedTiles, setUploadedTiles] = useState<Tile[]>(readInitialTiles);
  const [error, setError] = useState<string>("");
  const [gridSize, setGridSize] = useState<number>(8);
  const [shape, setShape] = useState<ShapeType>("random");
  const [rotation, setRotation] = useState<RotationType>("default");
  const [sigma, setSigma] = useState<number>(0.15);
  const dragFromIndex = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem("uploadedTiles", JSON.stringify(uploadedTiles));
  }, [uploadedTiles]);

  const processedTiles = useMemo(
    () => processUploadedTiles(uploadedTiles, tileSize),
    [uploadedTiles, tileSize]
  );

  const tilesForGeneration = useMemo(
    () => processedTiles.filter((t) => t.processedSVG.trim() !== ""),
    [processedTiles]
  );

  const tiledSVG = useMemo(() => {
    if (tilesForGeneration.length === 0) return "";

    return generateTiledSVG(
      tilesForGeneration,
      gridSize,
      tileSize,
      shape,
      rotation,
      sigma
    );
  }, [tilesForGeneration, gridSize, tileSize, shape, rotation, sigma]);

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

  const handleSigmaChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newSigma = parseFloat(e.target.value);
    setSigma(newSigma);
  };

  const reorderTiles = (from: number, to: number) => {
    if (from === to) return;
    setUploadedTiles((prev) => {
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

  const handleDrop =
    (dropIndex: number) => (e: DragEvent<HTMLDivElement>) => {
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
    setUploadedTiles((prevTiles) => {
      const updatedTiles = [...prevTiles];
      updatedTiles.splice(index, 1);
      return updatedTiles;
    });
  };

  const clearAllTiles = () => {
    setUploadedTiles([]);
    localStorage.removeItem("uploadedTiles");
  };

  const addEmptyTile = () => {
    const emptySvgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <rect width="24" height="24" fill="none" />
      </svg>
    `;

    const newTile: Tile = {
      id: crypto.randomUUID(),
      svg: emptySvgContent,
      fileName: "empty",
    };

    setUploadedTiles((prevTiles) => [...prevTiles, newTile]);
  };

  return (
    <div className="generator">
      <div className="controls">
        <div className="multi-container">
          <h1>
            Truchet
            <br /> Generator
          </h1>
          <hr />
          <span onClick={clearAllTiles} className="clear-all-button">
            Clear All Tiles
          </span>
          <a
            target="_blank"
            href={`data:image/svg+xml;base64,${btoa(tiledSVG)}`}
            download={`${shape}-s${sigma}-${gridSize}x${gridSize}-truchet.svg`}
          >
            Download SVG
          </a>{" "}
        </div>
        <div className="upload-container">
          <input
            type="file"
            accept=".svg"
            multiple
            onChange={(e) => handleFileUpload(e, setUploadedTiles, setError)}
          />
        </div>
        <div className="uploaded-tiles">
          {uploadedTiles.length > 0 && (
            <div className="tile-list">
              {uploadedTiles.map((tile, index) => {
                const processedSVG = processedTiles[index]?.processedSVG || "";
                const fileName =
                  tile.fileName.substring(0, tile.fileName.lastIndexOf(".")) ||
                  tile.fileName;
                return (
                  <div
                    key={tile.id}
                    className="tile-item"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop(index)}
                  >
                    <div className="tile-item-body">
                      <div
                        className="tile-svg-wrap"
                        draggable
                        onDragStart={handleDragStart(index)}
                        onDragEnd={handleDragEnd}
                        title="Drag to reorder"
                      >
                        <div
                          className="tile-svg"
                          dangerouslySetInnerHTML={{ __html: processedSVG }}
                        />
                        <span className="tile-drag-icon" aria-hidden="true">
                          ⋮⋮
                        </span>
                      </div>
                      <p className="file-name">{fileName}</p>
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
          <span onClick={addEmptyTile} className="empty">
            Empty tile
          </span>
        </div>
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
        </div>
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
            <label htmlFor="sigma">Sigma {sigma.toFixed(2)}</label>
            <input
              type="range"
              id="sigma"
              name="sigma"
              min="0.01"
              max="1.0"
              step="0.01"
              value={sigma}
              onChange={handleSigmaChange}
            />
          </div>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      {uploadedTiles.length > 0 && (
        <div className="output">
          {tiledSVG && (
            <div
              className="svg-container"
              dangerouslySetInnerHTML={{ __html: tiledSVG }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default TruchetGenerator;
