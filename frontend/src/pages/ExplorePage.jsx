import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import FollowButton from '../components/FollowButton';
import { EntryList } from '../components/EntryList';
import { EmptyState, InlineError, Loading, UserAvatar } from '../components/ui';
import { MOODS, MOOD_EMOJI, capitalize } from '../shared/entryUtils';
import { getAuthorSearchTerm, getSearchHashtagFragment, parseEntrySearch, replaceSearchAuthor, replaceSearchHashtag } from '../shared/searchFilters.mjs';
import { getPageWindow, PAGE_SIZE } from '../shared/pagination.mjs';
import { getDailyPrompt } from '../shared/dailyPrompt.mjs';

export default function ExplorePage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [writers, setWriters] = useState([]);
  const [totalWriters, setTotalWriters] = useState(0);
  const [publicMetrics, setPublicMetrics] = useState({ totalPublic: 0, writerCount: 0 });
  const [searchText, setSearchText] = useState('');
  const [mood, setMood] = useState('');
  const [tag, setTag] = useState('');
  const [author, setAuthor] = useState('');
  const [authorUsername, setAuthorUsername] = useState('');
  const [authorSuggestions, setAuthorSuggestions] = useState([]);
  const [sort, setSort] = useState('newest');
  const [feed, setFeed] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalEntries, setTotalEntries] = useState(0);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const prompt = getDailyPrompt();
  const totalPages = Math.ceil(totalEntries / PAGE_SIZE);
  const hasFilters = Boolean(mood || tag || author || sort !== 'newest');

  function paramsFor(nextPage = 1) {
    const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE_SIZE) });
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
    api(`/api/public/entries?${paramsFor(page)}`)
      .then((data) => {
        if (!active) return;
        setEntries(data.entries);
        setHasMore(data.hasMore);
        setTotalEntries(data.totalEntries || 0);
        setPublicMetrics({ totalPublic: data.totalPublic || 0, writerCount: data.writerCount || 0 });
        setStatus('ready');
        setError('');
      })
      .catch((reason) => { if (active) { setError(reason.message); setStatus('error'); } });
    return () => { active = false; };
  }, [mood, tag, author, sort, feed, page]);

  useEffect(() => {
    const fragment = getSearchHashtagFragment(searchText);
    const appliedTag = parseEntrySearch(searchText).tag;
    if (fragment === null || (tag && appliedTag.toLocaleLowerCase('vi-VN') === tag.toLocaleLowerCase('vi-VN'))) { setTagSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(() => api(`/api/public/entries/tags/suggestions?q=${encodeURIComponent(fragment)}`)
      .then(({ suggestions }) => { if (active) setTagSuggestions(suggestions); })
      .catch(() => { if (active) setTagSuggestions([]); }), 120);
    return () => { active = false; clearTimeout(timer); };
  }, [searchText, tag]);

  useEffect(() => {
    if (authorUsername && searchText.includes(`@${authorUsername}`)) { setAuthorSuggestions([]); return; }
    const authorQuery = getAuthorSearchTerm(searchText);
    if (!authorQuery) { setAuthorSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(() => api(`/api/public/entries/authors?q=${encodeURIComponent(authorQuery)}`)
      .then(({ authors }) => { if (active) setAuthorSuggestions(authors || []); })
      .catch(() => { if (active) setAuthorSuggestions([]); }), 160);
    return () => { active = false; clearTimeout(timer); };
  }, [searchText, authorUsername]);

  function applySearch(value) {
    const filters = parseEntrySearch(value);
    setTag(filters.tag);
    setPage(1);
  }
  function submitSearch(event) { event.preventDefault(); applySearch(searchText); }
  function chooseTagSuggestion(value) {
    const nextText = replaceSearchHashtag(searchText, value);
    setSearchText(nextText);
    applySearch(nextText);
    setTagSuggestions([]);
  }
  function chooseAuthorSuggestion(writer) {
    const nextText = replaceSearchAuthor(searchText, writer.username);
    setSearchText(nextText);
    setAuthor(writer._id);
    setAuthorUsername(writer.username);
    setAuthorSuggestions([]);
    applySearch(nextText);
  }
  function selectTag(value) {
    const nextTag = tag.toLocaleLowerCase('vi-VN') === value.toLocaleLowerCase('vi-VN') ? '' : value;
    setTag(nextTag);
    setSearchText([nextTag ? `#${nextTag}` : '', authorUsername ? `@${authorUsername}` : ''].filter(Boolean).join(' '));
    setPage(1);
  }
  function clearFilters() {
    setSearchText(''); setMood(''); setTag(''); setAuthor(''); setAuthorUsername(''); setAuthorSuggestions([]); setSort('newest'); setPage(1);
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
        <form className="search-form explore-text-search" onSubmit={submitSearch} role="search">
          <label className="sr-only" htmlFor="explore-search">Tìm theo hashtag hoặc người dùng</label><span className="search-symbol" aria-hidden="true">⌕</span>
          <div className="search-input-wrap"><input id="explore-search" name="explore-filter-query" autoComplete="off" value={searchText} onChange={(event) => { const value = event.target.value; setSearchText(value); if (authorUsername && !value.includes(`@${authorUsername}`)) { setAuthor(''); setAuthorUsername(''); setPage(1); } }} placeholder="#hashtag hoặc tên/@username..." aria-controls="explore-search-suggestions" aria-expanded={tagSuggestions.length > 0 || authorSuggestions.length > 0} />
            {!!tagSuggestions.length && getSearchHashtagFragment(searchText) !== null && <div id="explore-search-suggestions" className="hashtag-suggestions" role="listbox" aria-label="Hashtag đang được sử dụng">{tagSuggestions.map(({ tag: value, uses }) => <button type="button" role="option" aria-selected="false" key={value} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseTagSuggestion(value)}><span>#{value}</span><small>{uses}</small></button>)}</div>}
            {!!authorSuggestions.length && getSearchHashtagFragment(searchText) === null && <div id="explore-search-suggestions" className="hashtag-suggestions" role="listbox" aria-label="Người viết có bài công khai">{authorSuggestions.map((writer) => <button type="button" role="option" aria-selected={author === writer._id} key={writer._id} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseAuthorSuggestion(writer)}><span>{writer.displayName}<small className="author-suggestion-username">@{writer.username}</small></span><small>{writer.publicEntryCount} bài</small></button>)}</div>}
          </div><button className="search-button" type="submit">Tìm</button>
        </form>
        <label className="toolbar-select"><span className="sr-only">Lọc tâm trạng</span><select value={mood} onChange={(event) => { setMood(event.target.value); setPage(1); }}><option value="">Mọi tâm trạng</option>{MOODS.map((value) => <option key={value} value={value}>{MOOD_EMOJI[value]} {capitalize(value)}</option>)}</select></label>
        <label className="toolbar-select"><span className="sr-only">Sắp xếp bài viết</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="newest">Mới nhất trước</option><option value="oldest">Cũ nhất trước</option></select></label>
        {hasFilters && <button type="button" className="text-button explore-clear" onClick={clearFilters}>Xóa bộ lọc</button>}
      </div>
      <div className="popular-tag-row"><span>Chủ đề gợi ý:</span>{popularTags.map(({ tag: value }) => <button type="button" key={value} className={tag === value ? 'selected' : ''} aria-pressed={tag === value} onClick={() => selectTag(value)}>#{value}</button>)}</div>
    </section>

    <div className="explore-layout">
      <section className="content-section explore-feed-section" aria-labelledby="explore-heading">
        <div className="explore-feed-heading">
          <div><p className="eyebrow">Trang viết vừa hé mở</p><h2 id="explore-heading">{feed === 'following' ? 'Từ người bạn theo dõi' : 'Những câu chuyện gần đây'}</h2><p>Cập nhật theo thời gian gần nhất</p></div>
          <div className="explore-feed-tabs" role="tablist" aria-label="Luồng bài viết"><button role="tab" aria-selected={feed === 'all'} className={feed === 'all' ? 'selected' : ''} onClick={() => { setFeed('all'); setPage(1); }}>Tất cả</button><button role="tab" aria-selected={feed === 'following'} className={feed === 'following' ? 'selected' : ''} onClick={() => { setFeed('following'); setPage(1); }} disabled={!user}>Đang theo dõi</button></div>
          <span className="result-count">{totalEntries} câu chuyện</span>
        </div>
        {status === 'loading' && <Loading />}
        {status === 'error' && <InlineError message={error} />}
        {status === 'ready' && (entries.length ? <><EntryList entries={entries} publicPage /><nav className="explore-pagination" aria-label="Phân trang bài viết"><button type="button" className="pagination-step" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="Trang trước">‹</button>{getPageWindow(page, totalPages).map((pageNumber) => <button type="button" key={pageNumber} className={pageNumber === page ? 'active' : ''} aria-current={pageNumber === page ? 'page' : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}<button type="button" className="pagination-step" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={!hasMore} aria-label="Trang sau">›</button></nav></> : <EmptyState title={feed === 'following' ? 'Luồng theo dõi đang yên ắng.' : hasFilters ? 'Chưa tìm thấy trang viết phù hợp.' : 'Góc này đang yên ắng.'} body={feed === 'following' ? 'Theo dõi một tác giả để thấy bài viết công khai của họ tại đây.' : 'Thử thay đổi bộ lọc hoặc quay lại sau nhé.'} action={hasFilters ? <button className="button button-outline" type="button" onClick={clearFilters}>Xóa bộ lọc</button> : undefined} />)}
      </section>
      <aside className="explore-sidebar">
        <section className="daily-prompt-card"><p className="eyebrow">✦ Gợi ý hôm nay</p><h3>“{prompt}”</h3><p>Một câu hỏi nhỏ để giúp bạn bắt đầu viết.</p>{user ? <Link to="/entries/new" state={{ prompt }}>✎ Viết chia sẻ về chủ đề này</Link> : <Link to="/login">Đăng nhập để viết</Link>}</section>
        <section className="writers-card"><div className="sidebar-heading"><div><p className="eyebrow">Cây bút đồng điệu</p><h3>Người viết nổi bật</h3></div>{totalWriters > 3 && <Link className="writers-view-all" to="/writers">Xem tất cả <span aria-hidden="true">›</span></Link>}</div>{writers.length ? <ul>{writers.slice(0, 3).map((writer) => <li key={writer._id}><Link to={`/people/${writer._id}`}><UserAvatar src={writer.avatarPath} name={writer.displayName} /><span><strong>{writer.displayName}</strong><small>{writer.publicEntryCount} bài viết công khai</small></span></Link><FollowButton authorId={writer._id} /></li>)}</ul> : <p className="muted">Những người viết sẽ xuất hiện tại đây.</p>}</section>
        <section className="privacy-note"><strong>Chia sẻ theo cách của bạn</strong><p>Chỉ những bài bạn đặt ở chế độ công khai mới xuất hiện trong Góc chia sẻ.</p><Link to="/my-diary">Mở Sổ của tôi →</Link></section>
      </aside>
    </div>
  </>;
}
