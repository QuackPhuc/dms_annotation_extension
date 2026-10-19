# NOTA Labeling Organizer

Phiên bản hiện tại: **1.6.3**.

Popup có nút **Kiểm tra update**. Với bản cài từ Chrome Web Store, nút yêu cầu Chrome kiểm tra và cài bản Store mới. Với bản `Load unpacked`, hãy double-click `Install-NOTA-Updater.cmd` một lần. Từ phiên bản sau, nút **Update ngay** sẽ tự tải GitHub Release, kiểm tra SHA256, thay file và reload extension.

**Điều hướng:** `A` / `D` mở frame trước / sau theo đúng thứ tự đang hiển thị trong danh sách đã gom. Khi đang lọc part, hai phím này chỉ di chuyển trong part đang hiện. `Shift+A` / `Shift+D` di chuyển 10 frame. **Space** phát video theo cùng thứ tự này và dừng ở frame cuối của danh sách đang hiển thị.

Extension này hỗ trợ seatbelt và eye 15pt trên màn hình **Labeling** của DMS. Tìm kiếm/gom clip chỉ đổi giao diện; chỉnh mask, điểm mắt và trạng thái frame được lưu qua API của trang đang mở.

## Chức năng

- Tìm nhanh part bằng một phần tên: `ciga`, `phone`, `bottle`...
- Gom các frame có cùng số clip thành một nhóm duy nhất: `#01`, `#02`...
- Bấm tên clip để mở hoặc thu gọn danh sách ảnh bên trong.
- Tự mở nhóm chứa frame đang xem; sau khi người dùng chủ động đóng thì clip sẽ giữ trạng thái đóng.
- Giữ vị trí cuộn của danh sách khi sửa mask, Undo hoặc lưu nhiều frame, kể cả lúc đang lọc part. Khi chuyển frame, danh sách vẫn đưa frame mới vào vùng nhìn thấy.
- Con trỏ trong ảnh dùng crosshair của trình duyệt để di chuyển mượt. Ảnh chỉ vẽ lại liên tục khi đang kéo khung hoặc vẽ/chỉnh mask; ô phóng đại vẫn đi theo chuột.
- Khi cuộn nhanh để zoom, các nấc cuộn được gộp theo frame màn hình để ảnh, mask, bbox và khung SAM3 phóng cùng lúc, không còn lệch nhau trong chốc lát.
- Danh sách frame chỉ được gom lại khi dữ liệu thực sự thay đổi. Khi vẽ, nhấn R hoặc chuyển trạng thái, extension cập nhật hàng và bộ đếm hiện có thay vì dựng lại toàn bộ danh sách; việc chấm điểm polygon cũng không tạo lại bitmap mask.
- Hiển thị checkpoint `📍` tại frame cuối cùng đã làm trong từng clip.
- Mỗi clip có ba nút trạng thái: **Done**, **Not checked** và **In progress**. Chọn nút nào sẽ chuyển toàn bộ frame trong clip sang trạng thái đó. Trạng thái đang áp dụng cho cả clip được làm nổi bật và khóa; mỗi thao tác chạy tối đa 4 request song song.
- Khi kiểm tra lại, nhấn **V** để chọn/bỏ chọn frame Done đang xem. Frame được chọn có dấu `✓ V` trong danh sách và ô đếm trên ảnh. Nhấn `Ctrl+B` để chuyển tất cả frame đã chọn sang **In progress** rồi sửa lại; mask và tag hiện có được giữ nguyên.
- Với seatbelt: `N` vẽ polygon thêm và `M` vẽ vùng xóa màu đỏ. Ở cả hai chế độ, có thể chấm vào nền đen ngoài ảnh; point được ghim vào mép ảnh gần nhất như CVAT. Khép vùng `N` là tạo mask ngay và thoát chế độ vẽ; sau khi khép vùng `M` vẫn giữ vùng đỏ đến khi nhấn `Esc`.
- **1 Point SAM**: chuột trái chấm điểm cộng (+), chuột phải chấm điểm trừ (−). Khi có vùng xanh lá, nhấn **R** để thêm vùng đó vào mask. **F** đổi Done/In progress; **Space** chạy/dừng video. Khi dùng `N`/`M`, chuột phải vẫn khép polygon.
- **K** ẩn/hiện mask seatbelt hoặc eye 15pt ngay cả khi frame đang **In progress**. Thao tác này chỉ đổi hiển thị, không xóa dữ liệu và không đổi trạng thái frame.
- Với eye 15pt, `Ctrl+B` sao chép mắt đang chọn hoặc tất cả mắt sang các frame trước/sau trong cùng clip; frame Done được bỏ qua và frame Not checked được chuyển sang In progress sau khi lưu.
- Với body, head, face, nose, mouth, eye, hand, cigarette, e-cigarette, phone, can, bottle và mask, `Ctrl+B` có hai lựa chọn: **Chỉ box mới thêm** sẽ chồng box vừa tạo và giữ các box đang có ở frame đích; **Toàn bộ box hiện tại** sẽ thay toàn bộ danh sách box ở frame đích bằng dữ liệu của frame nguồn. Face 7pt sao chép toàn bộ cụm điểm hiện tại.
- Với các label dạng bbox ở trên, nhấn `N`, click góc đầu, di chuyển chuột mà không cần giữ nút rồi click góc đối diện để tạo box mới; `Shift + kéo` cũ đã được tắt. Nhấn `M` để vẽ vùng xóa màu đỏ giống seatbelt M: polygon có nền đỏ mờ và điểm đỏ, bấm chuột phải hoặc chạm lại điểm đầu để xóa mọi box nằm trong vùng, và vùng đỏ tiếp tục hiển thị cho đến khi nhấn `Esc`. Click trái một lần vào vùng trống chỉ bỏ chọn và không còn tạo các điểm nét đứt.
- Khi đang di chuyển hoặc co giãn bbox, box được phép đi theo chuột vượt ra ngoài ảnh như CVAT. Khi thả chuột, phần bbox nằm ngoài ảnh bị cắt tại mép trái, phải, trên hoặc dưới; các cạnh vẫn còn trong ảnh giữ nguyên vị trí nên kích thước box được tính lại và có thể nhỏ hơn.
- Khi ở label **body**, **hand** hoặc **eye box**: `X` xóa toàn bộ box trên frame (`Shift+X` xóa toàn bộ rồi sang frame sau), `1` xóa box bên trái, `2` xóa box bên phải, `C` lấy toàn bộ box từ frame vừa xem (`Shift+C` lấy box rồi sang frame sau), `Ctrl+C` / `Ctrl+V` copy và dán giữa các frame không liền nhau, `V` đánh dấu frame, `Ctrl+B` áp dụng thao tác gần nhất cho số frame, đến `end` hoặc các frame đã đánh dấu, và `Z` hoàn tác. Một lần `Z` hoàn tác toàn bộ một đợt hàng loạt.
- Các phím thao tác trên hoạt động trực tiếp trên ảnh; bảng phím tắt nổi ở cuối màn hình đã được bỏ.
- Với **body**, **hand** và **eye box** có nhiều box, click một box rồi nhấn `Ctrl+B` để chỉ sao chép box đó. Ở mỗi frame đích, box cùng thứ tự trái/phải được thay thế và các box còn lại được giữ nguyên. `Ctrl+C` / `Ctrl+V` cũng dùng box đang chọn theo cùng quy tắc.
- Với **body**, double-click ô giữa cạnh trên/phải/dưới/trái để chọn riêng cạnh đó, sau đó kéo. Cạnh gốc màu trắng vẫn hiển thị, cạnh mới màu xanh. `Ctrl+B` đặt cạnh tương ứng của mọi frame đích vào đúng tọa độ tuyệt đối của đường xanh; ba cạnh còn lại của từng body box giữ nguyên.
- Kéo vùng trống trong khung nét đứt để di chuyển cả 15 điểm; giữ `Ctrl` và kéo để xoay cả mắt quanh tâm. Kéo ô vuông trên cạnh/góc để co giãn cả cụm mắt; kéo trực tiếp một điểm vẫn chỉ sửa điểm đó.
- Giữ khung nét đứt của SAM3 khi chuyển frame và quay lại. Frame chưa mở trong cùng clip dùng khung hiện tại; frame đã chỉnh khung riêng vẫn nhớ khung của nó. Khung không tự co lại theo đoạn mask nhỏ vừa thêm.
- `Z` hoàn tác điểm vừa chấm hoặc thao tác sửa mask gần nhất ở frame hiện tại. Với body/hand/eye box, `Z` hoàn tác thao tác bbox gần nhất và khôi phục toàn bộ các frame nếu thao tác đó là một đợt `Ctrl+B`.
- `Ctrl+B` áp dụng polygon vừa vẽ, phần mask mới thêm bằng SAM3 hoặc toàn bộ segment hiện tại sang các frame trước/sau trong cùng clip. Sau khi thêm mask bằng SAM3, mặc định chỉ chồng phần mới thêm và giữ mask cũ của frame đích. Vùng đỏ chỉ xóa phần seatbelt bên trong polygon và giữ nguyên phần bên ngoài. Frame Done được bỏ qua.
- `Esc` hoặc **Hủy** bỏ polygon đang vẽ và vùng đang chờ áp dụng sang frame khác. Vùng cũ không hiện lại khi mở `M` hoặc `Ctrl+B`; thao tác hủy không gửi yêu cầu lưu.
- Giữ nguyên thao tác bấm frame của trang gốc. Tìm kiếm/gom clip không ghi dữ liệu; chỉ các nút trạng thái clip, polygon và Ctrl+B mới lưu thay đổi do người dùng yêu cầu.

## Cài đặt

1. Mở `chrome://extensions`.
2. Bật **Developer mode**.
3. Nếu có bản cũ, bấm **Remove**.
4. Bấm **Load unpacked**.
5. Chọn thư mục `NOTA_Labeling_Organizer_Extension` này.
6. Double-click `Install-NOTA-Updater.cmd` để bật cập nhật một click cho các phiên bản sau.
7. Tải lại trang DMS và vào màn hình **Labeling**.

## Cách dùng

1. Nhập từ khóa vào ô **Tìm part**, ví dụ `ciga`.
2. Chỉ part có tên phù hợp được hiển thị.
3. Bấm `#01`, `#02`... để xem các frame của clip đó.
4. Bấm dấu `×` hoặc nhấn `Esc` trong ô tìm kiếm để hiện lại toàn bộ part.

### Seatbelt

1. Nhấn `N`, chấm ít nhất 3 điểm rồi bấm chuột phải (hoặc bấm lại điểm đầu). Có thể chấm point ở phần nền đen ngoài ảnh; tool tự ghim point vào mép ảnh gần nhất. Mask xanh lam được tạo ngay, viền/điểm xanh biến mất và tự thoát chế độ vẽ; không cần `Enter`. Nhấn `N` để vẽ tiếp hoặc `Ctrl+B` để chồng polygon vừa tạo sang các frame khác.
2. Để xóa phần dư, nhấn `M`, chấm các điểm bao quanh phần cần xóa. Chế độ này cũng cho phép chấm ngoài ảnh và ghim point vào biên. Polygon có màu đỏ. Khép polygon để xóa phần đó ở frame hiện tại; vùng đỏ vẫn giữ để dùng `Ctrl+B`. Nhấn `Esc` khi muốn thoát vùng xóa.
3. Nhấn `Ctrl+B`, chọn hướng và nhập số frame đích hoặc `end` (đến đầu/cuối clip theo hướng đã chọn). Số frame đích không tính frame hiện tại đã sửa.
4. Nếu vừa vẽ vùng đỏ, hộp thoại tự chọn **Xóa vùng seatbelt trên nhiều frame**. Kiểm tra phạm vi rồi nhấn **Áp dụng** hoặc `Enter`.
5. Nhấn `Z` để bỏ điểm cuối khi đang vẽ, hoặc hoàn tác thao tác sửa mask gần nhất ở frame hiện tại. `Esc` thoát chế độ vẽ và bỏ vùng chờ áp dụng sang frame khác; trong hộp thoại `Ctrl+B`, **Hủy** cũng có tác dụng này.
6. Khi dùng **1 Point SAM** hoặc **2 Box SAM**, chờ vùng xanh lá xuất hiện rồi nhấn **R** để thêm vào mask. Sau đó nhấn `Ctrl+B`. Hộp thoại mặc định chọn **Chỉ phần mask mới thêm (SAM3)**: các phần segment có sẵn ở frame nguồn không bị chồng theo. Có thể chọn **Toàn bộ segment của frame hiện tại** nếu cần.
7. Tool ghi nhớ phần mới của lần **Add** gần nhất. Nếu SAM3 không thêm phần nào mới, tool sẽ báo và không tự chuyển sang chồng toàn bộ mask. Dùng `Shift+Enter` / **Subtract** thì `Ctrl+B` chỉ áp dụng phần mask vừa xóa.

### Eye 15pt

1. Chọn mắt cần thao tác trong frame nguồn rồi nhấn `Ctrl+B`.
2. Chọn **Chỉ mắt đang chọn** hoặc **Tất cả mắt của frame hiện tại**.
3. Chọn **Thay mắt cùng vị trí và giữ các mắt còn lại** để ghép theo vị trí trái/phải, hoặc **Thay toàn bộ mắt ở frame đích**.
4. Chọn hướng trước/sau, nhập số frame hoặc `end`, rồi nhấn **Áp dụng**. Phạm vi luôn nằm trong clip hiện tại và bỏ qua frame Done.
5. Kéo vùng trống bên trong khung nét đứt để di chuyển toàn bộ mắt. Giữ `Ctrl` và kéo để xoay. Kéo các ô vuông giữa cạnh để đổi chiều rộng/chiều cao, hoặc kéo ô góc để đổi cả hai chiều.
6. Nhấn `K` để ẩn/hiện toàn bộ điểm mắt khi cần nhìn ảnh rõ hơn.

### Mở lại các frame Done bị sót

1. Mở frame Done cần sửa và nhấn `V`. Nhấn `V` lần nữa nếu muốn bỏ chọn.
2. Tiếp tục mở các frame bị sót khác và nhấn `V`. Ô trên ảnh hiển thị tổng số frame đã chọn; nút **Bỏ chọn tất cả** xóa toàn bộ lựa chọn.
3. Nhấn `Ctrl+B`, kiểm tra số frame rồi chọn **Chuyển In progress** hoặc nhấn `Enter`.
4. Các frame được mở lại để sửa; mask và tag cũ không bị xóa. Có thể chọn frame ở nhiều clip trong cùng session và cùng loại label.

Chuyển sang SAM sẽ bỏ vùng polygon cũ, tránh mở nhầm chế độ xóa. `Esc` / **Hủy** cũng bỏ phần SAM3 đang chờ áp dụng sang frame khác.

Trong **1 Point SAM**, chuột phải gửi điểm trừ để SAM3 tính lại vùng xanh. **R** xác nhận khi kết quả đã sẵn sàng; nếu SAM3 đang chạy thì chờ xong rồi nhấn lại. Giữ R không lưu lặp. **F** luôn giữ chức năng đổi Done/In progress của trang gốc, kể cả khi có vùng xanh đang chờ; frame Done dùng F để mở lại trước khi sửa. **Space** giữ chức năng chạy/dừng video. `Enter` / **Add** vẫn dùng được để thêm mask; `Shift+Enter` / **Subtract** vẫn dùng để xóa theo kết quả xem trước.

Khung nét đứt là vùng xử lý **SAM3 (ROI)**, tách biệt với mask seatbelt. Kéo các điểm vuông để chỉnh khung; tool nhớ khung trong tab đang mở. Clip khác dùng khung riêng; đổi session hoặc tải lại trang sẽ bắt đầu lại. Việc ghi nhớ khung không gửi thêm request lưu lên server; `Ctrl+B` vẫn chỉ thêm/xóa phần mask đã chọn.

Polygon được lưu vào mask của frame hiện tại ngay khi khép vùng. `Esc` không hoàn tác phần đã lưu; dùng `Z` nếu cần khôi phục mask của frame đó. Trong lúc đang lưu nhiều frame, hộp thoại không cho hủy bằng `Esc`.

Seatbelt của trang được lưu dưới dạng mask, vì vậy polygon được chuyển thành vùng pixel trong mask. Thao tác thêm giữ mask cũ; thao tác xóa chỉ tác động bên trong polygon đỏ. Lưu tối đa 4 frame song song và dừng cấp việc mới khi gặp lỗi.

Extension hỗ trợ cả:

- `https://ntt.dev.nota.ai/`
- `http://10.169.1.102:8765/`
