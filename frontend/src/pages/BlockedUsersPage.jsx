import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, InlineError, Loading, UserAvatar } from '../components/ui';

export default function BlockedUsersPage() {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let active = true;
    api('/api/social/blocks')
      .then((data) => { if (active) { setUsers(data.users || []); setStatus('ready'); } })
      .catch((reason) => { if (active) { setError(reason.message); setStatus('error'); } });
    return () => { active = false; };
  }, []);

  async function unblock(userId) {
    setBusyId(userId);
    setError('');
    try {
      await api(`/api/social/authors/${userId}/block`, { method: 'DELETE' });
      setUsers((current) => current.filter((user) => user.id !== userId));
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusyId('');
    }
  }

  return <section className="blocked-users-page">
    <Link className="back-link" to="/profile">← Hồ sơ cá nhân</Link>
    <header className="page-intro compact-intro">
      <div><p className="eyebrow">Quyền riêng tư</p><h1>Danh sách đã chặn</h1><p className="intro-description">Những người trong danh sách này sẽ không thấy bài viết hoặc bình luận của bạn, và nội dung của họ cũng được ẩn với bạn.</p></div>
    </header>
    {error && status !== 'error' && <InlineError message={error} />}
    {status === 'loading' && <Loading />}
    {status === 'error' && <InlineError message={error} />}
    {status === 'ready' && (users.length ? <ul className="blocked-users-list">{users.map((user) => <li className="blocked-user-row" key={user.id}>
      <Link to={`/people/${user.id}`} className="blocked-user-identity"><UserAvatar src={user.avatarPath} name={user.displayName} /><span><strong>{user.displayName}</strong><small>@{user.username}</small></span></Link>
      <button className="button button-outline button-small" type="button" onClick={() => unblock(user.id)} disabled={busyId === user.id}>{busyId === user.id ? 'Đang bỏ chặn…' : 'Bỏ chặn'}</button>
    </li>)}</ul> : <EmptyState title="Chưa chặn ai cả." body="Khi chặn một người viết, họ sẽ xuất hiện tại đây." />)}
  </section>;
}
