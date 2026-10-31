import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import SiteHeader from './components/SiteHeader';
import { Loading, NotFound } from './components/ui';
import ExplorePage from './pages/ExplorePage';
import MyDiaryPage from './pages/MyDiaryPage';
import CommunityPage from './pages/CommunityPage';
import EntryDetailPage from './pages/EntryDetailPage';
import EntryFormPage from './pages/EntryFormPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import MyProfilePage from './pages/MyProfilePage';
import PublicProfilePage from './pages/PublicProfilePage';
import LoginPage from './pages/LoginPage';

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  return <div className="site-frame">
    <SiteHeader />
    <main className="page-main">
      <Routes>
        <Route path="/" element={loading ? <Loading /> : <Navigate to={user ? '/my-diary' : '/explore'} replace />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/explore/:id" element={<EntryDetailPage publicPage />} />
        <Route path="/people/:id" element={<PublicProfilePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup-profile" element={<PrivateRoute><ProfileSetupPage /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><MyProfilePage /></PrivateRoute>} />
        <Route path="/my-diary" element={<PrivateRoute><MyDiaryPage /></PrivateRoute>} />
        <Route path="/community" element={<PrivateRoute><CommunityPage /></PrivateRoute>} />
        <Route path="/entries/new" element={<PrivateRoute><EntryFormPage /></PrivateRoute>} />
        <Route path="/entries/:id/edit" element={<PrivateRoute><EntryFormPage /></PrivateRoute>} />
        <Route path="/entries/:id" element={<PrivateRoute><EntryDetailPage /></PrivateRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    <footer className="site-footer"><span>Viết cho riêng mình. Chia sẻ khi bạn muốn.</span><span>Nhật ký cá nhân</span></footer>
  </div>;
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.needsProfileSetup && location.pathname !== '/setup-profile') return <Navigate to="/setup-profile" replace />;
  return children;
}
