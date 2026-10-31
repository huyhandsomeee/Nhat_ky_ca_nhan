import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import FollowButton from '../components/FollowButton';
import { EntryList } from '../components/EntryList';
import { EmptyState, InlineError, Loading, UserAvatar } from '../components/ui';
import { MOODS, MOOD_EMOJI, capitalize, getActiveHashtag, replaceActiveHashtag } from '../shared/entryUtils';
import { getDailyPrompt } from '../shared/dailyPrompt';

export default function ExplorePage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [writers, setWriters] = useState([]);
  const [totalWriters, setTotalWriters] = useState(0);
  const [publicMetrics, setPublicMetrics] = useState({ totalPublic: 0, writerCount: 0 });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [mood, setMood] = useState('');
  const [tag, setTag] = useState('');
  const [author, setAuthor] = useState('');
  const [authorText, setAuthorText] = useState('');
  const [authorSuggestions, setAuthorSuggestions] = useState([]);
  const [sort, setSort] = useState('newest');
  const [feed, setFeed] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const prompt = getDailyPrompt();
  const hasFilters = Boolean(query || mood || tag || author || sort !== 'newest');

  function paramsFor(nextPage = 1) {
    const params = new URLSearchParams({ page: String(nextPage), limit: '20' });
    if (query) params.set('q', query);
    if (mood) params.set('mood', mood);
    if (tag) params.set('tag', tag);
    if (author) params.set('author', author);
    if (sort === 'oldest') params.set('sort', sort);
    if (feed === 'following') params.set('feed', 'following');
    return params;
  }

  useEffect(() => {
    api('/api/public/entries/writers').then((data) => { setWriters(data.writers || []); setTotalWriters(data.totalWriters || 0); }).catch(() => {});
    api('/api/public/entries/tags/suggestions').then(({ suggestions }) => setPopularTags(suggestions || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    api(`/api/public/entries?${paramsFor(1)}`)
      .then((data) => {
        if (!active) return;
        setEntries(data.entries);
        setHasMore(data.hasMore);
        setPublicMetrics({ totalPublic: data.totalPublic || 0, writerCount: data.writerCount || 0 });
        setPage(1);
        setStatus('ready');
        setError('');
      })
      .catch((reason) => { if (active) { setError(reason.message); setStatus('error'); } });
    return () => { active = false; };
  }, [query, mood, tag, author, sort, feed]);

  useEffect(() => {
    const fragment = getActiveHashtag(search);
    if (fragment === null) { setTagSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(() => api(`/api/public/entries/tags/suggestions?q=${encodeURIComponent(fragment)}`)
      .then(({ suggestions }) => { if (active) setTagSuggestions(suggestions); })
      .catch(() => { if (active) setTagSuggestions([]); }), 120);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);

  useEffect(() => {
    if (!authorText.trim()) { setAuthorSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(() => api(`/api/public/entries/authors?q=${encodeURIComponent(authorText.trim())}`)
      .then(({ authors }) => { if (active) setAuthorSuggestions(authors || []); })
      .catch(() => { if (active) setAuthorSuggestions([]); }), 160);
    return () => { active = false; clearTimeout(timer); };
  }, [authorText]);

  function submitSearch(event) { event.preventDefault(); setQuery(search.trim()); }
  function chooseTagSuggestion(value) {
    const replaced = replaceActiveHashtag(search, value);
    setSearch(replaced);
    setQuery(replaced.trim());
    setTagSuggestions([]);
  }
  function selectTag(value) { setTag((current) => current.toLocaleLowerCase('vi-VN') === value.toLocaleLowerCase('vi-VN') ? '' : value); }
  function clearFilters() {
    setSearch(''); setQuery(''); setMood(''); setTag(''); setAuthor(''); setAuthorText(''); setSort('newest');
  }
  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await api(`/api/public/entries?${paramsFor(page + 1)}`);
      setEntries((current) => [...current, ...data.entries]);
      setHasMore(data.hasMore);
      setPage((current) => current + 1);
    } catch (reason) { setError(reason.message); }
    finally { setLoadingMore(false); }
  }

  return <>
    <section className="page-intro explore-intro">
      <div className="intro-copy">
        <p className="eyebrow">Góc chia sẻ &amp; đồng điệu</p>
        <h1>Những ngày bình thường<br />cũng thật đáng được kể lại.</h1>
        <p className="intro-description">Đọc những trang viết mọi người đã chọn mở lòng san sẻ. Mỗi câu chuyện bắt đầu từ một ngày rất riêng, nơi từng dòng cảm xúc tìm thấy bến đỗ an yên.</p>
        <p className="explore-metrics"><span>● <strong>{publicMetrics.totalPublic}</strong> trang viết công khai</span><span>● <strong>{publicMetrics.writerCount}</strong> người đang chia sẻ</span><span>Viết lá thư dịu dàng mình muốn nhắn nhủ hôm nay.</span></p>
      </div>
      <div className="intro-art" aria-hidden="true"><div className="sun-disc" /><div className="leaf leaf-one" /><div className="leaf leaf-two" /><div className="stem" /><span className="intro-art-caption">Lắng đọng tâm tư</span></div>
    </section>

    <section className="explore-toolbar" aria-label="Tìm và lọc bài viết">
      <div className="explore-main-filters">
        <form className="search-form" onSubmit={submitSearch} role="search">
          <label className="sr-only" htmlFor="explore-search">Tìm bài viết</label>
          <span className="search-symbol" aria-hidden="true">⌕</span>
          <div className="search-input-wrap">
            <input id="explore-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nội dung, cảm xúc, tác giả hoặc #hashtag..." aria-controls="explore-tag-suggestions" aria-expanded={getActiveHashtag(search) !== null && tagSuggestions.length > 0} />
            {getActiveHashtag(search) !== null && !!tagSuggestions.length && <div id="explore-tag-suggestions" className="hashtag-suggestions" role="listbox" aria-label="Hashtag đang được sử dụng">{tagSuggestions.map(({ tag: value, uses }) => <button type="button" role="option" aria-selected="false" key={value} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseTagSuggestion(value)}><span>#{value}</span><small>{uses}</small></button>)}</div>}
          </div>
          <button className="search-button" type="submit" aria-label="Tìm kiếm">Tìm</button>
        </form>
        <label className="toolbar-select"><span className="sr-only">Lọc tâm trạng</span><select value={mood} onChange={(event) => setMood(event.target.value)}><option value="">Mọi tâm trạng</option>{MOODS.map((value) => <option key={value} value={value}>{MOOD_EMOJI[value]} {capitalize(value)}</option>)}</select></label>
        <label className="toolbar-select"><span className="sr-only">Sắp xếp bài viết</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Mới nhất trước</option><option value="oldest">Cũ nhất trước</option></select></label>
      </div>
      <div className="popular-tag-row"><span>Chủ đề gợi ý:</span>{popularTags.map(({ tag: value }) => <button type="button" key={value} className={tag === value ? 'selected' : ''} aria-pressed={tag === value} onClick={() => selectTag(value)}>#{value}</button>)}</div>
      <details className="explore-more-filters">
        <summary>Lọc theo tác giả hoặc hashtag</summary>
        <div className="explore-more-filter-fields">
          <label><span>Hashtag</span><input value={tag} onChange={(event) => setTag(event.target.value.replace(/^#+/, ''))} placeholder="#chuyennay" /></label>
          <div className="author-filter-wrap"><label htmlFor="explore-author">Tác giả</label><input id="explore-author" value={authorText} onChange={(event) => { setAuthorText(event.target.value); setAuthor(''); }} placeholder="Nhập tên tác giả" aria-controls="explore-author-suggestions" aria-expanded={authorSuggestions.length > 0} />{!!authorSuggestions.length && <div id="explore-author-suggestions" className="hashtag-suggestions" role="listbox" aria-label="Tác giả có bài công khai">{authorSuggestions.map((writer) => <button type="button" role="option" aria-selected={author === writer._id} key={writer._id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setAuthor(writer._id); setAuthorText(writer.displayName); setAuthorSuggestions([]); }}><span>{writer.displayName}</span><small>{writer.publicEntryCount} bài</small></button>)}</div>}</div>
          {hasFilters && <button type="button" className="text-button explore-clear" onClick={clearFilters}>Xóa bộ lọc</button>}
        </div>
      </details>
    </section>

    <div className="explore-layout">
      <section className="content-section explore-feed-section" aria-labelledby="explore-heading">
        <div className="explore-feed-heading">
          <div><p className="eyebrow">Trang viết vừa hé mở</p><h2 id="explore-heading">{feed === 'following' ? 'Từ người bạn theo dõi' : 'Những câu chuyện gần đây'}</h2><p>Cập nhật theo thời gian gần nhất</p></div>
          <div className="explore-feed-tabs" role="tablist" aria-label="Luồng bài viết"><button role="tab" aria-selected={feed === 'all'} className={feed === 'all' ? 'selected' : ''} onClick={() => setFeed('all')}>Tất cả</button><button role="tab" aria-selected={feed === 'following'} className={feed === 'following' ? 'selected' : ''} onClick={() => setFeed('following')} disabled={!user}>Đang theo dõi</button></div>
          <span className="result-count">{publicMetrics.totalPublic} câu chuyện</span>
        </div>
        {status === 'loading' && <Loading />}
        {status === 'error' && <InlineError message={error} />}
        {status === 'ready' && (entries.length ? <><EntryList entries={entries} publicPage />{hasMore && <div className="load-more-wrap"><button className="button button-outline" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Đang tải…' : 'Xem thêm những trang cũ hơn'}</button></div>}</> : <EmptyState title={feed === 'following' ? 'Luồng theo dõi đang yên ắng.' : hasFilters ? 'Chưa tìm thấy trang viết phù hợp.' : 'Góc này đang yên ắng.'} body={feed === 'following' ? 'Theo dõi một tác giả để thấy bài viết công khai của họ tại đây.' : 'Thử thay đổi bộ lọc hoặc quay lại sau nhé.'} action={hasFilters ? <button className="button button-outline" type="button" onClick={clearFilters}>Xóa bộ lọc</button> : undefined} />)}
      </section>
      <aside className="explore-sidebar">
        <section className="daily-prompt-card"><p className="eyebrow">✦ Gợi ý hôm nay</p><h3>“{prompt}”</h3><p>Một câu hỏi nhỏ để giúp bạn bắt đầu viết.</p>{user ? <Link to="/entries/new" state={{ prompt }}>✎ Viết chia sẻ về chủ đề này</Link> : <Link to="/login">Đăng nhập để viết</Link>}</section>
        <section className="writers-card"><div className="sidebar-heading"><div><p className="eyebrow">Cây bút đồng điệu</p><h3>Người viết nổi bật</h3></div>{totalWriters > 3 && <Link className="writers-view-all" to="/writers">Xem tất cả <span aria-hidden="true">›</span></Link>}</div>{writers.length ? <ul>{writers.slice(0, 3).map((writer) => <li key={writer._id}><Link to={`/people/${writer._id}`}><UserAvatar src={writer.avatarPath} name={writer.displayName} /><span><strong>{writer.displayName}</strong><small>{writer.publicEntryCount} bài viết công khai</small></span></Link><FollowButton authorId={writer._id} /></li>)}</ul> : <p className="muted">Những người viết sẽ xuất hiện tại đây.</p>}</section>
        <section className="privacy-note"><strong>Chia sẻ theo cách của bạn</strong><p>Chỉ những bài bạn đặt ở chế độ công khai mới xuất hiện trong Góc chia sẻ.</p><Link to="/my-diary">Mở Sổ của tôi →</Link></section>
      </aside>
    </div>
  </>;
}
