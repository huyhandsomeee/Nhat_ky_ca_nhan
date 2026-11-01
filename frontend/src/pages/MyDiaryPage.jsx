import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { EntryList } from '../components/EntryList';
import { EmptyState, InlineError, Loading } from '../components/ui';
import { MOODS, MOOD_EMOJI, capitalize, localToday } from '../shared/entryUtils';
import { getAlternativeDailyPrompt, getDailyPrompt } from '../shared/dailyPrompt.mjs';
import { getSearchHashtagFragment, parseEntrySearch, replaceSearchHashtag } from '../shared/searchFilters.mjs';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function MyDiaryPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState(null);
  const [prompt, setPrompt] = useState(() => getDailyPrompt());
  const [searchText, setSearchText] = useState('');
  const [moodFilter, setMoodFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [tagInput, setTagInput] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [month, setMonth] = useState(() => localToday().slice(0, 7));
  const [calendarDays, setCalendarDays] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [status, setStatus] = useState('loading');
  const [calendarStatus, setCalendarStatus] = useState('loading');
  const [error, setError] = useState('');
  const [calendarError, setCalendarError] = useState('');

  const daysWithEntries = useMemo(() => new Map(calendarDays.map((item) => [item.date, item.count])), [calendarDays]);
  const weeklyMoodDistribution = Object.entries(stats?.weekMoodCounts || {}).sort((left, right) => right[1] - left[1]);
  const mostCommonMoodDays = weeklyMoodDistribution[0]?.[1] || 0;
  const mostCommonMoods = weeklyMoodDistribution.filter(([, count]) => count === mostCommonMoodDays).map(([mood]) => capitalize(mood));
  const hasFilters = Boolean(moodFilter || visibilityFilter || tagFilter || selectedDate);

  useEffect(() => { api('/api/entries/stats').then(setStats).catch(() => {}); }, []);

  useEffect(() => { api('/api/entries/tags/suggestions').then(({ suggestions }) => setPopularTags(suggestions || [])).catch(() => {}); }, []);

  useEffect(() => {
    const fragment = getSearchHashtagFragment(searchText);
    if (fragment === null) { setSearchSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(() => api(`/api/entries/tags/suggestions?q=${encodeURIComponent(fragment)}`)
      .then(({ suggestions }) => { if (active) setSearchSuggestions(suggestions); })
      .catch(() => { if (active) setSearchSuggestions([]); }), 120);
    return () => { active = false; clearTimeout(timer); };
  }, [searchText]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
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
  }, [moodFilter, visibilityFilter, tagFilter, selectedDate, sort]);

  async function loadMore() {
    setLoadingMore(true);
    const params = new URLSearchParams({ page: String(page + 1), limit: '20' });
    if (moodFilter) params.set('mood', moodFilter); if (visibilityFilter) params.set('visibility', visibilityFilter); if (tagFilter) params.set('tag', tagFilter); if (selectedDate) params.set('date', selectedDate); if (sort !== 'newest') params.set('sort', sort);
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
    const fragment = tagInput.trim().replace(/^#+/, '');
    if (!fragment) { setTagSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(() => api(`/api/entries/tags/suggestions?q=${encodeURIComponent(fragment)}`)
      .then(({ suggestions }) => { if (active) setTagSuggestions(suggestions); })
      .catch(() => { if (active) setTagSuggestions([]); }), 120);
    return () => { active = false; clearTimeout(timer); };
  }, [tagInput]);

  function chooseTagSuggestion(tag) {
    setTagInput(`#${tag}`);
    setTagFilter(tag);
    setTagSuggestions([]);
  }

  function applySearch(value) {
    const filters = parseEntrySearch(value);
    setSelectedDate(filters.date);
    setTagFilter(filters.tag);
    setTagInput(filters.tag ? `#${filters.tag}` : '');
    if (filters.date) setMonth(filters.date.slice(0, 7));
  }

  function submitSearch(event) {
    event.preventDefault();
    applySearch(searchText);
  }

  function chooseSearchSuggestion(tag) {
    const nextText = replaceSearchHashtag(searchText, tag);
    setSearchText(nextText);
    applySearch(nextText);
    setSearchSuggestions([]);
  }

  function clearFilters() {
    setSearchText('');
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

  return <>
    <section className="diary-heading diary-hero">
      <div className="diary-hero-copy"><p className="eyebrow">Sổ tay cá nhân</p><h1>Viết lại một ngày.</h1><p className="intro-description">Những điều nhỏ nhặt vẫn đáng có một nơi để ở lại.</p>
        {stats && <div className="diary-quick-stats"><span>▤ <strong>{stats.monthCount}</strong> trang nhật ký tháng này</span><span>✦ Tâm trạng phổ biến tháng này: <strong>{stats.popularMood || 'Chưa có'}</strong></span></div>}
      </div>
      <Link className="button" to="/entries/new"><span aria-hidden="true">✎</span> Viết trang mới</Link>
    </section>

    <section className="diary-toolbar" aria-label="Tìm và lọc nhật ký">
      <form className="search-form diary-text-search" onSubmit={submitSearch} role="search">
        <label className="sr-only" htmlFor="diary-search">Tìm theo ngày hoặc hashtag</label><span className="diary-search-icon" aria-hidden="true">⌕</span>
        <div className="search-input-wrap"><input id="diary-search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Nhập ngày YYYY-MM-DD hoặc #hashtag..." aria-controls="diary-search-suggestions" aria-expanded={searchSuggestions.length > 0} />
          {!!searchSuggestions.length && <div id="diary-search-suggestions" className="hashtag-suggestions" role="listbox" aria-label="Hashtag đang được sử dụng">{searchSuggestions.map(({ tag, uses }) => <button type="button" role="option" aria-selected="false" key={tag} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSearchSuggestion(tag)}><span>#{tag}</span><small>{uses}</small></button>)}</div>}
        </div><button className="search-button" type="submit">Tìm</button>
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

        {stats && <section className="diary-mood-panel diary-panel" aria-label="Tâm trạng tuần này">
          <div className="diary-panel-heading"><div><p className="eyebrow">Nhịp cảm xúc</p><h3>Cảm xúc tuần qua</h3></div><span className="week-range">7 ngày</span></div>
          <div className="mood-week-days">{stats.week.map((day) => <div key={day.date} title={day.mood ? `${formatDate(day.date)}: ${day.mood}` : `${formatDate(day.date)}: chưa chọn tâm trạng`}><span>{day.mood ? MOOD_EMOJI[day.mood] : '·'}</span><small>{new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))}</small></div>)}</div>
          <p className="weekly-mood-summary">Có cảm xúc trong <strong>{stats.weekMoodDays || 0}/7 ngày</strong>{mostCommonMoods.length > 0 && <> · Nổi bật: <strong>{mostCommonMoods.join(', ')}</strong></>}</p>
          {weeklyMoodDistribution.length > 0 ? <div className="weekly-mood-distribution" aria-label="Phân bố tâm trạng tuần này">{weeklyMoodDistribution.map(([mood, count]) => <div className="weekly-mood-row" key={mood}><span className="weekly-mood-label">{MOOD_EMOJI[mood]} {capitalize(mood)}</span><div className="weekly-mood-bar" role="img" aria-label={`${capitalize(mood)}: ${count} trên 7 ngày`}><span style={{ width: `${count / 7 * 100}%` }} /></div><strong>{count}</strong></div>)}</div> : <p className="weekly-mood-empty">Chưa có tâm trạng nào được ghi trong 7 ngày qua.</p>}
        </section>}

        <section className="diary-prompt-panel"><p className="eyebrow">✦ Gợi ý hôm nay</p><h3 aria-live="polite">“{prompt}”</h3><p>Gợi ý nhỏ để bạn bắt đầu viết.</p><div className="diary-prompt-actions"><button type="button" onClick={() => setPrompt((current) => getAlternativeDailyPrompt(current))}>Đổi gợi ý</button><Link to="/entries/new" state={{ prompt }}>✎ Viết từ gợi ý này</Link></div></section>
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
