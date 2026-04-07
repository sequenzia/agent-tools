import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { useToastStore } from "./stores/toast-store";
import { classifyIpcError } from "./services/ipc-error-handler";

// Global handler for unhandled promise rejections.
// Catches errors from async IPC calls that are not explicitly handled,
// and surfaces them as non-fatal toast notifications.
window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  const classified = classifyIpcError(event.reason);
  useToastStore.getState().addToast(
    "error",
    "Unhandled error",
    classified.message,
  );
  // Prevent the default browser console error for handled rejections
  event.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
