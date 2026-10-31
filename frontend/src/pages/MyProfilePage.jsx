import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, jsonBody } from '../api';
import { useAuth } from '../auth/AuthContext';
import { UserAvatar } from '../components/ui';

export default function MyProfilePage() {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [message, setMessage] = useState('');

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api('/api/auth/profile', { method: 'PUT', body: jsonBody({ displayName, bio }) });
      await refresh();
      setMessage('Đã lưu hồ sơ.');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setUploading(true);
    setAvatarError('');
    setMessage('');
    try {
      await api('/api/auth/profile/avatar', { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      await refresh();
      setMessage('Đã cập nhật ảnh đại diện.');
    } catch (reason) {
      setAvatarError(reason.message);
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setUploading(true);
    setAvatarError('');
    setMessage('');
    try {
      await api('/api/auth/profile/avatar', { method: 'DELETE' });
      await refresh();
      setMessage('Đã gỡ ảnh đại diện.');
    } catch (reason) {
      setAvatarError(reason.message);
    } finally {
      setUploading(false);
    }
  }

  return <section className="profile-page">
    <Link className="back-link" to="/my-diary">← Sổ của tôi</Link>
    <div className="profile-page-heading">
      <UserAvatar src={user?.avatarUrl} name={displayName} className="profile-avatar-large" />
      <div><p className="eyebrow">Hồ sơ cá nhân</p><h1>{displayName || 'Hồ sơ của bạn'}</h1><p className="profile-username">@{user?.username}</p><p>Những thông tin này sẽ hiện trên trang Profile công khai.</p></div>
    </div>
    {(error || message) && <div className={error ? 'inline-error' : 'inline-success'} role={error ? 'alert' : 'status'}>{error || message}</div>}
    <div className="profile-edit-layout">
      <div className="profile-edit-panel">
        <div className="avatar-editor">
          <UserAvatar src={user?.avatarUrl} name={displayName} className="profile-avatar-editor" />
          <div><strong>Ảnh đại diện</strong><small>JPEG, PNG hoặc WebP, tối đa 2 MB.</small><div className="avatar-actions"><label className="button button-outline button-small" htmlFor="profile-avatar-upload">{uploading ? 'Đang xử lý…' : 'Chọn ảnh'}</label>{user?.avatarUrl && <button className="text-button danger-text" type="button" onClick={removeAvatar} disabled={uploading}>Gỡ ảnh</button>}</div></div>
          <input id="profile-avatar-upload" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={uploading} />
        </div>
        {avatarError && <small className="field-error" role="alert">{avatarError}</small>}
        <form className="profile-edit-form" onSubmit={saveProfile}>
          <label htmlFor="profile-display-name">Biệt danh</label>
          <input id="profile-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required />
          <label htmlFor="profile-bio">Giới thiệu</label>
          <textarea id="profile-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} rows={4} placeholder="Viết đôi điều về bạn…" />
          <small className="field-hint">{bio.length}/280 ký tự</small>
          <button className="button" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
        </form>
      </div>
      <aside className="profile-public-preview">
        <p className="eyebrow">Trang công khai</p>
        <div className="profile-preview-heading"><UserAvatar src={user?.avatarUrl} name={displayName} /><div><strong>{displayName || 'Biệt danh của bạn'}</strong><small className="profile-username">@{user?.username}</small></div></div>
        <p>{bio || 'Phần giới thiệu sẽ xuất hiện tại đây.'}</p>
        <Link className="text-link" to={`/people/${user?.id}`}>Xem trang công khai</Link>
      </aside>
    </div>
  </section>;
}
