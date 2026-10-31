import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, apiUrl, jsonBody } from './api';
import { canComment } from './commentPermissions.mjs';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const MOOD_EMOJI = { 'vui': '😊', 'biết ơn': '🙏', 'bình yên': '😌', 'bình thường': '🙂', 'buồn': '😔', 'lo lắng': '😟', 'tức giận': '😠', 'mệt mỏi': '😴' };

const AuthContext = createContext(null);
const MOODS = ['vui', 'biết ơn', 'bình yên', 'bình thường', 'buồn', 'lo lắng', 'tức giận', 'mệt mỏi'];

function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ user: null, loading: true });

  async function refresh() {
    try {
      const data = await api('/api/auth/me');
      setAuth({ user: data.user, loading: false });
    } catch {
      setAuth({ user: null, loading: false });
    }
  }

  useEffect(() => { refresh(); }, []);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setAuth({ user: null, loading: false });
  }

  async function login(username, password) {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: jsonBody({ username, password })
    });
    setAuth({ user: res.user, loading: false });
    return res;
  }

  async function register(username, password, confirmPassword, displayName) {
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: jsonBody({ username, password, confirmPassword, displayName })
    });
    setAuth({ user: res.user, loading: false });
    return res;
  }

  async function resetPassword(username, newPassword, confirmPassword) {
    const res = await api('/api/auth/reset-password', {
      method: 'POST',
      body: jsonBody({ username, newPassword, confirmPassword })
    });
    setAuth({ user: res.user, loading: false });
    return res;
  }

  return <AuthContext.Provider value={{ ...auth, refresh, logout, login, register, resetPassword }}>{children}</AuthContext.Provider>;
}

function useAuth() {
  return useContext(AuthContext);
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  return <div className="site-frame">
    <Header />
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

function Header() {
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

function UserAvatar({ src, name, className = '' }) {
  return <span className={`user-avatar ${className}`} aria-hidden="true">
    {src ? <img src={src.startsWith('/api/') ? apiUrl(src) : src} alt="" /> : <span>{(name || 'N').trim().slice(0, 1).toLocaleUpperCase('vi-VN')}</span>}
  </span>;
}

function ExplorePage() {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    setStatus('loading');
    api(`/api/public/entries${params.size ? `?${params}` : ''}`)
      .then((data) => { if (active) { setEntries(data.entries); setStatus('ready'); setError(''); } })
      .catch((reason) => { if (active) { setError(reason.message); setStatus('error'); } });
    return () => { active = false; };
  }, [query]);

  useEffect(() => {
    const fragment = getActiveHashtag(search);
    if (fragment === null) { setTagSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(() => api(`/api/public/entries/tags/suggestions?q=${encodeURIComponent(fragment)}`)
      .then(({ suggestions }) => { if (active) setTagSuggestions(suggestions); })
      .catch(() => { if (active) setTagSuggestions([]); }), 120);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);

  function submitSearch(event) {
    event.preventDefault();
    setQuery(search.trim());
  }

  function chooseTagSuggestion(tag) {
    const value = replaceActiveHashtag(search, tag);
    setSearch(value);
    setQuery(value.trim());
    setTagSuggestions([]);
  }

  return <>
    <section className="page-intro explore-intro">
      <div className="intro-copy">
        <p className="eyebrow">Góc chia sẻ</p>
        <h1>Những ngày bình thường<br />cũng đáng được kể.</h1>
        <p className="intro-description">Đọc những trang viết mọi người đã chọn chia sẻ. Mỗi câu chuyện bắt đầu từ một ngày rất riêng.</p>
      </div>
      <div className="intro-art" aria-hidden="true"><div className="sun-disc" /><div className="leaf leaf-one" /><div className="leaf leaf-two" /><div className="stem" /></div>
    </section>

    <section className="content-section" aria-labelledby="explore-heading">
      <div className="section-heading">
        <div><p className="eyebrow">Bài viết công khai</p><h2 id="explore-heading">Gần đây được viết</h2></div>
        <form className="search-form" onSubmit={submitSearch} role="search">
          <label className="sr-only" htmlFor="explore-search">Tìm trong bài công khai</label>
          <div className="search-input-wrap"><input id="explore-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nội dung hoặc #hashtag..." aria-controls="explore-tag-suggestions" aria-expanded={getActiveHashtag(search) !== null && tagSuggestions.length > 0} />
            {getActiveHashtag(search) !== null && !!tagSuggestions.length && <div id="explore-tag-suggestions" className="hashtag-suggestions" role="listbox" aria-label="Hashtag đang được sử dụng">{tagSuggestions.map(({ tag, uses }) => <button type="button" role="option" aria-selected="false" key={tag} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseTagSuggestion(tag)}><span>#{tag}</span><small>{uses}</small></button>)}</div>}
          </div>
          <button className="search-button" type="submit" aria-label="Tìm kiếm">⌕</button>
        </form>
      </div>
      {status === 'loading' && <Loading />}
      {status === 'error' && <InlineError message={error} />}
      {status === 'ready' && (entries.length ? <EntryList entries={entries} publicPage /> : <EmptyState title={query ? 'Chưa thấy trang viết phù hợp.' : 'Góc này đang yên ắng.'} body={query ? 'Thử một cụm từ khác nhé.' : 'Những bài được chia sẻ sẽ xuất hiện ở đây.'} />)}
    </section>
  </>;
}

function MyDiaryPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    setStatus('loading');
    api(`/api/entries${params.size ? `?${params}` : ''}`)
      .then((data) => { if (active) { setEntries(data.entries); setStatus('ready'); setError(''); } })
      .catch((reason) => { if (active) { setError(reason.message); setStatus('error'); } });
    return () => { active = false; };
  }, [query]);

  useEffect(() => {
    const fragment = getActiveHashtag(search);
    if (fragment === null) { setTagSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(() => api(`/api/entries/tags/suggestions?q=${encodeURIComponent(fragment)}`)
      .then(({ suggestions }) => { if (active) setTagSuggestions(suggestions); })
      .catch(() => { if (active) setTagSuggestions([]); }), 120);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);

  function submitSearch(event) {
    event.preventDefault();
    setQuery(search.trim());
  }

  function chooseTagSuggestion(tag) {
    const value = replaceActiveHashtag(search, tag);
    setSearch(value);
    setQuery(value.trim());
    setTagSuggestions([]);
  }

  return <>
    <section className="diary-heading">
      <div><p className="eyebrow">Sổ riêng</p><h1>Viết lại một ngày.</h1><p className="intro-description">Những điều nhỏ nhặt vẫn đáng có một nơi để ở lại.</p></div>
      <Link className="button" to="/entries/new"><span aria-hidden="true">＋</span> Viết trang mới</Link>
    </section>
    <section className="content-section diary-content" aria-labelledby="diary-list-heading">
      <div className="section-heading">
        <div><p className="eyebrow">Những trang của bạn</p><h2 id="diary-list-heading">Gần đây</h2></div>
        <form className="search-form" onSubmit={submitSearch} role="search">
          <label className="sr-only" htmlFor="diary-search">Tìm trong nhật ký của tôi</label>
          <div className="search-input-wrap"><input id="diary-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nội dung hoặc #hashtag..." aria-controls="diary-tag-suggestions" aria-expanded={getActiveHashtag(search) !== null && tagSuggestions.length > 0} />
            {getActiveHashtag(search) !== null && !!tagSuggestions.length && <div id="diary-tag-suggestions" className="hashtag-suggestions" role="listbox" aria-label="Hashtag đang được sử dụng">{tagSuggestions.map(({ tag, uses }) => <button type="button" role="option" aria-selected="false" key={tag} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseTagSuggestion(tag)}><span>#{tag}</span><small>{uses}</small></button>)}</div>}
          </div>
          <button className="search-button" type="submit" aria-label="Tìm kiếm">⌕</button>
        </form>
      </div>
      {status === 'loading' && <Loading />}
      {status === 'error' && <InlineError message={error} />}
      {status === 'ready' && (entries.length ? <EntryList entries={entries} displayName={user?.displayName} /> : <EmptyState title={query ? 'Không tìm thấy trang nào.' : 'Trang đầu tiên đang chờ bạn.'} body={query ? 'Thử từ khóa khác để tìm lại.' : 'Ghi một điều còn vương lại trong ngày hôm nay.'} action={!query && <Link className="button" to="/entries/new">Bắt đầu viết</Link>} />)}
    </section>
  </>;
}

function CommunityPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [conversations, setConversations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  async function loadCommunity() {
    const [friendData, requestData, conversationData, notificationData, blockData] = await Promise.all([
      api('/api/community/friends'), api('/api/community/requests'), api('/api/community/conversations'),
      api('/api/community/notifications'), api('/api/community/blocks')
    ]);
    setFriends(friendData.friends);
    setRequests(requestData);
    setConversations(conversationData.conversations);
    setActiveConversation((current) => {
      if (!current) return current;
      const updated = conversationData.conversations.find((item) => String(item._id) === String(current._id));
      return updated ? { ...current, status: updated.status, requestedBy: updated.requestedBy } : current;
    });
    const viewedAt = new Date().toISOString();
    if (notificationData.unreadCount > 0) {
      await api('/api/community/notifications/read', { method: 'POST' });
      window.dispatchEvent(new Event('community:notifications-read'));
    }
    setNotifications(notificationData.notifications.map((item) => item.readAt ? item : { ...item, readAt: viewedAt }));
    setBlocks(blockData.blocks);
  }

  useEffect(() => { loadCommunity().catch((reason) => setError(reason.message)); }, []);

  useEffect(() => {
    const friend = location.state?.openChatUser;
    if (friend) openConversation(friend);
  }, [location.key]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) { setUsers([]); setSearching(false); return; }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => api(`/api/community/users?q=${encodeURIComponent(normalized)}`)
      .then((data) => { if (active) { setUsers(data.users); setSearching(false); } })
      .catch((reason) => { if (active) { setError(reason.message); setSearching(false); } }), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    const events = new EventSource(apiUrl('/api/community/events'), { withCredentials: true });
    events.addEventListener('message:new', (event) => {
      const data = JSON.parse(event.data);
      if (activeConversation?._id === data.conversationId) {
        api(`/api/community/conversations/${data.conversationId}/messages`)
          .then((result) => { setMessages(result.messages); return loadCommunity(); })
          .catch(() => {});
      } else {
        loadCommunity().catch(() => {});
      }
    });
    events.addEventListener('notification:new', () => loadCommunity().catch(() => {}));
    events.addEventListener('conversation:accepted', () => loadCommunity().catch(() => {}));
    return () => events.close();
  }, [activeConversation?._id]);

  useEffect(() => {
    if (!activeConversation?._id) return;
    let active = true;
    api(`/api/community/conversations/${activeConversation._id}/messages`)
      .then((data) => { if (active) setMessages(data.messages); })
      .catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [activeConversation?._id]);

  async function run(action) {
    setError('');
    try { await action(); await loadCommunity(); }
    catch (reason) { setError(reason.message); }
  }

  async function acceptRequest(id) { await run(() => api(`/api/community/requests/${id}/accept`, { method: 'POST' })); }
  async function declineRequest(id) { await run(() => api(`/api/community/requests/${id}`, { method: 'DELETE' })); }

  async function openConversation(friend) {
    setError('');
    try {
      const { conversation } = await api(`/api/community/conversations/${friend._id}`, { method: 'POST' });
      setActiveConversation({ ...conversation, user: friend, unreadCount: 0 });
      setConversations((current) => {
        const exists = current.some((item) => String(item.user?._id) === String(friend._id));
        const opened = { ...conversation, user: friend, unreadCount: 0 };
        return exists ? current.map((item) => String(item.user?._id) === String(friend._id) ? { ...item, unreadCount: 0, status: conversation.status, requestedBy: conversation.requestedBy } : item) : [opened, ...current];
      });
    } catch (reason) { setError(reason.message); }
  }

  async function blockActiveUser() {
    if (!activeConversation) return;
    const blockedId = activeConversation.user._id;
    try {
      await api(`/api/community/blocks/${blockedId}`, { method: 'POST' });
      setActiveConversation(null);
      setMessages([]);
      await loadCommunity();
    } catch (reason) { setError(reason.message); }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!activeConversation || !messageText.trim()) return;
    try {
      const { message } = await api(`/api/community/conversations/${activeConversation._id}/messages`, { method: 'POST', body: jsonBody({ content: messageText }) });
      setMessages((current) => [...current, message]);
      setMessageText('');
      loadCommunity().catch(() => {});
    } catch (reason) { setError(reason.message); }
  }

  async function acceptMessageRequest() {
    if (!activeConversation) return;
    await run(() => api(`/api/community/conversations/${activeConversation._id}/accept`, { method: 'POST' }));
  }

  async function markNotificationsRead() {
    await api('/api/community/notifications/read', { method: 'POST' });
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.readAt ? item : { ...item, readAt }));
    window.dispatchEvent(new Event('community:notifications-read'));
  }

  const contacts = [...friends];
  conversations.forEach((conversation) => {
    if (conversation.user && !contacts.some((person) => String(person._id) === String(conversation.user._id))) contacts.push(conversation.user);
  });

  return <section className="community-page">
    <div className="diary-heading community-heading"><div><p className="eyebrow">Không gian kết nối</p><h1>Những người bạn mới.</h1><p className="intro-description">Chia sẻ câu chuyện công khai và trò chuyện với những người bạn đã kết nối.</p></div></div>
    {error && <InlineError message={error} />}
    <div className="community-grid">
      <div className="community-sidebar">
        <section className="community-card">
          <p className="eyebrow">Tìm bạn</p><h2>Tìm theo tên người dùng</h2>
          <div className="community-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập tên người dùng" minLength={2} /><span className="community-hint">Nhập ít nhất 2 ký tự</span></div>
          {searching && <p className="community-hint">Đang tìm…</p>}
          {users.map((person) => <div className="community-person" key={person._id}><div><strong>{person.displayName || person.username}</strong><small>@{person.username}</small></div><button className="text-button" onClick={() => run(() => api('/api/community/requests', { method: 'POST', body: jsonBody({ username: person.username }) }))}>＋ Mời</button></div>)}
          {query.trim().length >= 2 && !searching && !users.length && <p className="community-hint">Không tìm thấy tài khoản phù hợp.</p>}
        </section>

        <section className="community-card">
          <p className="eyebrow">Lời mời đến <span className="count-pill">{requests.incoming.length}</span></p>
          {requests.incoming.length ? requests.incoming.map((request) => <div className="community-person" key={request._id}><div><strong>{request.sender?.displayName || request.sender?.username}</strong><small>@{request.sender?.username}</small></div><div className="person-actions"><button className="text-button" onClick={() => acceptRequest(request._id)}>Chấp nhận</button><button className="text-button danger-text" onClick={() => declineRequest(request._id)}>Từ chối</button></div></div>) : <p className="community-hint">Chưa có lời mời nào.</p>}
          {!!requests.outgoing.length && <p className="community-hint">Đang chờ {requests.outgoing.length} lời mời bạn gửi.</p>}
        </section>

        <section className="community-card">
          <p className="eyebrow">Thông báo <span className="count-pill">{notifications.filter((item) => !item.readAt).length}</span></p>
          {!!notifications.some((item) => !item.readAt) && <button className="text-button" onClick={() => run(markNotificationsRead)}>Đánh dấu đã đọc</button>}
          {notifications.slice(0, 5).map((item) => <p className={`notification-line ${item.readAt ? '' : 'unread'}`} key={item._id}>
            {item.type === 'message' ? 'Tin nhắn mới từ' : item.type === 'friend_request' ? 'Lời mời kết bạn từ' : item.type === 'friend_accepted' ? 'Đã trở thành bạn với' : item.type === 'entry_comment' ? 'đã bình luận bài viết:' : item.type === 'comment_reply' ? 'đã trả lời bình luận trong bài viết:' : item.type === 'comment_reaction' ? 'đã thả cảm xúc vào bình luận trong bài viết:' : item.type === 'entry_tag' ? 'đã gắn thẻ bạn trong bài viết:' : 'Thông báo từ'} <strong>{item.actor?.displayName || item.actor?.username}</strong>
            {(item.type === 'entry_comment' || item.type === 'comment_reply' || item.type === 'comment_reaction' || item.type === 'entry_tag') && item.entry && <> · <Link to={item.entry.visibility === 'public' ? `/explore/${item.entry._id}` : `/entries/${item.entry._id}`}>{item.entry.title}</Link></>}
          </p>)}
          {!notifications.length && <p className="community-hint">Thông báo mới sẽ xuất hiện ở đây.</p>}
        </section>

        <section className="community-card">
          <p className="eyebrow">Đã chặn</p>
          {blocks.map((item) => <div className="community-person" key={item._id}><div><strong>{item.blocked?.displayName || item.blocked?.username}</strong><small>@{item.blocked?.username}</small></div><button className="text-button" onClick={() => run(() => api(`/api/community/blocks/${item.blocked?._id}`, { method: 'DELETE' }))}>Bỏ chặn</button></div>)}
          {!blocks.length && <p className="community-hint">Bạn chưa chặn tài khoản nào.</p>}
        </section>
      </div>

      <section className="community-card friends-card">
        <div className="community-card-heading"><div><p className="eyebrow">Bạn bè <span className="count-pill">{friends.length}</span></p><h2>Hộp thư</h2></div></div>
        <div className="messenger-layout">
          <div className="conversation-list">
            {contacts.map((friend) => {
              const conversation = conversations.find((item) => String(item.user?._id) === String(friend._id));
              return <div className={`conversation-item ${activeConversation?.user?._id === friend._id ? 'active' : ''}`} key={friend._id}><button className="conversation-avatar-button" onClick={() => openConversation(friend)} aria-label={`Mở cuộc trò chuyện với ${friend.displayName || friend.username}`}><UserAvatar src={String(user.id) === String(friend._id) ? user.avatarUrl : friend.avatarPath} name={friend.displayName || friend.username} className="comment-avatar" /></button><span className="conversation-person-label"><Link className="conversation-person-name" to={`/people/${friend._id}`}>{friend.displayName || friend.username}</Link><button className="conversation-preview" onClick={() => openConversation(friend)}>{conversation?.lastMessage?.content || `@${friend.username}`}</button></span>{conversation?.unreadCount > 0 && <span className="message-unread-badge" aria-label={`${conversation.unreadCount} tin nhắn chưa đọc`}>{conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}</span>}</div>;
            })}
            {!contacts.length && <p className="community-hint">Khi có lời mời nhắn tin hoặc kết bạn, người đó sẽ xuất hiện ở đây.</p>}
          </div>
          <div className="chat-panel">
            {activeConversation ? <>
              <div className="chat-heading"><div><p className="eyebrow">{activeConversation.status === 'pending' ? 'Lời mời nhắn tin' : 'Đang trò chuyện'}</p><strong>{activeConversation.user.displayName || activeConversation.user.username}</strong></div><div className="chat-heading-actions">{activeConversation.status === 'pending' && String(activeConversation.requestedBy) !== String(user.id) && messages.length > 0 && <button className="button button-small" onClick={acceptMessageRequest}>Chấp nhận lời nhắn</button>}<button className="text-button danger-text" onClick={blockActiveUser}>Chặn</button></div></div>
              <div className="chat-messages">{messages.map((message) => <div className={`chat-bubble ${String(message.sender?._id || message.sender) === String(user.id) ? 'mine' : ''}`} key={message._id}><p>{message.content}</p><time>{formatTimestamp(message.createdAt)}</time></div>)}{!messages.length && <p className="community-hint">Gửi lời chào đầu tiên nhé.</p>}</div>
              {activeConversation.status === 'pending' && messages.length > 0 ? <p className="message-request-hint">{String(activeConversation.requestedBy) === String(user.id) ? 'Đang chờ người nhận chấp nhận lời nhắn trước khi bạn có thể nhắn tiếp.' : 'Hãy chấp nhận lời nhắn để bắt đầu trò chuyện.'}</p> : <form className="chat-compose" onSubmit={sendMessage}><textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={5000} rows={2} placeholder="Viết tin nhắn…" required /><button className="button button-small" disabled={!messageText.trim()}>Gửi</button></form>}
            </> : <div className="chat-empty"><span aria-hidden="true">✉</span><h3>Chọn một người để nhắn tin</h3><p>Bạn có thể gửi lời nhắn đầu tiên cho người chưa kết bạn. Họ cần chấp nhận trước khi hai bên trò chuyện tiếp.</p></div>}
          </div>
        </div>
      </section>
    </div>
  </section>;
}

function EntryList({ entries, publicPage = false, displayName }) {
  return <div className="entry-list">{entries.map((entry) => <EntryRow key={entry._id} entry={entry} publicPage={publicPage} displayName={displayName} />)}</div>;
}

function EntryRow({ entry, publicPage, displayName }) {
  const { user } = useAuth();
  const authorName = entry.author?.displayName || displayName || 'Người viết';
  const authorId = entry.author?._id;
  const authorAvatar = user && String(user.id) === String(authorId) ? user.avatarUrl : entry.author?.avatarPath;
  return <article className="entry-row">
    <div className="entry-date"><span>{formatDay(entry.journalDate)}</span><small>{formatMonthYear(entry.journalDate)}</small></div>
    <div className="entry-row-body">
      <div className="entry-row-title"><h3><Link to={publicPage ? `/explore/${entry._id}` : `/entries/${entry._id}`}>{entry.title}</Link></h3>{publicPage && <span className="entry-row-mood"><UserAvatar src={authorAvatar} name={authorName} className="entry-author-avatar" /><strong>{entry.author?._id ? <Link to={`/people/${entry.author._id}`}>{authorName}</Link> : authorName}</strong>{entry.mood && <> đang cảm thấy <span aria-hidden="true">{MOOD_EMOJI[entry.mood] || '💭'}</span><strong>{capitalize(entry.mood)}</strong></>}</span>}{!publicPage && entry.mood && <span className="entry-row-mood"><span aria-hidden="true">{MOOD_EMOJI[entry.mood] || '💭'}</span><strong>{authorName}</strong> đang cảm thấy <strong>{capitalize(entry.mood)}</strong></span>}<span className={`visibility-mark ${entry.visibility}`} title={entry.visibility === 'public' ? 'Công khai' : 'Riêng tư'}>{entry.visibility === 'public' ? '◉' : '◌'}</span></div>
      {!publicPage && entry.author?._id && String(entry.author._id) !== String(user?.id) && <p className="entry-shared-by">Được chia sẻ bởi <Link to={`/people/${entry.author._id}`}>{authorName}</Link></p>}
      <p className="entry-excerpt">{entry.content}</p>
      <div className="entry-meta">
        {(entry.tags || []).map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
      </div>
      {publicPage && entry.previewComments?.length > 0 && <div className="entry-comment-previews" aria-label="Một số bình luận">
        {entry.previewComments.map((comment) => <p key={comment._id}><UserAvatar src={user && String(user.id) === String(comment.author?.id) ? user.avatarUrl : comment.author?.avatarUrl} name={comment.author?.displayName} className="preview-comment-avatar" /><strong>{comment.author?.id ? <Link to={`/people/${comment.author.id}`}>{comment.author.displayName}</Link> : comment.author?.displayName || 'Người viết'}</strong><span>{comment.content}</span></p>)}
        <Link to={`/explore/${entry._id}`} className="entry-comments-link">Xem cuộc trò chuyện</Link>
      </div>}
    </div>
    <Link className="row-open" to={publicPage ? `/explore/${entry._id}` : `/entries/${entry._id}`} aria-label={`Mở bài ${entry.title}`}>↗</Link>
  </article>;
}

function EntryDetailPage({ publicPage = false }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [comments, setComments] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [openReactionPicker, setOpenReactionPicker] = useState(null);
  const [hoveredReactionPicker, setHoveredReactionPicker] = useState(null);

  async function loadEntry() {
    setStatus('loading');
    try {
      const data = await api(publicPage ? `/api/public/entries/${id}` : `/api/entries/${id}`);
      setEntry(data.entry);
      setComments(data.comments || []);
      setStatus('ready');
      setError('');
    } catch (reason) {
      setError(reason.message);
      setStatus('error');
    }
  }

  useEffect(() => { loadEntry(); }, [id, publicPage]);

  async function submitComment(event) {
    event.preventDefault();
    setCommentError('');
    setCommenting(true);
    try {
      await api(`/api/public/entries/${id}/comments`, { method: 'POST', body: jsonBody({ content: commentText }) });
      setCommentText('');
      await loadEntry();
    } catch (reason) {
      setCommentError(reason.message);
    } finally {
      setCommenting(false);
    }
  }

  async function submitReply(event) {
    event.preventDefault();
    if (!replyTarget) return;
    setCommentError('');
    try {
      await api(`/api/public/entries/${id}/comments`, { method: 'POST', body: jsonBody({ content: replyText, parentComment: replyTarget }) });
      setReplyText('');
      setReplyTarget(null);
      await loadEntry();
    } catch (reason) { setCommentError(reason.message); }
  }

  async function toggleReaction(comment, emoji) {
    try {
      const own = comment.reactions?.find((reaction) => String(reaction.user?._id || reaction.user) === String(user?.id));
      const { comment: updated } = await api(`/api/public/entries/${id}/comments/${comment._id}/reactions`, {
        method: 'POST', body: jsonBody({ emoji: own?.emoji === emoji ? null : emoji })
      });
      setComments((current) => current.map((item) => item._id === comment._id ? updated : item));
      setOpenReactionPicker(null);
      setHoveredReactionPicker(null);
    } catch (reason) { setCommentError(reason.message); }
  }

  async function deleteComment(commentId) {
    try {
      await api(`/api/entries/${id}/comments/${commentId}`, { method: 'DELETE' });
      await loadEntry();
    } catch (reason) {
      setCommentError(reason.message);
    }
  }

  async function deleteEntry() {
    if (!window.confirm('Xóa trang viết này và toàn bộ bình luận?')) return;
    try {
      await api(`/api/entries/${id}`, { method: 'DELETE' });
      navigate('/my-diary');
    } catch (reason) {
      setError(reason.message);
    }
  }

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <div className="detail-state"><InlineError message={error} /><Link to={publicPage ? '/explore' : '/my-diary'} className="text-link">Quay lại</Link></div>;
  if (!entry) return null;

  const authorId = entry.author?._id || entry.author;
  const isOwner = Boolean(user && String(user.id) === String(authorId));
  const authorName = entry.author?.displayName || (isOwner ? user?.displayName : '') || 'Người viết';
  const backPath = publicPage ? '/explore' : '/my-diary';
  return <article className="entry-detail">
    <Link className="back-link" to={backPath}>← {publicPage ? 'Góc chia sẻ' : 'Sổ của tôi'}</Link>
    <header className="detail-header">
      <div className="detail-date"><span>{formatDay(entry.journalDate)}</span><small>{formatLongDate(entry.journalDate)}</small></div>
      <div className="detail-title-block">
        <div className="detail-labels"><span className={`privacy-pill ${entry.visibility}`}>{entry.visibility === 'public' ? 'Đang chia sẻ' : 'Chỉ mình tôi'}</span>{entry.mood && <p className="mood-byline"><UserAvatar src={isOwner ? user?.avatarUrl : entry.author?.avatarPath} name={authorName} className="mood-byline-avatar" /><strong>{publicPage && entry.author?._id ? <Link to={`/people/${entry.author._id}`}>{authorName}</Link> : authorName}</strong> đang cảm thấy <span className="mood-byline-icon" aria-hidden="true">{MOOD_EMOJI[entry.mood] || '💭'}</span><strong>{capitalize(entry.mood)}</strong></p>}</div>
        <h1>{entry.title}</h1>
        {publicPage && entry.author?.displayName && !entry.mood && <p className="byline"><UserAvatar src={entry.author.avatarPath} name={authorName} className="byline-avatar" /> Một trang của <strong><Link to={`/people/${entry.author._id}`}>{entry.author.displayName}</Link></strong></p>}
      </div>
      {isOwner && <div className="detail-actions"><Link className="button button-outline button-small" to={`/entries/${entry._id}/edit`}>Sửa bài</Link><button className="text-button danger-text" onClick={deleteEntry}>Xóa</button></div>}
    </header>
    <div className="entry-paper">
      <div className="entry-prose">{entry.content.split('\n').map((line, index) => <p key={index}>{line || '\u00a0'}</p>)}</div>
      {!!entry.tags?.length && <div className="detail-tags">{entry.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}</div>}
      {!!entry.taggedUsers?.length && <div className="detail-tags"><span className="tagged-with-label">Cùng với</span>{entry.taggedUsers.map((person) => <Link className="tagged-person-link" key={person._id || person} to={`/people/${person._id || person}`}>{person.displayName || person.username || 'Bạn bè'}</Link>)}</div>}
    </div>

    <section className="comments-section" id="comments">
      <div className="comments-heading"><div><p className="eyebrow">Cuộc trò chuyện</p><h2>Bình luận <span>{comments.length}</span></h2></div></div>
      {comments.length ? <div className="comment-list">{comments.map((comment) => {
        const commenterId = comment.author?._id || comment.author;
        const commenterName = comment.deleted ? 'Người viết' : comment.author?.displayName || 'Người viết';
        const canDelete = user && (String(user.id) === String(commenterId) || isOwner);
        const parent = comments.find((item) => item._id === String(comment.parentComment?._id || comment.parentComment));
        const depth = parent ? Math.min(4, 1 + getCommentDepth(parent, comments)) : 0;
        const ownReaction = comment.reactions?.find((reaction) => String(reaction.user?._id || reaction.user) === String(user?.id));
        const reactionCounts = REACTIONS.map((emoji) => ({ emoji, count: comment.reactions?.filter((reaction) => reaction.emoji === emoji).length || 0 })).filter((item) => item.count);
        return <article className="comment" key={comment._id}>
          <UserAvatar src={!comment.deleted ? (user && String(user.id) === String(commenterId) ? user.avatarUrl : comment.author?.avatarPath) : null} name={commenterName} className="comment-avatar" />
          <div className={`comment-main ${depth ? 'comment-reply' : ''}`} style={depth ? { marginLeft: `${Math.min(depth, 3) * 18}px` } : undefined}>
            <div className="comment-byline"><strong>{publicPage && !comment.deleted && comment.author?._id ? <Link to={`/people/${comment.author._id}`}>{commenterName}</Link> : commenterName}</strong><time>{formatTimestamp(comment.createdAt)}</time>{canDelete && !comment.deleted && <button className="text-button comment-delete" onClick={() => deleteComment(comment._id)}>Xóa</button>}</div>
            <p>{comment.content}</p>
            <div className={`comment-actions ${openReactionPicker === comment._id || hoveredReactionPicker === comment._id ? 'reactions-open' : ''}`} onMouseLeave={() => setHoveredReactionPicker(null)}>
              {publicPage && canComment(user) && !comment.deleted && <><button className="text-button" onClick={() => { setReplyTarget(replyTarget === comment._id ? null : comment._id); setReplyText(''); }}>↩ Trả lời</button><button className="text-button reaction-trigger" aria-label="Mở bảng cảm xúc" aria-expanded={openReactionPicker === comment._id || hoveredReactionPicker === comment._id} onMouseEnter={() => setHoveredReactionPicker(comment._id)} onClick={() => { setHoveredReactionPicker(null); setOpenReactionPicker((current) => current === comment._id ? null : comment._id); }}>☺ Cảm xúc</button><div className="reaction-picker" role="group" aria-label="Chọn cảm xúc">{REACTIONS.map((emoji) => <button key={emoji} aria-label={`Thả ${emoji}`} title={emoji} className={`reaction-button ${ownReaction?.emoji === emoji ? 'selected' : ''}`} onClick={() => toggleReaction(comment, emoji)}>{emoji}</button>)}</div></>}
              {!!reactionCounts.length && <div className="reaction-summary" onMouseEnter={() => setHoveredReactionPicker(comment._id)}>{reactionCounts.map((item) => <span key={item.emoji}>{item.emoji} {item.count}</span>)}</div>}
            </div>
            {replyTarget === comment._id && <form className="reply-form" onSubmit={submitReply}><textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} maxLength={1000} rows={2} placeholder={`Trả lời ${comment.author?.displayName || 'bình luận này'}…`} required /><button className="button button-small" disabled={!replyText.trim()}>Gửi trả lời</button></form>}
          </div>
        </article>;
      })}</div> : <p className="no-comments">Chưa có lời nhắn nào. Nếu bạn muốn, hãy để lại một câu.</p>}
      {commentError && <InlineError message={commentError} />}
      {publicPage && canComment(user) ? <form className="comment-form" onSubmit={submitComment}>
        <label htmlFor="comment-content">Viết một bình luận</label>
        <textarea id="comment-content" value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={1000} rows={3} placeholder="Một lời nhắn tử tế..." required />
        <div className="form-end"><span>{commentText.length}/1.000 ký tự</span><button className="button" type="submit" disabled={commenting}>{commenting ? 'Đang gửi…' : 'Gửi bình luận'}</button></div>
      </form> : publicPage && (user ? <div className="comment-login"><p>Hoàn tất hồ sơ để bình luận.</p><Link className="text-link" to="/setup-profile">Đặt biệt danh</Link></div> : <div className="comment-login"><p>Đăng nhập để để lại bình luận.</p><Link className="text-link" to="/login">Đăng nhập tài khoản</Link></div>)}
    </section>
  </article>;
}

function EntryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const draftTimer = useRef(null);
  const draftSaveQueue = useRef(Promise.resolve());
  const [form, setForm] = useState({ title: '', content: '', journalDate: localToday(), mood: '', tagsText: '', taggedUserIds: [], visibility: 'private' });
  const [friends, setFriends] = useState([]);
  const [taggedUserOptions, setTaggedUserOptions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/community/friends').then(({ friends: items }) => setFriends(items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (editing) {
      api(`/api/entries/${id}`).then(({ entry }) => {
        setForm({ title: entry.title, content: entry.content, journalDate: entry.journalDate, mood: entry.mood || '', tagsText: (entry.tags || []).map((tag) => `#${tag}`).join(', '), taggedUserIds: (entry.taggedUsers || []).map((person) => String(person._id || person)), visibility: entry.visibility });
        setTaggedUserOptions(entry.taggedUsers || []);
        setStatus('ready');
      }).catch((error) => { setSubmitError(error.message); setStatus('error'); });
      return;
    }
    api('/api/community/draft').then(({ draft }) => {
      if (draft) setForm({ title: draft.title || '', content: draft.content || '', journalDate: draft.journalDate || localToday(), mood: draft.mood || '', tagsText: (draft.tags || []).map((tag) => `#${tag}`).join(', '), taggedUserIds: (draft.taggedUsers || []).map((person) => String(person._id || person)), visibility: draft.visibility || 'private' });
      setDraftLoaded(true);
      setStatus('ready');
    }).catch(() => { setDraftLoaded(true); setStatus('ready'); setDraftStatus('Chưa thể tải bản nháp'); });
  }, [id, editing]);

  useEffect(() => {
    if (editing || !draftLoaded) return;
    draftTimer.current = setTimeout(() => {
      setDraftStatus('Đang lưu nháp…');
      const payload = { title: form.title, content: form.content, journalDate: form.journalDate, mood: form.mood || null, tags: parseTagInput(form.tagsText), taggedUsers: form.taggedUserIds, visibility: form.visibility };
      draftSaveQueue.current = draftSaveQueue.current.catch(() => {}).then(() => api('/api/community/draft', { method: 'PUT', body: jsonBody(payload) }))
        .then(() => setDraftStatus('Đã lưu nháp'))
        .catch(() => setDraftStatus('Chưa thể lưu nháp'));
    }, 700);
    return () => clearTimeout(draftTimer.current);
  }, [form, editing, draftLoaded]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function toggleTaggedFriend(friendId) {
    const current = form.taggedUserIds || [];
    update('taggedUserIds', current.includes(String(friendId)) ? current.filter((id) => id !== String(friendId)) : [...current, String(friendId)]);
  }

  async function submit(event) {
    event.preventDefault();
    clearTimeout(draftTimer.current);
    if (!editing) await draftSaveQueue.current.catch(() => {});
    setSaving(true);
    setSubmitError('');
    setErrors({});
    const payload = {
      title: form.title,
      content: form.content,
      journalDate: form.journalDate,
      mood: form.mood || null,
      tags: parseTagInput(form.tagsText),
      taggedUsers: form.taggedUserIds,
      visibility: form.visibility
    };
    try {
      const data = await api(editing ? `/api/entries/${id}` : '/api/entries', { method: editing ? 'PUT' : 'POST', body: jsonBody(payload) });
      if (!editing) await api('/api/community/draft', { method: 'DELETE' }).catch(() => {});
      navigate(`/entries/${data.entry._id}`);
    } catch (error) {
      setSubmitError(error.message);
      setErrors(error.fields || {});
    } finally {
      setSaving(false);
    }
  }

  const taggableFriends = [...friends];
  taggedUserOptions.forEach((person) => {
    const personId = String(person._id || person);
    if (!taggableFriends.some((friend) => String(friend._id) === personId)) taggableFriends.push(typeof person === 'object' ? person : { _id: personId, displayName: 'Bạn đã gắn thẻ' });
  });

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <InlineError message={submitError} />;
  return <section className="editor-page">
    <Link className="back-link" to={editing ? `/entries/${id}` : '/my-diary'}>← Quay lại</Link>
    <div className="editor-heading"><p className="eyebrow">{editing ? 'Chỉnh sửa' : 'Trang mới'}</p><h1>{editing ? 'Ghi thêm điều bạn muốn giữ.' : 'Hôm nay của bạn thế nào?'}</h1><p>Một tiêu đề, vài dòng, và những chi tiết bạn muốn nhớ.</p>{!editing && <small className="draft-status" role="status">{draftStatus || 'Bản nháp được lưu tự động trên tài khoản của bạn.'}</small>}</div>
    {submitError && <InlineError message={submitError} />}
    <form className="entry-form" onSubmit={submit}>
      <fieldset className="visibility-fieldset">
        <legend>Chế độ chia sẻ</legend>
        <div className="visibility-options">
          <label className={`visibility-option ${form.visibility === 'private' ? 'selected' : ''}`}><input type="radio" name="visibility" value="private" checked={form.visibility === 'private'} onChange={() => update('visibility', 'private')} /><span className="visibility-icon" aria-hidden="true">◌</span><span><strong>Chỉ mình tôi</strong><small>Bài viết và bình luận chỉ bạn xem được.</small></span></label>
          <label className={`visibility-option ${form.visibility === 'public' ? 'selected' : ''}`}><input type="radio" name="visibility" value="public" checked={form.visibility === 'public'} onChange={() => update('visibility', 'public')} /><span className="visibility-icon" aria-hidden="true">◎</span><span><strong>Công khai</strong><small>Mọi người có thể đọc; người đăng nhập có thể bình luận.</small></span></label>
        </div>
      </fieldset>
      <Field id="journal-date" label="Ngày nhật ký" error={errors.journalDate}><input id="journal-date" className="entry-date-input" type="date" value={form.journalDate} max={localToday()} onChange={(event) => update('journalDate', event.target.value)} required aria-invalid={Boolean(errors.journalDate)} /></Field>
      <Field id="entry-title" label="Tiêu đề" error={errors.title}><input id="entry-title" value={form.title} onChange={(event) => update('title', event.target.value)} maxLength={120} placeholder="Một điều bạn muốn nhớ" required /></Field>
      <Field id="entry-content" label="Nội dung" error={errors.content}><textarea id="entry-content" className="entry-content-input" value={form.content} onChange={(event) => update('content', event.target.value)} maxLength={10000} placeholder="Viết theo cách của bạn…" rows={12} required /></Field>
      <div className="entry-tools" role="group" aria-label="Tâm trạng và thẻ">
        <span className="entry-tools-title">Thêm vào trang viết</span>
        <div className="entry-tools-controls">
          <Field id="entry-mood" label={<><span aria-hidden="true">☻</span> Tâm trạng</>} error={errors.mood}><select id="entry-mood" value={form.mood} onChange={(event) => update('mood', event.target.value)}><option value="">Chọn tâm trạng</option>{MOODS.map((mood) => <option key={mood} value={mood}>{MOOD_EMOJI[mood]} {capitalize(mood)}</option>)}</select></Field>
          <Field id="entry-tags" label={<><span aria-hidden="true">#</span> Hashtag</>} hint="Ngăn cách bằng dấu phẩy" error={errors.tags}><input id="entry-tags" value={form.tagsText} onChange={(event) => update('tagsText', event.target.value)} placeholder="#gia đình, #một chuyến đi" /></Field>
        </div>
        <fieldset className="tagged-friends-fieldset" aria-describedby={errors.taggedUsers ? 'entry-tagged-users-error' : undefined}>
          <legend>Gắn thẻ bạn bè</legend>
          {taggableFriends.length ? <div className="tagged-friends-list">{taggableFriends.map((friend) => <label className="tagged-friend-option" key={friend._id}><input type="checkbox" checked={form.taggedUserIds.includes(String(friend._id))} onChange={() => toggleTaggedFriend(friend._id)} disabled={!form.taggedUserIds.includes(String(friend._id)) && form.taggedUserIds.length >= 20} /><UserAvatar src={friend.avatarPath} name={friend.displayName || friend.username} /><span>{friend.displayName || friend.username}</span></label>)}</div> : <span className="community-hint">Kết bạn để có thể gắn thẻ bạn bè.</span>}
          {errors.taggedUsers && <small id="entry-tagged-users-error" className="field-error">{errors.taggedUsers}</small>}
        </fieldset>
      </div>
      <div className="form-actions"><Link className="text-link" to={editing ? `/entries/${id}` : '/my-diary'}>Hủy</Link><button className="button" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu trang viết'}</button></div>
    </form>
  </section>;
}

function ProfileSetupPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/api/auth/profile', { method: 'PUT', body: jsonBody({ displayName }) });
      await refresh();
      navigate('/my-diary');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }

  return <section className="profile-setup">
    <div className="profile-icon" aria-hidden="true">✳</div>
    <p className="eyebrow">Trước khi bắt đầu</p>
    <h1>Bạn muốn được gọi là gì?</h1>
    <p>Biệt danh này sẽ xuất hiện bên cạnh những trang bạn chọn chia sẻ.</p>
    {error && <InlineError message={error} />}
    <form className="profile-form" onSubmit={submit}>
      <label htmlFor="display-name">Biệt danh</label>
      <input id="display-name" autoFocus value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required placeholder="Ví dụ: Mây" />
      <button className="button" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu biệt danh'}</button>
    </form>
  </section>;
}

function MyProfilePage() {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [message, setMessage] = useState('');

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api('/api/auth/profile', { method: 'PUT', body: jsonBody({ displayName, bio }) });
      await refresh();
      setMessage('Đã lưu hồ sơ.');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setUploading(true);
    setAvatarError('');
    setMessage('');
    try {
      await api('/api/auth/profile/avatar', { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      await refresh();
      setMessage('Đã cập nhật ảnh đại diện.');
    } catch (reason) {
      setAvatarError(reason.message);
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setUploading(true);
    setAvatarError('');
    setMessage('');
    try {
      await api('/api/auth/profile/avatar', { method: 'DELETE' });
      await refresh();
      setMessage('Đã gỡ ảnh đại diện.');
    } catch (reason) {
      setAvatarError(reason.message);
    } finally {
      setUploading(false);
    }
  }

  return <section className="profile-page">
    <Link className="back-link" to="/my-diary">← Sổ của tôi</Link>
    <div className="profile-page-heading">
      <UserAvatar src={user?.avatarUrl} name={displayName} className="profile-avatar-large" />
      <div><p className="eyebrow">Hồ sơ cá nhân</p><h1>{displayName || 'Hồ sơ của bạn'}</h1><p className="profile-username">@{user?.username}</p><p>Những thông tin này sẽ hiện trên trang Profile công khai.</p></div>
    </div>
    {(error || message) && <div className={error ? 'inline-error' : 'inline-success'} role={error ? 'alert' : 'status'}>{error || message}</div>}
    <div className="profile-edit-layout">
      <div className="profile-edit-panel">
        <div className="avatar-editor">
          <UserAvatar src={user?.avatarUrl} name={displayName} className="profile-avatar-editor" />
          <div><strong>Ảnh đại diện</strong><small>JPEG, PNG hoặc WebP, tối đa 2 MB.</small><div className="avatar-actions"><label className="button button-outline button-small" htmlFor="profile-avatar-upload">{uploading ? 'Đang xử lý…' : 'Chọn ảnh'}</label>{user?.avatarUrl && <button className="text-button danger-text" type="button" onClick={removeAvatar} disabled={uploading}>Gỡ ảnh</button>}</div></div>
          <input id="profile-avatar-upload" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={uploading} />
        </div>
        {avatarError && <small className="field-error" role="alert">{avatarError}</small>}
        <form className="profile-edit-form" onSubmit={saveProfile}>
          <label htmlFor="profile-display-name">Biệt danh</label>
          <input id="profile-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required />
          <label htmlFor="profile-bio">Giới thiệu</label>
          <textarea id="profile-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} rows={4} placeholder="Viết đôi điều về bạn…" />
          <small className="field-hint">{bio.length}/280 ký tự</small>
          <button className="button" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
        </form>
      </div>
      <aside className="profile-public-preview">
        <p className="eyebrow">Trang công khai</p>
        <div className="profile-preview-heading"><UserAvatar src={user?.avatarUrl} name={displayName} /><div><strong>{displayName || 'Biệt danh của bạn'}</strong><small className="profile-username">@{user?.username}</small></div></div>
        <p>{bio || 'Phần giới thiệu sẽ xuất hiện tại đây.'}</p>
        <Link className="text-link" to={`/people/${user?.id}`}>Xem trang công khai</Link>
      </aside>
    </div>
  </section>;
}

function PublicProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [relationship, setRelationship] = useState(null);
  const [relationshipBusy, setRelationshipBusy] = useState(false);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [relationshipError, setRelationshipError] = useState('');

  useEffect(() => {
    let active = true;
    api(`/api/profiles/${id}`)
      .then((data) => { if (active) { setProfile(data.profile); setEntries(data.entries || []); setStatus('ready'); } })
      .catch((reason) => { if (active) { setError(reason.message); setStatus('error'); } });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    setRelationship(null);
    setRelationshipError('');
    if (!user || user.needsProfileSetup || String(user.id) === String(id)) {
      if (user && String(user.id) === String(id)) setRelationship({ state: 'self' });
      return () => { active = false; };
    }
    api(`/api/community/people/${id}/relationship`)
      .then((data) => { if (active) setRelationship(data.relationship); })
      .catch((reason) => { if (active) setRelationshipError(reason.message); });
    return () => { active = false; };
  }, [id, user?.id, user?.needsProfileSetup]);

  useEffect(() => {
    if (!user || relationship?.state !== 'outgoing') return;
    const events = new EventSource(apiUrl('/api/community/events'), { withCredentials: true });
    const refreshRelationship = (event) => {
      if (JSON.parse(event.data).type !== 'friend_accepted') return;
      api(`/api/community/people/${id}/relationship`)
        .then((data) => setRelationship(data.relationship))
        .catch(() => {});
    };
    events.addEventListener('notification:new', refreshRelationship);
    return () => events.close();
  }, [id, user?.id, relationship?.state]);

  async function sendFriendRequest() {
    setRelationshipBusy(true);
    setRelationshipError('');
    try {
      await api('/api/community/requests', { method: 'POST', body: jsonBody({ userId: id }) });
      setRelationship({ state: 'outgoing' });
    } catch (reason) {
      setRelationshipError(reason.message);
    } finally {
      setRelationshipBusy(false);
    }
  }

  async function acceptFriendRequest() {
    if (!relationship?.requestId) return;
    setRelationshipBusy(true);
    setRelationshipError('');
    try {
      await api(`/api/community/requests/${relationship.requestId}/accept`, { method: 'POST' });
      setRelationship({ state: 'friends' });
    } catch (reason) {
      setRelationshipError(reason.message);
    } finally {
      setRelationshipBusy(false);
    }
  }

  function openFriendChat() {
    navigate('/community', { state: { openChatUser: { _id: profile.id, displayName: profile.displayName, username: profile.username, avatarPath: profile.avatarUrl } } });
  }

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <section className="profile-page"><InlineError message={error} /><Link className="text-link" to="/explore">Quay lại Góc chia sẻ</Link></section>;

  return <section className="public-profile-page">
    <Link className="back-link" to="/explore">← Góc chia sẻ</Link>
    <header className="public-profile-header">
      <UserAvatar src={String(user?.id) === String(profile.id) ? user?.avatarUrl : profile.avatarUrl} name={profile.displayName} className="profile-avatar-large" />
      <div className="public-profile-identity"><p className="eyebrow">Người viết</p><h1>{profile.displayName}</h1><p className="profile-username">@{profile.username}</p>{profile.bio && <p>{profile.bio}</p>}
        {relationship?.state === 'none' && <div className="profile-contact-actions"><button className="button button-small" type="button" onClick={sendFriendRequest} disabled={relationshipBusy}>{relationshipBusy ? 'Đang gửi…' : '＋ Thêm bạn'}</button><button className="button button-outline button-small" type="button" onClick={openFriendChat}>✉ Nhắn tin</button></div>}
        {relationship?.state === 'incoming' && <div className="profile-contact-actions"><button className="button button-small" type="button" onClick={acceptFriendRequest} disabled={relationshipBusy}>{relationshipBusy ? 'Đang chấp nhận…' : 'Chấp nhận lời mời'}</button><button className="button button-outline button-small" type="button" onClick={openFriendChat}>✉ Nhắn tin</button></div>}
        {relationship?.state === 'outgoing' && <div className="profile-contact-actions"><span className="relationship-status">Đã gửi lời mời kết bạn</span><button className="button button-outline button-small" type="button" onClick={openFriendChat}>✉ Nhắn tin</button></div>}
        {relationship?.state === 'friends' && <div className="profile-contact-actions"><span className="relationship-status">Đã là bạn bè</span><button className="button button-small" type="button" onClick={openFriendChat}>✉ Nhắn tin</button></div>}
        {relationship?.state === 'unavailable' && <span className="relationship-status">Không thể kết bạn</span>}
        {!user && <Link className="button button-small" to="/login" state={{ from: `/people/${profile.id}` }}>Đăng nhập để kết bạn</Link>}
        {user?.needsProfileSetup && <Link className="button button-small" to="/setup-profile">Đặt biệt danh để kết bạn</Link>}
        {relationshipError && <small className="field-error" role="alert">{relationshipError}</small>}
      </div>
    </header>
    <section className="content-section" aria-labelledby="profile-entries-heading">
      <div className="section-heading"><div><p className="eyebrow">Góc chia sẻ</p><h2 id="profile-entries-heading">Bài viết công khai</h2></div></div>
      {entries.length ? <EntryList entries={entries} publicPage /> : <EmptyState title="Chưa có bài viết công khai." body="Những trang được chia sẻ sẽ xuất hiện ở đây." />}
    </section>
  </section>;
}

function LoginPage() {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const { user, loading, login, register, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from || '/my-diary';

  if (!loading && user && !user.needsProfileSetup) return <Navigate to="/my-diary" replace />;
  if (!loading && user?.needsProfileSetup) return <Navigate to="/setup-profile" replace />;

  function switchMode(newMode) {
    setMode(newMode);
    setError('');
    setSuccess('');
    setFieldErrors({});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(username, password);
        navigate(returnTo, { replace: true });
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setFieldErrors({ confirmPassword: 'Mật khẩu xác nhận không khớp.' });
          setSubmitting(false);
          return;
        }
        await register(username, password, confirmPassword, displayName);
        navigate(returnTo, { replace: true });
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          setFieldErrors({ confirmPassword: 'Mật khẩu xác nhận không khớp.' });
          setSubmitting(false);
          return;
        }
        await resetPassword(username, password, confirmPassword);
        setSuccess('Đặt lại mật khẩu thành công!');
        navigate(returnTo, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
      if (err.fields) setFieldErrors(err.fields);
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="login-page">
    <div className="login-note">
      <span className="login-mark" aria-hidden="true">✳</span>
      <p className="eyebrow">Một khoảng riêng</p>
      <h1>Hãy để ngày hôm nay có một nơi để ở lại.</h1>
      <p>Tạo tài khoản hoặc đăng nhập để viết nhật ký. Bạn luôn là người quyết định trang nào giữ riêng hay chia sẻ.</p>
    </div>

    <div className="login-panel auth-panel">
      <p className="eyebrow">
        {mode === 'login' ? 'Chào mừng bạn' : mode === 'register' ? 'Bắt đầu sổ riêng' : 'Khôi phục tài khoản'}
      </p>
      <h2>
        {mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : 'Đặt lại mật khẩu'}
      </h2>
      <p className="auth-desc">
        {mode === 'login'
          ? 'Điền thông tin tài khoản để vào sổ nhật ký của bạn.'
          : mode === 'register'
          ? 'Tạo tài khoản để bắt đầu lưu lại những trang nhật ký riêng.'
          : 'Nhập tên tài khoản để thiết lập mật khẩu mới.'}
      </p>

      {error && <InlineError message={error} />}
      {success && <div className="inline-success">{success}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <Field id="auth-username" label="Tên đăng nhập" hint={mode === 'register' ? 'Tối thiểu 3 ký tự, không chứa dấu cách' : undefined} error={fieldErrors.username}>
          <input
            id="auth-username"
            type="text"
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ví dụ: huy, nhatky123..."
          />
        </Field>

        {mode === 'register' && (
          <Field id="auth-display-name" label="Biệt danh hiển thị" hint="Tên sẽ hiện trên bài chia sẻ (để trống sẽ lấy tên đăng nhập)" error={fieldErrors.displayName}>
            <input
              id="auth-display-name"
              type="text"
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ví dụ: Huy, Mây..."
            />
          </Field>
        )}

        <Field
          id="auth-password"
          label={mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
          hint={mode === 'register' || mode === 'reset' ? 'Tối thiểu 6 ký tự' : undefined}
          error={fieldErrors.password || fieldErrors.newPassword}
        >
          <input
            id="auth-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        {(mode === 'register' || mode === 'reset') && (
          <Field id="auth-confirm-password" label="Xác nhận mật khẩu" error={fieldErrors.confirmPassword}>
            <input
              id="auth-confirm-password"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
        )}

        <button className="button auth-submit-btn" type="submit" disabled={submitting}>
          {submitting ? 'Đang xử lý…' : (
            mode === 'login' ? 'Đăng nhập' :
            mode === 'register' ? 'Tạo tài khoản' :
            'Đặt lại mật khẩu'
          )}
        </button>
      </form>

      <div className="auth-switch-links">
        {mode === 'login' ? (
          <>
            <p>Chưa có tài khoản? <button type="button" className="text-link-btn" onClick={() => switchMode('register')}>Đăng ký ngay</button></p>
            <p><button type="button" className="text-link-btn text-muted" onClick={() => switchMode('reset')}>Quên mật khẩu?</button></p>
          </>
        ) : mode === 'register' ? (
          <p>Đã có tài khoản? <button type="button" className="text-link-btn" onClick={() => switchMode('login')}>Đăng nhập ngay</button></p>
        ) : (
          <p><button type="button" className="text-link-btn" onClick={() => switchMode('login')}>← Quay lại đăng nhập</button></p>
        )}
      </div>

      {mode === 'register' && (
        <small className="auth-note">Biệt danh bạn chọn sẽ hiển thị trên bài viết công khai.</small>
      )}
    </div>
  </section>;
}

function Field({ id, label, hint, error, children }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}{hint && <small className="field-hint">{hint}</small>}{error && <small className="field-error" role="alert">{error}</small>}</div>;
}

function parseTagInput(value) {
  return String(value || '').split(',').map((tag) => tag.trim().replace(/^#+/, '')).filter(Boolean);
}

function getActiveHashtag(value) {
  const match = String(value || '').match(/(?:^|\s)#([^\s,]*)$/u);
  return match ? match[1] : null;
}

function replaceActiveHashtag(value, tag) {
  const match = String(value || '').match(/(?:^|\s)#([^\s,]*)$/u);
  if (!match) return `#${tag}`;
  return `${value.slice(0, match.index)}${match[0].slice(0, match[0].lastIndexOf('#'))}#${tag}`;
}

function Loading() {
  return <div className="loading-state" role="status"><span className="loading-leaf" aria-hidden="true" />Đang mở trang viết…</div>;
}

function InlineError({ message }) {
  return <div className="inline-error" role="alert">{message || 'Có lỗi xảy ra. Hãy thử lại.'}</div>;
}

function EmptyState({ title, body, action }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true">✳</span><h3>{title}</h3><p>{body}</p>{action}</div>;
}

function NotFound() {
  return <div className="empty-state"><span className="eyebrow">404</span><h1>Không tìm thấy trang này.</h1><p>Có thể đường dẫn đã đổi hoặc bài viết không còn công khai.</p><Link className="text-link" to="/explore">Về góc chia sẻ</Link></div>;
}

function formatDay(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit' }).format(new Date(`${value}T12:00:00`));
}

function formatMonthYear(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function formatLongDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function formatTimestamp(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function getCommentDepth(comment, comments, seen = new Set()) {
  if (!comment?.parentComment || seen.has(String(comment._id)) || seen.size >= 5) return 0;
  seen.add(String(comment._id));
  const parentId = String(comment.parentComment?._id || comment.parentComment);
  const parent = comments.find((item) => String(item._id) === parentId);
  return parent ? 1 + getCommentDepth(parent, comments, seen) : 0;
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function capitalize(value) {
  return value.charAt(0).toLocaleUpperCase('vi-VN') + value.slice(1);
}

