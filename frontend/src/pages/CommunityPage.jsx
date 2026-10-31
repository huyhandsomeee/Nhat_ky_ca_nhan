import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, apiUrl, jsonBody } from '../api';
import { useAuth } from '../auth/AuthContext';
import { InlineError, UserAvatar } from '../components/ui';

export default function CommunityPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [conversations, setConversations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  async function loadCommunity() {
    const [friendData, requestData, conversationData, notificationData, blockData] = await Promise.all([
      api('/api/community/friends'), api('/api/community/requests'), api('/api/community/conversations'),
      api('/api/community/notifications'), api('/api/community/blocks')
    ]);
    setFriends(friendData.friends);
    setRequests(requestData);
    setConversations(conversationData.conversations);
    setActiveConversation((current) => {
      if (!current) return current;
      const updated = conversationData.conversations.find((item) => String(item._id) === String(current._id));
      return updated ? { ...current, status: updated.status, requestedBy: updated.requestedBy } : current;
    });
    const viewedAt = new Date().toISOString();
    if (notificationData.unreadCount > 0) {
      await api('/api/community/notifications/read', { method: 'POST' });
      window.dispatchEvent(new Event('community:notifications-read'));
    }
    setNotifications(notificationData.notifications.map((item) => item.readAt ? item : { ...item, readAt: viewedAt }));
    setBlocks(blockData.blocks);
  }

  useEffect(() => { loadCommunity().catch((reason) => setError(reason.message)); }, []);

  useEffect(() => {
    const friend = location.state?.openChatUser;
    if (friend) openConversation(friend);
  }, [location.key]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) { setUsers([]); setSearching(false); return; }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => api(`/api/community/users?q=${encodeURIComponent(normalized)}`)
      .then((data) => { if (active) { setUsers(data.users); setSearching(false); } })
      .catch((reason) => { if (active) { setError(reason.message); setSearching(false); } }), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    const events = new EventSource(apiUrl('/api/community/events'), { withCredentials: true });
    events.addEventListener('message:new', (event) => {
      const data = JSON.parse(event.data);
      if (activeConversation?._id === data.conversationId) {
        api(`/api/community/conversations/${data.conversationId}/messages`)
          .then((result) => { setMessages(result.messages); return loadCommunity(); })
          .catch(() => {});
      } else {
        loadCommunity().catch(() => {});
      }
    });
    events.addEventListener('notification:new', () => loadCommunity().catch(() => {}));
    events.addEventListener('conversation:accepted', () => loadCommunity().catch(() => {}));
    return () => events.close();
  }, [activeConversation?._id]);

  useEffect(() => {
    if (!activeConversation?._id) return;
    let active = true;
    api(`/api/community/conversations/${activeConversation._id}/messages`)
      .then((data) => { if (active) setMessages(data.messages); })
      .catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [activeConversation?._id]);

  async function run(action) {
    setError('');
    try { await action(); await loadCommunity(); }
    catch (reason) { setError(reason.message); }
  }

  async function acceptRequest(id) { await run(() => api(`/api/community/requests/${id}/accept`, { method: 'POST' })); }
  async function declineRequest(id) { await run(() => api(`/api/community/requests/${id}`, { method: 'DELETE' })); }

  async function openConversation(friend) {
    setError('');
    try {
      const { conversation } = await api(`/api/community/conversations/${friend._id}`, { method: 'POST' });
      setActiveConversation({ ...conversation, user: friend, unreadCount: 0 });
      setConversations((current) => {
        const exists = current.some((item) => String(item.user?._id) === String(friend._id));
        const opened = { ...conversation, user: friend, unreadCount: 0 };
        return exists ? current.map((item) => String(item.user?._id) === String(friend._id) ? { ...item, unreadCount: 0, status: conversation.status, requestedBy: conversation.requestedBy } : item) : [opened, ...current];
      });
    } catch (reason) { setError(reason.message); }
  }

  async function blockActiveUser() {
    if (!activeConversation) return;
    const blockedId = activeConversation.user._id;
    try {
      await api(`/api/community/blocks/${blockedId}`, { method: 'POST' });
      setActiveConversation(null);
      setMessages([]);
      await loadCommunity();
    } catch (reason) { setError(reason.message); }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!activeConversation || !messageText.trim()) return;
    try {
      const { message } = await api(`/api/community/conversations/${activeConversation._id}/messages`, { method: 'POST', body: jsonBody({ content: messageText }) });
      setMessages((current) => [...current, message]);
      setMessageText('');
      loadCommunity().catch(() => {});
    } catch (reason) { setError(reason.message); }
  }

  async function acceptMessageRequest() {
    if (!activeConversation) return;
    await run(() => api(`/api/community/conversations/${activeConversation._id}/accept`, { method: 'POST' }));
  }

  async function markNotificationsRead() {
    await api('/api/community/notifications/read', { method: 'POST' });
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.readAt ? item : { ...item, readAt }));
    window.dispatchEvent(new Event('community:notifications-read'));
  }

  const contacts = [...friends];
  conversations.forEach((conversation) => {
    if (conversation.user && !contacts.some((person) => String(person._id) === String(conversation.user._id))) contacts.push(conversation.user);
  });

  return <section className="community-page">
    <div className="diary-heading community-heading"><div><p className="eyebrow">Không gian kết nối</p><h1>Những người bạn mới.</h1><p className="intro-description">Chia sẻ câu chuyện công khai và trò chuyện với những người bạn đã kết nối.</p></div></div>
    {error && <InlineError message={error} />}
    <div className="community-grid">
      <div className="community-sidebar">
        <section className="community-card">
          <p className="eyebrow">Tìm bạn</p><h2>Tìm theo tên người dùng</h2>
          <div className="community-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập tên người dùng" minLength={2} /><span className="community-hint">Nhập ít nhất 2 ký tự</span></div>
          {searching && <p className="community-hint">Đang tìm…</p>}
          {users.map((person) => <div className="community-person" key={person._id}><div><strong>{person.displayName || person.username}</strong><small>@{person.username}</small></div><button className="text-button" onClick={() => run(() => api('/api/community/requests', { method: 'POST', body: jsonBody({ username: person.username }) }))}>＋ Mời</button></div>)}
          {query.trim().length >= 2 && !searching && !users.length && <p className="community-hint">Không tìm thấy tài khoản phù hợp.</p>}
        </section>

        <section className="community-card">
          <p className="eyebrow">Lời mời đến <span className="count-pill">{requests.incoming.length}</span></p>
          {requests.incoming.length ? requests.incoming.map((request) => <div className="community-person" key={request._id}><div><strong>{request.sender?.displayName || request.sender?.username}</strong><small>@{request.sender?.username}</small></div><div className="person-actions"><button className="text-button" onClick={() => acceptRequest(request._id)}>Chấp nhận</button><button className="text-button danger-text" onClick={() => declineRequest(request._id)}>Từ chối</button></div></div>) : <p className="community-hint">Chưa có lời mời nào.</p>}
          {!!requests.outgoing.length && <p className="community-hint">Đang chờ {requests.outgoing.length} lời mời bạn gửi.</p>}
        </section>

        <section className="community-card">
          <p className="eyebrow">Thông báo <span className="count-pill">{notifications.filter((item) => !item.readAt).length}</span></p>
          {!!notifications.some((item) => !item.readAt) && <button className="text-button" onClick={() => run(markNotificationsRead)}>Đánh dấu đã đọc</button>}
          {notifications.slice(0, 5).map((item) => <p className={`notification-line ${item.readAt ? '' : 'unread'}`} key={item._id}>
            {item.type === 'message' ? 'Tin nhắn mới từ' : item.type === 'friend_request' ? 'Lời mời kết bạn từ' : item.type === 'friend_accepted' ? 'Đã trở thành bạn với' : item.type === 'entry_comment' ? 'đã bình luận bài viết:' : item.type === 'comment_reply' ? 'đã trả lời bình luận trong bài viết:' : item.type === 'comment_reaction' ? 'đã thả cảm xúc vào bình luận trong bài viết:' : item.type === 'entry_tag' ? 'đã gắn thẻ bạn trong bài viết:' : 'Thông báo từ'} <strong>{item.actor?.displayName || item.actor?.username}</strong>
            {(item.type === 'entry_comment' || item.type === 'comment_reply' || item.type === 'comment_reaction' || item.type === 'entry_tag') && item.entry && <> · <Link to={item.entry.visibility === 'public' ? `/explore/${item.entry._id}` : `/entries/${item.entry._id}`}>{item.entry.title}</Link></>}
          </p>)}
          {!notifications.length && <p className="community-hint">Thông báo mới sẽ xuất hiện ở đây.</p>}
        </section>

        <section className="community-card">
          <p className="eyebrow">Đã chặn</p>
          {blocks.map((item) => <div className="community-person" key={item._id}><div><strong>{item.blocked?.displayName || item.blocked?.username}</strong><small>@{item.blocked?.username}</small></div><button className="text-button" onClick={() => run(() => api(`/api/community/blocks/${item.blocked?._id}`, { method: 'DELETE' }))}>Bỏ chặn</button></div>)}
          {!blocks.length && <p className="community-hint">Bạn chưa chặn tài khoản nào.</p>}
        </section>
      </div>

      <section className="community-card friends-card">
        <div className="community-card-heading"><div><p className="eyebrow">Bạn bè <span className="count-pill">{friends.length}</span></p><h2>Hộp thư</h2></div></div>
        <div className="messenger-layout">
          <div className="conversation-list">
            {contacts.map((friend) => {
              const conversation = conversations.find((item) => String(item.user?._id) === String(friend._id));
              return <div className={`conversation-item ${activeConversation?.user?._id === friend._id ? 'active' : ''}`} key={friend._id}><button className="conversation-avatar-button" onClick={() => openConversation(friend)} aria-label={`Mở cuộc trò chuyện với ${friend.displayName || friend.username}`}><UserAvatar src={String(user.id) === String(friend._id) ? user.avatarUrl : friend.avatarPath} name={friend.displayName || friend.username} className="comment-avatar" /></button><span className="conversation-person-label"><Link className="conversation-person-name" to={`/people/${friend._id}`}>{friend.displayName || friend.username}</Link><button className="conversation-preview" onClick={() => openConversation(friend)}>{conversation?.lastMessage?.content || `@${friend.username}`}</button></span>{conversation?.unreadCount > 0 && <span className="message-unread-badge" aria-label={`${conversation.unreadCount} tin nhắn chưa đọc`}>{conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}</span>}</div>;
            })}
            {!contacts.length && <p className="community-hint">Khi có lời mời nhắn tin hoặc kết bạn, người đó sẽ xuất hiện ở đây.</p>}
          </div>
          <div className="chat-panel">
            {activeConversation ? <>
              <div className="chat-heading"><div><p className="eyebrow">{activeConversation.status === 'pending' ? 'Lời mời nhắn tin' : 'Đang trò chuyện'}</p><strong>{activeConversation.user.displayName || activeConversation.user.username}</strong></div><div className="chat-heading-actions">{activeConversation.status === 'pending' && String(activeConversation.requestedBy) !== String(user.id) && messages.length > 0 && <button className="button button-small" onClick={acceptMessageRequest}>Chấp nhận lời nhắn</button>}<button className="text-button danger-text" onClick={blockActiveUser}>Chặn</button></div></div>
              <div className="chat-messages">{messages.map((message) => <div className={`chat-bubble ${String(message.sender?._id || message.sender) === String(user.id) ? 'mine' : ''}`} key={message._id}><p>{message.content}</p><time>{formatTimestamp(message.createdAt)}</time></div>)}{!messages.length && <p className="community-hint">Gửi lời chào đầu tiên nhé.</p>}</div>
              {activeConversation.status === 'pending' && messages.length > 0 ? <p className="message-request-hint">{String(activeConversation.requestedBy) === String(user.id) ? 'Đang chờ người nhận chấp nhận lời nhắn trước khi bạn có thể nhắn tiếp.' : 'Hãy chấp nhận lời nhắn để bắt đầu trò chuyện.'}</p> : <form className="chat-compose" onSubmit={sendMessage}><textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={5000} rows={2} placeholder="Viết tin nhắn…" required /><button className="button button-small" disabled={!messageText.trim()}>Gửi</button></form>}
            </> : <div className="chat-empty"><span aria-hidden="true">✉</span><h3>Chọn một người để nhắn tin</h3><p>Bạn có thể gửi lời nhắn đầu tiên cho người chưa kết bạn. Họ cần chấp nhận trước khi hai bên trò chuyện tiếp.</p></div>}
          </div>
        </div>
      </section>
    </div>
  </section>;
}
