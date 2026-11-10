# Dữ liệu mẫu Garage và Manager

Đã giữ lịch sử xe, hợp đồng, chuyến thuê, bàn giao và tài chính có liên kết; dọn 11 sự cố chỉ có mô tả `Demo ... report, pending verification`, 18 thông báo mẫu không khớp người nhận/trạng thái, và đường dẫn ảnh chưa có file thật. Checklist cũ dùng `clean`, `normal`, `needs_attention`, `recheck_required` được đổi về `good`/`attention` theo giao diện hiện tại. Các hồ sơ yêu cầu bổ sung/từ chối có lý do cụ thể.

## Bốn ca mới

Đăng nhập Garage bằng `garage16@example.com`, Manager bằng `manager19@example.com`; mật khẩu mẫu theo cấu hình seed hiện tại. Xe thuộc lần lượt `owner01` đến `owner04`. Các ca dùng chung Garage và Manager để xem đầy đủ dữ liệu giữa hai màn hình.

| Xe | Biển số | Trạng thái ban đầu | Thử luồng |
| --- | --- | --- | --- |
| Toyota Veloz Cross | 30K-91001 | Biên bản nháp, xe đã nộp hồ sơ | Garage sửa checklist, tải ảnh thật, gửi đề xuất → Manager duyệt |
| Hyundai Stargazer | 30K-91002 | Đã gửi biên bản đạt, chờ duyệt | Manager duyệt hoặc yêu cầu bổ sung → Garage xem quyết định |
| Kia Carens | 30K-91003 | Manager yêu cầu khắc phục lốp | Garage tạo vòng kiểm định mới → gửi → Manager duyệt lại |
| Honda BR-V | 30K-91004 | Đã duyệt, hợp đồng quản lý mẫu có hiệu lực, xe còn ở chủ | Garage tiếp nhận, chủ xe xác nhận → xe vào gara |

Các ID xe kết thúc bằng `0021`–`0024`; biên bản tham chiếu đúng xe, chủ xe và nhân viên. Ca Honda có hợp đồng `MGMT-GM-2026-0004`, hoa hồng 10%, có mốc ký hai bên và quyền giữ xe. Ba ca trước chưa tạo hợp đồng quản lý. Chưa có listing/booking cho xe chưa nhập gara.

Đây là dữ liệu minh họa nghiệp vụ, không phải hồ sơ đã xác minh ngoài thực tế. Không gắn ảnh/giấy tờ giả vào các ca mới. Người demo cần tải ảnh và giấy tờ thực sự nếu muốn thử phần xem file; hợp đồng mẫu không có bản scan đính kèm.

## Cập nhật database local đã seed trước đây

`db:seed` chỉ thêm ID mới, không xóa hoặc sửa bản ghi đã tồn tại. Dùng lệnh dưới đây trong `BE` để áp dụng việc dọn dữ liệu cũ:

```powershell
node scripts/clean-garage-demo.js          # Xem trước danh sách thay đổi
node scripts/clean-garage-demo.js --apply  # Sao lưu rồi áp dụng
```

Lệnh chỉ nhận MongoDB local. Trước khi cập nhật trong transaction, lệnh lưu toàn bộ collection dưới dạng BSON Extended JSON vào `BE/storage/backups/garage-demo-.../database.ejson`, kèm metadata và bản sao `BE/data` trước khi sửa. Thư mục này được Git bỏ qua; không chia sẻ bản sao vì có dữ liệu tài khoản.

Lệnh cũng bỏ đúng 4 biên bản thử nghiệm đã xác định trên máy phát triển và các log tham chiếu chúng; hoàn tác lý do thử “không thích” ở xe VF 6 về yêu cầu kiểm định lại có căn cứ. Những ID thử nghiệm này không liên quan tài khoản hoặc giao dịch tài chính. Lệnh chỉ thêm ca mới nếu thiếu ID, không đặt lại trạng thái ca đã demo. Không dùng lại database backup như một seed công khai.
