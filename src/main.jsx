import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import GTDManager from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GTDManager />
  </StrictMode>
);
