import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiUrl, jsonBody } from '../api';
import { useAuth } from '../auth/AuthContext';
import { EntryList } from '../components/EntryList';
import { EmptyState, InlineError, Loading, UserAvatar } from '../components/ui';

export default function PublicProfilePage() {
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
