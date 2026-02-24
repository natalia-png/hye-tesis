// src/pages/Dashboard.jsx
import { useAuth } from "../app/useAuth";
import DashboardAdmin from "./DashboardAdmin.jsx";
import DashboardCliente from "./DashboardCliente.jsx";

export default function Dashboard() {
  const { user, ready } = useAuth();

  if (!ready) {
    return <p className="text-[13px] text-ink/60">Verificando sesión…</p>;
  }

  const role = (user?.role || "sin-rol").toLowerCase().trim();

  if (role === "cliente") return <DashboardCliente />;

  return <DashboardAdmin />;
}