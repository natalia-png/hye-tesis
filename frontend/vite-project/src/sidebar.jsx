import { NavLink } from "react-router-dom";
export default function Sidebar() {
  const link="block px-3 py-2 rounded hover:bg-gray-100";
  const active="bg-gray-200 font-medium";
  return (
    <aside className="fixed top-[56px] left-0 h-[calc(100vh-56px)] w-56 bg-white border-r p-4">
      <NavLink to="/" end className={({isActive})=>`${link} ${isActive?active:""}`}>Dashboard</NavLink>
      <NavLink to="/proyectos" className={({isActive})=>`${link} ${isActive?active:""}`}>Proyectos</NavLink>
    </aside>
  );
}
