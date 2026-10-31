import { useEffect, useState } from 'react';
import { api } from '../api';
import { EntryList } from '../components/EntryList';
import { EmptyState, InlineError, Loading } from '../components/ui';
import { getActiveHashtag, replaceActiveHashtag } from '../shared/entryUtils';

export default function ExplorePage() {
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
