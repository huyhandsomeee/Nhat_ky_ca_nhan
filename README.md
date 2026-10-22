# Nhật ký cá nhân

Website viết và chia sẻ nhật ký, dùng React/Vite, Express và MongoDB. Mỗi người dùng đăng nhập bằng Google, chọn biệt danh riêng, rồi quyết định bài nào chỉ mình xem và bài nào được chia sẻ.

## Chức năng

- Đăng nhập Google và lưu phiên trong MongoDB bằng cookie `HttpOnly`.
- Tạo, sửa, xóa bài nhật ký; bài mới mặc định riêng tư.
- Lưu tiêu đề, nội dung, ngày nhật ký, tâm trạng tùy chọn và các thẻ tự nhập.
- Tìm bài trong nhật ký cá nhân hoặc trong các bài công khai.
- Ai cũng đọc được bài công khai; người dùng đăng nhập có thể bình luận.
- Người viết bình luận có thể xóa bình luận của mình; chủ bài có thể xóa mọi bình luận trên bài.
- Chuyển bài sang riêng tư sẽ ẩn bài và bình luận với người khác. Xóa bài sẽ xóa các bình luận đi kèm.

## Yêu cầu

- Node.js 20.19 trở lên.
- MongoDB local hoặc MongoDB Atlas.
- OAuth Client ID và Client Secret của ứng dụng Google.

## Cấu hình local

1. Cài dependency:

   ```powershell
   npm install
   ```

2. Tạo file `.env` từ mẫu:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Trong Google Cloud Console, tạo OAuth client loại Web application. Thêm URI sau vào **Authorized redirect URIs**:

   ```text
   http://localhost:3000/api/auth/google/callback
   ```

4. Điền `MONGODB_URI`, `MONGO_DB_NAME`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` trong `.env`. `MONGO_DB_NAME` mặc định là `nhat_ky_ca_nhan_v2`, tách riêng dữ liệu bản React khỏi database của ứng dụng cũ. Khi chạy local, giữ:

   ```text
   GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
   FRONTEND_URL=http://localhost:5173
   ```

Không commit `.env` hoặc thông tin OAuth.

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
| `GET` | `/api/auth/google` | Bắt đầu đăng nhập Google |
| `GET` | `/api/auth/google/callback` | Nhận phản hồi OAuth |
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

Test tự động bao gồm kiểm tra dữ liệu bài, ngày tương lai, quyền xem/xóa bình luận và schema MongoDB. Để demo đầy đủ OAuth, MongoDB và giao diện, dùng các bước chạy ứng dụng ở trên.

Ứng dụng này khởi đầu lại schema và không tự chuyển tài khoản/bài viết từ phiên bản EJS cũ.
