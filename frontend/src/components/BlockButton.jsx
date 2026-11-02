import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';

export default function BlockButton({ authorId }) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !authorId || String(user.id) === String(authorId)) return;
    let active = true;
    api(`/api/social/authors/${authorId}/block`)
      .then((data) => { if (active) setBlocked(data.blocked); })
      .catch(() => {});
    return () => { active = false; };
  }, [authorId, user?.id]);

  async function toggle() {
    if (!user || busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await api(`/api/social/authors/${authorId}/block`, { method: blocked ? 'DELETE' : 'POST' });
      setBlocked(data.blocked);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  if (user && String(user.id) === String(authorId)) return null;
  return <span className="block-control">
    <button className={`block-button ${blocked ? 'blocked' : ''}`} type="button" onClick={toggle} disabled={!user || busy} title={!user ? 'Đăng nhập để chặn người viết này' : undefined}>
      {blocked ? 'Bỏ chặn' : 'Chặn'}
    </button>
    {error && <small className="block-error" role="alert">{error}</small>}
  </span>;
}
