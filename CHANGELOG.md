# Changelog

## 1.6.1 - 2026-10-19

- Body, hand và eye box có thể click chọn một box rồi dùng `Ctrl+B` để chỉ sao chép box đó sang các frame đích; box cùng thứ tự trái/phải được thay và các box còn lại được giữ nguyên.
- `Ctrl+C` / `Ctrl+V` cũng ưu tiên box đang chọn trên các label multi-box.
- Sửa `Ctrl+B` cho vùng xóa bbox tạo bằng `M`; polygon xóa được áp dụng đúng lên các frame trước/sau hoặc frame đã đánh dấu.

## 1.6.0 - 2026-10-19

- Thêm thanh phím tắt luôn hiển thị cho body, hand và eye box.
- Thêm `X`, `Shift+X`, `1`, `2`, `C`, `Shift+C`, `Ctrl+C`, `Ctrl+V`, `V` và `Z` cho quy trình sửa bbox nhanh.
- `Ctrl+B` hỗ trợ sao chép hoặc xóa theo số frame, đến cuối clip, hoặc các frame đã đánh dấu.
- Body có chế độ double-click và kéo riêng một cạnh; cạnh cũ màu trắng, cạnh mới màu xanh và chỉ cạnh đó được truyền sang frame đích.
- `Z` khôi phục toàn bộ một đợt bbox hàng loạt trong một lần.

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
