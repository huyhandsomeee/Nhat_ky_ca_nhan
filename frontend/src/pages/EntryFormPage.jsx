import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, jsonBody } from '../api';
import { Field, InlineError, Loading } from '../components/ui';
import { MOODS, MOOD_EMOJI, capitalize, localToday, parseTagInput } from '../shared/entryUtils';

export default function EntryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const prompt = location.state?.prompt || '';
  const editing = Boolean(id);
  const draftTimer = useRef(null);
  const draftSaveQueue = useRef(Promise.resolve());
  const [form, setForm] = useState({ title: '', content: '', journalDate: localToday(), mood: '', tagsText: '', visibility: 'private' });
  const [status, setStatus] = useState('loading');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      api(`/api/entries/${id}`).then(({ entry }) => {
        setForm({ title: entry.title, content: entry.content, journalDate: entry.journalDate, mood: entry.mood || '', tagsText: (entry.tags || []).map((tag) => `#${tag}`).join(', '), visibility: entry.visibility });
        setStatus('ready');
      }).catch((error) => { setSubmitError(error.message); setStatus('error'); });
      return;
    }
    api('/api/drafts').then(({ draft }) => {
      if (draft) setForm({ title: draft.title || '', content: prompt && !String(draft.content || '').includes(prompt) ? [draft.content, prompt].filter(Boolean).join('\n\n') : draft.content || prompt, journalDate: draft.journalDate || localToday(), mood: draft.mood || '', tagsText: (draft.tags || []).map((tag) => `#${tag}`).join(', '), visibility: draft.visibility || 'private' });
      else if (prompt) setForm((current) => ({ ...current, content: prompt }));
      setDraftLoaded(true);
      setStatus('ready');
    }).catch(() => { setDraftLoaded(true); setStatus('ready'); setDraftStatus('Chưa thể tải bản nháp'); });
  }, [id, editing]);

  useEffect(() => {
    if (editing || !draftLoaded) return;
    draftTimer.current = setTimeout(() => {
      setDraftStatus('Đang lưu nháp…');
      const payload = { title: form.title, content: form.content, journalDate: form.journalDate, mood: form.mood || null, tags: parseTagInput(form.tagsText), visibility: form.visibility };
      draftSaveQueue.current = draftSaveQueue.current.catch(() => {}).then(() => api('/api/drafts', { method: 'PUT', body: jsonBody(payload) }))
        .then(() => setDraftStatus('Đã lưu nháp'))
        .catch(() => setDraftStatus('Chưa thể lưu nháp'));
    }, 700);
    return () => clearTimeout(draftTimer.current);
  }, [form, editing, draftLoaded]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
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
      visibility: form.visibility
    };
    try {
      const data = await api(editing ? `/api/entries/${id}` : '/api/entries', { method: editing ? 'PUT' : 'POST', body: jsonBody(payload) });
      if (!editing) await api('/api/drafts', { method: 'DELETE' }).catch(() => {});
      navigate(`/entries/${data.entry._id}`);
    } catch (error) {
      setSubmitError(error.message);
      setErrors(error.fields || {});
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <InlineError message={submitError} />;
  return <section className="editor-page journal-editor">
    <Link className="back-link" to={editing ? `/entries/${id}` : '/my-diary'}>← {editing ? 'Quay lại bài viết' : 'Sổ của tôi'}</Link>
    <header className="editor-hero">
      <span className="editor-hero-mark" aria-hidden="true">✎</span>
      <div className="editor-hero-copy"><p className="eyebrow">{editing ? 'Chỉnh sửa trang viết' : 'Một khoảng riêng cho bạn'}</p><h1>{editing ? 'Ghi thêm điều bạn muốn giữ.' : 'Hôm nay của bạn thế nào?'}</h1><p>Một tiêu đề, vài dòng, và những chi tiết bạn muốn nhớ.</p></div>
      {!editing && <span className="editor-draft-status" role="status"><i aria-hidden="true" />{draftStatus || 'Lưu nháp tự động'}</span>}
    </header>
    {prompt && <div className="editor-prompt-banner"><span aria-hidden="true">✦</span><p><small>Gợi ý hôm nay</small>{prompt}</p></div>}
    {submitError && <InlineError message={submitError} />}
    <form className="entry-form journal-entry-form" onSubmit={submit}>
      <div className="editor-meta-grid">
        <Field id="journal-date" label="Ngày nhật ký" error={errors.journalDate}><input id="journal-date" type="date" value={form.journalDate} max={localToday()} onChange={(event) => update('journalDate', event.target.value)} required aria-invalid={Boolean(errors.journalDate)} /></Field>
        <Field id="entry-mood" label={<><span aria-hidden="true">☻</span> Tâm trạng</>} error={errors.mood}><select id="entry-mood" value={form.mood} onChange={(event) => update('mood', event.target.value)}><option value="">Chọn tâm trạng</option>{MOODS.map((mood) => <option key={mood} value={mood}>{MOOD_EMOJI[mood]} {capitalize(mood)}</option>)}</select></Field>
      </div>
      <div className="editor-hashtag-card"><Field id="entry-tags" label={<><span aria-hidden="true">#</span> Hashtag</>} hint="Có thể nhập nhiều thẻ, ngăn cách bằng dấu phẩy" error={errors.tags}><input id="entry-tags" value={form.tagsText} onChange={(event) => update('tagsText', event.target.value)} placeholder="#gia đình, #một chuyến đi" /></Field></div>
      <div className="editor-paper-card">
        <Field id="entry-title" label="Tiêu đề" error={errors.title}><input id="entry-title" className="editor-title-input" value={form.title} onChange={(event) => update('title', event.target.value)} maxLength={120} placeholder="Một điều bạn muốn nhớ" required /></Field>
        <Field id="entry-content" label="Nội dung" error={errors.content}><textarea id="entry-content" className="entry-content-input" value={form.content} onChange={(event) => update('content', event.target.value)} maxLength={10000} placeholder="Viết theo cách của bạn…" rows={14} required /></Field>
        <div className="editor-writing-footer"><span>{form.content.length.toLocaleString('vi-VN')} / 10.000 ký tự</span><span>{form.title.length} / 120 ký tự tiêu đề</span></div>
      </div>
      <div className="editor-publish-card">
        <fieldset className="visibility-fieldset journal-visibility-fieldset">
          <legend>Ai có thể đọc trang viết này?</legend>
          <div className="visibility-options">
            <label className={`visibility-option ${form.visibility === 'private' ? 'selected' : ''}`}><input type="radio" name="visibility" value="private" checked={form.visibility === 'private'} onChange={() => update('visibility', 'private')} /><span className="visibility-icon" aria-hidden="true">◌</span><span><strong>Chỉ mình tôi</strong><small>Bài viết và bình luận chỉ bạn xem được.</small></span></label>
            <label className={`visibility-option ${form.visibility === 'public' ? 'selected' : ''}`}><input type="radio" name="visibility" value="public" checked={form.visibility === 'public'} onChange={() => update('visibility', 'public')} /><span className="visibility-icon" aria-hidden="true">◎</span><span><strong>Công khai</strong><small>Mọi người có thể đọc; người đăng nhập có thể bình luận.</small></span></label>
          </div>
        </fieldset>
        <div className="editor-submit-bar"><span>{form.visibility === 'private' ? '◌ Chỉ mình bạn có thể đọc' : '◎ Bài viết sẽ xuất hiện ở Góc chia sẻ'}</span><div className="form-actions"><Link className="text-link" to={editing ? `/entries/${id}` : '/my-diary'}>Hủy</Link><button className="button" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu trang viết'}</button></div></div>
      </div>
    </form>
  </section>;
}
