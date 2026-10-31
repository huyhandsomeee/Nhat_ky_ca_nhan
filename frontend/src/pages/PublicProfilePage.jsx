import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { EntryList } from '../components/EntryList';
import { EmptyState, InlineError, Loading, UserAvatar } from '../components/ui';
import FollowButton from '../components/FollowButton';

export default function PublicProfilePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api(`/api/profiles/${id}`)
      .then((data) => { if (active) { setProfile(data.profile); setEntries(data.entries || []); setStatus('ready'); } })
      .catch((reason) => { if (active) { setError(reason.message); setStatus('error'); } });
    return () => { active = false; };
  }, [id]);

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <section className="profile-page"><InlineError message={error} /><Link className="text-link" to="/explore">Quay lại Góc chia sẻ</Link></section>;

  return <section className="public-profile-page">
    <Link className="back-link" to="/explore">← Góc chia sẻ</Link>
    <header className="public-profile-header">
      <UserAvatar src={profile.avatarUrl} name={profile.displayName} className="profile-avatar-large" />
      <div className="public-profile-identity"><p className="eyebrow">Người viết</p><h1>{profile.displayName}</h1><p className="profile-username">@{profile.username}</p>{profile.bio && <p>{profile.bio}</p>}<div className="public-profile-stats"><span><strong>{profile.publicEntryCount || 0}</strong> bài công khai</span><FollowButton authorId={profile.id} /></div>
      </div>
    </header>
    <section className="content-section" aria-labelledby="profile-entries-heading">
      <div className="section-heading"><div><p className="eyebrow">Góc chia sẻ</p><h2 id="profile-entries-heading">Bài viết công khai</h2></div></div>
      {entries.length ? <EntryList entries={entries} publicPage /> : <EmptyState title="Chưa có bài viết công khai." body="Những trang được chia sẻ sẽ xuất hiện ở đây." />}
    </section>
  </section>;
}
