import { useAuth } from "../app/useAuth";

export default function Header() {
  const { user, logout } = useAuth();
  const first = user?.name?.split(" ")[0] || "Bienvenido";
  return (
    <header className="fixed top-0 inset-x-0 h-16 bg-[#E9E4DD] border-b border-taupe/40 z-[100]">
      <div className="max-w-[500px] mx-auto h-full px-4 flex items-center justify-between">
        <h1 className="text-[16px] font-semibold text-ink">Plataforma H&E</h1>
        {user && (
          <div className="text-right leading-tight">
            <div className="text-[13px] text-ink/70">Bienvenido</div>
            <div className="text-[13px] text-ink font-medium capitalize">
              {first} · <span className="text-ink/60">{user.role}</span>
            </div>
          </div>
        )}
        <button className="btn-ghost ml-2 px-3 py-1 text-[12px]" onClick={logout}>Salir</button>
      </div>
    </header>
  );
}
