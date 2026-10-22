# Trang nhật ký

Website nhật ký cá nhân dùng Node.js, Express, EJS và MongoDB. Đây là project mẫu để bạn đọc code, chạy thử rồi phát triển tiếp.

## Tính năng

- Đăng ký, đăng nhập và đăng xuất.
- Tạo, đọc, sửa, xóa bài nhật ký.
- Chọn bài **Riêng tư** hoặc **Công khai** (mặc định là riêng tư).
- Đọc bài công khai và bình luận khi đã đăng nhập.
- Người viết bình luận có thể xóa bình luận của mình; chủ bài có thể xóa bình luận trên bài của họ.
- Kiểm tra quyền ở phía máy chủ, băm mật khẩu, lưu phiên đăng nhập trong MongoDB.

## 1. Cài đặt cần có

- Node.js bản LTS và npm.
- MongoDB chạy trên máy, hoặc một URI MongoDB Atlas.

## 2. Cài và chạy

Mở terminal tại thư mục project:

```bash
npm install
```

Tạo file cấu hình môi trường từ mẫu:

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Mở `.env`, điền `MONGODB_URI` nếu bạn dùng MongoDB Atlas và đổi `SESSION_SECRET` thành chuỗi bí mật riêng. Sau đó chạy:

```bash
npm run dev
```

Mở <http://localhost:3000>. Để chạy mà không tự khởi động lại khi sửa code, dùng `npm start`.

## 3. Đọc code theo luồng

1. `server.js`: cấu hình Express, middleware, session, kết nối MongoDB và khai báo router.
2. `src/models/`: cấu trúc dữ liệu `User`, `Entry`, `Comment` trong MongoDB.
3. `src/middleware/auth.js`: nạp người dùng hiện tại và chặn trang cần đăng nhập.
4. `src/routes/auth.js`: đăng ký, đăng nhập, đăng xuất và băm mật khẩu.
5. `src/routes/entries.js`: CRUD nhật ký cá nhân; truy vấn luôn giới hạn theo chủ bài.
6. `src/routes/publicEntries.js`: trang công khai và bình luận.
7. `src/views/`: giao diện EJS; `public/styles.css` điều khiển giao diện responsive.

## 4. Thử các luồng chính

1. Tạo tài khoản rồi viết bài. Mặc định bài chỉ hiển thị với bạn.
2. Mở bài để sửa hoặc xóa; thử đổi chế độ sang **Mọi người**.
3. Mở **Góc chia sẻ** ở cửa sổ riêng tư hoặc tài khoản khác và xem bài công khai.
4. Đăng nhập tài khoản khác, bình luận, rồi thử xóa bình luận của chính mình.
5. Thử URL của bài riêng tư bằng tài khoản khác: máy chủ sẽ trả về trang không tìm thấy.

## Ghi chú bảo mật

Đây là nền tảng học tập, chưa phải cấu hình triển khai production hoàn chỉnh. Trước khi đưa lên Internet, hãy đặt `SESSION_SECRET` mạnh, bật HTTPS, cấu hình sao lưu MongoDB, thêm bảo vệ CSRF và giới hạn tần suất đăng nhập/bình luận. Không commit file `.env`.
