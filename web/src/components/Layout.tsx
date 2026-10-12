import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth';
import { Logo } from './Logo';

const STORAGE_KEY = 'pulsecheck:sidebar';

/** Иконка-гамбургер (три полоски). */
function BurgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/** Крестик (свернуть меню). */
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState<boolean>(() => localStorage.getItem(STORAGE_KEY) !== 'closed');

  // запоминаем выбор пользователя между сессиями
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, open ? 'open' : 'closed');
  }, [open]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-sky-100 text-sky-800' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className={`shrink-0 overflow-hidden transition-[width] duration-200 ${
          open ? 'w-56' : 'w-0'
        }`}
      >
        <div className="relative flex h-full w-56 flex-col border-r border-slate-200 bg-white p-4">
          {/* свернуть меню */}
          <button
            className="absolute right-2 top-2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={() => setOpen(false)}
            aria-label="Свернуть меню"
          >
            <CloseIcon />
          </button>
          <Link to="/presentations" className="mb-6 block px-2">
            <Logo size="sm" />
          </Link>
          <nav className="space-y-1">
            <NavLink to="/presentations" className={navClass}>
              Презентации
            </NavLink>
            <NavLink to="/lectures" className={navClass}>
              Лекции
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin/users" className={navClass}>
                Пользователи
              </NavLink>
            )}
          </nav>
          <div className="mt-auto border-t border-slate-200 pt-3">
            <div className="mb-2 px-3 text-sm font-medium text-slate-800">{user?.name}</div>
            <div className="mb-3 px-3 text-xs text-slate-400">{user?.email}</div>
            <button
              className="btn-secondary w-full"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Выйти
            </button>
            <div className="mt-2 px-3 text-center text-[10px] text-slate-300">
              PulseCheck v{__APP_VERSION__}
            </div>
          </div>
        </div>
      </aside>

      {/* гамбургер: появляется, когда меню свернуто */}
      {!open && (
        <button
          className="fixed left-3 top-3 z-50 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50"
          onClick={() => setOpen(true)}
          aria-label="Развернуть меню"
        >
          <BurgerIcon />
        </button>
      )}

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
