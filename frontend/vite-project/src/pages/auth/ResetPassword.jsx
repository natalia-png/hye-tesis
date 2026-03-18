import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../../lib/firebase";
import Logo from "../../assets/hye-letrasblancas.png";
import Bg from "../../assets/bg-arch.png";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get("oobCode");

  const [step, setStep] = useState("verifying"); // verifying | form | done | error
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setStep("error");
      setErrMsg("El enlace no es válido o ha expirado. Solicita uno nuevo desde el login.");
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((userEmail) => {
        setEmail(userEmail);
        setStep("form");
      })
      .catch(() => {
        setStep("error");
        setErrMsg("El enlace ha expirado o ya fue usado. Solicita uno nuevo desde el login.");
      });
  }, [oobCode]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrMsg("");
    if (password.length < 6) {
      setErrMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setErrMsg("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStep("done");
    } catch (err) {
      if (err.code === "auth/expired-action-code") {
        setErrMsg("El enlace ha expirado. Solicita uno nuevo.");
      } else if (err.code === "auth/weak-password") {
        setErrMsg("La contraseña es muy débil. Usa al menos 6 caracteres.");
      } else {
        setErrMsg("Ocurrió un error. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen relative flex items-center justify-center overflow-hidden bg-cover bg-center"
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

          {step === "verifying" && (
            <p className="text-center text-[#0F0F10]/60 text-sm py-4">Verificando enlace...</p>
          )}

          {step === "error" && (
            <>
              <header className="mb-6 text-center">
                <h2 className="text-2xl font-semibold text-[#0F0F10]">Enlace inválido</h2>
              </header>
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-center">
                {errMsg}
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full py-3 rounded-2xl bg-[#0F0F10] text-white text-base font-medium
                           hover:brightness-110 active:scale-[0.99] transition-all"
              >
                Volver al login
              </button>
            </>
          )}

          {step === "form" && (
            <>
              <header className="mb-6 text-center">
                <h2 className="text-2xl font-semibold text-[#0F0F10]">Nueva contraseña</h2>
                <p className="text-sm text-[#0F0F10]/70 mt-1">
                  Cuenta: <span className="font-medium">{email}</span>
                </p>
              </header>

              {errMsg && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-center">
                  {errMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    required
                    placeholder="Nueva contraseña"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 pr-24 py-3 rounded-2xl bg-[#F7F4EE]
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

                <input
                  type={show ? "text" : "password"}
                  required
                  placeholder="Confirmar contraseña"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-[#F7F4EE]
                             border border-[#A29B8E]/40 text-[15px] text-[#0F0F10]
                             outline-none focus:ring-4 focus:ring-[#0F0F10]/10
                             focus:border-[#0F0F10] transition"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-2xl bg-[#0F0F10] text-white text-base font-medium
                             hover:brightness-110 active:scale-[0.99] disabled:opacity-60
                             transition-all shadow-[0_12px_36px_-12px_rgba(15,15,16,0.45)]"
                >
                  {loading ? "Guardando..." : "Guardar nueva contraseña"}
                </button>
              </form>
            </>
          )}

          {step === "done" && (
            <>
              <header className="mb-6 text-center">
                <h2 className="text-2xl font-semibold text-[#0F0F10]">Contraseña actualizada</h2>
              </header>
              <div className="mb-6 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm text-center">
                Tu contraseña fue cambiada exitosamente. Ya puedes iniciar sesión.
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full py-3 rounded-2xl bg-[#0F0F10] text-white text-base font-medium
                           hover:brightness-110 active:scale-[0.99] transition-all"
              >
                Ir al login
              </button>
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
