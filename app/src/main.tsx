import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import "./styles/app.css";
createRoot(document.getElementById("root")!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
