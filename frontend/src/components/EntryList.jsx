import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { MOOD_EMOJI, capitalize, formatDay, formatMonthYear } from '../shared/entryUtils';
import { UserAvatar } from './ui';

export function EntryList({ entries, publicPage = false, displayName, onSaveChange, className = '' }) {
  return <div className={`entry-list ${className}`.trim()}>{entries.map((entry) => <EntryRow key={entry._id} entry={entry} publicPage={publicPage} displayName={displayName} onSaveChange={onSaveChange} />)}</div>;
}

function EntryRow({ entry, publicPage, displayName, onSaveChange }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(Boolean(entry.likedByMe));
  const [likeCount, setLikeCount] = useState(entry.likeCount || 0);
  const [saved, setSaved] = useState(Boolean(entry.savedByMe));
  const [actionError, setActionError] = useState('');
  const authorName = entry.author?.displayName || displayName || 'Người viết';
  const authorId = entry.author?._id;
  const authorAvatar = user && String(user.id) === String(authorId) ? user.avatarUrl : entry.author?.avatarPath;
  const entryUrl = publicPage ? `/explore/${entry._id}` : `/entries/${entry._id}`;

  async function toggleLike() {
    if (!user) return;
    try {
      const data = await api(`/api/public/entries/${entry._id}/like`, { method: liked ? 'DELETE' : 'POST' });
      setLiked(data.liked);
      setLikeCount(data.likeCount);
      setActionError('');
    } catch (error) { setActionError(error.message); }
  }

  async function toggleSave() {
    if (!user) return;
    try {
      const data = await api(`/api/social/entries/${entry._id}/save`, { method: saved ? 'DELETE' : 'POST' });
      setSaved(data.saved);
      onSaveChange?.(entry._id, data.saved);
      setActionError('');
    } catch (error) { setActionError(error.message); }
  }

  if (publicPage) return <article className="entry-row public-entry-card">
    <div className="entry-date"><span>{formatDay(entry.journalDate)}</span><small>{formatMonthYear(entry.journalDate)}</small></div>
    <div className="entry-row-body public-entry-body">
      <div className="public-entry-byline">
        <UserAvatar src={authorAvatar} name={authorName} className="entry-author-avatar" />
        <strong>{authorId ? <Link to={`/people/${authorId}`}>{authorName}</Link> : authorName}</strong>
        {entry.author?.username && <span className="public-entry-username">@{entry.author.username}</span>}
        {entry.mood && <span className="public-entry-mood"><span aria-hidden="true">{MOOD_EMOJI[entry.mood] || '💭'}</span> {capitalize(entry.mood)}</span>}
        <span className="public-entry-time">Đăng lúc {new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.createdAt))}</span>
        <button type="button" className={saved ? 'entry-save-icon active' : 'entry-save-icon'} onClick={toggleSave} disabled={!user} aria-label={saved ? 'Bỏ lưu bài viết' : 'Lưu bài viết'} aria-pressed={saved} title={user ? (saved ? 'Bỏ lưu bài viết' : 'Lưu riêng tư') : 'Đăng nhập để lưu bài viết'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75h11a1 1 0 0 1 1 1v14l-6.5-3.9-6.5 3.9v-14a1 1 0 0 1 1-1Z" /></svg>
        </button>
      </div>
      <h3 className="public-entry-title"><Link to={entryUrl}>{entry.title}</Link></h3>
      <p className="entry-excerpt">{entry.content}</p>
      <div className="entry-meta">
        {(entry.tags || []).map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
      </div>
      {entry.previewComments?.length > 0 && <div className="entry-comment-previews" aria-label="Một số bình luận">
        {entry.previewComments.map((comment) => <p key={comment._id}><UserAvatar src={user && String(user.id) === String(comment.author?.id) ? user.avatarUrl : comment.author?.avatarUrl} name={comment.author?.displayName} className="preview-comment-avatar" /><strong>{comment.author?.id ? <Link to={`/people/${comment.author.id}`}>{comment.author.displayName}</Link> : comment.author?.displayName || 'Người viết'}:</strong><span>{comment.content}</span></p>)}
      </div>}
      <div className="entry-social-actions public-entry-footer">
        <button type="button" className={liked ? 'social-action active' : 'social-action'} onClick={toggleLike} disabled={!user} aria-pressed={liked} title={user ? 'Thích bài viết' : 'Đăng nhập để thích'}>♥ <span>{likeCount} đồng cảm</span></button>
        <Link to={`${entryUrl}#comments`} className="entry-comments-link">◷ <span>{entry.commentCount || 0} bình luận</span></Link>
        {actionError && <small className="social-action-error" role="alert">{actionError}</small>}
        <Link to={entryUrl} className="public-entry-read-more">Đọc trọn vẹn <span aria-hidden="true">›</span></Link>
      </div>
    </div>
  </article>;

  return <article className="entry-row">
    <div className="entry-date"><span>{formatDay(entry.journalDate)}</span><small>{formatMonthYear(entry.journalDate)}</small></div>
    <div className="entry-row-body">
      <div className="entry-row-title"><h3><Link to={entryUrl}>{entry.title}</Link></h3>{entry.mood && <span className="entry-row-mood"><span aria-hidden="true">{MOOD_EMOJI[entry.mood] || '💭'}</span><strong>{authorName}</strong> đang cảm thấy <strong>{capitalize(entry.mood)}</strong></span>}<span className={`visibility-mark ${entry.visibility}`} title={entry.visibility === 'public' ? 'Công khai' : 'Riêng tư'}>{entry.visibility === 'public' ? '◉' : '◌'}</span></div>
      {entry.author?._id && String(entry.author._id) !== String(user?.id) && <p className="entry-shared-by">Được chia sẻ bởi <Link to={`/people/${entry.author._id}`}>{authorName}</Link></p>}
      <p className="entry-excerpt">{entry.content}</p>
      <div className="entry-meta">{(entry.tags || []).map((tag) => <span className="tag" key={tag}>#{tag}</span>)}</div>
    </div>
    <Link className="row-open" to={entryUrl} aria-label={`Mở bài ${entry.title}`}>↗</Link>
  </article>;
}
