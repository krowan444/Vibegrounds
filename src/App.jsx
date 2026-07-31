import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import BrowserChrome from './components/BrowserChrome';

import HomePage from './pages/HomePage';
import CreationPage from './pages/CreationPage';
import UploadPage from './pages/UploadPage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import CategoryPage from './pages/CategoryPage';
import PortalPage from './pages/PortalPage';
import ChartsPage from './pages/ChartsPage';
import CoinsPage from './pages/CoinsPage';
import RulesPage from './pages/RulesPage';
import AdminPage from './pages/AdminPage';

import ForumPage from './pages/ForumPage';
import ForumCategoryPage from './pages/ForumCategoryPage';
import ForumThreadPage from './pages/ForumThreadPage';

import AuthPage from './pages/AuthPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BrowserChrome>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/portal" element={<PortalPage />} />
            <Route path="/charts" element={<ChartsPage />} />
            <Route path="/category/:category" element={<CategoryPage />} />
            <Route path="/creation/:id" element={<CreationPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/coins" element={<CoinsPage />} />
            <Route path="/rules" element={<RulesPage />} />

            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/edit-profile" element={<EditProfilePage />} />
            <Route path="/settings" element={<EditProfilePage />} />

            <Route path="/forum" element={<ForumPage />} />
            <Route path="/forum/category/:slug" element={<ForumCategoryPage />} />
            <Route path="/forum/thread/:id" element={<ForumThreadPage />} />

            <Route path="/auth" element={<AuthPage />} />
            <Route path="/login" element={<Navigate to="/auth" replace />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify" element={<VerifyEmailPage />} />

            <Route path="/admin" element={<AdminPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserChrome>
      </AuthProvider>
    </BrowserRouter>
  );
}
