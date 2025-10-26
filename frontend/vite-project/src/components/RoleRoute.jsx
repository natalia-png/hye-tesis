import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../app/useAuth";
import { isOneOf } from "../data/roles";  // ✅ Debe coincidir exactamente


export default function RoleRoute({ children, allow = [] }) {
  const { user, ready } = useAuth();
  const { pathname } = useLocation();

  if (!ready) return null;             // esperando a Firebase + perfil
  if (!user)  return <Navigate to="/login" state={{ from: pathname }} replace />;

  const role = user.role;              // el AuthContext ya lo pone en user
  if (role == null) return null;       // aún cargando perfil → no decidas
  if (!isOneOf(role, allow)) return <Navigate to="/" replace />;

  return children;
}
