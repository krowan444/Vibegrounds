import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

import HomePage from './pages/HomePage';
import CreationPage from './pages/CreationPage';
import UploadPage from './pages/UploadPage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import CategoryPage from './pages/CategoryPage';
import PortalPage from './pages/PortalPage';
import ChartsPage from './pages/ChartsPage';
import HallOfFamePage from './pages/HallOfFamePage';
import BadgesPage from './pages/BadgesPage';
import SiteFooter from './components/SiteFooter';
import EditCreationPage from './pages/EditCreationPage';
import MemesPage from './pages/MemesPage';
import ComicsPage from './pages/ComicsPage';
import ArcadePage from './pages/ArcadePage';
import ComicPage from './pages/ComicPage';
import PostComicPage from './pages/PostComicPage';
import EditComicPage from './pages/EditComicPage';
import PostMemePage from './pages/PostMemePage';
import CoinsPage from './pages/CoinsPage';
import RulesPage from './pages/RulesPage';
import AdvertisePage from './pages/AdvertisePage';
import FeedbackPage from './pages/FeedbackPage';
import UnsubscribePage from './pages/UnsubscribePage';
import AdminPage from './pages/AdminPage';

import ForumPage from './pages/ForumPage';
import ForumCategoryPage from './pages/ForumCategoryPage';
import ForumThreadPage from './pages/ForumThreadPage';

import { Analytics } from '@vercel/analytics/react';
import ProgressDrawer from './components/ProgressDrawer';
import ScrollToTop from './components/ScrollToTop';
import AuthPage from './pages/AuthPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import RouteMeta from './lib/pageMeta';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Inside the router, because it needs to know when the route
            changed. Renders nothing. */}
        <ScrollToTop />
        {/* Title, description and canonical URL per route. Fixed routes are
            listed in pageMeta.js; pages whose name depends on a fetch set
            their own with useDocumentTitle. Also renders nothing. */}
        <RouteMeta />
        <div className="vg-app">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/portal" element={<PortalPage />} />
            <Route path="/charts" element={<ChartsPage />} />
            <Route path="/badges" element={<BadgesPage />} />
          <Route path="/hall-of-fame" element={<HallOfFamePage />} />
            <Route path="/category/:category" element={<CategoryPage />} />
            <Route path="/creation/:id" element={<CreationPage />} />
            <Route path="/creation/:id/edit" element={<EditCreationPage />} />
            <Route path="/memes" element={<MemesPage />} />

            {/* /comics/post before /comics/:id, or "post" is read as an id. */}
            <Route path="/comics" element={<ComicsPage />} />
            <Route path="/arcade" element={<ArcadePage />} />
            <Route path="/comics/post" element={<PostComicPage />} />
            <Route path="/comics/:id" element={<ComicPage />} />
            <Route path="/comics/:id/edit" element={<EditComicPage />} />
            <Route path="/memes/post" element={<PostMemePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/coins" element={<CoinsPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/advertise" element={<AdvertisePage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />

            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/edit-profile" element={<EditProfilePage />} />
            <Route path="/settings" element={<EditProfilePage />} />

            <Route path="/community" element={<ForumPage />} />
            <Route path="/community/category/:slug" element={<ForumCategoryPage />} />
            <Route path="/community/thread/:id" element={<ForumThreadPage />} />

            <Route path="/auth" element={<AuthPage />} />
            <Route path="/login" element={<Navigate to="/auth" replace />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify" element={<VerifyEmailPage />} />

            <Route path="/admin" element={<AdminPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <SiteFooter />
          {/* Fixed to the right edge, so it rides above every page rather
              than being part of any one of them. Renders nothing when
              signed out. */}
          <ProgressDrawer />
          {/* Vercel's own analytics: no cookies, no consent banner needed,
              and it only reports in production. */}
          <Analytics />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
