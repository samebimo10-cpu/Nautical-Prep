import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./index.css";

const STANDALONE = import.meta.env.VITE_STANDALONE === "1";
// Standalone single-file build (opened from disk or embedded) uses hash routing and no service worker.
if (!STANDALONE) registerSW({ immediate: true });
const Router = STANDALONE ? HashRouter : BrowserRouter;

const queryClient = new QueryClient({ defaultOptions: { queries: { networkMode: "offlineFirst", retry: 1 } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <App />
      </Router>
    </QueryClientProvider>
  </React.StrictMode>,
);
