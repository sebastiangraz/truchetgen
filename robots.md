# Truchet Generator — application overview (`App.tsx`)

This document describes what the main React entry component does so humans and automated tools can understand the app’s behavior without reading the full source.

## Purpose

`App.tsx` exports a single default component, **`TruchetGenerator`**, which is a **Truchet-tile pattern generator**. Users upload one or more SVG files (or add placeholder “empty” tiles). The app tiles and transforms those graphics into a larger grid-based SVG preview and offers a **download** of the result.

## Data flow

1. **Tiles** — Each tile is an SVG (from upload or a built-in empty SVG) plus metadata: `fileName`, and a **busyness** value (0–10) used when building the pattern.
2. **Processing** — `processUploadedTiles` (from `./utils/svgutils`) normalizes uploaded SVGs to a fixed **tile size** (default 24px logical units).
3. **Generation** — `generateTiledSVG` (from `./utils/svgutils`) builds one combined SVG string from the processed tiles, using:
   - **grid size** (8–56, square grid),
   - **shape** mode: random, circle, gradient, or exponential,
   - **rotation** mode: default, random, or pyramid,
   - **sigma** (0.01–1.0): a smoothness / distribution parameter passed into the generator (default 0.15).
4. **Rendering** — The generated SVG is injected into the page with `dangerouslySetInnerHTML` inside an `.output` / `.svg-container` region when there is at least one uploaded tile and non-empty output.

## Persistence

- On first load, **`uploadedTiles`** is restored from **`localStorage`** under the key `uploadedTiles`.
- Whenever `uploadedTiles` changes, it is written back to the same key.
- **Clear All Tiles** removes all tiles from state and deletes the `uploadedTiles` entry from `localStorage`.

## User interface (controls)

| Control | Effect |
|--------|--------|
| File input (`.svg`, multiple) | Adds tiles via `handleFileUpload` (`./utils/fileutils`); errors surface in an `.error` paragraph. |
| **Clear All Tiles** | Empties the list and localStorage. |
| **Download SVG** | Link with `data:image/svg+xml;base64,...` and a filename derived from shape, sigma, and grid size. |
| Per-tile preview | Click preview to **delete** that tile. |
| Per-tile **Busyness** (number 0–10) | Updates that tile’s weighting for pattern generation. |
| **Empty tile** | Appends a transparent 24×24 empty SVG tile named `empty`. |
| **Shape** / **Rotation** | Selects tiling / variation strategy for `generateTiledSVG`. |
| **Grid Size** slider | Sets N for an N×N grid (labeled in the UI). |
| **Sigma** slider | Adjusts the sigma parameter (shown to two decimal places). |

## Props

- **`tileSize`** (optional, default `24`) — Passed into tile processing and SVG generation; controls the coordinate system scale for each cell.

## Dependencies (from `App.tsx` only)

- `./utils/svgutils` — `generateTiledSVG`, `processUploadedTiles`
- `./utils/fileutils` — `handleFileUpload`
- `./types` — `Tile`, `ShapeType`, `RotationType`
- `./styles.css` — Layout and styling for `.generator`, `.controls`, tiles, and output

## Summary

**`App.tsx` is the full UI and state layer for a browser-based Truchet-style SVG mosaic tool:** manage a list of SVG tiles (with persistence), tune grid size and algorithm parameters, preview the tiled result, and export a single downloadable SVG.
