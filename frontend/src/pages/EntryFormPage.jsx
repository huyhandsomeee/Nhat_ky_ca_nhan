import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, jsonBody } from '../api';
import { Field, InlineError, Loading, UserAvatar } from '../components/ui';
import { MOODS, MOOD_EMOJI, capitalize, localToday, parseTagInput } from '../shared/entryUtils';

export default function EntryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const draftTimer = useRef(null);
  const draftSaveQueue = useRef(Promise.resolve());
  const [form, setForm] = useState({ title: '', content: '', journalDate: localToday(), mood: '', tagsText: '', taggedUserIds: [], visibility: 'private' });
  const [friends, setFriends] = useState([]);
  const [taggedUserOptions, setTaggedUserOptions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/community/friends').then(({ friends: items }) => setFriends(items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (editing) {
      api(`/api/entries/${id}`).then(({ entry }) => {
        setForm({ title: entry.title, content: entry.content, journalDate: entry.journalDate, mood: entry.mood || '', tagsText: (entry.tags || []).map((tag) => `#${tag}`).join(', '), taggedUserIds: (entry.taggedUsers || []).map((person) => String(person._id || person)), visibility: entry.visibility });
        setTaggedUserOptions(entry.taggedUsers || []);
        setStatus('ready');
      }).catch((error) => { setSubmitError(error.message); setStatus('error'); });
      return;
    }
    api('/api/community/draft').then(({ draft }) => {
      if (draft) setForm({ title: draft.title || '', content: draft.content || '', journalDate: draft.journalDate || localToday(), mood: draft.mood || '', tagsText: (draft.tags || []).map((tag) => `#${tag}`).join(', '), taggedUserIds: (draft.taggedUsers || []).map((person) => String(person._id || person)), visibility: draft.visibility || 'private' });
      setDraftLoaded(true);
      setStatus('ready');
    }).catch(() => { setDraftLoaded(true); setStatus('ready'); setDraftStatus('Chưa thể tải bản nháp'); });
  }, [id, editing]);

  useEffect(() => {
    if (editing || !draftLoaded) return;
    draftTimer.current = setTimeout(() => {
      setDraftStatus('Đang lưu nháp…');
      const payload = { title: form.title, content: form.content, journalDate: form.journalDate, mood: form.mood || null, tags: parseTagInput(form.tagsText), taggedUsers: form.taggedUserIds, visibility: form.visibility };
      draftSaveQueue.current = draftSaveQueue.current.catch(() => {}).then(() => api('/api/community/draft', { method: 'PUT', body: jsonBody(payload) }))
        .then(() => setDraftStatus('Đã lưu nháp'))
        .catch(() => setDraftStatus('Chưa thể lưu nháp'));
    }, 700);
    return () => clearTimeout(draftTimer.current);
  }, [form, editing, draftLoaded]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function toggleTaggedFriend(friendId) {
    const current = form.taggedUserIds || [];
    update('taggedUserIds', current.includes(String(friendId)) ? current.filter((id) => id !== String(friendId)) : [...current, String(friendId)]);
  }

  async function submit(event) {
    event.preventDefault();
    clearTimeout(draftTimer.current);
    if (!editing) await draftSaveQueue.current.catch(() => {});
    setSaving(true);
    setSubmitError('');
    setErrors({});
    const payload = {
      title: form.title,
      content: form.content,
      journalDate: form.journalDate,
      mood: form.mood || null,
      tags: parseTagInput(form.tagsText),
      taggedUsers: form.taggedUserIds,
      visibility: form.visibility
    };
    try {
      const data = await api(editing ? `/api/entries/${id}` : '/api/entries', { method: editing ? 'PUT' : 'POST', body: jsonBody(payload) });
      if (!editing) await api('/api/community/draft', { method: 'DELETE' }).catch(() => {});
      navigate(`/entries/${data.entry._id}`);
    } catch (error) {
      setSubmitError(error.message);
      setErrors(error.fields || {});
    } finally {
      setSaving(false);
    }
  }

  const taggableFriends = [...friends];
  taggedUserOptions.forEach((person) => {
    const personId = String(person._id || person);
    if (!taggableFriends.some((friend) => String(friend._id) === personId)) taggableFriends.push(typeof person === 'object' ? person : { _id: personId, displayName: 'Bạn đã gắn thẻ' });
  });

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <InlineError message={submitError} />;
  return <section className="editor-page">
    <Link className="back-link" to={editing ? `/entries/${id}` : '/my-diary'}>← Quay lại</Link>
    <div className="editor-heading"><p className="eyebrow">{editing ? 'Chỉnh sửa' : 'Trang mới'}</p><h1>{editing ? 'Ghi thêm điều bạn muốn giữ.' : 'Hôm nay của bạn thế nào?'}</h1><p>Một tiêu đề, vài dòng, và những chi tiết bạn muốn nhớ.</p>{!editing && <small className="draft-status" role="status">{draftStatus || 'Bản nháp được lưu tự động trên tài khoản của bạn.'}</small>}</div>
    {submitError && <InlineError message={submitError} />}
    <form className="entry-form" onSubmit={submit}>
      <fieldset className="visibility-fieldset">
        <legend>Chế độ chia sẻ</legend>
        <div className="visibility-options">
          <label className={`visibility-option ${form.visibility === 'private' ? 'selected' : ''}`}><input type="radio" name="visibility" value="private" checked={form.visibility === 'private'} onChange={() => update('visibility', 'private')} /><span className="visibility-icon" aria-hidden="true">◌</span><span><strong>Chỉ mình tôi</strong><small>Bài viết và bình luận chỉ bạn xem được.</small></span></label>
          <label className={`visibility-option ${form.visibility === 'public' ? 'selected' : ''}`}><input type="radio" name="visibility" value="public" checked={form.visibility === 'public'} onChange={() => update('visibility', 'public')} /><span className="visibility-icon" aria-hidden="true">◎</span><span><strong>Công khai</strong><small>Mọi người có thể đọc; người đăng nhập có thể bình luận.</small></span></label>
        </div>
      </fieldset>
      <Field id="journal-date" label="Ngày nhật ký" error={errors.journalDate}><input id="journal-date" className="entry-date-input" type="date" value={form.journalDate} max={localToday()} onChange={(event) => update('journalDate', event.target.value)} required aria-invalid={Boolean(errors.journalDate)} /></Field>
      <Field id="entry-title" label="Tiêu đề" error={errors.title}><input id="entry-title" value={form.title} onChange={(event) => update('title', event.target.value)} maxLength={120} placeholder="Một điều bạn muốn nhớ" required /></Field>
      <Field id="entry-content" label="Nội dung" error={errors.content}><textarea id="entry-content" className="entry-content-input" value={form.content} onChange={(event) => update('content', event.target.value)} maxLength={10000} placeholder="Viết theo cách của bạn…" rows={12} required /></Field>
      <div className="entry-tools" role="group" aria-label="Tâm trạng và thẻ">
        <span className="entry-tools-title">Thêm vào trang viết</span>
        <div className="entry-tools-controls">
          <Field id="entry-mood" label={<><span aria-hidden="true">☻</span> Tâm trạng</>} error={errors.mood}><select id="entry-mood" value={form.mood} onChange={(event) => update('mood', event.target.value)}><option value="">Chọn tâm trạng</option>{MOODS.map((mood) => <option key={mood} value={mood}>{MOOD_EMOJI[mood]} {capitalize(mood)}</option>)}</select></Field>
          <Field id="entry-tags" label={<><span aria-hidden="true">#</span> Hashtag</>} hint="Ngăn cách bằng dấu phẩy" error={errors.tags}><input id="entry-tags" value={form.tagsText} onChange={(event) => update('tagsText', event.target.value)} placeholder="#gia đình, #một chuyến đi" /></Field>
        </div>
        <fieldset className="tagged-friends-fieldset" aria-describedby={errors.taggedUsers ? 'entry-tagged-users-error' : undefined}>
          <legend>Gắn thẻ bạn bè</legend>
          {taggableFriends.length ? <div className="tagged-friends-list">{taggableFriends.map((friend) => <label className="tagged-friend-option" key={friend._id}><input type="checkbox" checked={form.taggedUserIds.includes(String(friend._id))} onChange={() => toggleTaggedFriend(friend._id)} disabled={!form.taggedUserIds.includes(String(friend._id)) && form.taggedUserIds.length >= 20} /><UserAvatar src={friend.avatarPath} name={friend.displayName || friend.username} /><span>{friend.displayName || friend.username}</span></label>)}</div> : <span className="community-hint">Kết bạn để có thể gắn thẻ bạn bè.</span>}
          {errors.taggedUsers && <small id="entry-tagged-users-error" className="field-error">{errors.taggedUsers}</small>}
        </fieldset>
      </div>
      <div className="form-actions"><Link className="text-link" to={editing ? `/entries/${id}` : '/my-diary'}>Hủy</Link><button className="button" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu trang viết'}</button></div>
    </form>
  </section>;
}
