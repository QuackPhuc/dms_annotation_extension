# Changelog

## 1.6.12 - 2026-10-19

- Không còn xóa nhầm body box lớn khi copy một box nhỏ nằm bên trong: điều kiện replace giờ kiểm tra thêm độ tương đồng chiều rộng và chiều cao, đồng thời vẫn gộp các bản sao thực sự trùng nhau.

## 1.6.11 - 2026-10-19

- Nhận diện bbox cùng đối tượng bằng cả IoU và độ phủ của box nhỏ hơn. Khi copy, mọi box cũ trùng cùng vị trí được gộp và thay bằng đúng một box nguồn, kể cả khi box cũ cao hơn nhiều.

## 1.6.10 - 2026-10-19

- Khi sao chép riêng bbox, nhận diện box cùng vị trí với ngưỡng IoU 50% để thay box cũ kể cả khi chiều cao khác nhau; ngưỡng cảnh báo bbox trùng màu đỏ vẫn giữ ở 90%.

## 1.6.9 - 2026-10-19

- Khi sao chép riêng một bbox bằng `Ctrl+B` hoặc `Ctrl+C` / `Ctrl+V`, box đích trùng từ 90% IoU được thay bằng box nguồn; nếu không có box trùng thì thêm box mới và giữ nguyên các box khác.

## 1.6.8 - 2026-10-19

- Sửa `Ctrl+B` sau khi vẽ vùng xóa `M` cho hand và eye box: luôn mở chế độ xóa hàng loạt, kể cả khi khép vùng bằng cách click lại điểm đầu hoặc vùng nguồn không chứa box.

## 1.6.7 - 2026-10-19

- Chỉ cảnh báo bbox trùng màu đỏ khi IoU của cặp box đạt từ 90%; box nhỏ giao một phần hoặc nằm trong box lớn không còn bị báo nhầm.

## 1.6.6 - 2026-10-19

- Sửa hướng hiển thị tổng số ảnh trong cột part để đọc từ trên xuống dưới, không còn bị xoay ngược.

## 1.6.5 - 2026-10-19

- `Ctrl+B` với **Chỉ box đang chọn** chuyển sang thêm box vào frame đích; không thay thế hoặc làm mất box cũ.
- Cảnh báo trực quan các bbox chồng lấn bằng lớp phủ và viền đỏ; góc ảnh hiển thị tổng số bbox.
- Hiển thị tổng số ảnh của từng part ngay trong cột tên part ở danh sách bên trái.

## 1.6.4 - 2026-10-19

- Sửa trường hợp updater báo đã dùng bản mới nhất nhưng khi mở lại popup vẫn hiện phiên bản runtime cũ.
- Khi file extension trên máy mới hơn runtime Chrome đang giữ, popup luôn gọi reload kể cả native updater trả về `up_to_date`.

## 1.6.3 - 2026-10-19

- Chuẩn hóa body/hand/eye box: `X` xóa toàn bộ bbox, `1`/`2` xóa box trái/phải; `Shift+X` xóa toàn bộ rồi sang frame sau.
- `C` và `Shift+C` luôn lấy toàn bộ bbox của frame vừa xem; `Ctrl+C/V`, `V`, `Ctrl+B` và `Z` giữ nguyên chức năng.
- Bỏ bảng phím tắt nổi ở cuối màn hình.

## 1.6.2 - 2026-10-19

- Đổi chỉnh cạnh body hàng loạt sang tọa độ tuyệt đối: cạnh ở mọi frame đích được đặt đúng tại vị trí đường xanh của frame nguồn, không cộng/trừ delta pixel.
- Đổi thanh chức năng body/hand/eye thành các nút thật có thể click; phím tắt bàn phím vẫn hoạt động song song.

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
