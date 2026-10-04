import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth';
import { Logo } from '../components/Logo';

export function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/presentations';

  if (user) {
    return <Navigate to={from} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-2 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="mb-4 text-center text-sm text-slate-500">
          Опросы на лекциях
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              После регистрации аккаунт должен подтвердить администратор — до этого проведение
              лекций будет недоступно.
            </div>
          )}
          {mode === 'register' && (
            <div>
              <label className="label">Имя</label>
              <input className="input" value={name} required minLength={2} maxLength={120}
                onChange={(e) => setName(e.target.value)} placeholder="Иван Иванов" />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} required
              onChange={(e) => setEmail(e.target.value)} placeholder="teacher@example.com" />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input className="input" type="password" value={password} required minLength={8}
              onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов" />
          </div>
          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
        <button
          className="mt-4 w-full text-center text-sm text-sky-600 hover:underline"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
        {mode === 'login' && (
          <Link to="/forgot-password" className="mt-2 block text-center text-xs text-slate-400 hover:text-sky-600">
            Забыли пароль?
          </Link>
        )}
        {mode === 'login' && (
          <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-400">
            Демо: demo@slide.local / demo12345
          </div>
        )}
      </div>
    </div>
  );
}
