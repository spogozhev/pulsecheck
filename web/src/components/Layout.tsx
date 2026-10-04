import { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth';
import { Logo } from './Logo';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-sky-100 text-sky-800' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
        <Link to="/presentations" className="mb-6">
          <Logo />
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
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        {user?.status === 'pending' && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Аккаунт ожидает подтверждения администратором. Проведение лекций и создание опросов
            станут доступны после одобрения.
          </div>
        )}
        {user?.status === 'blocked' && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Аккаунт заблокирован администратором. Изменение материалов и запуск лекций недоступны.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
