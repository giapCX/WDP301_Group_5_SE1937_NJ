# Mẫu hợp đồng XeDi

Hai PDF được đặt trực tiếp trong `docs/`:

- [Hợp đồng thuê xe tự lái cho Renter](../MAU_HOP_DONG_THUE_XE_RENTER.pdf).
- [Hợp đồng quản lý xe và ủy quyền cho thuê cho Owner](../MAU_HOP_DONG_QUAN_LY_XE_OWNER.pdf).

Đây là mẫu có khoảng trống để điền và in ký, phục vụ đồ án; không phải hợp đồng đã ký hoặc tài liệu chứng minh giao dịch thật. Chưa gắn với chức năng tạo PDF, upload hợp đồng hoặc OTP của ứng dụng. XeDi là tên sản phẩm, không được tự dùng thay tên pháp nhân có thẩm quyền ký.

## Trước khi sử dụng

1. Điền đầy đủ danh tính, tư cách đại diện, thông tin xe, mã hợp đồng/booking, thời hạn và gara. Hợp đồng thuê để chủ xe là bên cho thuê, pháp nhân XeDi ký với tư cách đại diện theo hợp đồng quản lý/ủy quyền hợp lệ; cần rà soát mô hình pháp lý trước vận hành thật.
2. Chốt giá, tiền cọc, thuế/phí, bảo hiểm, hạn mức và Phụ lục A. Không dùng ô để trống làm căn cứ thu phí hoặc mở rộng quyền đại diện. Các số liệu 48 giờ, 30 phút, 3 ngày làm việc, 24 giờ và 100.000 VND là chính sách baseline dự án, không phải ngưỡng pháp luật ấn định.
3. Hợp đồng Owner mới ghi tham chiếu baseline hoa hồng 10%; tỷ lệ thực tế phải điền và được chấp thuận. Seed cũ có thể là 15%, không sửa hồi tố hợp đồng đã ký. Chốt biểu phí theo nội dung hợp đồng, không lấy cấu hình mới đè nội dung đã ký.
4. Khi ký giấy: lưu bản đã ký và bằng chứng giao nhận theo quyền truy cập. Khi triển khai ký điện tử: cần quy trình xác minh, lưu phiên bản nội dung, dấu thời gian và bằng chứng chấp thuận; OTP demo không mặc nhiên là chữ ký số hay chứng nhận hiệu lực pháp lý.
5. Rà soát pháp lý, bảo hiểm, thuế, bảo vệ người tiêu dùng và dữ liệu cá nhân trước sử dụng thực tế. Các mẫu không khẳng định việc ký giấy hoặc OTP luôn đủ điều kiện cho mọi trường hợp ủy quyền.

## Ánh xạ vào dữ liệu hiện tại

| Mẫu | Collection và các trường chính |
| --- | --- |
| Owner | `management_agreements`: `agreement_number`, `vehicle_id`, `owner_id`, `platform_signer_id`, `start_date`, `end_date`, `commission_rate_pct`, `authorization_scope`, `signature_info`, `signed_document_key` |
| Renter | `rental_agreements`: `contract_number`, `booking_id`, `management_agreement_id`, `lender_details_snapshot`, `renter_details_snapshot`, `terms_snapshot`, `signing_info`, `signed_document_key` |

Mẫu thể hiện đặc tả đích, không có nghĩa schema/API hiện tại đã lưu đủ tất cả nội dung. Các phần biểu phí, phạm vi bảo hiểm, chứng cứ xác nhận, phiên bản và toàn văn cần được lưu bất biến hoặc bổ sung schema khi triển khai. Biên bản giao/nhận là tài liệu riêng, không được dùng hợp đồng trắng thay bằng chứng giao xe thực tế.

## Tạo lại PDF

Cài `reportlab`, dùng Arial trên Windows hoặc DejaVu Sans trên Linux:

```powershell
python -m pip install reportlab
python docs/templates/generate_contract_templates.py
```

Script ghi đè hai PDF mẫu, không truy cập database, Cloudinary hoặc `.env`. Sau khi sửa nội dung cần render và kiểm tra lại từng trang trước khi dùng.

## Cơ sở tham khảo

- [Luồng nghiệp vụ dự án](../OFFICIAL_BUSINESS_FLOWS.md), phiên bản 1.0: F05, F09-F20 và các quy tắc tại mục 2. Đây là nguồn quyết định chính sách sản phẩm trong mẫu.
- [Bộ luật Dân sự 2015 trên cổng Bộ Quốc phòng](https://btllang.mod.gov.vn/van-ban/vbpq-do-nha-nuoc-ban-hanh/5001-bo-luat-dan-su-2015.html): tham khảo khái niệm thuê tài sản và ủy quyền, không sao chép toàn văn.
- [Luật Giao dịch điện tử số 20/2023/QH15 trên Cổng Chính phủ](https://vanban.chinhphu.vn/?classid=1&docid=208421&pageid=27160&typegroupid=3): tham khảo về giao dịch điện tử; cần kiểm tra các sửa đổi và văn bản áp dụng tại thời điểm triển khai thực tế.

Nguồn tham khảo được kiểm tra ngày 10/11/2026. Không diễn giải chính sách demo thành quy định bắt buộc của pháp luật.
