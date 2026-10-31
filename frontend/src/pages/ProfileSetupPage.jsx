import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, jsonBody } from '../api';
import { useAuth } from '../auth/AuthContext';
import { InlineError } from '../components/ui';

export default function ProfileSetupPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/api/auth/profile', { method: 'PUT', body: jsonBody({ displayName }) });
      await refresh();
      navigate('/my-diary');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }

  return <section className="profile-setup">
    <div className="profile-icon" aria-hidden="true">✳</div>
    <p className="eyebrow">Trước khi bắt đầu</p>
    <h1>Bạn muốn được gọi là gì?</h1>
    <p>Biệt danh này sẽ xuất hiện bên cạnh những trang bạn chọn chia sẻ.</p>
    {error && <InlineError message={error} />}
    <form className="profile-form" onSubmit={submit}>
      <label htmlFor="display-name">Biệt danh</label>
      <input id="display-name" autoFocus value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required placeholder="Ví dụ: Mây" />
      <button className="button" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu biệt danh'}</button>
    </form>
  </section>;
}
