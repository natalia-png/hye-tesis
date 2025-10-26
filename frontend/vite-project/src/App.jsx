// src/App.jsx
import { Routes, Route, Outlet } from "react-router-dom";
import Header from "./components/header.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Login from "./pages/auth/Login.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RoleRoute from "./components/RoleRoute.jsx";
import { ACCESS } from "./data/roles.js";
import Proyectos from "./pages/Proyectos.jsx";
import ProyectosCliente from "./pages/ProyectosCliente.jsx";

function Shell() {
  return (
    <div className="min-h-screen bg-[#F2EEE7]">
      <Header />
      <main className="max-w-[500px] mx-auto px-4 pb-24 pt-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

function Home() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Bienvenida a tu plataforma. Aquí verás avances, tareas y alertas.
        </p>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Login público */}
      <Route path="/login" element={<Login />} />

      {/* Rutas privadas */}
      <Route
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route
          path="proyectos"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_LIST}>
              <Proyectos />
            </RoleRoute>
          }
        />
        <Route
          path="mis-proyectos"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_CLIENTE}>
              <ProyectosCliente />
            </RoleRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Login />} />
    </Routes>
  );
}
