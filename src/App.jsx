import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import BrowserChrome from './components/BrowserChrome';
import HomePage from './pages/HomePage';
import CreationPage from './pages/CreationPage';
import UploadPage from './pages/UploadPage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import CategoryPage from './pages/CategoryPage';
import PortalPage from './pages/PortalPage';
import AuthPage from './pages/AuthPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BrowserChrome>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/creation/:id" element={<CreationPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/edit-profile" element={<EditProfilePage />} />
            <Route path="/category/:category" element={<CategoryPage />} />
            <Route path="/portal" element={<PortalPage />} />
            <Route path="/auth" element={<AuthPage />} />
          </Routes>
        </BrowserChrome>
      </AuthProvider>
    </BrowserRouter>
  );
}
