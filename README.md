# Nhật ký cá nhân

Website viết và chia sẻ nhật ký, dùng React/Vite, Express và MongoDB. Người dùng có thể đăng ký tài khoản bằng tên đăng nhập & mật khẩu, chọn biệt danh riêng, rồi quyết định bài nào chỉ mình xem và bài nào được chia sẻ.

## Chức năng

- Đăng ký, đăng nhập và đặt lại mật khẩu với tài khoản tên đăng nhập & mật khẩu được mã hóa an toàn (bcrypt).
- Lưu phiên làm việc trong MongoDB bằng cookie `HttpOnly`.
- Tạo, sửa, xóa bài nhật ký; bài mới mặc định riêng tư.
- Lưu tiêu đề, nội dung, ngày nhật ký, tâm trạng tùy chọn và các thẻ tự nhập.
- Tìm bài trong nhật ký cá nhân hoặc trong các bài công khai.
- Ai cũng đọc được bài công khai; người dùng đăng nhập có thể bình luận.
- Người viết bình luận có thể xóa bình luận của mình; chủ bài có thể xóa mọi bình luận trên bài.
- Chuyển bài sang riêng tư sẽ ẩn bài và bình luận với người khác. Xóa bài sẽ xóa các bình luận đi kèm.

## Yêu cầu

- Node.js 20.19 trở lên.
- MongoDB local hoặc MongoDB Atlas.

## Cấu hình local

1. Cài dependency:

   ```powershell
   npm install
   ```

2. Cấu hình file `.env`:

   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/nhat_ky_ca_nhan
   MONGO_DB_NAME=nhat_ky_ca_nhan
   SESSION_SECRET=thay-bang-mot-chuoi-bi-mat-dai-va-ngau-nhien
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   ```

## Chạy ứng dụng

Khi phát triển, mở hai terminal tại thư mục project:

```powershell
npm run dev:server
```

```powershell
npm run dev
```

Mở <http://localhost:5173>. Vite chuyển tiếp `/api` tới Express ở cổng 3000.

Để chạy bản build bằng một server Express:

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

Các API trả lỗi dưới dạng JSON. API bài riêng tư chỉ trả dữ liệu cho chủ bài; người khác nhận `404` để không tiết lộ bài có tồn tại hay không.

## Kiểm tra

```powershell
npm test
npm run build
```
