import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Field, InlineError } from '../components/ui';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const { user, loading, login, register, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from || '/my-diary';

  if (!loading && user && !user.needsProfileSetup) return <Navigate to="/my-diary" replace />;
  if (!loading && user?.needsProfileSetup) return <Navigate to="/setup-profile" replace />;

  function switchMode(newMode) {
    setMode(newMode);
    setError('');
    setSuccess('');
    setFieldErrors({});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(username, password);
        navigate(returnTo, { replace: true });
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setFieldErrors({ confirmPassword: 'Mật khẩu xác nhận không khớp.' });
          setSubmitting(false);
          return;
        }
        await register(username, password, confirmPassword, displayName);
        navigate(returnTo, { replace: true });
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          setFieldErrors({ confirmPassword: 'Mật khẩu xác nhận không khớp.' });
          setSubmitting(false);
          return;
        }
        await resetPassword(username, password, confirmPassword);
        setSuccess('Đặt lại mật khẩu thành công!');
        navigate(returnTo, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
      if (err.fields) setFieldErrors(err.fields);
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="login-page">
    <div className="login-note">
      <span className="login-mark" aria-hidden="true">✳</span>
      <p className="eyebrow">Một khoảng riêng</p>
      <h1>Hãy để ngày hôm nay có một nơi để ở lại.</h1>
      <p>Tạo tài khoản hoặc đăng nhập để viết nhật ký. Bạn luôn là người quyết định trang nào giữ riêng hay chia sẻ.</p>
    </div>

    <div className="login-panel auth-panel">
      <p className="eyebrow">
        {mode === 'login' ? 'Chào mừng bạn' : mode === 'register' ? 'Bắt đầu sổ riêng' : 'Khôi phục tài khoản'}
      </p>
      <h2>
        {mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : 'Đặt lại mật khẩu'}
      </h2>
      <p className="auth-desc">
        {mode === 'login'
          ? 'Điền thông tin tài khoản để vào sổ nhật ký của bạn.'
          : mode === 'register'
          ? 'Tạo tài khoản để bắt đầu lưu lại những trang nhật ký riêng.'
          : 'Nhập tên tài khoản để thiết lập mật khẩu mới.'}
      </p>

      {error && <InlineError message={error} />}
      {success && <div className="inline-success">{success}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <Field id="auth-username" label="Tên đăng nhập" hint={mode === 'register' ? 'Tối thiểu 3 ký tự, không chứa dấu cách' : undefined} error={fieldErrors.username}>
          <input
            id="auth-username"
            type="text"
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ví dụ: huy, nhatky123..."
          />
        </Field>

        {mode === 'register' && (
          <Field id="auth-display-name" label="Biệt danh hiển thị" hint="Tên sẽ hiện trên bài chia sẻ (để trống sẽ lấy tên đăng nhập)" error={fieldErrors.displayName}>
            <input
              id="auth-display-name"
              type="text"
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ví dụ: Huy, Mây..."
            />
          </Field>
        )}

        <Field
          id="auth-password"
          label={mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
          hint={mode === 'register' || mode === 'reset' ? 'Tối thiểu 6 ký tự' : undefined}
          error={fieldErrors.password || fieldErrors.newPassword}
        >
          <input
            id="auth-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        {(mode === 'register' || mode === 'reset') && (
          <Field id="auth-confirm-password" label="Xác nhận mật khẩu" error={fieldErrors.confirmPassword}>
            <input
              id="auth-confirm-password"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
        )}

        <button className="button auth-submit-btn" type="submit" disabled={submitting}>
          {submitting ? 'Đang xử lý…' : (
            mode === 'login' ? 'Đăng nhập' :
            mode === 'register' ? 'Tạo tài khoản' :
            'Đặt lại mật khẩu'
          )}
        </button>
      </form>

      <div className="auth-switch-links">
        {mode === 'login' ? (
          <>
            <p>Chưa có tài khoản? <button type="button" className="text-link-btn" onClick={() => switchMode('register')}>Đăng ký ngay</button></p>
            <p><button type="button" className="text-link-btn text-muted" onClick={() => switchMode('reset')}>Quên mật khẩu?</button></p>
          </>
        ) : mode === 'register' ? (
          <p>Đã có tài khoản? <button type="button" className="text-link-btn" onClick={() => switchMode('login')}>Đăng nhập ngay</button></p>
        ) : (
          <p><button type="button" className="text-link-btn" onClick={() => switchMode('login')}>← Quay lại đăng nhập</button></p>
        )}
      </div>

      {mode === 'register' && (
        <small className="auth-note">Biệt danh bạn chọn sẽ hiển thị trên bài viết công khai.</small>
      )}
    </div>
  </section>;
}
