import { useEffect, useState } from 'react';
import { api } from '../api';
import { EntryList } from '../components/EntryList';
import { EmptyState, InlineError, Loading } from '../components/ui';

export default function SavedEntriesPage() {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => { api('/api/social/saved?limit=20').then((data) => { setEntries(data.entries); setHasMore(data.hasMore); setStatus('ready'); }).catch((reason) => { setError(reason.message); setStatus('error'); }); }, []);
  async function loadMore() {
    setLoadingMore(true);
    try { const data = await api(`/api/social/saved?page=${page + 1}&limit=20`); setEntries((current) => [...current, ...data.entries]); setPage((current) => current + 1); setHasMore(data.hasMore); }
    catch (reason) { setError(reason.message); } finally { setLoadingMore(false); }
  }
  return <section className="saved-page"><header className="page-intro compact-intro"><div><p className="eyebrow">Riêng bạn</p><h1>Bài viết đã lưu</h1><p className="intro-description">Những trang viết công khai bạn muốn quay lại đọc.</p></div></header><section className="content-section"><div className="section-heading"><div><p className="eyebrow">Bộ sưu tập cá nhân</p><h2>Đọc lại sau này</h2></div></div>{status === 'loading' && <Loading />}{status === 'error' && <InlineError message={error} />}{status === 'ready' && (entries.length ? <><EntryList entries={entries} publicPage onSaveChange={(id, saved) => { if (!saved) setEntries((current) => current.filter((entry) => entry._id !== id)); }} />{hasMore && <div className="load-more-wrap"><button className="button button-outline" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Đang tải…' : 'Xem thêm'}</button></div>}</> : <EmptyState title="Chưa có bài viết được lưu." body="Chọn Lưu bài ở một trang viết công khai để giữ lại ở đây." />)}</section></section>;
}
