# Kiến trúc và hướng dẫn phát triển XeDi

## 1. Quyết định tổ chức code

Frontend dùng **Feature-Based Architecture**: code được đặt theo nghiệp vụ. Backend dùng **Layered Architecture**: routes, controller, service, repositories, models, middleware, validators, utils và config nằm trong các thư mục riêng. Tên file cho biết nghiệp vụ, ví dụ `garage-inspection.controller.js`.

Giữ tên `FE/` và `BE/` để các lệnh npm, cấu hình proxy và cách chạy của nhóm tiếp tục hoạt động. Dự án dùng JavaScript, React với Create React App, Express 5 và Mongoose 9 để truy cập MongoDB.

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
│   ├── garage/               # Garage page, components, hooks and styles
│   ├── manager/              # Manager dashboard feature
│   └── owner/
│       ├── api/ownerApi.js
│       ├── components/RegistrationDialog.js
│       ├── hooks/            # Owner dashboard and registration flows
│       └── pages/            # OwnerPage.js and owner.css
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
│   ├── database/             # Index, khởi tạo collection và seed
│   ├── models/               # 19 schema/model Mongoose, đăng ký theo connection
│   ├── routes/               # auth, listing, homepage, garage-intake, garage-inspection, manager, owner
│   ├── controller/           # Nhận request, gọi service, trả response
│   ├── service/              # Nghiệp vụ và điều phối transaction
│   ├── repositories/         # Truy cập model và base.repository.js dùng chung
│   ├── validators/           # Kiểm tra đầu vào listing và Garage
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── garage-auth.middleware.js
│   │   └── error.middleware.js
│   ├── utils/http-error.js
│   ├── app.js                # Ghép middleware và router
│   └── server.js             # Kết nối DB, mở cổng và đóng kết nối
└── test/                     # API integration và middleware tests
```

Chỉ tạo thư mục khi có code sử dụng. Khi thêm nghiệp vụ, đặt từng file vào thư mục đúng tầng thay vì tạo lại `src/modules/`. Ảnh tĩnh hiện nằm trong `FE/public/`.

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
| Model | Kiểu dữ liệu, ref, required, enum và validation document | Quyết định nghiệp vụ, xử lý HTTP |
| Middleware | Xác thực, route không tồn tại, xử lý lỗi tập trung | Nghiệp vụ của từng endpoint |

Luồng thông thường: **Routes → Controller → Service → Repository → Mongoose Model → MongoDB**.

Các factory nhận dependency tường minh. Ví dụ:

```js
const repository = createListingRepository(database);
const service = createListingService(repository);
const controller = createListingController(service);
router.get('/', controller.list);
```

- `connectDatabase()` trả về Mongoose `Connection`, được tạo tại startup và truyền vào module; không mở kết nối mới cho mỗi request. Tên biến `database` ở các factory hiện có cũng chỉ connection này.
- Controller async để Express 5 chuyển lỗi sang middleware xử lý lỗi. Service có thể `throw httpError(400, '...')`; không gửi response trong service.
- `errorHandler` giữ định dạng `{ error: { message, details? } }`, trả 400 cho lỗi schema/cast, 409 cho trùng khóa và ẩn nội dung lỗi nội bộ khi trả 500.
- Middleware xác thực lấy từ `middleware/auth.middleware.js`; gắn trước controller ở các route cần bảo vệ. Các route hiện tại giữ nguyên yêu cầu xác thực của chúng.
- Lỗi database phải đi tiếp tới error handler; không quy mọi lỗi thành token sai.
- Query `listings` giữ projection dữ liệu công khai để không lộ giấy tờ, VIN hoặc thông tin nội bộ của xe.
- Homepage cần thống kê cùng tập xe công khai với listings, nên repository homepage tái sử dụng `publicListingPipeline` của repository listings. Đây là phụ thuộc đọc có chủ đích; không import router/controller của module khác.
- Khi bổ sung nghiệp vụ giao dịch nhiều module, phối hợp ở service. Repository không gọi controller hoặc trả JSON theo Express.

### Mongoose và dữ liệu hiện có

- Mỗi file `models/<entity>.model.js` định nghĩa schema. `getModels(connection)` trong `models/index.js` đăng ký model trên đúng connection, ánh xạ tên collection tường minh và tránh đăng ký trùng.
- `database/indexes.js` giữ tên collection và các index hiện có. Index được gắn vào schema; `db:setup` dùng `createCollection()`/`createIndexes()`, không dùng `syncIndexes()` để tránh xóa index bổ sung.
- `repositories/base.repository.js` tập trung thao tác Mongoose dùng chung. Đọc dùng `lean()`, ghi mới dùng document `save()`, cập nhật bật `runValidators`. Repository của từng nghiệp vụ chọn các model cần dùng; service không gọi raw collection.
- Schema dùng `strict: 'throw'`, subdocument không tự sinh `_id`, không thêm `__v`, timestamp hoặc default array/status vào dữ liệu cũ. Các mốc thời gian và version nghiệp vụ vẫn do service quản lý.
- `config` của policy, `sanitized_changes` của audit và `provider_response` dùng `Mixed` vì payload thay đổi theo loại nghiệp vụ. Các trường và subdocument còn lại có kiểu dữ liệu cụ thể. Quy tắc liên collection và điều kiện gửi/xác nhận vẫn nằm trong service.
- Bản nháp Garage được phép thiếu trường báo cáo. Biên bản tiếp nhận seed không có `status` vẫn được hiểu là đã hoàn tất; không tự gán thành nháp. Giá trị tình trạng cũ như `clean`, `normal`, `no_new_damage` được giữ nguyên.
- Transaction dùng `await connection.startSession()`, truyền cùng session qua mọi thao tác, giữ kiểm tra version và cơ chế gửi/xác nhận lặp an toàn.
- `database/seed.js` đọc EJSON bằng BSON đi cùng Mongoose, validate toàn bộ dataset trước khi ghi, rồi dùng `$setOnInsert`. Chạy lại seed giữ nguyên bản ghi đã tồn tại.

Khi cập nhật code trên máy khác, chạy `npm ci --prefix BE`, sau đó `npm run db:setup` để bảo đảm index và `npm run dev:be`. Database hiện có tiếp tục dùng được; không cần seed lại để chuyển sang Mongoose.

Tham khảo chính thức: [Mongoose connections](https://mongoosejs.com/docs/connections.html), [validation](https://mongoosejs.com/docs/validation.html), [transactions](https://mongoosejs.com/docs/transactions.html).

## 5. Ví dụ luồng đăng nhập

1. `LoginPage` thu thập account, password và lựa chọn ghi nhớ.
2. `useLogin` gọi `authApi.login`, cập nhật loading và thông báo.
3. `httpClient.postApi` gửi `POST /api/auth/login`.
4. Router gọi controller; controller chuyển body cho `auth.service`.
5. Service kiểm tra đầu vào, lấy người dùng qua repository, kiểm tra trạng thái/mật khẩu và tải quyền.
6. Repository truy vấn model `User`, `Role`; service tạo JWT và dữ liệu user công khai.
7. Controller trả response hiện có; hook lưu phiên rồi chuyển theo quyền về trang Manager, Garage hoặc trang chủ.

URL, mã HTTP và cấu trúc JSON hiện có được giữ để frontend/backend tiếp tục tương thích.

## 6. Thêm chức năng mới trong nhóm

Ví dụ triển khai đặt xe:

1. Thống nhất API, quyền truy cập, request/response và điều kiện thất bại trước khi chia việc.
2. Tạo `routes/booking.routes.js`, `controller/booking.controller.js`, `service/booking.service.js`, `repositories/booking.repository.js` và validator nếu cần, trong `BE/src/`. Dùng schema tại `models/booking.model.js`. Đặt kiểm tra lịch, trạng thái và chính sách trong service; truy vấn/ghi dữ liệu trong repository.
3. Mount router tại `BE/src/app.js`; thêm middleware xác thực cho endpoint yêu cầu đăng nhập.
4. Tạo `FE/src/features/bookings/` với `api`, `hooks`, `pages`, `components` theo nhu cầu. Ghép route ở `FE/src/app/router.js`.
5. Thêm test cho hành vi quan trọng: đặt trùng lịch, thiếu quyền, lỗi server và thành công. Cập nhật bảng API trong README.
6. Chạy test và build trước khi mở pull request. PR mô tả hành vi thay đổi, cách kiểm tra và các bước cấu hình nếu có.

Chia công việc theo feature, thống nhất sớm khi nhiều người cùng sửa `app.js`, `router.js`, `httpClient.js`, CSS chung hoặc hợp đồng API. Dùng tên component/page PascalCase, hook bắt đầu bằng `use`, file backend theo mẫu `<nghiệp-vụ>.<layer>.js`; giữ ES modules nhất quán. Các file cùng nghiệp vụ có cùng tiền tố ở mọi tầng.

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

Backend integration test tự tạo replica set tạm bằng `mongod`, database mang tên ngẫu nhiên và tự dọn sau khi chạy; không ghi vào database ứng dụng. Test API/auth/Manager tự seed database tạm qua các model Mongoose. Cần cài MongoDB Server hoặc đặt `MONGOD_BINARY`; có thể dùng `INTAKE_TEST_MONGODB_URI` trỏ tới replica set dành cho kiểm thử. Test model kiểm tra cả 19 dataset, giữ nguyên BSON và dữ liệu cũ; test database kiểm tra seed lặp và validation khi update.

## 8. Phạm vi còn lại

- Form đăng ký hiện chỉ thông báo chưa khả dụng; refactor không bổ sung endpoint đăng ký.
- Logout hiện xóa phiên ở trình duyệt; JWT đã cấp chưa có cơ chế thu hồi phía server.
- Cơ chế mật khẩu mặc định cho tài khoản seed và JWT secret dự phòng được giữ nguyên từ code cũ. Đây là các phần cần thay đổi khi triển khai xác thực production.
- `HomePage` và `LoginPage` vẫn chứa nhiều JSX. Có thể tiếp tục tách các khối giao diện khi phát triển chức năng liên quan; logic HTTP và tải dữ liệu đã được đưa ra khỏi page.
- Việc tìm xe trống không giữ chỗ. Luồng tạo booking sau này phải kiểm tra lại lịch và xử lý tranh chấp đồng thời.

## 9. Feature gara và quản lý

- Frontend Garage Staff đặt trong `FE/src/features/garage/`; feature Manager đặt trong `FE/src/features/manager/`. Các feature sở hữu page, component, hook, dữ liệu, styles và API client của mình; primitive dùng chung tiếp tục nằm trong `FE/src/components/` và HTTP transport nằm trong `FE/src/services/httpClient.js`.
- Backend Garage Staff dùng các nhóm `garage-intake`, `garage-inspection`, `garage-handover`, `garage-incident`, `garage-photo` và `garage-workspace`, đặt trong các thư mục tầng tương ứng. Model nghiệp vụ vẫn nằm tại `models/`; tệp ảnh đi qua repository Cloudinary riêng tư (`authenticated`), không được phục vụ bằng public static.
- Frontend Garage dùng `api/garageApi.js → services/httpClient.js`; `hooks/useGarageWorkspace.js` điều phối tải lại và lưu dữ liệu. Không dùng dữ liệu demo/localStorage cho nghiệp vụ. `GarageReportDialog` giữ lỗi và ngăn gửi lặp trong lúc đang lưu; chỉ đóng sau khi API thành công. Sau khi tạo nháp, hook giữ recordId/version để không tạo nháp mới nếu gửi bước cuối thất bại.
- Workspace tổng hợp danh sách theo permission hiện tại, không coi danh sách chung là công việc đã được phân công. Lịch sử lấy audit và cập nhật nháp gần nhất. Các quyền inspection/intake/handover/case được kiểm tra độc lập ở backend; nháp của người khác chỉ được xem.
- Xác nhận bàn giao/nhận trả cập nhật biên bản, booking, xe, sự cố phát sinh và audit trong cùng transaction. Mỗi booking/type chỉ có một handover; version và replay ngăn xác nhận lặp. Trả xe có hư hỏng mới đưa xe về maintenance; Garage không quyết định bồi thường hoặc hoàn cọc.
- Hướng dẫn endpoint, lưu ảnh, thử lại và yêu cầu replica set: [Garage Staff](../BE/docs/garage-staff.md). Luồng duyệt của Manager được giữ cho giai đoạn sau.
- Backend Manager dùng các file `manager.*.js` ở từng thư mục tầng. Controller chỉ điều phối HTTP; nghiệp vụ nằm trong service và truy cập dữ liệu đi qua repository/model.
- Backend Owner dùng `owner.routes.js`, `owner.controller.js`, `owner.service.js` và `owner.repository.js` theo đúng các tầng; repository tệp Cloudinary được ghép dependency tại route, còn dữ liệu nghiệp vụ vẫn qua Mongoose.
- `POST /api/owner/vehicles` lưu giấy đăng ký, đăng kiểm, bảo hiểm và ảnh dưới dạng asset Cloudinary riêng tư (`authenticated`); MongoDB chỉ lưu key. Xe được gửi sang kiểm định với trạng thái `submitted`. Xác nhận điều khoản lưu chữ ký điện tử, phiên bản hợp đồng, thời điểm ký và audit log.
- Dashboard Owner chỉ đọc xe, đối soát và hợp đồng theo `owner_id` của phiên JWT. Schema Vehicle và ManagementAgreement khai báo đầy đủ các trường do luồng Owner ghi.
- `BE/test/owner.test.js` kiểm tra role, cô lập dữ liệu theo Owner, upload hồ sơ, ký hợp đồng và trạng thái xe đã gửi kiểm định.
- eKYC Renter đặt tại `identity-verification.*`: Renter nộp CCCD/hộ chiếu và bằng lái; file vào Cloudinary private, MongoDB chỉ giữ key, số giấy tờ được che khi trả API. Vì chưa cấu hình nhà cung cấp eKYC, trạng thái ban đầu là `pending` và Manager xét duyệt cùng lúc hai giấy tờ thành `verified`, `revision_required` hoặc `rejected`, luôn kèm lý do cho quyết định bất lợi. Không gắn nhãn tự động xác minh khi chưa có provider thật.
- Manager có endpoint tải tài liệu xe/eKYC qua JWT và phản hồi `private, no-store`; không trả URL Cloudinary công khai. Duyệt xe yêu cầu đủ đăng ký, đăng kiểm, bảo hiểm và biên bản kiểm định đạt; quyết định đồng thời cập nhật trạng thái xác minh từng giấy tờ, lịch sử và audit log.
