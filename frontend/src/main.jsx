import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { JCUIProvider } from "@jackcrane/ui";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <JCUIProvider theme="light">
      <App />
    </JCUIProvider>
  </StrictMode>,
);
