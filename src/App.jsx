import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

import HomePage from './pages/HomePage';
import SiteFooter from './components/SiteFooter';

import { Analytics } from '@vercel/analytics/react';
import ProgressDrawer from './components/ProgressDrawer';
import ScrollToTop from './components/ScrollToTop';
import RouteMeta from './lib/pageMeta';

/**
 * Every route except the home page is fetched when somebody actually goes
 * to it.
 *
 * The whole site used to arrive in one 771 kB file. Somebody landing on the
 * home page on a phone downloaded the arcade and all nine of its games, the
 * comic reader, the Control Room, the upload forms and the forum before
 * they could read the first sentence — and most of them will never open any
 * of it. On a poor connection that is the difference between a site that
 * appears and a site that people give up on.
 *
 * The home page stays imported normally. It is the one page that is
 * definitely needed, and lazy-loading it would mean a flash of the fallback
 * before the thing you came to see.
 *
 * Vite splits each of these into its own file automatically. The names in
 * the comments below are what shows up in the build output.
 */
const PortalPage        = lazy(() => import('./pages/PortalPage'));
const ChartsPage        = lazy(() => import('./pages/ChartsPage'));
const BadgesPage        = lazy(() => import('./pages/BadgesPage'));
const HallOfFamePage    = lazy(() => import('./pages/HallOfFamePage'));
const CategoryPage      = lazy(() => import('./pages/CategoryPage'));
const CreationPage      = lazy(() => import('./pages/CreationPage'));
const EditCreationPage  = lazy(() => import('./pages/EditCreationPage'));
const MemesPage         = lazy(() => import('./pages/MemesPage'));

const ComicsPage        = lazy(() => import('./pages/ComicsPage'));
const ComicPage         = lazy(() => import('./pages/ComicPage'));
const PostComicPage     = lazy(() => import('./pages/PostComicPage'));
const EditComicPage     = lazy(() => import('./pages/EditComicPage'));
const PostMemePage      = lazy(() => import('./pages/PostMemePage'));

// The big one. Nine games and a whole cabinet, only for people who go there.
const ArcadePage        = lazy(() => import('./pages/ArcadePage'));

const UploadPage        = lazy(() => import('./pages/UploadPage'));
const CoinsPage         = lazy(() => import('./pages/CoinsPage'));
const RulesPage         = lazy(() => import('./pages/RulesPage'));
const AdvertisePage     = lazy(() => import('./pages/AdvertisePage'));
const FeedbackPage      = lazy(() => import('./pages/FeedbackPage'));
const UnsubscribePage   = lazy(() => import('./pages/UnsubscribePage'));

const ProfilePage       = lazy(() => import('./pages/ProfilePage'));
const EditProfilePage   = lazy(() => import('./pages/EditProfilePage'));

const ForumPage         = lazy(() => import('./pages/ForumPage'));
const ForumCategoryPage = lazy(() => import('./pages/ForumCategoryPage'));
const ForumThreadPage   = lazy(() => import('./pages/ForumThreadPage'));

const AuthPage          = lazy(() => import('./pages/AuthPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage   = lazy(() => import('./pages/VerifyEmailPage'));

// Staff only, and the largest page on the site. There is no reason for a
// visitor to ever download it.
const AdminPage         = lazy(() => import('./pages/AdminPage'));

/**
 * What sits there for the moment a page is being fetched.
 *
 * Deliberately quiet. A spinner that appears for 80ms on a good connection
 * is a flicker, and a flicker on every navigation makes a fast site feel
 * broken. This holds the space and says nothing unless the wait is real.
 */
function RouteLoading() {
  return (
    <div className="vg-route-loading" role="status" aria-live="polite">
      <span>Loading…</span>
    </div>
  );
}

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
          <Suspense fallback={<RouteLoading />}>
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
          </Suspense>
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
