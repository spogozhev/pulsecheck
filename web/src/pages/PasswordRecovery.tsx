import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Logo } from '../components/Logo';

/** Запрос письма для восстановления пароля. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<{ ok: boolean; devResetUrl?: string }>('/api/auth/password/forgot', {
        email,
      });
      setSent(true);
      if (res.devResetUrl) setDevLink(res.devResetUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка запроса');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>

        {sent ? (
          <div className="space-y-3 text-center">
            <div className="text-4xl">📩</div>
            <div className="font-medium text-slate-800">Если аккаунт существует, письмо отправлено</div>
            <p className="text-sm text-slate-500">
              Проверьте почту: внутри ссылка для восстановления пароля, действует 30 минут.
            </p>
            {devLink && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
                Dev-режим (SMTP не настроен). Ссылка для восстановления:
                <br />
                <a className="break-all text-sky-600 hover:underline" href={devLink}>
                  {devLink}
                </a>
              </div>
            )}
            <Link to="/login" className="btn-secondary w-full">
              Вернуться ко входу
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4 text-center text-sm text-slate-500">
              Введите email — пришлём ссылку для восстановления пароля
            </div>
            <form onSubmit={submit} className="space-y-3">
              <input
                className="input"
                type="email"
                required
                value={email}
                placeholder="Ваш email"
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
              )}
              <button className="btn-primary w-full" disabled={false}>
                Восстановить пароль
              </button>
            </form>
            <Link to="/login" className="mt-4 block text-center text-sm text-sky-600 hover:underline">
              Вернуться ко входу
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

/** Установка нового пароля по токену из письма. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== newPassword2) {
      setError('Пароли не совпадают');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/auth/password/reset', { token, newPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>

        {done ? (
          <div className="space-y-3 text-center">
            <div className="text-4xl">✅</div>
            <div className="font-medium text-slate-800">Пароль изменён</div>
            <p className="text-sm text-slate-500">Войдите с новым паролем.</p>
            <Link to="/login" className="btn-primary w-full">
              Ко входу
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4 text-center text-sm text-slate-500">Новый пароль</div>
            {!token && (
              <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                В ссылке нет токена восстановления
              </div>
            )}
            <form onSubmit={submit} className="space-y-3">
              <input
                className="input"
                type="password"
                required
                minLength={8}
                value={newPassword}
                placeholder="Новый пароль (минимум 8 символов)"
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                className="input"
                type="password"
                required
                minLength={8}
                value={newPassword2}
                placeholder="Повторите пароль"
                onChange={(e) => setNewPassword2(e.target.value)}
              />
              {error && (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
              )}
              <button className="btn-primary w-full" disabled={!token || busy}>
                {busy ? 'Сохранение…' : 'Установить пароль'}
              </button>
            </form>
            <Link to="/login" className="mt-4 block text-center text-sm text-sky-600 hover:underline">
              Вернуться ко входу
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
