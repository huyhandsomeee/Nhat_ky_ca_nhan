import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';

export default function FollowButton({ authorId }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user || !authorId || String(user.id) === String(authorId)) return;
    let active = true;
    api(`/api/social/authors/${authorId}`).then((data) => { if (active) { setFollowing(data.following); setCount(data.followerCount); } }).catch(() => {});
    return () => { active = false; };
  }, [authorId, user?.id]);
  async function toggle() {
    if (!user) return;
    setBusy(true);
    try { const data = await api(`/api/social/authors/${authorId}/follow`, { method: following ? 'DELETE' : 'POST' }); setFollowing(data.following); setCount(data.followerCount); }
    catch {} finally { setBusy(false); }
  }
  if (user && String(user.id) === String(authorId)) return null;
  return <button className={`follow-button ${following ? 'following' : ''}`} type="button" onClick={toggle} disabled={!user || busy} title={!user ? 'Đăng nhập để theo dõi' : undefined}>{following ? 'Đang theo dõi' : 'Theo dõi'}{count !== null && <small>{count}</small>}</button>;
}
