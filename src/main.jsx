import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

function loadLocalFiles(callbacks) {
  // IMAGE
  document.getElementById("fileImage").addEventListener("change", (e) => {
    if (!e.target.files.length) return;

    const file = e.target.files[0];
    const url = URL.createObjectURL(file);

    callbacks.onImage(url);
  });

  // JSON PREDICTION
  document.getElementById("fileJson").addEventListener("change", (e) => {
    if (!e.target.files.length) return;

    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      callbacks.onJson(JSON.parse(ev.target.result));
    };
    reader.readAsText(file);
  });
}

function Root() {
  const [localImageUrl, setLocalImageUrl] = React.useState(null);
  const [predictionJson, setPredictionJson] = React.useState(null);

  React.useEffect(() => {
    // Existing local file handling
    loadLocalFiles({
      onImage: setLocalImageUrl,
      onJson: setPredictionJson,
    });

    // expose global callbacks for URL loading
    window.onImageUrlLoad = (url) => {
      setLocalImageUrl(url);
    };

    window.onJsonUrlLoad = (json) => {
      setPredictionJson(json);
    };

    // Clean up
    return () => {
      window.onImageUrlLoad = null;
      window.onJsonUrlLoad = null;
    };
  }, []);

  return (
    <App 
      localImageUrl={localImageUrl} 
      predictionJson={predictionJson} 
    />
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<Root />);