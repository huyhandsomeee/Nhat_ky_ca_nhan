import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, jsonBody } from './api';
import { canComment } from './commentPermissions.mjs';

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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup-profile" element={<PrivateRoute><ProfileSetupPage /></PrivateRoute>} />
        <Route path="/my-diary" element={<PrivateRoute><MyDiaryPage /></PrivateRoute>} />
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
  const [logoutError, setLogoutError] = useState('');

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
      </nav>
      <div className="header-actions">
        {!loading && (user
          ? user.needsProfileSetup
            ? <Link className="button button-small" to="/setup-profile">Đặt biệt danh</Link>
            : <><span className="user-name">{user.displayName}</span><button className="text-button" onClick={handleLogout}>Đăng xuất</button></>
          : <Link className="button button-small" to="/login">Đăng nhập</Link>)}
      </div>
    </header>
    {logoutError && <div className="toast-error" role="alert">{logoutError}</div>}
  </>;
}

function ExplorePage() {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
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

  function submitSearch(event) {
    event.preventDefault();
    setQuery(search.trim());
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
          <input id="explore-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm một từ, một ngày..." />
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
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
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

  function submitSearch(event) {
    event.preventDefault();
    setQuery(search.trim());
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
          <input id="diary-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm trong nhật ký..." />
          <button className="search-button" type="submit" aria-label="Tìm kiếm">⌕</button>
        </form>
      </div>
      {status === 'loading' && <Loading />}
      {status === 'error' && <InlineError message={error} />}
      {status === 'ready' && (entries.length ? <EntryList entries={entries} /> : <EmptyState title={query ? 'Không tìm thấy trang nào.' : 'Trang đầu tiên đang chờ bạn.'} body={query ? 'Thử từ khóa khác để tìm lại.' : 'Ghi một điều còn vương lại trong ngày hôm nay.'} action={!query && <Link className="button" to="/entries/new">Bắt đầu viết</Link>} />)}
    </section>
  </>;
}

function EntryList({ entries, publicPage = false }) {
  return <div className="entry-list">{entries.map((entry) => <EntryRow key={entry._id} entry={entry} publicPage={publicPage} />)}</div>;
}

function EntryRow({ entry, publicPage }) {
  return <article className="entry-row">
    <div className="entry-date"><span>{formatDay(entry.journalDate)}</span><small>{formatMonthYear(entry.journalDate)}</small></div>
    <div className="entry-row-body">
      <div className="entry-row-title"><h3><Link to={publicPage ? `/explore/${entry._id}` : `/entries/${entry._id}`}>{entry.title}</Link></h3><span className={`visibility-mark ${entry.visibility}`} title={entry.visibility === 'public' ? 'Công khai' : 'Riêng tư'}>{entry.visibility === 'public' ? '◉' : '◌'}</span></div>
      <p className="entry-excerpt">{entry.content}</p>
      <div className="entry-meta">
        {entry.mood && <span className="mood-chip">{entry.mood}</span>}
        {(entry.tags || []).map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
        {publicPage && entry.author?.displayName && <span className="author-name">viết bởi {entry.author.displayName}</span>}
      </div>
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
  const [commentError, setCommentError] = useState('');
  const [commenting, setCommenting] = useState(false);

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
  const backPath = publicPage ? '/explore' : '/my-diary';
  return <article className="entry-detail">
    <Link className="back-link" to={backPath}>← {publicPage ? 'Góc chia sẻ' : 'Sổ của tôi'}</Link>
    <header className="detail-header">
      <div className="detail-date"><span>{formatDay(entry.journalDate)}</span><small>{formatLongDate(entry.journalDate)}</small></div>
      <div className="detail-title-block">
        <div className="detail-labels"><span className={`privacy-pill ${entry.visibility}`}>{entry.visibility === 'public' ? 'Đang chia sẻ' : 'Chỉ mình tôi'}</span>{entry.mood && <span className="mood-chip">{entry.mood}</span>}</div>
        <h1>{entry.title}</h1>
        {publicPage && entry.author?.displayName && <p className="byline">Một trang của <strong>{entry.author.displayName}</strong></p>}
      </div>
      {isOwner && <div className="detail-actions"><Link className="button button-outline button-small" to={`/entries/${entry._id}/edit`}>Sửa bài</Link><button className="text-button danger-text" onClick={deleteEntry}>Xóa</button></div>}
    </header>
    <div className="entry-paper">
      <div className="entry-prose">{entry.content.split('\n').map((line, index) => <p key={index}>{line || '\u00a0'}</p>)}</div>
      {!!entry.tags?.length && <div className="detail-tags">{entry.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}</div>}
    </div>

    <section className="comments-section" id="comments">
      <div className="comments-heading"><div><p className="eyebrow">Cuộc trò chuyện</p><h2>Bình luận <span>{comments.length}</span></h2></div></div>
      {comments.length ? <div className="comment-list">{comments.map((comment) => {
        const commenterId = comment.author?._id || comment.author;
        const canDelete = user && (String(user.id) === String(commenterId) || isOwner);
        return <article className="comment" key={comment._id}>
          <div className="comment-avatar" aria-hidden="true">{(comment.author?.displayName || '?').slice(0, 1).toUpperCase()}</div>
          <div className="comment-main"><div className="comment-byline"><strong>{comment.author?.displayName || 'Người viết'}</strong><time>{formatTimestamp(comment.createdAt)}</time>{canDelete && <button className="text-button comment-delete" onClick={() => deleteComment(comment._id)}>Xóa</button>}</div><p>{comment.content}</p></div>
        </article>;
      })}</div> : <p className="no-comments">Chưa có lời nhắn nào. Nếu bạn muốn, hãy để lại một câu.</p>}
      {commentError && <InlineError message={commentError} />}
      {canComment(user) ? <form className="comment-form" onSubmit={submitComment}>
        <label htmlFor="comment-content">Viết một bình luận</label>
        <textarea id="comment-content" value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={1000} rows={3} placeholder="Một lời nhắn tử tế..." required />
        <div className="form-end"><span>{commentText.length}/1.000 ký tự</span><button className="button" type="submit" disabled={commenting}>{commenting ? 'Đang gửi…' : 'Gửi bình luận'}</button></div>
      </form> : user ? <div className="comment-login"><p>Hoàn tất hồ sơ để bình luận.</p><Link className="text-link" to="/setup-profile">Đặt biệt danh</Link></div> : <div className="comment-login"><p>Đăng nhập để để lại bình luận.</p><Link className="text-link" to="/login">Đăng nhập tài khoản</Link></div>}
    </section>
  </article>;
}

function EntryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState({ title: '', content: '', journalDate: localToday(), mood: '', tagsText: '', visibility: 'private' });
  const [status, setStatus] = useState(editing ? 'loading' : 'ready');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    api(`/api/entries/${id}`).then(({ entry }) => {
      setForm({ title: entry.title, content: entry.content, journalDate: entry.journalDate, mood: entry.mood || '', tagsText: (entry.tags || []).join(', '), visibility: entry.visibility });
      setStatus('ready');
    }).catch((error) => { setSubmitError(error.message); setStatus('error'); });
  }, [id, editing]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setSubmitError('');
    setErrors({});
    const payload = {
      title: form.title,
      content: form.content,
      journalDate: form.journalDate,
      mood: form.mood || null,
      tags: form.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
      visibility: form.visibility
    };
    try {
      const data = await api(editing ? `/api/entries/${id}` : '/api/entries', { method: editing ? 'PUT' : 'POST', body: jsonBody(payload) });
      navigate(`/entries/${data.entry._id}`);
    } catch (error) {
      setSubmitError(error.message);
      setErrors(error.fields || {});
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <InlineError message={submitError} />;
  return <section className="editor-page">
    <Link className="back-link" to={editing ? `/entries/${id}` : '/my-diary'}>← Quay lại</Link>
    <div className="editor-heading"><p className="eyebrow">{editing ? 'Chỉnh sửa' : 'Trang mới'}</p><h1>{editing ? 'Ghi thêm điều bạn muốn giữ.' : 'Hôm nay của bạn thế nào?'}</h1><p>Một tiêu đề, vài dòng, và những chi tiết bạn muốn nhớ.</p></div>
    {submitError && <InlineError message={submitError} />}
    <form className="entry-form" onSubmit={submit}>
      <div className="form-grid">
        <Field id="journal-date" label="Ngày nhật ký" error={errors.journalDate}><input id="journal-date" type="date" value={form.journalDate} max={localToday()} onChange={(event) => update('journalDate', event.target.value)} required aria-invalid={Boolean(errors.journalDate)} /></Field>
        <Field id="entry-mood" label="Tâm trạng" error={errors.mood}><select id="entry-mood" value={form.mood} onChange={(event) => update('mood', event.target.value)}><option value="">Không chọn</option>{MOODS.map((mood) => <option key={mood} value={mood}>{capitalize(mood)}</option>)}</select></Field>
      </div>
      <Field id="entry-title" label="Tiêu đề" error={errors.title}><input id="entry-title" value={form.title} onChange={(event) => update('title', event.target.value)} maxLength={120} placeholder="Một điều bạn muốn nhớ" required /></Field>
      <Field id="entry-content" label="Nội dung" error={errors.content}><textarea id="entry-content" className="entry-content-input" value={form.content} onChange={(event) => update('content', event.target.value)} maxLength={10000} placeholder="Viết theo cách của bạn…" rows={12} required /></Field>
      <Field id="entry-tags" label="Thẻ" hint="Ngăn cách nhiều thẻ bằng dấu phẩy" error={errors.tags}><input id="entry-tags" value={form.tagsText} onChange={(event) => update('tagsText', event.target.value)} placeholder="gia đình, một chuyến đi" /></Field>
      <fieldset className="visibility-fieldset">
        <legend>Ai có thể đọc trang này?</legend>
        <label className={`visibility-option ${form.visibility === 'private' ? 'selected' : ''}`}><input type="radio" name="visibility" value="private" checked={form.visibility === 'private'} onChange={() => update('visibility', 'private')} /><span><strong>Chỉ mình tôi</strong><small>Bài viết và bình luận chỉ bạn xem được.</small></span><span className="radio-dot" /></label>
        <label className={`visibility-option ${form.visibility === 'public' ? 'selected' : ''}`}><input type="radio" name="visibility" value="public" checked={form.visibility === 'public'} onChange={() => update('visibility', 'public')} /><span><strong>Mọi người</strong><small>Bất kỳ ai cũng có thể đọc và người dùng đăng nhập có thể bình luận.</small></span><span className="radio-dot" /></label>
      </fieldset>
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
        navigate('/my-diary');
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setFieldErrors({ confirmPassword: 'Mật khẩu xác nhận không khớp.' });
          setSubmitting(false);
          return;
        }
        await register(username, password, confirmPassword, displayName);
        navigate('/my-diary');
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          setFieldErrors({ confirmPassword: 'Mật khẩu xác nhận không khớp.' });
          setSubmitting(false);
          return;
        }
        await resetPassword(username, password, confirmPassword);
        setSuccess('Đặt lại mật khẩu thành công!');
        navigate('/my-diary');
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

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function capitalize(value) {
  return value.charAt(0).toLocaleUpperCase('vi-VN') + value.slice(1);
}

