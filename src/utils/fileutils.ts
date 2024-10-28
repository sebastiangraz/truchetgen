import DOMPurify from "dompurify";
import { Tile } from "../types";

export const handleFileUpload = (
  e: React.ChangeEvent<HTMLInputElement>,
  setUploadedTiles: React.Dispatch<React.SetStateAction<Tile[]>>,
  setError: React.Dispatch<React.SetStateAction<string>>
) => {
  const files = e.target.files;
  if (!files) return;

  const svgFiles = Array.from(files).filter(
    (file) => file.type === "image/svg+xml"
  );

  if (svgFiles.length !== files.length) {
    setError("Some files were not SVGs and have been ignored.");
  } else {
    setError("");
  }

  const readFiles = svgFiles.map(
    (file) =>
      new Promise<{ content: string; fileName: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          resolve({ content, fileName: file.name });
        };
        reader.onerror = () => reject("Error reading file");
        reader.readAsText(file);
      })
  );

  Promise.all(readFiles)
    .then((fileDataArray) => {
      const sanitizedSVGS = fileDataArray.map(({ content, fileName }) => ({
        svg: DOMPurify.sanitize(content),
        fileName,
      }));

      const newTiles: Tile[] = sanitizedSVGS.map(({ svg, fileName }) => ({
        svg,
        fileName,
        busyness: 5, // Default busyness
      }));

      setUploadedTiles((prev) => [...prev, ...newTiles]);
    })
    .catch((err) => {
      console.error(err);
      setError("Error reading some SVG files.");
    });
};
