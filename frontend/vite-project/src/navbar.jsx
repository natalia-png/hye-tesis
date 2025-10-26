import { Link } from "react-router-dom";
export default function Navbar() {
  return (
    <header className="w-full bg-white border-b sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between">
        <h1 className="font-semibold">Plataforma Arquitectónica</h1>
        <nav className="flex gap-4 text-sm">
          <Link to="/">Dashboard</Link>
          <Link to="/proyectos">Proyectos</Link>
        </nav>
      </div>
    </header>
  );
}
