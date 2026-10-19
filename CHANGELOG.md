# Changelog

## 1.5.9 - 2026-10-19

- Sửa encoding của script cài NOTA Updater trên Windows PowerShell 5.1.

## 1.5.8 - 2026-10-19

- Thêm NOTA Updater cho Windows qua Chrome Native Messaging.
- Sau bước cài updater một lần, nút **Update ngay** tự tải GitHub Release, kiểm tra SHA256, thay file và reload extension.
- Tự tìm ID gắn với thư mục Load unpacked hiện tại để giữ nguyên extension và giới hạn native host đúng ID đó.

## 1.5.7 - 2026-10-19

- Đổi thao tác tạo bbox: nhấn `N`, click góc đầu, di chuyển chuột không cần giữ nút rồi click góc đối diện để hoàn tất.
- `Esc` hủy box đang tạo trước lần click thứ hai.

## 1.5.6 - 2026-10-19

- Thêm nút **Kiểm tra update** trong popup.
- Kiểm tra bản Chrome Web Store trước, sau đó kiểm tra GitHub Release.
- Thêm quy trình tự đóng gói và tạo Release bằng GitHub Actions.
- Giữ toàn bộ tính năng của 1.5.5: điều hướng theo danh sách đang lọc, ba trạng thái clip, Ctrl+B cho mọi loại nhãn, eye 15pt theo cụm, N/M cho bbox và giới hạn bbox tại biên ảnh kiểu CVAT.
