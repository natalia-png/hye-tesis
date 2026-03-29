// src/App.jsx
import { Routes, Route, Outlet } from "react-router-dom";
import { useAuth } from "./app/useAuth";
import Header from "./components/header.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Login from "./pages/auth/Login.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RoleRoute from "./components/RoleRoute.jsx";
import { ACCESS } from "./data/roles.js";


import Proyectos from "./pages/Proyectos.jsx";
import ProyectosCliente from "./pages/ProyectosCliente.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ProyectoDetalle from "./pages/ProyectoDetalle.jsx";
import ProyectoDetalleCliente from "./pages/ProyectoDetalleCliente.jsx";
import ProyectoNuevo from "./pages/ProyectoNuevo.jsx";
import ProyectoEditar from "./pages/ProyectoEditar.jsx";
import HistorialProyectos from "./pages/HistorialProyectos";
import GestionColaboradores from "./pages/GestionColaboradores";
import AsistenteIA from "./components/AsistenteIA";
import SolicitudServicio from "./pages/SolicitudServicio";
import ComercialAdmin from "./pages/ComercialAdmin";
import GarantiasAdmin from "./pages/GarantiasAdmin.jsx";
import GarantiasCliente from "./pages/GarantiasCliente.jsx";
import BandejaMensajes from "./pages/mensajes/BandejaMensajes.jsx";
import ChatPage from "./pages/mensajes/ChatPage.jsx";
import Configuracion from "./pages/Configuracion.jsx";



// Wrapper que decide canManageDocuments según el rol
function ProyectoDetalleWrapper() {
  const { user } = useAuth();
  const role = user?.role || "sin-rol";
  // Admin y colaborador pueden gestionar — la lógica por-fase vive en FasesProyecto
  const canManage = role === "admin" || role === "colaborador";
  return <ProyectoDetalle canManageDocuments={canManage} clientView={false} />;
}

function ShellLayout() {
  return (
    <div className="min-h-[100dvh] transition-colors duration-300 bg-[#F2EEE7] dark:bg-[#1A1917]">
      <Header />
      <main
        className="max-w-[500px] mx-auto px-4 pt-16"
        style={{ paddingBottom: 'max(6rem, calc(6rem + env(safe-area-inset-bottom, 0px)))' }}
      >
        <div className="rounded-[18px] border shadow-card p-3 transition-colors duration-300 bg-ivory/92 dark:bg-[#252320] border-taupe/30 dark:border-[#3a3731]">
          <Outlet />
        </div>
      </main>
      <BottomNav />
      <AsistenteIA />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/solicitar" element={<SolicitudServicio />} />

      <Route element={<ProtectedRoute><ShellLayout /></ProtectedRoute>}>

        <Route index element={<Dashboard />} />

        {/* Admin */}
        <Route path="proyectos" element={
          <RoleRoute allow={["admin", "colaborador"]}><Proyectos /></RoleRoute>
        } />
        <Route path="proyectos/nuevo" element={
          <RoleRoute allow={ACCESS.PROYECTOS_LIST}><ProyectoNuevo /></RoleRoute>
        } />
        <Route path="proyectos/:id" element={
          <RoleRoute allow={ACCESS.PROYECTOS_LIST}>
            <ProyectoDetalleWrapper />
          </RoleRoute>
        } />
        <Route path="proyectos/:id/editar" element={
          <RoleRoute allow={ACCESS.PROYECTOS_LIST}><ProyectoEditar /></RoleRoute>
        } />
        {/* Sección de Garantías */}
        <Route path="proyectos/:id/garantias" element={
          <RoleRoute allow={["admin", "colaborador"]}><GarantiasAdmin /></RoleRoute>
        } />

        {/* Cliente */}
        <Route path="mis-proyectos" element={
          <RoleRoute allow={ACCESS.PROYECTOS_CLIENTE}><ProyectosCliente /></RoleRoute>
        } />
        <Route path="mis-proyectos/:id" element={
          <RoleRoute allow={ACCESS.PROYECTOS_CLIENTE}><ProyectoDetalleCliente /></RoleRoute>
        } />
        <Route path="comercial" element={
          <RoleRoute allow={ACCESS.PROYECTOS_LIST}><ComercialAdmin /></RoleRoute>
        } />
        <Route path="historial" element={
          <RoleRoute allow={["admin"]}><HistorialProyectos /></RoleRoute>
        } />
        <Route path="colaboradores" element={
          <RoleRoute allow={["admin"]}><GestionColaboradores /></RoleRoute>
        } />
        <Route path="mis-proyectos/:id/garantias" element={
          <RoleRoute allow={["cliente"]}><GarantiasCliente /></RoleRoute>
        } />

        {/* Mensajes — todos los roles */}
        <Route path="mensajes" element={<BandejaMensajes />} />
        <Route path="mensajes/:chatId" element={<ChatPage />} />

        {/* Configuración — todos los roles */}
        <Route path="configuracion" element={<Configuracion />} />

      </Route>

      <Route path="*" element={<Login />} />
    </Routes>
  );
}