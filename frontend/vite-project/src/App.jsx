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

function Shell() {
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

      {/* Rutas privadas, todas dentro del Shell para que se vea como app */}
      <Route
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        {/* Dashboard según rol */}
        <Route index element={<Dashboard />} />

        {/* Proyectos (Luisa / equipo interno) */}
        <Route
          path="proyectos"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_LIST}>
              <Proyectos />
            </RoleRoute>
          }
        />

        {/* Crear proyecto */}
        <Route
          path="proyectos/nuevo"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_LIST}>
              <ProyectoNuevo />
            </RoleRoute>
          }
        />

        {/* Detalle interno – aquí SÍ se puede gestionar documentos */}
        <Route
          path="proyectos/:id"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_LIST}>
              <ProyectoDetalle
                canManageDocuments={true} // 👈 Luisa / equipo
                clientView={false}
              />
            </RoleRoute>
          }
        />

        {/* Editar proyecto (solo equipo interno) */}
        <Route
          path="proyectos/:id/editar"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_LIST}>
              <ProyectoEditar />
            </RoleRoute>
          }
        />

        {/* Listado de proyectos del cliente */}
        <Route
          path="mis-proyectos"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_CLIENTE}>
              <ProyectosCliente />
            </RoleRoute>
          }
        />

        {/* Detalle desde vista de cliente – solo lectura */}
        <Route
          path="mis-proyectos/:id"
          element={
            <RoleRoute allow={ACCESS.PROYECTOS_CLIENTE}>
              <ProyectoDetalle
                canManageDocuments={false} // 👈 cliente NO gestiona
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
