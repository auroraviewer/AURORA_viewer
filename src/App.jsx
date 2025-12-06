import React, { useEffect, useState, useRef } from "react";
import OpenSeadragon from "openseadragon";


// Turbo colormap (t in 0..1)
function turboColor(t) {
  t = Math.max(0, Math.min(1, t)); // clamp

  const r = Math.round(
    34.61 +
      t * (1172.33 +
        t * (-10793.56 +
          t * (33300.12 +
            t * (-38394.49 +
              t * (16666.33))))))

  const g = Math.round(
    23.31 +
      t * (557.33 +
        t * (1225.33 +
          t * (-3574.96 +
            t * (4384.79 +
              t * (-1838.66))))))

  const b = Math.round(
    27.2 +
      t * (3211.1 +
        t * (-15327.97 +
          t * (40692.05 +
            t * (-46052.61 +
              t * (18627.93)))))) 

  return `rgb(${r}, ${g}, ${b})`;
}

export default function App({ localImageUrl, predictionJson }) {
  const [data, setData] = useState(null);
  const [geneIndex, setGeneIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const [jsonLoading, setJsonLoading] = useState(false);

  const viewer1Ref = useRef(null);
  const viewer2Ref = useRef(null);
  const overlayRef = useRef([]);

  // --------------------------
  // Load JSON data
  // --------------------------
  useEffect(() => {
    if (predictionJson) {
      setJsonLoading(true);
      setTimeout(() => {
        setData(predictionJson);
        setJsonLoading(false);
      }, 0);
    } else {
      setJsonLoading(true);
      fetch("predictions_TCGA-05-4244-01A-01-BS1.json")
        .then((res) => res.json())
        .then((json) => {
          setData(json);
          setJsonLoading(false);
        });
    }
  }, [predictionJson]);

  // --------------------------
  // Initialize OpenSeadragon viewers
  // --------------------------
  useEffect(() => {
    if (!viewer1Ref.current) {
      viewer1Ref.current = OpenSeadragon({
        id: "viewer1",
        prefixUrl: "images/",
        tileSources: "TCGA-05-4244-01A-01-BS1.dzi",
      });

      viewer2Ref.current = OpenSeadragon({
        id: "viewer2",
        prefixUrl: "images/",
        tileSources: "TCGA-05-4244-01A-01-BS1.dzi",
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
// Load pre-generated PNG heatmap overlay (robust)
// --------------------------
useEffect(() => {
  if (!data || imageLoading || jsonLoading) return;
  if (!viewer2Ref.current) return;

  const viewer = viewer2Ref.current;

  // remove old overlay elements
  overlayRef.current.forEach((el) => {
    try { viewer.removeOverlay(el); } catch (e) {}
  });
  overlayRef.current = [];

  const geneName = data.genes[geneIndex];
  const url = `predictions_png/${geneName}.png`;

  // create the image element for overlay
  const imgEl = document.createElement("img");
  imgEl.src = url;
  imgEl.style.opacity = 0.75;
  imgEl.style.pointerEvents = "none";
  imgEl.style.display = "block";
  // don't set width/height CSS — overlay sizing will be controlled by OpenSeadragon location

  // helper to add overlay once the viewer has an image loaded
  const addOverlayWhenReady = () => {
    const item = viewer.world.getItemAt(0);
    if (!item) {
      // viewer not yet opened/ready — try again later
      return false;
    }

    // get the displayed image's pixel dimensions (content size)
    const contentSize = item.getContentSize();
    const dziWidth = contentSize.x;
    const dziHeight = contentSize.y;

    // Now compute viewport rectangle that corresponds to the full image
    // (image coords rectangle (0,0,dziWidth,dziHeight) -> viewport rectangle)
    const imgRect = new OpenSeadragon.Rect(0, 0, dziWidth, dziHeight);
    const vpRect = viewer.viewport.imageToViewportRectangle(imgRect);

    // If your generated PNG has a different pixel size (pngNatural*), you'll want to scale it to match the DZI.
    // We can compute a scale factor so the png will be stretched to cover the DZI area.
    // The overlay element will be sized by OpenSeadragon to the viewport rect; so we don't need to do additional transforms.

    // Add overlay using computed viewport rect
    viewer.addOverlay({
      element: imgEl,
      location: vpRect
    });

    overlayRef.current.push(imgEl);

    return true;
  };

  // If the viewer `item` isn't ready immediately, attach a short retry loop (or listen for 'open').
  if (!addOverlayWhenReady()) {
    // listen for 'open' and 'tile-drawing' events; also try a simple interval retry
    const onOpen = () => {
      addOverlayWhenReady();
    };
    viewer.addHandler("open", onOpen);

    // a few retries (in case open already fired but item not ready)
    let tries = 0;
    const interval = setInterval(() => {
      tries += 1;
      if (addOverlayWhenReady() || tries > 10) {
        clearInterval(interval);
        viewer.removeHandler("open", onOpen);
      }
    }, 200);
  }

  // cleanup
  return () => {
    try { viewer.removeOverlay(imgEl); } catch (e) {}
    overlayRef.current = overlayRef.current.filter((el) => el !== imgEl);
  };
}, [data, geneIndex, imageLoading, jsonLoading]);






  // --------------------------
  // Render UI
  // --------------------------
  return (
    <div style={{ display: "flex", height: "90vh", width: "100vw" }}>
      <div style={{ flex: 1 }}>
        <div style={{ background: "#111", color: "white" }}>H&E Image</div>
        <div id="viewer1" style={{ height: "100%" }} />
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <div style={{ background: "#111", color: "white" }}>Predicted Expression</div>
        <div id="viewer2" style={{ height: "100%" }} />

        {data && (
          <select
            style={{ position: "absolute", top: 70, right: 20, zIndex: 1000 }}
            value={geneIndex}
            onChange={(e) => setGeneIndex(Number(e.target.value))}
          >
            {data.genes.map((g, i) => (
              <option value={i} key={i}>
                {g}
              </option>
            ))}
          </select>
        )}

        {(imageLoading || jsonLoading) && (
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
            {imageLoading && "Loading Image..."}
            {jsonLoading && "Loading Predictions..."}
          </div>
        )}
      </div>
    </div>
  );
}
