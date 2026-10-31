# Nhật ký cá nhân

Website viết và chia sẻ nhật ký, dùng React, Rolldown, Express và MongoDB. Mã nguồn được chia thành `frontend/` cho giao diện và `backend/` cho API, xác thực, mô hình dữ liệu và nghiệp vụ. Người dùng có thể đăng ký tài khoản bằng tên đăng nhập & mật khẩu, chọn biệt danh riêng, rồi quyết định bài nào chỉ mình xem và bài nào được chia sẻ.

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
- Bài viết có emoji tâm trạng và thanh chèn emoji; bài đang tạo được lưu nháp tự động theo tài khoản.
- Tìm người dùng theo tên đăng nhập, gửi/nhận lời mời kết bạn và trò chuyện riêng sau khi kết bạn.
- Bình luận trên bài công khai hỗ trợ trả lời theo luồng và thả 👍 ❤️ 😂 😮 😢 🙏.
- Có thông báo trong ứng dụng cho lời mời và tin nhắn; người dùng có thể chặn hoặc bỏ chặn tài khoản.
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
| `GET`, `POST` | `/api/entries` | Liệt kê/tạo bài của tôi |
| `GET`, `PUT`, `DELETE` | `/api/entries/:id` | Đọc/sửa/xóa bài của tôi |
| `DELETE` | `/api/entries/:entryId/comments/:commentId` | Xóa bình luận theo quyền |
| `GET` | `/api/public/entries` | Tìm và liệt kê bài công khai |
| `GET` | `/api/public/entries/:id` | Đọc bài công khai cùng bình luận |
| `POST` | `/api/public/entries/:id/comments` | Bình luận trên bài công khai |
| `POST` | `/api/public/entries/:id/comments/:commentId/reactions` | Thêm hoặc gỡ phản ứng trên bình luận công khai |
| `GET`, `POST` | `/api/community/users`, `/api/community/requests` | Tìm người dùng, gửi lời mời kết bạn |
| `GET`, `POST`, `DELETE` | `/api/community/requests/:id...` | Xem, chấp nhận hoặc từ chối lời mời |
| `GET`, `DELETE` | `/api/community/friends` | Xem bạn bè hoặc kết thúc kết nối |
| `POST`, `GET`, `DELETE` | `/api/community/blocks/:id`, `/api/community/blocks` | Chặn, xem danh sách hoặc bỏ chặn |
| `GET`, `POST` | `/api/community/conversations...` | Mở hộp thư và tải/gửi tin nhắn giữa bạn bè |
| `GET` | `/api/community/events` | Sự kiện SSE đã xác thực cho tin nhắn và thông báo mới |
| `GET`, `PUT`, `DELETE` | `/api/community/draft` | Tải, lưu hoặc xóa bản nháp tài khoản |
| `GET`, `POST` | `/api/community/notifications` | Xem thông báo và đánh dấu đã đọc |

Các API trả lỗi dưới dạng JSON. API bài riêng tư chỉ trả dữ liệu cho chủ bài; người khác nhận `404` để không tiết lộ bài có tồn tại hay không.

## Kiểm tra

```powershell
npm test
npm run build
```
