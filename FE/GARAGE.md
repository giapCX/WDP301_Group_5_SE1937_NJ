# Garage Staff — bản thử nghiệm frontend

Mở **http://localhost:3000/garage** sau khi chạy `npm start --prefix FE` từ thư mục gốc. Trang thuê xe vẫn ở `/`.

## Màn hình và thao tác

- Tổng quan: số công việc, lịch hẹn, tiến độ và hoạt động gần đây, tính từ dữ liệu đang hiển thị.
- Kiểm định: xem phân công, lập biên bản ngoại/nội thất, động cơ, lốp, số km và nhiên liệu/pin; lưu nháp hoặc gửi đề xuất cho Manager.
- Tiếp nhận: đối chiếu thông tin chủ xe/hợp đồng, ghi nhận hiện trạng, xác nhận chủ xe bàn giao.
- Bàn giao: kiểm tra điều kiện, lập biên bản và ghi nhận khách thuê xác nhận nhận xe.
- Nhận trả: so sánh số km/nhiên liệu lúc giao, ghi tình trạng nhận trả. Bất thường tạo báo cáo sự cố trong bản thử nghiệm.
- Báo cáo sự cố: tạo báo cáo có mức độ, mô tả, ảnh; xem lại ở chế độ chỉ đọc.
- Lịch sử: các thao tác lưu nháp/gửi đề xuất/hoàn tất biên bản được thêm tự động.
- Tìm kiếm không dấu, lọc trạng thái/ngày hẹn và xuất danh sách CSV ở các trang nghiệp vụ.

## Kịch bản để thử

1. `GS-001`: kiểm định chờ thực hiện. Chọn đủ bốn hạng mục, đề xuất đạt rồi gửi; trạng thái là **Chờ duyệt**, không tự phê duyệt.
2. `GS-005`: bản nháp có ghi chú, có thể mở và sửa tiếp.
3. `GS-004`: tiếp nhận đủ điều kiện. `GS-008`: thiếu phê duyệt kiểm định, chỉ lưu nháp.
4. `GS-002`: bàn giao đủ điều kiện. `GS-006`: chưa xác nhận thanh toán, nút hoàn tất bị khóa.
5. `GS-003` hoặc `GS-007`: nhận trả xe, nhập số km thấp hơn lúc giao để thử kiểm tra lỗi. Ghi nhận hư hỏng kèm mô tả để thử tạo báo cáo vận hành.
6. Tải lại trang để kiểm tra giữ bản nháp. Nút **Khôi phục dữ liệu mẫu** ở cuối sidebar có hộp thoại xác nhận.

## Phạm vi và quy tắc minh họa

Chỉ là FE, chưa có đăng nhập/phân quyền, API ghi nghiệp vụ, chữ ký số, quyết định bồi thường hay hoàn cọc. Nút gửi chỉ đổi trạng thái trong trình duyệt; không gửi cho nhân viên khác. Những điều kiện bàn giao/tiếp nhận là giả định cho bản thử nghiệm, cần chốt lại trước khi triển khai BE. Ảnh hiện không bắt buộc. Không tự tính phụ phí, không phê duyệt kiểm định thay Manager.

Dữ liệu tên/xe/lịch hẹn đều là mẫu. Lịch mẫu được tạo theo ngày hiện tại ở múi giờ Asia/Bangkok; nếu giữ dữ liệu qua ngày, có thể khôi phục để nhận lịch mẫu mới. Ảnh tối đa 4 file mỗi biên bản, JPG/PNG/WebP, 500 KB/file. Dữ liệu và ảnh lưu trong localStorage với key `xedi.garage.preview.v1`. Nếu vượt dung lượng trình duyệt, trang báo lỗi và giữ thay đổi trong phiên đang mở.

## Tổ chức file

- `src/pages/GaragePage.js`: điều hướng, tìm kiếm/lọc, mở form và xuất CSV.
- `src/components/garage/`: layout, dashboard, bảng công việc, form kiểm định/giao nhận, form sự cố và đính kèm ảnh.
- `src/hooks/useGarageWorkspace.js`: đọc/lưu dữ liệu thử nghiệm, cập nhật trạng thái, tạo nhật ký và sự cố.
- `src/data/garage.js`: fixture, nhãn trạng thái, quy tắc kiểm tra dữ liệu mẫu.
- `src/styles/garage.css`: CSS riêng, được giới hạn trong không gian Garage Staff.

Kiểm tra: `npm run build --prefix FE`; trong thư mục FE chạy `node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand`.
