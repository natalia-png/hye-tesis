import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../app/useAuth";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { findUserByEmail } from "../../lib/firestore";
import Logo from "../../assets/hye-letrasblancas.png";
import Bg from "../../assets/bg-arch.png";

export default function Login() {
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Estado para el modal de recuperación
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (ready && user) navigate(from, { replace: true });
  }, [ready, user, from, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch {
      setError("Credenciales inválidas o usuario no registrado.");
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setResetError("");
    setResetMsg("");
    if (!resetEmail.trim()) { setResetError("Ingresa tu correo."); return; }
    setResetLoading(true);
    try {
      // Verificar si el correo existe en Firestore antes de enviar
      const userRecord = await findUserByEmail(resetEmail.trim());
      if (!userRecord) {
        setResetError("No existe una cuenta registrada con ese correo.");
        setResetLoading(false);
        return;
      }

      const actionCodeSettings = {
        url: window.location.origin + "/login",
        handleCodeInApp: false,
      };
      await sendPasswordResetEmail(auth, resetEmail.trim(), actionCodeSettings);
      setResetMsg("✅ Correo enviado. Revisa tu bandeja de entrada (y la carpeta de spam).");
    } catch {
      setResetError("No se pudo enviar el correo. Intenta de nuevo.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div
      className="min-h-[100dvh] relative flex items-center justify-center overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${Bg})` }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 flex flex-col items-center justify-center px-6 py-12 w-full max-w-md space-y-10">
        <img
          src={Logo}
          alt="H&E Arquitectos"
          className="w-[clamp(14rem,40vw,22rem)] object-contain drop-shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
          draggable="false"
        />

        <div className="w-full rounded-[24px] bg-white/90 backdrop-blur-md border border-white/40
                     shadow-[0_20px_50px_-10px_rgba(0,0,0,0.45)] p-8">

          {/* ── MODO RECUPERAR CONTRASEÑA ── */}
          {resetMode ? (
            <>
              <header className="mb-6 text-center">
                <h2 className="text-2xl font-semibold text-[#0F0F10]">Recuperar contraseña</h2>
                <p className="text-sm text-[#0F0F10]/70 mt-1">
                  Te enviaremos un enlace para crear una nueva contraseña.
                </p>
              </header>

              {resetMsg && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm text-center">
                  {resetMsg}
                </div>
              )}
              {resetError && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-center">
                  {resetError}
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-5">
                <div className="relative">
                  <InputIconMail />
                  <input
                    type="email"
                    required
                    placeholder="correo@hye.com"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-[#F7F4EE]
                               border border-[#A29B8E]/40 text-[15px] text-[#0F0F10]
                               outline-none focus:ring-4 focus:ring-[#0F0F10]/10
                               focus:border-[#0F0F10] transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 rounded-2xl bg-[#0F0F10] text-white text-base font-medium
                             hover:brightness-110 active:scale-[0.99] disabled:opacity-60
                             transition-all shadow-[0_12px_36px_-12px_rgba(15,15,16,0.45)]"
                >
                  {resetLoading ? "Enviando..." : "Enviar enlace"}
                </button>

                <button
                  type="button"
                  onClick={() => { setResetMode(false); setResetMsg(""); setResetError(""); }}
                  className="w-full text-sm text-[#0F0F10]/60 hover:text-[#0F0F10] text-center transition"
                >
                  ← Volver al inicio de sesión
                </button>
              </form>
            </>
          ) : (
            /* ── MODO LOGIN NORMAL ── */
            <>
              <header className="mb-6 text-center">
                <h2 className="text-2xl font-semibold text-[#0F0F10]">Bienvenido</h2>
                <p className="text-sm text-[#0F0F10]/70 mt-1">
                  Ingresa con tu correo corporativo para continuar.
                </p>
              </header>

              {error && (
                <div className="mb-4 text-[15px] px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="relative">
                  <InputIconMail />
                  <input
                    type="email"
                    required
                    placeholder="correo@hye.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-[#F7F4EE]
                               border border-[#A29B8E]/40 text-[15px] text-[#0F0F10]
                               outline-none focus:ring-4 focus:ring-[#0F0F10]/10
                               focus:border-[#0F0F10] transition"
                  />
                </div>

                <div className="relative">
                  <InputIconLock />
                  <input
                    type={show ? "text" : "password"}
                    required
                    placeholder="Contraseña"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-12 pr-16 py-3 rounded-2xl bg-[#F7F4EE]
                               border border-[#A29B8E]/40 text-[15px] text-[#0F0F10]
                               outline-none focus:ring-4 focus:ring-[#0F0F10]/10
                               focus:border-[#0F0F10] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-sm
                               text-[#0F0F10]/70 hover:text-[#0F0F10] rounded-md"
                  >
                    {show ? "Ocultar" : "Mostrar"}
                  </button>
                </div>

                <div className="flex items-center justify-between text-sm text-[#0F0F10]/75">
                  <label className="inline-flex items-center gap-2 select-none cursor-pointer">
                    <span className="relative w-[18px] h-[18px] flex-shrink-0">
                      <input type="checkbox" className="peer sr-only" />
                      <span className="absolute inset-0 rounded-[5px] border border-[#A29B8E]/50 bg-[#F7F4EE]
                                       peer-checked:bg-[#0F0F10] peer-checked:border-[#0F0F10] transition-all" />
                      <svg className="absolute inset-0 m-auto w-2.5 h-2.5 opacity-0 peer-checked:opacity-100 transition-opacity"
                           fill="none" stroke="white" strokeWidth="3" viewBox="0 0 12 12">
                        <polyline points="1.5 6 4.5 9 10.5 3" />
                      </svg>
                    </span>
                    <span className="text-[13px] text-[#0F0F10]/65">Recuérdame</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setResetMode(true); setResetEmail(email); }}
                    className="hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-2xl bg-[#0F0F10] text-white text-base font-medium
                             hover:brightness-110 active:scale-[0.99] disabled:opacity-60
                             transition-all shadow-[0_12px_36px_-12px_rgba(15,15,16,0.45)]"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-sm text-[#0F0F10]/55 text-center">
            © {new Date().getFullYear()} H&amp;E Arquitectos. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}

function InputIconMail() {
  return (
    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F10]/60"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16v12H4z" /><path d="m22 7-10 7L2 7" />
    </svg>
  );
}

function InputIconLock() {
  return (
    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F10]/60"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}