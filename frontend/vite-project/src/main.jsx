// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./app/AuthContext.jsx";
import { ThemeProvider } from "./app/ThemeContext.jsx";
import App from "./App.jsx";
import "./index.css";

// Suprimir errores internos del SDK de Firestore que ocurren asincrónicamente
// al desmontar componentes con listeners activos. Son bugs del SDK (no del código).
window.addEventListener("unhandledrejection", (e) => {
  if (e.reason?.message?.includes("FIRESTORE") && e.reason?.message?.includes("INTERNAL ASSERTION FAILED")) {
    e.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);
