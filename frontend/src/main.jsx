import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { JCUIProvider } from "@jackcrane/ui";
import { BrowserRouter } from "react-router-dom";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <JCUIProvider theme="light">
        <App />
      </JCUIProvider>
    </BrowserRouter>
  </StrictMode>,
);
