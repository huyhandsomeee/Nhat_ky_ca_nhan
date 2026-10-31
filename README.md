# Nhật ký cá nhân

Website quản lý nhật ký cá nhân, dùng React, Rolldown, Express và MongoDB. Người dùng có thể đăng ký tài khoản, viết và quản lý bài nhật ký riêng tư, hoặc chủ động công khai từng bài để người khác đọc và bình luận.

## Cấu trúc dự án

- `frontend/`: giao diện React, entry `src/index.js` và stylesheet.
- `backend/`: Express server cùng các route API, model MongoDB, middleware, xác thực và logic nghiệp vụ.
- `test/`: kiểm thử cho backend và frontend.
- `dist/`: thư mục frontend được tạo khi chạy lệnh build; Express dùng thư mục này để phục vụ ứng dụng ở chế độ production.
- `package.json`: các lệnh chạy dự án ở thư mục gốc.

## Chức năng

- Đăng ký, đăng nhập và đặt lại mật khẩu với tài khoản tên đăng nhập & mật khẩu được mã hóa an toàn (bcrypt).
- Lưu phiên làm việc trong MongoDB bằng cookie `HttpOnly`.
- Tạo, sửa, xóa bài nhật ký; bài mới mặc định riêng tư.
- Lưu tiêu đề, nội dung, ngày nhật ký, tâm trạng tùy chọn và các thẻ tự nhập.
- Tìm bài trong nhật ký cá nhân hoặc trong các bài công khai.
- Ai cũng đọc được bài công khai; người dùng đăng nhập có thể bình luận.
- Góc chia sẻ có luồng bài từ người đang theo dõi, lọc theo tâm trạng/hashtag/tác giả và sắp xếp bài; có thể thích hoặc lưu bài công khai.
- Sổ của tôi có lịch, bộ lọc, thống kê cảm xúc 7 ngày và chuỗi ngày viết (streak) tính theo ngày nhật ký tại múi giờ `Asia/Ho_Chi_Minh`.
- Bài đã lưu chỉ người lưu xem được; hồ sơ công khai chỉ hiển thị số bài công khai.
- Bài viết có emoji tâm trạng và thanh chèn emoji; bài đang tạo được lưu nháp tự động theo tài khoản.
- Bình luận trên bài công khai hỗ trợ trả lời theo luồng và thả 👍 ❤️ 😂 😮 😢 🙏.
- Chủ bài nhận thông báo khi có người thả tim hoặc bình luận; người viết bình luận nhận thông báo khi có người trả lời hoặc thả cảm xúc.
- Người viết bình luận có thể xóa bình luận của mình; chủ bài có thể xóa mọi bình luận trên bài.
- Chuyển bài sang riêng tư sẽ ẩn bài và bình luận với người khác. Xóa bài sẽ xóa các bình luận đi kèm.

## Yêu cầu

- Node.js 20.19 trở lên.
- MongoDB local hoặc MongoDB Atlas.

## Cài đặt và cấu hình

Chạy các lệnh sau từ thư mục gốc của dự án (thư mục có `package.json`):

```powershell
npm install
```

Tạo file `.env` từ mẫu `.env.example`, sau đó cập nhật cấu hình MongoDB và session secret:

```powershell
Copy-Item .env.example .env
```

Các giá trị mẫu trong `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/nhat_ky_ca_nhan
MONGO_DB_NAME=nhat_ky_ca_nhan
SESSION_SECRET=thay-bang-mot-chuoi-bi-mat-dai-va-ngau-nhien
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5174
```

## Chạy ứng dụng

Khi phát triển, mở hai terminal tại thư mục gốc. Terminal thứ nhất chạy backend Express từ `backend/server.js`:

```powershell
npm run dev:server
```

Terminal thứ hai chạy server frontend và bundler Rolldown:

```powershell
npm run dev
```

Mở <http://localhost:5174>. Frontend gọi API Express ở cổng 3000.

Để tạo frontend production trong `dist/` và chạy cả frontend lẫn API qua Express:

```powershell
npm run build
npm start
```

Mở <http://localhost:3000>.

## API chính

| Phương thức | Đường dẫn | Mục đích |
| --- | --- | --- |
| `GET` | `/api/auth/me` | Trạng thái đăng nhập hiện tại |
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới |
| `POST` | `/api/auth/login` | Đăng nhập tài khoản |
| `POST` | `/api/auth/reset-password` | Đặt lại / Đăng ký lại mật khẩu |
| `PUT` | `/api/auth/profile` | Đặt hoặc đổi biệt danh |
| `POST` | `/api/auth/logout` | Đăng xuất |
| `GET`, `POST` | `/api/entries` | Tìm kiếm, lọc/liệt kê hoặc tạo bài nhật ký của tôi |
| `GET` | `/api/entries/calendar?month=YYYY-MM` | Đếm bài nhật ký theo ngày trong tháng |
| `GET` | `/api/entries/stats` | Thống kê tháng, cảm xúc tuần và streak riêng của tôi |
| `GET`, `PUT`, `DELETE` | `/api/entries/:id` | Đọc/sửa/xóa bài của tôi |
| `DELETE` | `/api/entries/:entryId/comments/:commentId` | Xóa bình luận theo quyền |
| `GET` | `/api/public/entries` | Tìm và liệt kê bài công khai |
| `GET` | `/api/public/entries/writers`, `/api/public/entries/authors?q=...` | Tác giả nổi bật hoặc gợi ý lọc tác giả |
| `POST`, `DELETE` | `/api/public/entries/:id/like` | Thích hoặc bỏ thích bài công khai |
| `GET` | `/api/public/entries/:id` | Đọc bài công khai cùng bình luận |
| `POST` | `/api/public/entries/:id/comments` | Bình luận trên bài công khai |
| `POST` | `/api/public/entries/:id/comments/:commentId/reactions` | Thêm hoặc gỡ phản ứng trên bình luận công khai |
| `GET` | `/api/social/saved` | Liệt kê bài công khai đã lưu của tôi |
| `POST`, `DELETE` | `/api/social/entries/:id/save` | Lưu hoặc bỏ lưu bài công khai |
| `GET` | `/api/social/authors/:id` | Xem trạng thái theo dõi tác giả |
| `POST`, `DELETE` | `/api/social/authors/:id/follow` | Theo dõi hoặc bỏ theo dõi tác giả |
| `GET`, `PUT`, `DELETE` | `/api/drafts` | Tải, lưu hoặc xóa bản nháp nhật ký |
| `GET` | `/api/notifications` | Xem thông báo bình luận và số lượng chưa đọc |
| `POST` | `/api/notifications/:id/read`, `/api/notifications/read` | Đánh dấu một hoặc tất cả thông báo đã đọc |

Các API trả lỗi dưới dạng JSON. API bài riêng tư chỉ trả dữ liệu cho chủ bài; người khác nhận `404` để không tiết lộ bài có tồn tại hay không.

## Kiểm tra

```powershell
npm test
npm run build
```
