// src/app/useAuth.js
import { useContext } from "react";
import { Ctx } from "./auth-ctx";

export const useAuth = () => useContext(Ctx);
