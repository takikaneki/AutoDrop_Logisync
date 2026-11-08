import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

// Cleanup old mock data caches once from localStorage
if (typeof window !== "undefined") {
  try {
    const CLEANUP_KEY = "pt-mock-cleaned-v1";
    if (!localStorage.getItem(CLEANUP_KEY)) {
      localStorage.removeItem("pt-announcements");
      localStorage.removeItem("pt-notifications");
      localStorage.removeItem("pt-complaints");
      localStorage.setItem(CLEANUP_KEY, "1");
    }
  } catch {
    /* ignore */
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
