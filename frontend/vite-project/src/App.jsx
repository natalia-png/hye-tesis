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
import Dashboard from "./pages/Dashboard.jsx";
import ProyectoDetalle from "./pages/ProyectoDetalle.jsx";
import ProyectoNuevo from "./pages/ProyectoNuevo.jsx";
import ProyectoEditar from "./pages/ProyectoEditar.jsx";

function ShellLayout() {
  return (
    <div className="min-h-screen bg-[#F2EEE7]">
      <Header />
      <main className="max-w-[500px] mx-auto px-4 pb-24 pt-16">
        <div className="rounded-[18px] bg-ivory/90 border border-taupe/30 shadow-card p-3">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Login público */}
      <Route path="/login" element={<Login />} />

      {/* App protegida */}
      <Route
        element={
          <ProtectedRoute>
            <ShellLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route index element={<Dashboard />} />

        {/* Proyectos – equipo interno (Luisa) */}
        <Route
          path="proyectos"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_LIST}>
              <Proyectos />
            </RoleRoute>
          }
        />

        <Route
          path="proyectos/nuevo"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_LIST}>
              <ProyectoNuevo />
            </RoleRoute>
          }
        />

        <Route
          path="proyectos/:id"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_LIST}>
              <ProyectoDetalle
                canManageDocuments={true}
                clientView={false}
              />
            </RoleRoute>
          }
        />

        <Route
          path="proyectos/:id/editar"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_LIST}>
              <ProyectoEditar />
            </RoleRoute>
          }
        />

        {/* Proyectos cliente */}
        <Route
          path="mis-proyectos"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_CLIENTE}>
              <ProyectosCliente />
            </RoleRoute>
          }
        />

        <Route
          path="mis-proyectos/:id"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_CLIENTE}>
              <ProyectoDetalle
                canManageDocuments={false}
                clientView={true}
              />
            </RoleRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Login />} />
    </Routes>
  );
}
