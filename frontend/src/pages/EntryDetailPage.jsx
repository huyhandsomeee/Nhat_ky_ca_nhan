import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, jsonBody } from '../api';
import { canComment } from '../commentPermissions.mjs';
import { useAuth } from '../auth/AuthContext';
import { InlineError, Loading, UserAvatar } from '../components/ui';
import { MOOD_EMOJI, REACTIONS, capitalize, formatDay, formatLongDate, formatTimestamp, getCommentDepth } from '../shared/entryUtils';

export default function EntryDetailPage({ publicPage = false }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
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

  async function loadEntry() {
    setStatus('loading');
    try {
      const data = await api(publicPage ? `/api/public/entries/${id}` : `/api/entries/${id}`);
      setEntry(data.entry);
      setComments(data.comments || []);
      setStatus('ready');
      setError('');
    } catch (reason) {
      setError(reason.message);
      setStatus('error');
    }
  }

  useEffect(() => { loadEntry(); }, [id, publicPage]);

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

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <div className="detail-state"><InlineError message={error} /><Link to={publicPage ? '/explore' : '/my-diary'} className="text-link">Quay lại</Link></div>;
  if (!entry) return null;

  const authorId = entry.author?._id || entry.author;
  const isOwner = Boolean(user && String(user.id) === String(authorId));
  const authorName = entry.author?.displayName || (isOwner ? user?.displayName : '') || 'Người viết';
  const backPath = publicPage ? '/explore' : '/my-diary';
  return <article className="entry-detail">
    <Link className="back-link" to={backPath}>← {publicPage ? 'Góc chia sẻ' : 'Sổ của tôi'}</Link>
    <header className="detail-header">
      <div className="detail-date"><span>{formatDay(entry.journalDate)}</span><small>{formatLongDate(entry.journalDate)}</small></div>
      <div className="detail-title-block">
        <div className="detail-labels"><span className={`privacy-pill ${entry.visibility}`}>{entry.visibility === 'public' ? 'Đang chia sẻ' : 'Chỉ mình tôi'}</span>{entry.mood && <p className="mood-byline"><UserAvatar src={isOwner ? user?.avatarUrl : entry.author?.avatarPath} name={authorName} className="mood-byline-avatar" /><strong>{publicPage && entry.author?._id ? <Link to={`/people/${entry.author._id}`}>{authorName}</Link> : authorName}</strong> đang cảm thấy <span className="mood-byline-icon" aria-hidden="true">{MOOD_EMOJI[entry.mood] || '💭'}</span><strong>{capitalize(entry.mood)}</strong></p>}</div>
        <h1>{entry.title}</h1>
        {publicPage && entry.author?.displayName && !entry.mood && <p className="byline"><UserAvatar src={entry.author.avatarPath} name={authorName} className="byline-avatar" /> Một trang của <strong><Link to={`/people/${entry.author._id}`}>{entry.author.displayName}</Link></strong></p>}
      </div>
      {isOwner && <div className="detail-actions"><Link className="button button-outline button-small" to={`/entries/${entry._id}/edit`}>Sửa bài</Link><button className="text-button danger-text" onClick={deleteEntry}>Xóa</button></div>}
    </header>
    <div className="entry-paper">
      <div className="entry-prose">{entry.content.split('\n').map((line, index) => <p key={index}>{line || '\u00a0'}</p>)}</div>
      {!!entry.tags?.length && <div className="detail-tags">{entry.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}</div>}
      {!!entry.taggedUsers?.length && <div className="detail-tags"><span className="tagged-with-label">Cùng với</span>{entry.taggedUsers.map((person) => <Link className="tagged-person-link" key={person._id || person} to={`/people/${person._id || person}`}>{person.displayName || person.username || 'Bạn bè'}</Link>)}</div>}
    </div>

    <section className="comments-section" id="comments">
      <div className="comments-heading"><div><p className="eyebrow">Cuộc trò chuyện</p><h2>Bình luận <span>{comments.length}</span></h2></div></div>
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
      {commentError && <InlineError message={commentError} />}
      {publicPage && canComment(user) ? <form className="comment-form" onSubmit={submitComment}>
        <label htmlFor="comment-content">Viết một bình luận</label>
        <textarea id="comment-content" value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={1000} rows={3} placeholder="Một lời nhắn tử tế..." required />
        <div className="form-end"><span>{commentText.length}/1.000 ký tự</span><button className="button" type="submit" disabled={commenting}>{commenting ? 'Đang gửi…' : 'Gửi bình luận'}</button></div>
      </form> : publicPage && (user ? <div className="comment-login"><p>Hoàn tất hồ sơ để bình luận.</p><Link className="text-link" to="/setup-profile">Đặt biệt danh</Link></div> : <div className="comment-login"><p>Đăng nhập để để lại bình luận.</p><Link className="text-link" to="/login">Đăng nhập tài khoản</Link></div>)}
    </section>
  </article>;
}
