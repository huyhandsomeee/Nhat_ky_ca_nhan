import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { formatDay, formatMonthYear } from '../shared/entryUtils';
import { UserAvatar } from './ui';

export function EntryList({ entries, publicPage = false, displayName }) {
  return <div className="entry-list">{entries.map((entry) => <EntryRow key={entry._id} entry={entry} publicPage={publicPage} displayName={displayName} />)}</div>;
}

export function EntryRow({ entry, publicPage, displayName }) {
  const { user } = useAuth();
  const authorName = entry.author?.displayName || displayName || 'Người viết';
  const authorId = entry.author?._id;
  const authorAvatar = user && String(user.id) === String(authorId) ? user.avatarUrl : entry.author?.avatarPath;
  return <article className="entry-row">
    <div className="entry-date"><span>{formatDay(entry.journalDate)}</span><small>{formatMonthYear(entry.journalDate)}</small></div>
    <div className="entry-row-body">
      <div className="entry-row-title"><h3><Link to={publicPage ? `/explore/${entry._id}` : `/entries/${entry._id}`}>{entry.title}</Link></h3>{publicPage && <span className="entry-row-mood"><UserAvatar src={authorAvatar} name={authorName} className="entry-author-avatar" /><strong>{entry.author?._id ? <Link to={`/people/${entry.author._id}`}>{authorName}</Link> : authorName}</strong>{entry.mood && <> đang cảm thấy <span aria-hidden="true">{MOOD_EMOJI[entry.mood] || '💭'}</span><strong>{capitalize(entry.mood)}</strong></>}</span>}{!publicPage && entry.mood && <span className="entry-row-mood"><span aria-hidden="true">{MOOD_EMOJI[entry.mood] || '💭'}</span><strong>{authorName}</strong> đang cảm thấy <strong>{capitalize(entry.mood)}</strong></span>}<span className={`visibility-mark ${entry.visibility}`} title={entry.visibility === 'public' ? 'Công khai' : 'Riêng tư'}>{entry.visibility === 'public' ? '◉' : '◌'}</span></div>
      {!publicPage && entry.author?._id && String(entry.author._id) !== String(user?.id) && <p className="entry-shared-by">Được chia sẻ bởi <Link to={`/people/${entry.author._id}`}>{authorName}</Link></p>}
      <p className="entry-excerpt">{entry.content}</p>
      <div className="entry-meta">
        {(entry.tags || []).map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
      </div>
      {publicPage && entry.previewComments?.length > 0 && <div className="entry-comment-previews" aria-label="Một số bình luận">
        {entry.previewComments.map((comment) => <p key={comment._id}><UserAvatar src={user && String(user.id) === String(comment.author?.id) ? user.avatarUrl : comment.author?.avatarUrl} name={comment.author?.displayName} className="preview-comment-avatar" /><strong>{comment.author?.id ? <Link to={`/people/${comment.author.id}`}>{comment.author.displayName}</Link> : comment.author?.displayName || 'Người viết'}</strong><span>{comment.content}</span></p>)}
        <Link to={`/explore/${entry._id}`} className="entry-comments-link">Xem cuộc trò chuyện</Link>
      </div>}
    </div>
    <Link className="row-open" to={publicPage ? `/explore/${entry._id}` : `/entries/${entry._id}`} aria-label={`Mở bài ${entry.title}`}>↗</Link>
  </article>;
}
