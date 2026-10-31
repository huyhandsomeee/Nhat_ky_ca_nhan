import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { EntryList } from '../components/EntryList';
import { EmptyState, InlineError, Loading } from '../components/ui';
import { getActiveHashtag, replaceActiveHashtag } from '../shared/entryUtils';

export default function MyDiaryPage() {
  const { user } = useAuth();
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
    api(`/api/entries${params.size ? `?${params}` : ''}`)
      .then((data) => { if (active) { setEntries(data.entries); setStatus('ready'); setError(''); } })
      .catch((reason) => { if (active) { setError(reason.message); setStatus('error'); } });
    return () => { active = false; };
  }, [query]);

  useEffect(() => {
    const fragment = getActiveHashtag(search);
    if (fragment === null) { setTagSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(() => api(`/api/entries/tags/suggestions?q=${encodeURIComponent(fragment)}`)
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
    <section className="diary-heading">
      <div><p className="eyebrow">Sổ riêng</p><h1>Viết lại một ngày.</h1><p className="intro-description">Những điều nhỏ nhặt vẫn đáng có một nơi để ở lại.</p></div>
      <Link className="button" to="/entries/new"><span aria-hidden="true">＋</span> Viết trang mới</Link>
    </section>
    <section className="content-section diary-content" aria-labelledby="diary-list-heading">
      <div className="section-heading">
        <div><p className="eyebrow">Những trang của bạn</p><h2 id="diary-list-heading">Gần đây</h2></div>
        <form className="search-form" onSubmit={submitSearch} role="search">
          <label className="sr-only" htmlFor="diary-search">Tìm trong nhật ký của tôi</label>
          <div className="search-input-wrap"><input id="diary-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nội dung hoặc #hashtag..." aria-controls="diary-tag-suggestions" aria-expanded={getActiveHashtag(search) !== null && tagSuggestions.length > 0} />
            {getActiveHashtag(search) !== null && !!tagSuggestions.length && <div id="diary-tag-suggestions" className="hashtag-suggestions" role="listbox" aria-label="Hashtag đang được sử dụng">{tagSuggestions.map(({ tag, uses }) => <button type="button" role="option" aria-selected="false" key={tag} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseTagSuggestion(tag)}><span>#{tag}</span><small>{uses}</small></button>)}</div>}
          </div>
          <button className="search-button" type="submit" aria-label="Tìm kiếm">⌕</button>
        </form>
      </div>
      {status === 'loading' && <Loading />}
      {status === 'error' && <InlineError message={error} />}
      {status === 'ready' && (entries.length ? <EntryList entries={entries} displayName={user?.displayName} /> : <EmptyState title={query ? 'Không tìm thấy trang nào.' : 'Trang đầu tiên đang chờ bạn.'} body={query ? 'Thử từ khóa khác để tìm lại.' : 'Ghi một điều còn vương lại trong ngày hôm nay.'} action={!query && <Link className="button" to="/entries/new">Bắt đầu viết</Link>} />)}
    </section>
  </>;
}
