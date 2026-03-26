import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../app/useAuth";
import PropTypes from "prop-types";

export default function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};
