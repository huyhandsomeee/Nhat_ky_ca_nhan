import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, jsonBody } from '../api';
import { canComment } from '../commentPermissions.mjs';
import { useAuth } from '../auth/AuthContext';
import { InlineError, Loading, UserAvatar } from '../components/ui';
import FollowButton from '../components/FollowButton';
import { MOOD_EMOJI, REACTIONS, capitalize, formatDay, formatLongDate, formatTimestamp, getCommentDepth } from '../shared/entryUtils';
import { getDailyPrompt } from '../shared/dailyPrompt';

export default function EntryDetailPage({ publicPage = false }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [authorSummary, setAuthorSummary] = useState(null);
  const [authorEntries, setAuthorEntries] = useState([]);
  const [comments, setComments] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [openReactionPicker, setOpenReactionPicker] = useState(null);
  const [hoveredReactionPicker, setHoveredReactionPicker] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState('');
  const authorId = entry?.author?._id || entry?.author;
  const dailyPrompt = getDailyPrompt();

  async function loadEntry() {
    setStatus('loading');
    try {
      const data = await api(publicPage ? `/api/public/entries/${id}` : `/api/entries/${id}`);
      setEntry(data.entry);
      setLiked(Boolean(data.entry.likedByMe)); setLikeCount(data.entry.likeCount || 0); setSaved(Boolean(data.entry.savedByMe));
      setComments(data.comments || []);
      setStatus('ready');
      setError('');
    } catch (reason) {
      setError(reason.message);
      setStatus('error');
    }
  }

  useEffect(() => { loadEntry(); }, [id, publicPage]);

  useEffect(() => {
    if (!publicPage || !authorId) return undefined;
    let active = true;
    api(`/api/profiles/${authorId}`)
      .then((data) => { if (active) { setAuthorSummary(data.profile); setAuthorEntries(data.entries || []); } })
      .catch(() => { if (active) { setAuthorSummary(null); setAuthorEntries([]); } });
    return () => { active = false; };
  }, [authorId, publicPage]);

  async function submitComment(event) {
    event.preventDefault();
    setCommentError('');
    setCommenting(true);
    try {
      await api(`/api/public/entries/${id}/comments`, { method: 'POST', body: jsonBody({ content: commentText }) });
      setCommentText('');
      await loadEntry();
    } catch (reason) {
      setCommentError(reason.message);
    } finally {
      setCommenting(false);
    }
  }

  async function submitReply(event) {
    event.preventDefault();
    if (!replyTarget) return;
    setCommentError('');
    try {
      await api(`/api/public/entries/${id}/comments`, { method: 'POST', body: jsonBody({ content: replyText, parentComment: replyTarget }) });
      setReplyText('');
      setReplyTarget(null);
      await loadEntry();
    } catch (reason) { setCommentError(reason.message); }
  }

  async function toggleReaction(comment, emoji) {
    try {
      const own = comment.reactions?.find((reaction) => String(reaction.user?._id || reaction.user) === String(user?.id));
      const { comment: updated } = await api(`/api/public/entries/${id}/comments/${comment._id}/reactions`, {
        method: 'POST', body: jsonBody({ emoji: own?.emoji === emoji ? null : emoji })
      });
      setComments((current) => current.map((item) => item._id === comment._id ? updated : item));
      setOpenReactionPicker(null);
      setHoveredReactionPicker(null);
    } catch (reason) { setCommentError(reason.message); }
  }

  async function deleteComment(commentId) {
    try {
      await api(`/api/entries/${id}/comments/${commentId}`, { method: 'DELETE' });
      await loadEntry();
    } catch (reason) {
      setCommentError(reason.message);
    }
  }

  async function deleteEntry() {
    if (!window.confirm('Xóa trang viết này và toàn bộ bình luận?')) return;
    try {
      await api(`/api/entries/${id}`, { method: 'DELETE' });
      navigate('/my-diary');
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function toggleLike() {
    try { const data = await api(`/api/public/entries/${id}/like`, { method: liked ? 'DELETE' : 'POST' }); setLiked(data.liked); setLikeCount(data.likeCount); setActionError(''); }
    catch (reason) { setActionError(reason.message); }
  }

  async function toggleSave() {
    try { const data = await api(`/api/social/entries/${id}/save`, { method: saved ? 'DELETE' : 'POST' }); setSaved(data.saved); setActionError(''); }
    catch (reason) { setActionError(reason.message); }
  }

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <div className="detail-state"><InlineError message={error} /><Link to={publicPage ? '/explore' : '/my-diary'} className="text-link">Quay lại</Link></div>;
  if (!entry) return null;

  const isOwner = Boolean(user && String(user.id) === String(authorId));
  const authorName = entry.author?.displayName || (isOwner ? user?.displayName : '') || 'Người viết';
  const backPath = publicPage ? '/explore' : '/my-diary';
  const relatedEntries = authorEntries.filter((item) => String(item._id) !== String(entry._id)).slice(0, 3);
  const detailContent = <>
    <Link className="back-link" to={backPath}>← {publicPage ? 'Góc chia sẻ' : 'Sổ của tôi'}</Link>
    <header className="detail-header">
      <div className="detail-date"><span>{formatDay(entry.journalDate)}</span><small>{formatLongDate(entry.journalDate)}</small></div>
      <div className="detail-title-block">
        <div className="detail-labels"><span className={`privacy-pill ${entry.visibility}`}>{entry.visibility === 'public' ? 'Đang chia sẻ' : 'Chỉ mình tôi'}</span>{entry.mood && (publicPage ? <span className="public-detail-mood"><span aria-hidden="true">{MOOD_EMOJI[entry.mood] || '💭'}</span> {capitalize(entry.mood)}</span> : <p className="mood-byline"><UserAvatar src={isOwner ? user?.avatarUrl : entry.author?.avatarPath} name={authorName} className="mood-byline-avatar" /><strong>{authorName}</strong> đang cảm thấy <span className="mood-byline-icon" aria-hidden="true">{MOOD_EMOJI[entry.mood] || '💭'}</span><strong>{capitalize(entry.mood)}</strong></p>)}</div>
        <h1>{entry.title}</h1>
        {!!entry.tags?.length && <div className="detail-tags">{entry.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}</div>}
        {publicPage && entry.author?.displayName && <p className="byline"><UserAvatar src={entry.author.avatarPath} name={authorName} className="byline-avatar" /> <strong><Link to={`/people/${entry.author._id}`}>{entry.author.displayName}</Link></strong>{entry.author?.username && <span>@{entry.author.username}</span>}<span>· {formatTimestamp(entry.createdAt)}</span></p>}
      </div>
      {publicPage ? <div className="public-entry-header-actions">
        <button type="button" className={saved ? 'detail-save-icon saved' : 'detail-save-icon'} onClick={toggleSave} disabled={!user} aria-pressed={saved} aria-label={saved ? 'Bỏ lưu bài viết' : 'Lưu bài viết'} title={!user ? 'Đăng nhập để lưu bài viết' : saved ? 'Bỏ lưu bài viết' : 'Lưu riêng tư'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75h11a1 1 0 0 1 1 1v14l-6.5-3.9-6.5 3.9v-14a1 1 0 0 1 1-1Z" /></svg></button>
        {isOwner && <div className="detail-actions"><Link className="button button-outline button-small" to={`/entries/${entry._id}/edit`}>Sửa bài</Link><button className="text-button danger-text" onClick={deleteEntry}>Xóa</button></div>}
      </div> : isOwner && <div className="detail-actions"><Link className="button button-outline button-small" to={`/entries/${entry._id}/edit`}>Sửa bài</Link><button className="text-button danger-text" onClick={deleteEntry}>Xóa</button></div>}
    </header>
    <div className="entry-paper">
      <div className="entry-prose">{entry.content.split('\n').map((line, index) => <p key={index}>{line || '\u00a0'}</p>)}</div>
      {publicPage && <div className="entry-social-actions detail-social-actions"><button type="button" className={liked ? 'social-action active' : 'social-action'} onClick={toggleLike} disabled={!user} aria-pressed={liked} title={!user ? 'Đăng nhập để thả tim' : undefined}>♥ {likeCount} lượt thích</button><a className="social-action" href="#comments">◷ {comments.length} bình luận</a>{actionError && <small className="social-action-error" role="alert">{actionError}</small>}</div>}
    </div>

    <section className="comments-section" id="comments">
      <div className="comments-heading"><div><p className="eyebrow">Trao đổi về bài viết</p><h2>Bình luận <span>{comments.length}</span></h2></div>{publicPage && <small>Giữ cuộc trò chuyện nhẹ nhàng và tôn trọng</small>}</div>
      {publicPage && canComment(user) ? <form className="comment-form" onSubmit={submitComment}>
        <UserAvatar src={user?.avatarUrl} name={user?.displayName || user?.username} className="comment-avatar" />
        <div className="comment-compose"><label htmlFor="comment-content">Viết một bình luận</label><textarea id="comment-content" value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={1000} rows={3} placeholder="Hãy chia sẻ điều bạn nghĩ…" required /><div className="form-end"><span>{commentText.length}/1.000 ký tự</span><button className="button button-small" type="submit" disabled={commenting || !commentText.trim()}>{commenting ? 'Đang gửi…' : 'Gửi bình luận'}</button></div></div>
      </form> : publicPage && (user ? <div className="comment-login"><p>Hoàn tất hồ sơ để bình luận.</p><Link className="text-link" to="/setup-profile">Đặt biệt danh</Link></div> : <div className="comment-login"><p>Đăng nhập để để lại bình luận.</p><Link className="text-link" to="/login">Đăng nhập tài khoản</Link></div>)}
      {commentError && <InlineError message={commentError} />}
      {comments.length ? <div className="comment-list">{comments.map((comment) => {
        const commenterId = comment.author?._id || comment.author;
        const commenterName = comment.deleted ? 'Người viết' : comment.author?.displayName || 'Người viết';
        const canDelete = user && (String(user.id) === String(commenterId) || isOwner);
        const parent = comments.find((item) => item._id === String(comment.parentComment?._id || comment.parentComment));
        const depth = parent ? Math.min(4, 1 + getCommentDepth(parent, comments)) : 0;
        const ownReaction = comment.reactions?.find((reaction) => String(reaction.user?._id || reaction.user) === String(user?.id));
        const reactionCounts = REACTIONS.map((emoji) => ({ emoji, count: comment.reactions?.filter((reaction) => reaction.emoji === emoji).length || 0 })).filter((item) => item.count);
        return <article className="comment" key={comment._id}>
          <UserAvatar src={!comment.deleted ? (user && String(user.id) === String(commenterId) ? user.avatarUrl : comment.author?.avatarPath) : null} name={commenterName} className="comment-avatar" />
          <div className={`comment-main ${depth ? 'comment-reply' : ''}`} style={depth ? { marginLeft: `${Math.min(depth, 3) * 18}px` } : undefined}>
            <div className="comment-byline"><strong>{publicPage && !comment.deleted && comment.author?._id ? <Link to={`/people/${comment.author._id}`}>{commenterName}</Link> : commenterName}</strong><time>{formatTimestamp(comment.createdAt)}</time>{canDelete && !comment.deleted && <button className="text-button comment-delete" onClick={() => deleteComment(comment._id)}>Xóa</button>}</div>
            <p>{comment.content}</p>
            <div className={`comment-actions ${openReactionPicker === comment._id || hoveredReactionPicker === comment._id ? 'reactions-open' : ''}`} onMouseLeave={() => setHoveredReactionPicker(null)}>
              {publicPage && canComment(user) && !comment.deleted && <><button className="text-button" onClick={() => { setReplyTarget(replyTarget === comment._id ? null : comment._id); setReplyText(''); }}>↩ Trả lời</button><button className="text-button reaction-trigger" aria-label="Mở bảng cảm xúc" aria-expanded={openReactionPicker === comment._id || hoveredReactionPicker === comment._id} onMouseEnter={() => setHoveredReactionPicker(comment._id)} onClick={() => { setHoveredReactionPicker(null); setOpenReactionPicker((current) => current === comment._id ? null : comment._id); }}>☺ Cảm xúc</button><div className="reaction-picker" role="group" aria-label="Chọn cảm xúc">{REACTIONS.map((emoji) => <button key={emoji} aria-label={`Thả ${emoji}`} title={emoji} className={`reaction-button ${ownReaction?.emoji === emoji ? 'selected' : ''}`} onClick={() => toggleReaction(comment, emoji)}>{emoji}</button>)}</div></>}
              {!!reactionCounts.length && <div className="reaction-summary" onMouseEnter={() => setHoveredReactionPicker(comment._id)}>{reactionCounts.map((item) => <span key={item.emoji}>{item.emoji} {item.count}</span>)}</div>}
            </div>
            {replyTarget === comment._id && <form className="reply-form" onSubmit={submitReply}><textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} maxLength={1000} rows={2} placeholder={`Trả lời ${comment.author?.displayName || 'bình luận này'}…`} required /><button className="button button-small" disabled={!replyText.trim()}>Gửi trả lời</button></form>}
          </div>
        </article>;
      })}</div> : <p className="no-comments">Chưa có lời nhắn nào. Nếu bạn muốn, hãy để lại một câu.</p>}
    </section>
  </>;

  if (!publicPage) return <article className="entry-detail private-entry-detail">{detailContent}</article>;
  return <div className="public-entry-detail-layout">
    <article className="entry-detail public-entry-detail">{detailContent}</article>
    <aside className="public-entry-detail-sidebar">
      {authorSummary && <section className="detail-sidebar-card detail-author-card">
        <UserAvatar src={authorSummary.avatarUrl} name={authorSummary.displayName} className="profile-avatar-large" />
        <div className="detail-author-identity"><strong>{authorSummary.displayName}</strong><span>@{authorSummary.username}</span></div>
        {authorSummary.bio && <p className="detail-author-bio">{authorSummary.bio}</p>}
        <div className="detail-author-stats"><span><strong>{authorSummary.publicEntryCount || 0}</strong> bài công khai</span></div>
        <FollowButton authorId={authorSummary.id} />
        <Link className="text-link" to={`/people/${authorSummary.id}`}>Trang cá nhân</Link>
      </section>}
      {relatedEntries.length > 0 && <section className="detail-sidebar-card detail-related-card"><div className="detail-sidebar-heading"><h2>Bài viết gần đây</h2><Link to={`/people/${authorId}`}>Xem hồ sơ</Link></div>{relatedEntries.map((item) => <Link className="detail-related-entry" key={item._id} to={`/explore/${item._id}`}><time>{formatLongDate(item.journalDate)}</time><strong>{item.title}</strong><span>{item.content}</span></Link>)}</section>}
      <section className="detail-prompt-card"><p className="eyebrow">✦ Gợi ý hôm nay</p><p>“{dailyPrompt}”</p>{user && <Link to="/entries/new">Viết nhật ký</Link>}</section>
    </aside>
  </div>;
}
