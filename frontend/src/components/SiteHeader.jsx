import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, apiUrl } from '../api';
import { useAuth } from '../auth/AuthContext';
import { UserAvatar } from './ui';

export default function Header() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutError, setLogoutError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || user.needsProfileSetup) { setUnreadCount(0); return; }
    let active = true;
    api('/api/community/notifications').then((data) => { if (active) setUnreadCount(location.pathname === '/community' ? 0 : data.unreadCount || 0); }).catch(() => {});
    const events = new EventSource(apiUrl('/api/community/events'), { withCredentials: true });
    events.addEventListener('notification:new', () => setUnreadCount((count) => count + 1));
    const clearUnread = () => setUnreadCount(0);
    window.addEventListener('community:notifications-read', clearUnread);
    return () => { active = false; events.close(); window.removeEventListener('community:notifications-read', clearUnread); };
  }, [user?.id, user?.needsProfileSetup, location.pathname]);

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
      navigate('/explore');
    } catch {
      setLogoutError('Chưa thể đăng xuất. Hãy thử lại.');
    }
  }

  return <>
    <header className="site-header">
      <Link className="brand" to="/" aria-label="Nhật ký, về trang chủ">
        <span className="brand-mark" aria-hidden="true"><span /></span>
        <span><strong>Nhật ký</strong><small>nơi những ngày ở lại</small></span>
      </Link>
      <nav className="main-nav" aria-label="Điều hướng chính">
        <Link to="/explore">Góc chia sẻ</Link>
        {user && !user.needsProfileSetup && <Link to="/my-diary">Sổ của tôi</Link>}
        {user && !user.needsProfileSetup && <Link to="/community">Cộng đồng{unreadCount > 0 && <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}</Link>}
      </nav>
      <div className="header-actions">
        {!loading && (user
          ? user.needsProfileSetup
            ? <Link className="button button-small" to="/setup-profile">Đặt biệt danh</Link>
            : <><Link className="profile-link" to="/profile" aria-label={`Mở hồ sơ ${user.displayName}`}><UserAvatar src={user.avatarUrl} name={user.displayName} /><span className="user-name">{user.displayName}</span></Link><button className="text-button" onClick={handleLogout}>Đăng xuất</button></>
          : <Link className="button button-small" to="/login">Đăng nhập</Link>)}
      </div>
    </header>
    {logoutError && <div className="toast-error" role="alert">{logoutError}</div>}
  </>;
}
