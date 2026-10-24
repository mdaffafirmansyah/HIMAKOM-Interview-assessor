import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CandidatesPage } from './pages/CandidatesPage';
import { SessionsPage } from './pages/SessionsPage';
import { RubricsPage } from './pages/RubricsPage';
import { EvaluationsPage } from './pages/EvaluationsPage';
import { ReviewPage } from './pages/ReviewPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Halaman Login & Pendaftaran Publik */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rute Aplikasi yang Dilindungi (Wajib Login) */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/kandidat" element={<CandidatesPage />} />
            <Route path="/sesi" element={<SessionsPage />} />
            <Route path="/rubrik" element={<RubricsPage />} />
            <Route path="/evaluasi" element={<EvaluationsPage />} />

            {/* Halaman Review Khusus Hak Akses Reviewer & Admin */}
            <Route
              path="/review"
              element={
                <ProtectedRoute allowedRoles={['admin', 'reviewer']}>
                  <ReviewPage />
                </ProtectedRoute>
              }
            />

            <Route path="/laporan" element={<ReportsPage />} />
            <Route path="/pengaturan" element={<SettingsPage />} />

            {/* Catch-all redirect ke Dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
