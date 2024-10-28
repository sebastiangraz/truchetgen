//App.tsx

import React, { useState, useEffect, ChangeEvent, useMemo } from "react";
import { generateTiledSVG, processUploadedTiles } from "./utils/svgutils";
import { handleFileUpload } from "./utils/fileutils";
import { Tile, ShapeType, RotationType } from "./types";

import "./styles.css";

interface TruchetGeneratorProps {
  tileSize?: number;
}

const TruchetGenerator: React.FC<TruchetGeneratorProps> = ({
  tileSize = 24,
}) => {
  const [uploadedTiles, setUploadedTiles] = useState<Tile[]>([]);
  const [error, setError] = useState<string>("");
  const [gridSize, setGridSize] = useState<number>(8);
  const [shape, setShape] = useState<ShapeType>("random");
  const [rotation, setRotation] = useState<RotationType>("default");
  const [sigma, setSigma] = useState<number>(0.15); // Default sigma value

  useEffect(() => {
    const storedTiles = localStorage.getItem("uploadedTiles");
    if (storedTiles) {
      setUploadedTiles(JSON.parse(storedTiles));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("uploadedTiles", JSON.stringify(uploadedTiles));
  }, [uploadedTiles]);

  // Utility function to remove fills
  const traverseAndRemoveFills = (element: Element) => {
    element.setAttribute("fill", "none");
    element.childNodes.forEach((child) => {
      if (child instanceof Element) {
        traverseAndRemoveFills(child);
      }
    });
  };

  // 4. Processed Tiles Memoization
  const processedTiles = useMemo(
    () => processUploadedTiles(uploadedTiles, tileSize),
    [uploadedTiles, tileSize]
  );

  // 5. Generate Tiled SVG
  const tiledSVG = useMemo(() => {
    if (processedTiles.length === 0) return "";

    return generateTiledSVG(
      processedTiles,
      gridSize,
      tileSize,
      shape,
      rotation,
      sigma // Pass sigma here
    );
  }, [processedTiles, gridSize, tileSize, shape, rotation, sigma]);

  // Event Handlers
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

  const handleTileBusynessChange = (
    index: number,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const newBusyness = parseInt(e.target.value, 10);
    setUploadedTiles((prevTiles) => {
      const updatedTiles = [...prevTiles];
      updatedTiles[index] = { ...updatedTiles[index], busyness: newBusyness };
      return updatedTiles;
    });
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

  // JSX Rendering
  return (
    <div className="generator">
      <div className="controls">
        <h1>
          Truchet
          <br /> Generator
        </h1>
        <div className="upload-container">
          <input
            type="file"
            accept=".svg"
            multiple
            onChange={(e) => handleFileUpload(e, setUploadedTiles, setError)}
          />
        </div>
        {uploadedTiles.length > 0 && (
          <div className="uploaded-tiles">
            <div className="tile-list">
              {uploadedTiles.map((tile, index) => {
                const processedSVG = processedTiles[index]?.processedSVG || "";
                const fileName =
                  tile.fileName.substring(0, tile.fileName.lastIndexOf(".")) ||
                  tile.fileName;
                return (
                  <div key={index} className="tile-item">
                    <div
                      onClick={() => deleteTile(index)}
                      className="tile-svg"
                      dangerouslySetInnerHTML={{ __html: processedSVG }}
                    />
                    <input
                      type="number"
                      placeholder="Busyness"
                      min="0"
                      max="10"
                      value={tile.busyness}
                      onChange={(e) => handleTileBusynessChange(index, e)}
                    />
                    <p className="file-name">{fileName}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
        <div className="multi-container">
          <span onClick={clearAllTiles} className="clear-all-button">
            Clear All Tiles
          </span>
          <a
            href={`data:image/svg+xml;base64,${btoa(tiledSVG)}`}
            download="truchet_tiles.svg"
          >
            Download SVG
          </a>{" "}
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
