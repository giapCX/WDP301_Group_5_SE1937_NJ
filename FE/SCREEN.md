# Màn hình danh sách xe XeDi

Từ thư mục gốc chạy `npm run dev:be` và `npm run dev:fe` (hoặc `npm run dev` sau khi cài dependency ở thư mục gốc). MongoDB cần chạy và có dữ liệu: `npm run db:seed`. FE mở tại http://localhost:3000 và proxy `/api` tới BE cổng 5000.

## Tổ chức code

- `src/pages/ListingsPage.js`: trạng thái tìm kiếm, bộ lọc, trang hiện tại, danh sách đã lưu, ghép trang.
- `src/hooks/useListings.js`: gọi API có debounce 250 ms, AbortController và chặn response cũ, xử lý tải/lỗi/thử lại.
- `src/services/listings.js`: tạo query và chuyển response API sang dữ liệu hiển thị; không lọc/sắp xếp danh sách trong FE.
- `src/data/listingFilters.js`: giá trị bộ lọc ban đầu và địa điểm.
- `src/components/layout/`, `src/components/listings/`, `src/components/ui/`: các thành phần giao diện.
- `src/styles/`: CSS theo từng phần. `src/utils/formatPrice.js`: định dạng tiền.

## Tìm kiếm và lọc

Backend hỗ trợ từ khóa tên/hãng/mẫu xe/mô tả, thành phố, khoảng giá, nhiều loại xe, nhiên liệu, hộp số, số chỗ, đời xe từ 2023; sắp xếp mới nhất/giá và phân trang 6 xe/trang. Chọn ngày để lọc booking trùng lịch và `availability_blocks`. Mặc định chưa chọn ngày và tìm trên tất cả địa điểm. Dữ liệu seed hiện có Hà Nội và Hải Phòng; chọn TP. Hồ Chí Minh có thể không có kết quả.

Danh sách đã lưu giữ ID trong phiên trang; khi bật chế độ xem đã lưu, ID được gửi tới BE qua `ids` để lọc trước khi phân trang. Không sử dụng dữ liệu xe mẫu hay fallback sang dữ liệu mẫu khi API lỗi.

Các bộ lọc tiện nghi, giao nhận, Superhost, giảm giá và đặt nhanh bị khóa vì schema hiện chưa có dữ liệu tương ứng. Không hiển thị đánh giá, khoảng cách hay huy hiệu tự tạo. Đăng nhập, đặt xe, bản đồ và nội dung chính sách chưa tích hợp.

Seed chỉ có khóa ảnh `demo/...`, chưa có file ảnh thật. Component VehicleImage hiển thị placeholder; khi có URL ảnh thật trong `photos`, ảnh tự được sử dụng. Font Be Vietnam Pro tải qua Google Fonts, có sans-serif dự phòng.

## Kiểm tra

- Tại thư mục gốc: `npm run build --prefix FE`.
- Trong FE: `node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand`.
- Trong BE: `node --test` (cần MongoDB).
