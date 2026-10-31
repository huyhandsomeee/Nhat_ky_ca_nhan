import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { UserAvatar } from './ui';
import { formatTimestamp } from '../shared/entryUtils';

export default function Header() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);

  useEffect(() => {
    if (!user || user.needsProfileSetup) { setCurrentStreak(0); return; }
    let active = true;
    api('/api/entries/stats').then((data) => { if (active) setCurrentStreak(data.currentStreak || 0); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id, user?.needsProfileSetup]);

  useEffect(() => {
    if (!user || user.needsProfileSetup) {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsOpen(false);
      return undefined;
    }
    let active = true;
    async function loadNotifications() {
      try {
        const data = await api('/api/notifications');
        if (active) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {}
    }
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') loadNotifications(); };
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 20000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [user?.id, user?.needsProfileSetup]);

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
      navigate('/explore');
    } catch {
      setLogoutError('Chưa thể đăng xuất. Hãy thử lại.');
    }
  }

  async function markAllNotificationsRead() {
    try {
      await api('/api/notifications/read', { method: 'POST' });
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => item.readAt ? item : { ...item, readAt }));
      setUnreadCount(0);
    } catch {}
  }

  async function openNotification(notification) {
    setNotificationsOpen(false);
    if (!notification.readAt) {
      try {
        await api(`/api/notifications/${notification._id}/read`, { method: 'POST' });
        setNotifications((current) => current.map((item) => item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {}
    }
    if (notification.entry?._id && notification.entry.visibility === 'public') {
      navigate(`/explore/${notification.entry._id}#comments`);
    } else if (notification.type === 'new_follower' && notification.actor?._id) navigate(`/people/${notification.actor._id}`);
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
        {user && !user.needsProfileSetup && <Link to="/saved">Bài đã lưu</Link>}
      </nav>
      <div className="header-actions">
        {user && !user.needsProfileSetup && <Link to="/my-diary" className="header-streak" title="Chuỗi ngày viết nhật ký">🔥 {currentStreak} ngày streak</Link>}
        {user && !user.needsProfileSetup && <div className="notification-area">
          <button className="notification-toggle" type="button" aria-expanded={notificationsOpen} aria-controls="header-notifications" onClick={() => {
            setNotificationsOpen((open) => !open);
            if (!notificationsOpen) api('/api/notifications').then((data) => { setNotifications(data.notifications || []); setUnreadCount(data.unreadCount || 0); }).catch(() => {});
          }}>
            <span>Thông báo</span>{unreadCount > 0 && <span className="notification-count" aria-label={`${unreadCount} thông báo chưa đọc`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          {notificationsOpen && <section className="notification-panel" id="header-notifications" aria-label="Thông báo">
            <div className="notification-panel-heading"><h2>Thông báo</h2>{unreadCount > 0 && <button className="text-button" type="button" onClick={markAllNotificationsRead}>Đánh dấu đã đọc</button>}</div>
            {notifications.length ? <ul className="notification-list">{notifications.map((notification) => {
              const actor = notification.actor?.displayName || notification.actor?.username || 'Một người dùng';
              const message = notification.type === 'comment_reply'
                ? 'đã trả lời bình luận của bạn'
                : notification.type === 'entry_like'
                  ? 'đã thả tim bài viết của bạn'
                  : notification.type === 'comment_reaction'
                    ? 'đã thả cảm xúc vào bình luận của bạn'
                    : notification.type === 'new_follower'
                      ? 'đã bắt đầu theo dõi bạn'
                      : 'đã bình luận bài viết của bạn';
              return <li key={notification._id}><button className={`notification-item ${notification.readAt ? '' : 'unread'}`} type="button" onClick={() => openNotification(notification)}><span><strong>{actor}</strong> {message}</span>{notification.entry?.title && <small>{notification.entry.title}</small>}<time>{formatTimestamp(notification.createdAt)}</time></button></li>;
            })}</ul> : <p className="notification-empty">Chưa có thông báo mới.</p>}
          </section>}
        </div>}
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
