# Kiến trúc và hướng dẫn phát triển XeDi

## 1. Quyết định tổ chức code

Frontend dùng **Feature-Based Architecture**: code được đặt theo nghiệp vụ. Backend dùng **Modular Layered Architecture**: mỗi module chia thành routes, controller, service và repository.

Giữ tên `FE/` và `BE/` để các lệnh npm, cấu hình proxy và cách chạy của nhóm tiếp tục hoạt động. Dự án dùng JavaScript, React với Create React App, Express 5 và MongoDB native driver. Đây là quy ước của dự án; không gắn nhãn một chuẩn “H2Q” khi chưa có tài liệu của nhóm.

## 2. Cấu trúc hiện tại

```text
FE/src/
├── app/
│   ├── App.js                 # Gốc ứng dụng
│   ├── router.js              # Điều hướng theo hash và tiêu đề trang
│   └── App.test.js            # Kiểm thử các luồng giao diện
├── components/               # Header, footer, Icon, Modal dùng chung
├── features/
│   ├── auth/
│   │   ├── api/authApi.js
│   │   ├── hooks/useLogin.js
│   │   ├── pages/LoginPage.jsx
│   │   ├── pages/LoginPage.css
│   │   ├── session.js         # Lưu/xóa phiên và thông báo thay đổi
│   │   └── session.test.js
│   ├── home/
│   │   ├── api/homeApi.js
│   │   ├── components/IncomeCalculator.js
│   │   ├── hooks/useHomeOverview.js
│   │   └── pages/             # HomePage.js và CSS
│   └── listings/
│       ├── api/listingApi.js
│       ├── components/VehicleCard.js
│       └── hooks/useListings.js
├── services/httpClient.js    # fetch, header, Bearer token và lỗi HTTP
├── index.js                  # Điểm khởi động của Create React App
├── index.css
├── setupTests.js
└── reportWebVitals.js

BE/
├── data/                     # Dataset JSON của nhóm
├── scripts/                  # Setup và seed database
├── src/
│   ├── config/               # env và kết nối database
│   ├── database/             # Khai báo collection/index
│   ├── modules/
│   │   ├── auth/             # auth.{routes,controller,service,repository}.js
│   │   ├── listings/         # listing.{routes,controller,service,repository}.js
│   │   └── homepage/         # homepage.{routes,controller,service,repository}.js
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   └── error.middleware.js
│   ├── utils/httpError.js
│   ├── app.js                # Ghép middleware và router
│   └── server.js             # Kết nối DB, mở cổng và đóng kết nối
└── test/                     # API integration và middleware tests
```

Chỉ tạo thư mục khi có code sử dụng. Chưa cần tạo module `bookings` hoặc thêm thư mục `hooks`, `utils` chung khi chưa có logic dùng chung tương ứng. Ảnh tĩnh hiện nằm trong `FE/public/`; không cần chuyển sang `assets` chỉ để giống một sơ đồ mẫu.

## 3. Quy tắc frontend

| Vị trí | Trách nhiệm | Ví dụ |
| --- | --- | --- |
| `app/` | Ghép ứng dụng, điều hướng | `#/login` mở trang đăng nhập |
| `features/<name>/pages/` | Bố cục và trạng thái giao diện của trang | Tab đăng nhập/đăng ký, bộ lọc đang chọn |
| `features/<name>/components/` | Thành phần giao diện thuộc feature | `VehicleCard`, `IncomeCalculator` |
| `features/<name>/hooks/` | Luồng tải dữ liệu, loading, lỗi, retry, cleanup | `useListings`, `useLogin` |
| `features/<name>/api/` | Endpoint và tham số API của feature | `getListings(params, options)` |
| `components/` | Thành phần giao diện dùng chung | `Modal`, `SiteHeader` |
| `services/` | Cơ chế giao tiếp HTTP | `getApi`, `postApi` |

Luồng thông thường: **Page → Hook → Feature API → HTTP client → Backend**.

- Không gọi `fetch` trực tiếp trong page/component. Endpoint thuộc feature API, cơ chế HTTP thuộc `httpClient.js`.
- Hook tải dữ liệu phải cleanup khi dependency thay đổi hoặc component unmount. Các hook danh sách hiện dùng `AbortController`.
- CSS của trang đặt cạnh trang. Giữ phạm vi `.login-page` của giao diện đăng nhập để tránh ảnh hưởng trang chủ.
- `home` được phép sử dụng API/hook/component của `listings`, vì trang chủ hiển thị danh sách xe. `listings` không import ngược về `home`.
- `SiteHeader` dùng tiện ích phiên của `auth` để hiển thị tài khoản và đăng xuất. Những thành phần nền tảng như `Icon`, `Modal` không phụ thuộc feature.
- Giữ object `filters` truyền vào `useListings` ổn định qua các lần render; hiện tại chúng được khai báo trong mảng `categories` ngoài component.
- Không thêm Context/provider hoặc thư viện router nếu chưa có nhu cầu. Khi có nhiều route hoặc trạng thái xác thực dùng rộng hơn, thống nhất cách nâng cấp trong nhóm trước khi triển khai.

Phiên đăng nhập được quản lý tại `features/auth/session.js`. Chế độ ghi nhớ dùng `localStorage`; chế độ theo phiên dùng `sessionStorage`. Khi lưu tài khoản mới, xóa dữ liệu xác thực ở cả hai nơi để không đọc nhầm tài khoản cũ. Event `xedi:session` cập nhật header trong cùng tab; event `storage` hỗ trợ thay đổi storage giữa các tab theo cơ chế trình duyệt.

## 4. Quy tắc backend

| Layer | Trách nhiệm | Không đặt ở đây |
| --- | --- | --- |
| Routes | Khai báo endpoint, gắn middleware, ghép dependency của module | Nghiệp vụ, truy vấn DB |
| Controller | Đọc body/query/params/header, gọi service, trả JSON | bcrypt, JWT, aggregate pipeline |
| Service | Kiểm tra đầu vào, áp dụng nghiệp vụ, gọi repository | `request`, `response`, gọi collection trực tiếp |
| Repository | Query MongoDB, projection, aggregate và ghi dữ liệu | Trả HTTP response |
| Middleware | Xác thực, route không tồn tại, xử lý lỗi tập trung | Nghiệp vụ của từng endpoint |

Luồng thông thường: **Routes → Controller → Service → Repository → MongoDB**.

Các factory nhận dependency tường minh. Ví dụ:

```js
const repository = createListingRepository(database);
const service = createListingService(repository);
const controller = createListingController(service);
router.get('/', controller.list);
```

- Kết nối MongoDB được tạo tại startup và truyền vào module; không mở kết nối mới cho mỗi request.
- Controller async để Express 5 chuyển lỗi sang middleware xử lý lỗi. Service có thể `throw httpError(400, '...')`; không gửi response trong service.
- `errorHandler` giữ định dạng `{ error: { message } }` và ẩn nội dung lỗi nội bộ khi trả 500.
- Middleware xác thực lấy từ `middlewares/auth.middleware.js`; gắn trước controller ở các route cần bảo vệ. Các route hiện tại giữ nguyên yêu cầu xác thực của chúng.
- Lỗi database phải đi tiếp tới error handler; không quy mọi lỗi thành token sai.
- Query `listings` giữ projection dữ liệu công khai để không lộ giấy tờ, VIN hoặc thông tin nội bộ của xe.
- Homepage cần thống kê cùng tập xe công khai với listings, nên repository homepage tái sử dụng `publicListingPipeline` của repository listings. Đây là phụ thuộc đọc có chủ đích; không import router/controller của module khác.
- Khi bổ sung nghiệp vụ giao dịch nhiều module, phối hợp ở service. Repository không gọi controller hoặc trả JSON theo Express.

## 5. Ví dụ luồng đăng nhập

1. `LoginPage` thu thập account, password và lựa chọn ghi nhớ.
2. `useLogin` gọi `authApi.login`, cập nhật loading và thông báo.
3. `httpClient.postApi` gửi `POST /api/auth/login`.
4. Router gọi controller; controller chuyển body cho `auth.service`.
5. Service kiểm tra đầu vào, lấy người dùng qua repository, kiểm tra trạng thái/mật khẩu và tải quyền.
6. Repository truy vấn collection `users`, `roles`; service tạo JWT và dữ liệu user công khai.
7. Controller trả response hiện có; hook lưu phiên rồi chuyển về trang chủ.

URL, mã HTTP và cấu trúc JSON hiện có được giữ để frontend/backend tiếp tục tương thích.

## 6. Thêm chức năng mới trong nhóm

Ví dụ triển khai đặt xe:

1. Thống nhất API, quyền truy cập, request/response và điều kiện thất bại trước khi chia việc.
2. Tạo `BE/src/modules/bookings/` với các lớp thực sự cần. Đặt kiểm tra lịch, trạng thái và chính sách trong service; truy vấn/ghi dữ liệu trong repository.
3. Mount router tại `BE/src/app.js`; thêm middleware xác thực cho endpoint yêu cầu đăng nhập.
4. Tạo `FE/src/features/bookings/` với `api`, `hooks`, `pages`, `components` theo nhu cầu. Ghép route ở `FE/src/app/router.js`.
5. Thêm test cho hành vi quan trọng: đặt trùng lịch, thiếu quyền, lỗi server và thành công. Cập nhật bảng API trong README.
6. Chạy test và build trước khi mở pull request. PR mô tả hành vi thay đổi, cách kiểm tra và các bước cấu hình nếu có.

Chia công việc theo feature, thống nhất sớm khi nhiều người cùng sửa `app.js`, `router.js`, `httpClient.js`, CSS chung hoặc hợp đồng API. Dùng tên component/page PascalCase, hook bắt đầu bằng `use`, file backend theo mẫu `<module>.<layer>.js`; giữ ES modules nhất quán.

## 7. Lệnh chạy và kiểm tra

Chạy từ thư mục gốc:

```powershell
npm run install:all
# Chỉ copy khi BE/.env chưa tồn tại:
Copy-Item BE/.env.example BE/.env
npm run db:seed
npm run dev
```

```powershell
npm test --prefix BE
npm test --prefix FE -- --watchAll=false --runInBand
npm run build
```

Backend integration test cần MongoDB hoạt động và dữ liệu đã seed. Test auth có thể cập nhật hash mật khẩu của tài khoản mẫu, đồng thời tạo/xóa tài khoản tạm. Dùng database phát triển hoặc database test có dataset tương ứng; không trỏ test vào dữ liệu production. Có thể đặt `MONGODB_DB_NAME` cho database test trước khi seed và chạy test.

## 8. Phạm vi còn lại

- Form đăng ký hiện chỉ thông báo chưa khả dụng; refactor không bổ sung endpoint đăng ký.
- Logout hiện xóa phiên ở trình duyệt; JWT đã cấp chưa có cơ chế thu hồi phía server.
- Cơ chế mật khẩu mặc định cho tài khoản seed và JWT secret dự phòng được giữ nguyên từ code cũ. Đây là các phần cần thay đổi khi triển khai xác thực production.
- `HomePage` và `LoginPage` vẫn chứa nhiều JSX. Có thể tiếp tục tách các khối giao diện khi phát triển chức năng liên quan; logic HTTP và tải dữ liệu đã được đưa ra khỏi page.
- Việc tìm xe trống không giữ chỗ. Luồng tạo booking sau này phải kiểm tra lại lịch và xử lý tranh chấp đồng thời.

## 9. Feature gara và quản lý

- Frontend Garage Staff đặt trong `FE/src/features/garage/`; feature Manager đặt trong `FE/src/features/manager/`. Các feature sở hữu page, component, hook, dữ liệu, styles và API client của mình; primitive dùng chung tiếp tục nằm trong `FE/src/components/` và HTTP transport nằm trong `FE/src/services/httpClient.js`.
- Backend Garage Staff đặt trong `BE/src/modules/garage/{intakes,inspections}/`, với routes, controller, service, repository và validator theo luồng.
- Backend Manager đặt trong `BE/src/modules/manager/`. Quy tắc mới tiếp tục tách endpoint binding, điều phối HTTP, nghiệp vụ và truy cập MongoDB theo các layer routes/controller/service/repository; không đưa thêm truy vấn trực tiếp vào route khi mở rộng API.
