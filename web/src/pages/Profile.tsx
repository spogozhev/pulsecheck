import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { useAuth } from '../state/auth';

/** Страница «Профиль»: имя, email и смена пароля. */
export function ProfilePage() {
  const { user, refresh } = useAuth();
  const qc = useQueryClient();

  // --- имя и email ---
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [emailPassword, setEmailPassword] = useState('');
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const saveProfile = useMutation({
    mutationFn: () =>
      api.put('/api/profile', {
        name: name.trim(),
        ...(email.trim() !== (user?.email ?? '')
          ? { email: email.trim(), currentPassword: emailPassword }
          : {}),
      }),
    onSuccess: async () => {
      setProfileError(null);
      setEmailPassword('');
      setInfoMsg('Профиль обновлён');
      await refresh();
      void qc.invalidateQueries();
    },
    onError: (e) => {
      setInfoMsg(null);
      setProfileError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
    },
  });

  // --- пароль ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  const changePassword = useMutation({
    mutationFn: () =>
      api.post('/api/profile/password', { currentPassword, newPassword }),
    onSuccess: async () => {
      setPassError(null);
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
      setPassMsg('Пароль изменён. Используйте новый пароль при следующем входе.');
    },
    onError: (e) => {
      setPassMsg(null);
      setPassError(e instanceof ApiError ? e.message : 'Ошибка смены пароля');
    },
  });

  const passwordsMismatch = newPassword2 !== '' && newPassword !== newPassword2;
  const passwordValid =
    currentPassword !== '' && newPassword.length >= 8 && !passwordsMismatch;
  const emailChanged = email.trim() !== '' && email.trim() !== (user?.email ?? '');
  const profileValid = name.trim().length >= 2 && (!emailChanged || emailPassword !== '');

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Профиль</h1>

      <div className="card mb-6 p-5">
        <h2 className="mb-4 font-semibold text-slate-700">Имя и email</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Имя</label>
            <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {emailChanged && (
              <div className="mt-1.5">
                <label className="label">Текущий пароль — для подтверждения смены email</label>
                <input
                  className="input"
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
        {infoMsg && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{infoMsg}</div>}
        {profileError && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{profileError}</div>}
        <button
          className="btn-primary mt-4"
          disabled={!profileValid || saveProfile.isPending}
          onClick={() => saveProfile.mutate()}
        >
          {saveProfile.isPending ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 font-semibold text-slate-700">Смена пароля</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Текущий пароль</label>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Новый пароль (минимум 8 символов)</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Повторите новый пароль</label>
            <input
              className="input"
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
            />
            {passwordsMismatch && <div className="mt-1 text-xs text-rose-600">Пароли не совпадают</div>}
          </div>
        </div>
        {passMsg && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{passMsg}</div>}
        {passError && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{passError}</div>}
        <button
          className="btn-primary mt-4"
          disabled={!passwordValid || changePassword.isPending}
          onClick={() => changePassword.mutate()}
        >
          {changePassword.isPending ? 'Сохранение…' : 'Изменить пароль'}
        </button>
      </div>
    </div>
  );
}
