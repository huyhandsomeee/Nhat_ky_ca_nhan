import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import FollowButton from '../components/FollowButton';
import { EmptyState, InlineError, Loading, UserAvatar } from '../components/ui';

export default function WritersPage() {
  const [writers, setWriters] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api('/api/public/entries/writers?all=true')
      .then((data) => { if (active) { setWriters(data.writers || []); setStatus('ready'); } })
      .catch((reason) => { if (active) { setError(reason.message); setStatus('error'); } });
    return () => { active = false; };
  }, []);

  const visibleWriters = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    return writers.filter((writer) => `${writer.displayName} ${writer.username || ''}`.toLocaleLowerCase('vi-VN').includes(normalized));
  }, [writers, query]);

  return <section className="writers-directory">
    <Link className="back-link" to="/explore">← Góc chia sẻ</Link>
    <header className="writers-directory-heading">
      <div><p className="eyebrow">Góc chia sẻ</p><h1>Cây bút đồng điệu</h1><p>Danh sách những người đã đăng bài viết công khai, xếp theo số bài nhiều nhất.</p></div>
      <span className="writers-directory-count">{writers.length} cây bút</span>
    </header>
    <label className="writers-directory-search"><span aria-hidden="true">⌕</span><span className="sr-only">Tìm cây bút</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc tên người dùng" /></label>
    {status === 'loading' && <Loading />}
    {status === 'error' && <InlineError message={error} />}
    {status === 'ready' && (visibleWriters.length ? <div className="writers-directory-list">{visibleWriters.map((writer, index) => <article className="writer-directory-card" key={writer._id}>
      <span className="writer-directory-rank">{index + 1}</span>
      <Link className="writer-directory-profile" to={`/people/${writer._id}`}><UserAvatar src={writer.avatarPath} name={writer.displayName} /><span><strong>{writer.displayName}</strong>{writer.username && <small>@{writer.username}</small>}<small className="writer-directory-view-posts">Xem bài viết ›</small></span></Link>
      <span className="writer-directory-post-count"><strong>{writer.publicEntryCount}</strong> bài công khai</span>
      <FollowButton authorId={writer._id} />
    </article>)}</div> : <EmptyState title={query ? 'Không tìm thấy cây bút phù hợp.' : 'Chưa có người viết công khai.'} body={query ? 'Thử tìm bằng tên khác nhé.' : 'Những người có bài viết công khai sẽ xuất hiện tại đây.'} />)}
  </section>;
}
