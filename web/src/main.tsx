import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import './index.css';
import { AuthProvider, RequireAuth } from './state/auth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { PresentationsPage } from './pages/Presentations';
import { PresentationDetailPage } from './pages/PresentationDetail';
import { LecturesPage } from './pages/Lectures';
import { LectureDetailPage } from './pages/LectureDetail';
import { AdminUsersPage } from './pages/AdminUsers';
import { PresentPage } from './pages/Present';
import { VotePage } from './pages/Vote';

dayjs.locale('ru');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5_000, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/v/:code" element={<VotePage />} />
            <Route path="/v/:code/:slide" element={<VotePage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Layout>
                    <PresentationsPage />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/presentations"
              element={
                <RequireAuth>
                  <Layout>
                    <PresentationsPage />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/presentations/:id"
              element={
                <RequireAuth>
                  <Layout>
                    <PresentationDetailPage />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/lectures"
              element={
                <RequireAuth>
                  <Layout>
                    <LecturesPage />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/lectures/:id"
              element={
                <RequireAuth>
                  <Layout>
                    <LectureDetailPage />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireAuth>
                  <Layout>
                    <AdminUsersPage />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route path="/present/:lectureId" element={<RequireAuth><PresentPage /></RequireAuth>} />
            <Route path="*" element={<div className="p-10 text-slate-500">Страница не найдена</div>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
