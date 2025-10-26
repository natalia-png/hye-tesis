import { NavLink } from "react-router-dom";
import { HiOutlineHome, HiOutlineCollection } from "react-icons/hi";

const base = "flex flex-col items-center justify-center h-12 flex-1 text-[12px] font-medium";
const active = "text-ink";
const inactive = "text-stone";

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 h-16 bg-ivory/90 backdrop-blur border-t border-taupe/40 shadow-sm z-50">
      <div className="max-w-phone mx-auto h-full grid grid-cols-2">
        <NavLink to="/" end className={({isActive}) => `${base} ${isActive?active:inactive}`}>
          <HiOutlineHome size={20} />
          <span>Inicio</span>
        </NavLink>
        <NavLink to="/proyectos" className={({isActive}) => `${base} ${isActive?active:inactive}`}>
          <HiOutlineCollection size={20} />
          <span>Proyectos</span>
        </NavLink>
      </div>
    </nav>
  );
}
