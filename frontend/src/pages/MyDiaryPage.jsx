import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { EntryList } from '../components/EntryList';
import { EmptyState, InlineError, Loading } from '../components/ui';
import { MOODS, MOOD_EMOJI, getActiveHashtag, localToday, replaceActiveHashtag } from '../shared/entryUtils';
import { getDailyPrompt } from '../shared/dailyPrompt';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function MyDiaryPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [moodFilter, setMoodFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [tagInput, setTagInput] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [month, setMonth] = useState(() => localToday().slice(0, 7));
  const [calendarDays, setCalendarDays] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [calendarStatus, setCalendarStatus] = useState('loading');
  const [error, setError] = useState('');
  const [calendarError, setCalendarError] = useState('');

  const daysWithEntries = useMemo(() => new Map(calendarDays.map((item) => [item.date, item.count])), [calendarDays]);
  const hasFilters = Boolean(query || moodFilter || visibilityFilter || tagFilter || selectedDate);

  useEffect(() => { api('/api/entries/stats').then(setStats).catch(() => {}); }, []);

  useEffect(() => { api('/api/entries/tags/suggestions').then(({ suggestions }) => setPopularTags(suggestions || [])).catch(() => {}); }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (moodFilter) params.set('mood', moodFilter);
    if (visibilityFilter) params.set('visibility', visibilityFilter);
    if (tagFilter) params.set('tag', tagFilter);
    if (selectedDate) params.set('date', selectedDate);
    if (sort !== 'newest') params.set('sort', sort);
    params.set('page', '1'); params.set('limit', '20');
    setStatus('loading');
    api(`/api/entries${params.size ? `?${params}` : ''}`)
      .then((data) => { if (active) { setEntries(data.entries); setHasMore(data.hasMore); setPage(1); setStatus('ready'); setError(''); } })
      .catch((reason) => { if (active) { setError(reason.message); setStatus('error'); } });
    return () => { active = false; };
  }, [query, moodFilter, visibilityFilter, tagFilter, selectedDate, sort]);

  async function loadMore() {
    setLoadingMore(true);
    const params = new URLSearchParams({ page: String(page + 1), limit: '20' });
    if (query) params.set('q', query); if (moodFilter) params.set('mood', moodFilter); if (visibilityFilter) params.set('visibility', visibilityFilter); if (tagFilter) params.set('tag', tagFilter); if (selectedDate) params.set('date', selectedDate); if (sort !== 'newest') params.set('sort', sort);
    try { const data = await api(`/api/entries?${params}`); setEntries((current) => [...current, ...data.entries]); setHasMore(data.hasMore); setPage((current) => current + 1); }
    catch (reason) { setError(reason.message); }
    finally { setLoadingMore(false); }
  }

  useEffect(() => {
    let active = true;
    setCalendarStatus('loading');
    api(`/api/entries/calendar?month=${encodeURIComponent(month)}`)
      .then(({ days }) => { if (active) { setCalendarDays(days); setCalendarStatus('ready'); setCalendarError(''); } })
      .catch((reason) => { if (active) { setCalendarError(reason.message); setCalendarStatus('error'); } });
    return () => { active = false; };
  }, [month]);

  useEffect(() => {
    const fragment = getActiveHashtag(search);
    if (fragment === null) { setSearchSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(() => api(`/api/entries/tags/suggestions?q=${encodeURIComponent(fragment)}`)
      .then(({ suggestions }) => { if (active) setSearchSuggestions(suggestions); })
      .catch(() => { if (active) setSearchSuggestions([]); }), 120);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);

  useEffect(() => {
    const fragment = tagInput.trim().replace(/^#+/, '');
    if (!fragment) { setTagSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(() => api(`/api/entries/tags/suggestions?q=${encodeURIComponent(fragment)}`)
      .then(({ suggestions }) => { if (active) setTagSuggestions(suggestions); })
      .catch(() => { if (active) setTagSuggestions([]); }), 120);
    return () => { active = false; clearTimeout(timer); };
  }, [tagInput]);

  function submitSearch(event) {
    event.preventDefault();
    setQuery(search.trim());
  }

  function chooseSearchSuggestion(tag) {
    const value = replaceActiveHashtag(search, tag);
    setSearch(value);
    setQuery(value.trim());
    setSearchSuggestions([]);
  }

  function chooseTagSuggestion(tag) {
    setTagInput(`#${tag}`);
    setTagFilter(tag);
    setTagSuggestions([]);
  }

  function clearFilters() {
    setSearch('');
    setQuery('');
    setMoodFilter('');
    setVisibilityFilter('');
    setSort('newest');
    setTagInput('');
    setTagFilter('');
    setSelectedDate('');
  }

  function changeMonth(offset) {
    setMonth((value) => moveMonth(value, offset));
    setSelectedDate('');
  }

  function showToday() {
    const today = localToday();
    setMonth(today.slice(0, 7));
    setSelectedDate(today);
  }

  function choosePopularTag(tag) {
    if (tagFilter.toLocaleLowerCase('vi-VN') === tag.toLocaleLowerCase('vi-VN')) {
      setTagInput('');
      setTagFilter('');
      return;
    }
    setTagInput(`#${tag}`);
    setTagFilter(tag);
  }

  const prompt = getDailyPrompt();

  return <>
    <section className="diary-heading diary-hero">
      <div className="diary-hero-copy"><p className="eyebrow">Sổ tay cá nhân</p><h1>Viết lại một ngày.</h1><p className="intro-description">Những điều nhỏ nhặt vẫn đáng có một nơi để ở lại.</p>
        {stats && <div className="diary-quick-stats"><span>▤ <strong>{stats.monthCount}</strong> trang nhật ký tháng này</span><span>✦ Tâm trạng phổ biến: <strong>{stats.popularMood || 'Chưa có'}</strong></span></div>}
      </div>
      <Link className="button" to="/entries/new"><span aria-hidden="true">✎</span> Viết trang mới</Link>
    </section>

    <section className="diary-toolbar" aria-label="Tìm và lọc nhật ký">
      <form className="search-form" onSubmit={submitSearch} role="search">
        <label className="sr-only" htmlFor="diary-search">Tìm trong nhật ký của tôi</label>
        <span className="diary-search-icon" aria-hidden="true">⌕</span>
        <div className="search-input-wrap"><input id="diary-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nội dung, cảm xúc hoặc #hashtag..." aria-controls="diary-tag-suggestions" aria-expanded={getActiveHashtag(search) !== null && searchSuggestions.length > 0} />
          {getActiveHashtag(search) !== null && !!searchSuggestions.length && <div id="diary-tag-suggestions" className="hashtag-suggestions" role="listbox" aria-label="Hashtag đang được sử dụng">{searchSuggestions.map(({ tag, uses }) => <button type="button" role="option" aria-selected="false" key={tag} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSearchSuggestion(tag)}><span>#{tag}</span><small>{uses}</small></button>)}</div>}
        </div>
        <button className="search-button" type="submit">Tìm</button>
      </form>
      <div className="diary-filter-controls">
        <label className="diary-filter-field"><span>Tâm trạng</span><select value={moodFilter} onChange={(event) => setMoodFilter(event.target.value)}><option value="">Tất cả tâm trạng</option>{MOODS.map((mood) => <option key={mood} value={mood}>{MOOD_EMOJI[mood]} {mood}</option>)}</select></label>
        <label className="diary-filter-field"><span>Hiển thị</span><select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)}><option value="">Tất cả bài viết</option><option value="private">Chỉ mình tôi</option><option value="public">Đang chia sẻ</option></select></label>
        <label className="diary-filter-field"><span>Sắp xếp</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Mới nhất trước</option><option value="oldest">Cũ nhất trước</option></select></label>
        <div className="diary-filter-field hashtag-filter"><label htmlFor="diary-hashtag-filter">Hashtag</label><div className="hashtag-filter-wrap"><input id="diary-hashtag-filter" value={tagInput} onChange={(event) => { const value = event.target.value; setTagInput(value); setTagFilter(value.trim().replace(/^#+/, '')); }} placeholder="#tâm trạng" aria-controls="filter-tag-suggestions" aria-expanded={tagSuggestions.length > 0} />
          {!!tagSuggestions.length && <div id="filter-tag-suggestions" className="hashtag-suggestions" role="listbox" aria-label="Chọn hashtag">{tagSuggestions.map(({ tag, uses }) => <button type="button" role="option" aria-selected={tagFilter.toLocaleLowerCase('vi-VN') === tag.toLocaleLowerCase('vi-VN')} key={tag} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseTagSuggestion(tag)}><span>#{tag}</span><small>{uses}</small></button>)}</div>}
        </div></div>
        {hasFilters && <button className="text-button diary-clear-filters" type="button" onClick={clearFilters}>Xóa bộ lọc</button>}
      </div>
      <div className="diary-tag-suggestions"><span>Từ khóa gợi ý:</span>{popularTags.map(({ tag }) => <button type="button" key={tag} aria-pressed={tagFilter === tag} className={tagFilter === tag ? 'selected' : ''} onClick={() => choosePopularTag(tag)}>#{tag}</button>)}</div>
    </section>

    <div className="diary-dashboard">
      <aside className="diary-sidebar">
        <section className="diary-calendar diary-panel" aria-label="Lịch nhật ký">
          <div className="diary-calendar-heading"><div><p className="eyebrow">Thời gian</p><h3>{formatCalendarMonth(month)}</h3></div><div className="calendar-navigation"><button type="button" onClick={() => changeMonth(-1)} aria-label="Tháng trước">‹</button><button type="button" onClick={() => changeMonth(1)} disabled={month >= localToday().slice(0, 7)} aria-label="Tháng sau">›</button></div></div>
          <button className="calendar-today-button" type="button" onClick={showToday}>Hôm nay</button>
          {calendarStatus === 'loading' && <p className="calendar-message" role="status">Đang mở lịch…</p>}
          {calendarStatus === 'error' && <InlineError message={calendarError} />}
          {calendarStatus === 'ready' && <CalendarGrid month={month} selectedDate={selectedDate} today={localToday()} daysWithEntries={daysWithEntries} onSelectDate={(date) => setSelectedDate((current) => current === date ? '' : date)} />}
          <p className="calendar-legend"><span aria-hidden="true" /> Có trang nhật ký{selectedDate && <button type="button" onClick={() => setSelectedDate('')}>Bỏ chọn ngày</button>}</p>
        </section>

        {stats && <section className="diary-mood-panel diary-panel" aria-label="Tâm trạng và streak tuần này">
          <div className="diary-panel-heading"><div><p className="eyebrow">Nhịp cảm xúc</p><h3>Cảm xúc tuần qua</h3></div><span className="week-range">7 ngày</span></div>
          <div className="mood-week-days">{stats.week.map((day) => <div key={day.date} title={day.mood ? `${formatDate(day.date)}: ${day.mood}` : `${formatDate(day.date)}: chưa chọn tâm trạng`}><span>{day.mood ? MOOD_EMOJI[day.mood] : '·'}</span><small>{new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))}</small></div>)}</div>
          <p className="popular-mood-line">Tâm trạng phổ biến: <strong>{stats.popularMood || 'Chưa có'}</strong></p>
          <div className="diary-streak-line"><span>🔥 <strong>{stats.currentStreak}</strong> ngày liên tiếp</span><span>🏅 Kỷ lục <strong>{stats.longestStreak}</strong> ngày</span></div>
        </section>}

        <section className="diary-prompt-panel"><p className="eyebrow">✦ Gợi ý hôm nay</p><h3>“{prompt}”</h3><p>Gợi ý nhỏ để bạn bắt đầu viết.</p><Link to="/entries/new" state={{ prompt }}>✎ Viết từ gợi ý này</Link></section>
      </aside>

      <section className="diary-feed" aria-labelledby="diary-list-heading">
        <div className="diary-feed-heading"><div><p className="eyebrow">Những trang gần đây</p><h2 id="diary-list-heading">Nhật ký của bạn</h2><p>{selectedDate ? `Đang xem ngày ${formatDate(selectedDate)}` : 'Danh sách các bài viết theo thời gian.'}</p></div><span className="diary-count-pill">{stats?.totalCount ?? entries.length} bài đã ghi</span></div>
        {status === 'loading' && <Loading />}
        {status === 'error' && <InlineError message={error} />}
        {status === 'ready' && entries.length > 0 && <EntryList entries={entries} displayName={user?.displayName} className="diary-entry-list" />}
        {status === 'ready' && entries.length > 0 && hasMore && <div className="load-more-wrap"><button type="button" className="button button-outline" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Đang tải…' : 'Xem thêm những trang cũ hơn'}</button></div>}
        {status === 'ready' && entries.length === 0 && <div className="diary-empty-state">
          <EmptyState title={hasFilters ? 'Không tìm thấy bài viết phù hợp.' : 'Trang đầu tiên đang chờ bạn.'} body={hasFilters ? 'Thử thay đổi điều kiện lọc hoặc xóa bộ lọc để xem các bài khác.' : 'Ghi một điều còn vương lại trong ngày hôm nay.'} />
          {hasFilters ? <button className="button button-outline" type="button" onClick={clearFilters}>Xóa bộ lọc</button> : <Link className="button" to="/entries/new">Bắt đầu viết</Link>}
        </div>}      </section>
    </div>
  </>;
}

function CalendarGrid({ month, selectedDate, today, daysWithEntries, onSelectDate }) {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstWeekday = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];

  return <div className="calendar-grid" role="grid" aria-label={formatCalendarMonth(month)}>
    {WEEKDAYS.map((day) => <span className="calendar-weekday" role="columnheader" key={day}>{day}</span>)}
    {cells.map((day, index) => {
      if (day === null) return <span className="calendar-day calendar-day-empty" role="gridcell" aria-hidden="true" key={`empty-${index}`} />;
      const date = `${month}-${String(day).padStart(2, '0')}`;
      const count = daysWithEntries.get(date) || 0;
      const classes = ['calendar-day', date === today && 'today', date === selectedDate && 'selected', count > 0 && 'has-entries'].filter(Boolean).join(' ');
      return <button type="button" role="gridcell" aria-pressed={date === selectedDate} aria-label={`${formatDate(date)}${count ? `, ${count} bài nhật ký` : ', chưa có bài nhật ký'}`} className={classes} disabled={date > today} onClick={() => onSelectDate(date)} key={date}>{day}{count > 0 && <span className="calendar-entry-dot" aria-hidden="true" />}</button>;
    })}
  </div>;
}

function moveMonth(value, offset) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatCalendarMonth(value) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}
