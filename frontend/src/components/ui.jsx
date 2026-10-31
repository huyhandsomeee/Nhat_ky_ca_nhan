import { Link } from 'react-router-dom';
import { apiUrl } from '../api';

export function UserAvatar({ src, name, className = '' }) {
  return <span className={`user-avatar ${className}`} aria-hidden="true">
    {src ? <img src={src.startsWith('/api/') ? apiUrl(src) : src} alt="" /> : <span>{(name || 'N').trim().slice(0, 1).toLocaleUpperCase('vi-VN')}</span>}
  </span>;
}

export function Field({ id, label, hint, error, children }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}{hint && <small className="field-hint">{hint}</small>}{error && <small className="field-error" role="alert">{error}</small>}</div>;
}

export function Loading() {
  return <div className="loading-state" role="status"><span className="loading-leaf" aria-hidden="true" />Đang mở trang viết…</div>;
}

export function InlineError({ message }) {
  return <div className="inline-error" role="alert">{message || 'Có lỗi xảy ra. Hãy thử lại.'}</div>;
}

export function EmptyState({ title, body, action }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true">✳</span><h3>{title}</h3><p>{body}</p>{action}</div>;
}

export function NotFound() {
  return <div className="empty-state"><span className="eyebrow">404</span><h1>Không tìm thấy trang này.</h1><p>Có thể đường dẫn đã đổi hoặc bài viết không còn công khai.</p><Link className="text-link" to="/explore">Về góc chia sẻ</Link></div>;
}
