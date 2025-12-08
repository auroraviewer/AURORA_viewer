import React, { useEffect, useState, useRef } from "react";
import OpenSeadragon from "openseadragon";



// --------------------------
// Load gene list from CSV
// --------------------------
async function loadGeneList() {
  const res = await fetch("./Lung_Highly_expressed_gene3000.csv")
  const text = await res.text();

  // Split lines, remove header
  const lines = text.trim().split("\n").slice(1);

  // Extract column 2 (gene name)
  const genes = lines.map(line => line.split(",")[1].trim());

  return genes;
}

export default function App({ localImageUrl }) {
  const [genes, setGenes] = useState([]);
  const [geneIndex, setGeneIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);

  const viewer1Ref = useRef(null);
  const viewer2Ref = useRef(null);
  const overlayRef = useRef([]);

  // --------------------------
  // Load gene list CSV on startup
  // --------------------------
  useEffect(() => {
    loadGeneList().then(setGenes);
  }, []);

  // --------------------------
  // Initialize OpenSeadragon viewers
  // --------------------------
  useEffect(() => {
    if (!viewer1Ref.current) {
      viewer1Ref.current = OpenSeadragon({
        id: "viewer1",
        prefixUrl: "images/",
        tileSources: "./TCGA-05-4244-01A-01-BS1.dzi",
      });

      viewer2Ref.current = OpenSeadragon({
        id: "viewer2",
        prefixUrl: "images/",
        tileSources: "./TCGA-05-4244-01A-01-BS1.dzi",
      });

      // Sync zoom/pan
      const v1 = viewer1Ref.current;
      const v2 = viewer2Ref.current;
      let ignore = false;

      const sync = (src, dst) => {
        if (ignore) return;
        ignore = true;
        dst.viewport.zoomTo(src.viewport.getZoom());
        dst.viewport.panTo(src.viewport.getCenter());
        ignore = false;
      };

      v1.addHandler("zoom", () => sync(v1, v2));
      v1.addHandler("pan", () => sync(v1, v2));
      v2.addHandler("zoom", () => sync(v2, v1));
      v2.addHandler("pan", () => sync(v2, v1));
    }
  }, []);

  // --------------------------
  // Load local H&E image if provided
  // --------------------------
  useEffect(() => {
    if (!viewer1Ref.current || !localImageUrl) return;

    setImageLoading(true);

    const viewer1 = viewer1Ref.current;
    const viewer2 = viewer2Ref.current;

    const onTileLoaded = () => setImageLoading(false);

    viewer1.addHandler("tile-loaded", onTileLoaded);
    viewer2.addHandler("tile-loaded", onTileLoaded);

    viewer1.open({ type: "image", url: localImageUrl });
    viewer2.open({ type: "image", url: localImageUrl });

    return () => {
      viewer1.removeHandler("tile-loaded", onTileLoaded);
      viewer2.removeHandler("tile-loaded", onTileLoaded);
    };
  }, [localImageUrl]);

  // --------------------------
  // Add PNG heatmap overlay
  // --------------------------
  useEffect(() => {
    if (!genes.length || imageLoading) return;
    if (!viewer2Ref.current) return;

    const viewer = viewer2Ref.current;

    // remove old overlays
    overlayRef.current.forEach(el => {
      try { viewer.removeOverlay(el); } catch (e) {}
    });
    overlayRef.current = [];

    const geneName = genes[geneIndex];
    const url = `./predictions_png/${geneName}.png`;

    const imgEl = document.createElement("img");
    imgEl.src = url;
    imgEl.style.opacity = 0.75;
    imgEl.style.pointerEvents = "none";
    imgEl.style.display = "block";

    const addOverlayWhenReady = () => {
      const item = viewer.world.getItemAt(0);
      if (!item) return false;

      const contentSize = item.getContentSize();
      const dziWidth = contentSize.x;
      const dziHeight = contentSize.y;

      const imgRect = new OpenSeadragon.Rect(0, 0, dziWidth, dziHeight);
      const vpRect = viewer.viewport.imageToViewportRectangle(imgRect);

      viewer.addOverlay({ element: imgEl, location: vpRect });
      overlayRef.current.push(imgEl);

      return true;
    };

    if (!addOverlayWhenReady()) {
      const onOpen = () => addOverlayWhenReady();
      viewer.addHandler("open", onOpen);

      let tries = 0;
      const interval = setInterval(() => {
        tries += 1;
        if (addOverlayWhenReady() || tries > 10) {
          clearInterval(interval);
          viewer.removeHandler("open", onOpen);
        }
      }, 200);
    }

    return () => {
      try { viewer.removeOverlay(imgEl); } catch (e) {}
      overlayRef.current = overlayRef.current.filter(el => el !== imgEl);
    };
  }, [genes, geneIndex, imageLoading]);

  // --------------------------
  // UI RENDER
  // --------------------------
  return (
    <div style={{ display: "flex", height: "90vh", width: "100vw" }}>
      <div style={{ flex: 1 }}>
        <div style={{ background: "#111", color: "white" }}>H&E Image</div>
        <div id="viewer1" style={{ height: "100%" }} />
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <div style={{ background: "#111", color: "white" }}>
          Predicted Expression
        </div>
        <div id="viewer2" style={{ height: "100%" }} />

        {genes.length > 0 && (
          <select
            style={{ position: "absolute", top: 70, right: 20, zIndex: 1000 }}
            value={geneIndex}
            onChange={(e) => setGeneIndex(Number(e.target.value))}
          >
            {genes.map((g, i) => (
              <option value={i} key={i}>
                {g}
              </option>
            ))}
          </select>
        )}

        {imageLoading && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              padding: "12px 24px",
              background: "rgba(0,0,0,0.7)",
              color: "white",
              fontSize: "18px",
              borderRadius: "8px",
              zIndex: 2000,
            }}
          >
            Loading Image...
          </div>
        )}
      </div>
    </div>
  );
}
