# NOTA Labeling Organizer

Chrome extension hỗ trợ sắp xếp frame theo clip và thao tác nhãn nhanh trên DMS Labeling.

Phiên bản hiện tại: **1.6.8**

[Tải bản mới nhất](https://github.com/tanmainhat0502/dms_annotation_extension/releases/latest)

## Chức năng chính

- Gom frame theo part và clip, tìm kiếm part nhanh.
- Di chuyển đúng thứ tự bằng `A`, `D`, `Shift+A`, `Shift+D` và `Space`.
- Đổi trạng thái toàn bộ clip giữa **Done**, **Not checked** và **In progress**.
- Sao chép hàng loạt bằng `Ctrl+B` cho seatbelt, eye 15pt, bbox, face 7pt và các loại nhãn còn lại.
- Tạo bbox bằng `N` với hai lần click, không cần giữ chuột; vẽ vùng xóa bằng `M`.
- Khi kéo bbox vượt biên ảnh, phần ngoài ảnh được cắt tại mép khi thả chuột giống CVAT.
- `Ctrl+B` với box đang chọn sẽ thêm box vào frame đích và giữ nguyên toàn bộ box cũ.
- Hai bbox có IoU từ 90% được cảnh báo màu đỏ; góc ảnh luôn hiện số bbox và thanh part hiện tổng số ảnh.
- Body/hand/eye box có bộ phím thao tác nhanh: `X` xóa mọi box, `1`/`2` xóa box trái/phải, `C` lấy toàn bộ box của frame vừa xem, cùng clipboard, đánh dấu, xử lý hàng loạt và hoàn tác.
- Body cho phép double-click rồi kéo riêng một cạnh; `Ctrl+B` đặt cạnh đó vào đúng vị trí tuyệt đối của đường xanh trên mọi frame đích và giữ nguyên ba cạnh còn lại.
- Chỉnh eye 15pt theo cả cụm: di chuyển, xoay và co giãn.
- Ẩn/hiện nhãn bằng `K` khi cần quan sát ảnh rõ hơn.
- Kiểm tra phiên bản mới ngay trong popup của extension.

Hướng dẫn đầy đủ nằm trong [extension/README.md](extension/README.md).

## Cài đặt

1. Mở trang [Releases](https://github.com/tanmainhat0502/dms_annotation_extension/releases/latest).
2. Tải file `NOTA_Labeling_Organizer_Extension_vX.Y.Z.zip` và giải nén.
3. Mở `chrome://extensions`.
4. Bật **Developer mode**.
5. Chọn **Load unpacked** và mở thư mục vừa giải nén.
6. Tải lại trang DMS.

Có thể clone repository rồi chọn trực tiếp thư mục `extension` ở bước 5.

## Cập nhật một click trên Windows

Chrome không cho bản `Load unpacked` tự thay mã nguồn nếu chỉ dùng API extension. Bản 1.5.8 kèm **NOTA Updater** chạy cục bộ để thực hiện phần thay file qua Native Messaging.

Thiết lập một lần:

1. Cài bản 1.6.8 vào một thư mục cố định bằng **Load unpacked**.
2. Double-click `Install-NOTA-Updater.cmd` trong thư mục đó.
3. Đóng và mở lại popup. Nút **Cài update một lần** sẽ biến mất khi updater sẵn sàng.

Từ phiên bản sau:

1. Bấm **Kiểm tra update**.
2. Khi có bản mới, bấm **Update ngay vX.Y.Z**.
3. Updater tải GitHub Release, kiểm tra SHA256, thay file và reload extension tự động.

Updater không cần quyền Administrator. Bộ cài đọc Chrome profile để tìm ID gắn với đúng thư mục đang được **Load unpacked**; native host chỉ nhận lệnh từ ID đó. Nếu extension được cài từ Chrome Web Store, Chrome vẫn dùng cơ chế cập nhật Store chính thức.

## Cấu trúc repository

```text
extension/              Mã nguồn có thể Load unpacked
dist/                   ZIP phát hành hiện tại
native-updater/         Mã nguồn và script build updater Windows
scripts/package.ps1     Đóng gói ZIP theo version trong manifest
.github/workflows/      Tự tạo GitHub Release khi push tag vX.Y.Z
```

## Tạo phiên bản mới

1. Sửa mã nguồn trong `extension` và tăng `version` trong `extension/manifest.json`.
2. Chạy `powershell -ExecutionPolicy Bypass -File scripts/package.ps1`.
3. Commit và push thay đổi.
4. Tạo tag trùng với version, ví dụ `git tag v1.5.7` rồi `git push origin v1.5.7`.

GitHub Actions sẽ kiểm tra tag, đóng gói thư mục `extension` và tạo Release kèm ZIP. Popup kiểm tra Release mới qua GitHub API; NOTA Updater tải và áp dụng gói này.

## Phạm vi truy cập

Extension chỉ chạy trên:

- `https://ntt.dev.nota.ai/*`
- `http://10.169.1.102:8765/*`

Popup truy cập `https://api.github.com/*` chỉ để đọc thông tin Release mới nhất của repository này.
