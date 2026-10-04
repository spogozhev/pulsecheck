import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../api/client';
import type { AdminUserRow } from '../api/types';
import { useAuth } from '../state/auth';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'ожидает подтверждения', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'подтверждён', cls: 'bg-emerald-50 text-emerald-700' },
  blocked: { label: 'заблокирован', cls: 'bg-rose-50 text-rose-700' },
};

/** Страница администратора: подтверждение и блокировка преподавателей. */
export function AdminUsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => api.get<AdminUserRow[]>('/api/admin/users'),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/users/${id}/approve`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['adminUsers'] }),
  });
  const block = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/users/${id}/block`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['adminUsers'] }),
  });

  if (me?.role !== 'admin') {
    return <div className="card p-6 text-rose-600">Доступ только для администраторов</div>;
  }

  const users = list.data ?? [];
  const pending = users.filter((u) => u.status === 'pending');
  const rest = users.filter((u) => u.status !== 'pending');

  const row = (u: AdminUserRow) => {
    const badge = STATUS_BADGE[u.status] ?? { label: u.status, cls: 'bg-slate-100 text-slate-600' };
    return (
      <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
        <td className="px-4 py-3">
          <div className="font-medium text-slate-800">{u.name}</div>
          <div className="text-xs text-slate-400">{u.email}</div>
        </td>
        <td className="px-4 py-3 text-slate-600">{u.role === 'admin' ? 'админ' : 'преподаватель'}</td>
        <td className="px-4 py-3">
          <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
        </td>
        <td className="px-4 py-3 text-slate-600">{dayjs(u.createdAt).format('D MMM YYYY, HH:mm')}</td>
        <td className="px-4 py-3 text-center tabular-nums text-slate-600">{u._count?.presentations ?? 0}</td>
        <td className="px-4 py-3 text-center tabular-nums text-slate-600">{u._count?.lectures ?? 0}</td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-2">
            {u.status !== 'approved' && (
              <button
                className="btn-primary px-3 py-1 text-xs"
                disabled={approve.isPending}
                onClick={() => approve.mutate(u.id)}
              >
                Подтвердить
              </button>
            )}
            {u.status !== 'blocked' && u.id !== me.id && (
              <button
                className="btn-danger px-3 py-1 text-xs"
                disabled={block.isPending}
                onClick={() => {
                  if (confirm(`Заблокировать ${u.email}?`)) block.mutate(u.id);
                }}
              >
                Заблокировать
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Пользователи</h1>

      <h2 className="mb-3 font-semibold text-slate-700">
        Ожидают подтверждения {pending.length > 0 && `(${pending.length})`}
      </h2>
      {pending.length === 0 ? (
        <div className="card mb-8 p-6 text-sm text-slate-400">Новых заявок нет</div>
      ) : (
        <div className="card mb-8 overflow-hidden">
          <table className="w-full text-sm">{renderTable(pending)}</table>
        </div>
      )}

      <h2 className="mb-3 font-semibold text-slate-700">Все пользователи</h2>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">{renderTable(rest)}</table>
      </div>
    </div>
  );

  function renderTable(rows: AdminUserRow[]) {
    return (
      <>
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Пользователь</th>
            <th className="px-4 py-3">Роль</th>
            <th className="px-4 py-3">Статус</th>
            <th className="px-4 py-3">Регистрация</th>
            <th className="px-4 py-3 text-center">През.</th>
            <th className="px-4 py-3 text-center">Лекц.</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>{rows.map(row)}</tbody>
      </>
    );
  }
}
