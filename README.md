# XeDi

Ung dung thue xe tu lai: React JavaScript, Node.js, Express va MongoDB qua Mongoose.

```text
FE/                    Ung dung React hien tai
BE/
  data/                19 file JSON du lieu mau cua nhom
  scripts/             Tao collection, index va nhap du lieu
  src/config/          Cau hinh moi truong va ket noi MongoDB
  src/database/        Index, khoi tao collection va seed
  src/models/          19 schema/model Mongoose
  src/routes/          Khai bao endpoint
  src/controller/      Dieu phoi HTTP
  src/service/         Nghiep vu
  src/repositories/    Truy cap model va repository chung
  src/validators/      Kiem tra du lieu dau vao
  src/middleware/      Xac thuc va xu ly loi tap trung
  src/utils/           Tien ich dung chung
  src/app.js           Express app
  src/server.js        Diem khoi dong backend
```

## Cai dat

Cần Node.js >= 20.19 và **MongoDB Server local có replica set**. Cấu hình mặc định dùng local, không cần Atlas. MongoDB Compass là công cụ xem/quản lý dữ liệu. Xem [hướng dẫn local](#dùng-mongodb-local-không-cần-atlas); [Atlas](#dùng-mongodb-atlas-cho-nhóm) là lựa chọn nếu cần database chung trên cloud.

Backend dung kien truc `Routes -> Controller -> Service -> Repository -> Mongoose Model`. Khi cap nhat tu ban Native Driver, chay `npm ci --prefix BE` va `npm run db:setup`; database hien co tiep tuc dung duoc, khong can seed lai. Chi tiet schema, connection va transaction xem [kien truc backend](docs/ARCHITECTURE.md#mongoose-và-dữ-liệu-hiện-có).

Tai thu muc goc:

```powershell
npm run install:all
if (!(Test-Path BE/.env)) { Copy-Item BE/.env.example BE/.env }
npm run db:local
# Kiểm tra BE/.env dùng URI local theo hướng dẫn bên dưới trước khi chạy tiếp.
npm run db:setup
npm run dev
```

Khong can copy de len `.env` neu file da ton tai. Dieu chinh `MONGODB_URI` trong `BE/.env` neu dung Atlas hoac MongoDB co tai khoan. Khong commit `.env`.

- FE: http://localhost:3000
- BE: http://127.0.0.1:5000/api/health
- Compass: dùng cùng URI trong `BE/.env`; mặc định `mongodb://127.0.0.1:27018/?replicaSet=rs0`.
- Database mac dinh: `xedi`

`npm run db:setup` tao 19 collection va index. `npm run db:seed` thuc hien setup roi nhap du lieu, chuyen `$oid` thanh ObjectId va `$date` thanh Date. Chay lai seed chi them ID chua co, giu nguyen ban ghi da ton tai; khong xoa collection. Neu du lieu hien co vi pham unique index, script bao loi de kiem tra.

Co the chay rieng tung ben trong hai terminal:

```powershell
npm run dev:be
```

```powershell
npm run dev:fe
```

## Dùng MongoDB local không cần Atlas

Mặc định dự án dùng replica set **một node `rs0`**, chỉ lắng nghe trên máy hiện tại ở cổng **27018**. Cấu hình này hỗ trợ transaction cho kiểm định, tiếp nhận, bàn giao và sự cố; không cần Atlas hoặc IP Access List. Cần cài MongoDB Server (MongoDB 6.0+; nên dùng phiên bản hiện tại), cài Compass riêng là chưa đủ.

Tại thư mục gốc repository, sau khi cài dependencies:

```powershell
npm run db:local
```

Lệnh tự tìm `mongod.exe` trong `Program Files/MongoDB/Server` trên Windows; trên hệ điều hành khác cần có `mongod` trong PATH. Nếu cài ở vị trí khác, đặt biến môi trường `MONGOD_BINARY` trỏ tới executable. Lệnh khởi động MongoDB chạy nền, khởi tạo replica set nếu cần và đợi node trở thành primary. Có thể chạy lại lệnh khi database đang hoạt động.

Trong `BE/.env`, đặt:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27018/?replicaSet=rs0
MONGODB_DB_NAME=xedi
```

Sau đó chạy tại thư mục gốc:

```powershell
npm run db:setup
# Chỉ seed khi cần nạp dữ liệu mẫu vào database mới:
npm run db:seed
npm run dev
```

Sau khi khởi động lại máy tính, chạy `npm run db:local` trước `npm run dev`. Nếu terminal đang ở `BE`, các lệnh `db:local`, `db:setup`, `db:seed` và `dev` cũng dùng được; `dev` tại `BE` chỉ khởi động backend. Khởi động lại backend sau khi đổi `.env`. Trong Compass, thêm kết nối bằng URI local phía trên.

**Dữ liệu local:** lưu bền vững tại `BE/storage/mongodb-local/`, được Git bỏ qua. Không xóa thư mục này nếu cần giữ database. Log nằm tại `BE/storage/mongodb-local/mongod.log`. Tiến trình này dùng cổng và thư mục riêng, không chuyển đổi MongoDB standalone đang chạy ở cổng 27017. Dữ liệu ở 27017 hoặc Atlas không tự xuất hiện ở 27018; cần chuyển dữ liệu nếu muốn giữ biên bản cũ, còn seed chỉ nạp các file JSON mẫu.

Mỗi thành viên dùng local có **database riêng**. Cùng Cloudinary chỉ chia sẻ file ảnh; không đồng bộ biên bản giữa các database. Để mọi người thấy cùng dữ liệu cần một database server chung có replica set, hoặc dùng tùy chọn Atlas bên dưới. Replica set một node local phục vụ phát triển, không cung cấp khả năng dự phòng khi máy hỏng.

Nếu `db:local` báo không tìm thấy executable, kiểm tra cài đặt MongoDB Server hoặc `MONGOD_BINARY`. Nếu cổng 27018 đã có MongoDB standalone/replica set khác, lệnh sẽ báo lỗi thay vì tự đổi cấu hình server đó. Nếu backend vẫn yêu cầu replica set, kiểm tra URI cổng 27018 và khởi động lại backend; thêm `replicaSet=rs0` vào URI không thay thế được bước khởi tạo replica set.

Tài liệu MongoDB: [khởi tạo replica set](https://www.mongodb.com/docs/v8.0/reference/method/rs.initiate/).

## Dùng MongoDB Atlas cho nhóm

Phần này là **tùy chọn** khi nhóm muốn database chung trên cloud; bỏ qua nếu dùng local phía trên.

### Vì sao dùng Atlas?

Atlas lưu database trên cloud để các thành viên chạy backend trên máy riêng vẫn đọc/ghi cùng dữ liệu. Các thao tác gửi đề xuất kiểm định, xác nhận giao nhận và tạo sự cố cần **transaction** để ghi dữ liệu đồng bộ; MongoDB standalone local không hỗ trợ các thao tác này. Cluster Atlas của nhóm dùng replica set nên đáp ứng yêu cầu đó.

- **Atlas:** nơi chạy và lưu database chung.
- **Compass:** ứng dụng để kết nối, xem và quản lý database đó.
- **Cloudinary:** kho ảnh Garage riêng; Atlas lưu key ảnh và dữ liệu biên bản. Pull code không tải database hoặc ảnh về máy.

### 1. Nhận thông tin kết nối từ người quản lý nhóm

Thành viên dùng **cluster hiện có của nhóm**, không cần tạo cluster mới. Liên hệ người quản lý để nhận hostname và database user/password qua kênh riêng; nên cấp user riêng cho từng thành viên. Mật khẩu database user khác mật khẩu đăng nhập website Atlas và khác mật khẩu đăng nhập XeDi.

Người quản lý cấu hình tài khoản tại **Database & Network Access → Database Users**, cấp quyền đọc/ghi phù hợp cho database `xedi`. Không đưa URI chứa mật khẩu hoặc Cloudinary API Secret vào README, `.env.example`, ảnh chụp màn hình hay commit Git.

### 2. Cho phép IP của máy kết nối

Trong Atlas, mở **Database & Network Access → IP Access List → Add IP Address**. Nếu có nút **Add Current IP Address**, chọn nút đó. Nếu giao diện chỉ có ô nhập thủ công, chạy lệnh này trên máy tính đang chạy backend:

```powershell
curl.exe -4 https://api.ipify.org
```

Dán IP trả về vào **Access List Entry**, thêm comment tên thành viên rồi **Confirm**. Chờ trạng thái **Active** trước khi kết nối. Nếu không có quyền quản lý Atlas, gửi IP cho người quản lý nhóm thêm giúp. Khi đổi Wi-Fi, dùng hotspot hoặc IP mạng thay đổi, cần cập nhật IP được phép. Dùng IP public vừa lấy, không dùng IP nội bộ như `192.168.x.x`.

### 3. Cấu hình BE/.env trên từng máy

Các lệnh trong phần hướng dẫn này chạy tại **thư mục gốc repository**:

```powershell
npm run install:all
if (!(Test-Path BE/.env)) { Copy-Item BE/.env.example BE/.env }
```

Mở `BE/.env`, thay giá trị các biến có sẵn; mỗi biến chỉ khai báo một lần:

```dotenv
MONGODB_URI=mongodb+srv://<database_user>:<encoded_password>@<atlas_hostname>/?authSource=admin
MONGODB_DB_NAME=xedi
```

Lấy URI chính xác từ **Clusters → XeDi → Connect → Drivers → Node.js** hoặc người quản lý nhóm. Thay các phần `<...>` bằng giá trị thật, bỏ cả dấu `< >`. Copy hostname thay vì gõ lại để tránh thiếu ký tự. Nếu mật khẩu chứa ký tự đặc biệt, cần URL-encode phần mật khẩu trước khi ghép vào URI, ví dụ `@` thành `%40`, `#` thành `%23` và `%` thành `%25`; không encode toàn bộ URI.

Backend đọc **`BE/.env`**, không đọc `.env.example`. Chuỗi `mongodb+srv://...` là giá trị cấu hình, không phải lệnh chạy trực tiếp trong PowerShell. `.env` đã được Git bỏ qua, nên mỗi thành viên phải tự cấu hình sau khi pull code. Giữ nguyên các biến khác đang dùng và khởi động lại backend sau khi sửa `.env`.

### 4. Kiểm tra database và chạy ứng dụng

```powershell
npm run db:setup
```

Kết quả thành công có dạng `Database xedi: 19 collections and indexes are ready.` Chỉ chạy tiếp sau khi bước này thành công:

```powershell
npm run dev
```

Mở FE tại <http://localhost:3000> và kiểm tra backend tại <http://127.0.0.1:5000/api/health>; phản hồi cần có `status: "ok"` và `database: "xedi"`. Đăng xuất rồi đăng nhập lại nếu trước đó dùng database local, sau đó thử tạo biên bản Garage và gửi đề xuất kiểm định.

**Seed dữ liệu:** database chung đã có dữ liệu thì thành viên không cần seed mỗi lần pull code. Chỉ người phụ trách khởi tạo database hoặc bổ sung dataset mới chạy:

```powershell
npm run db:seed
```

Script đọc `BE/data/*.json`, thêm các ID chưa có và giữ nguyên bản ghi đã tồn tại; không reset trạng thái đã thay đổi trong database. Script không sao chép database local lên Atlas, không chuyển các biên bản đã tạo trên máy và không upload ảnh. Nếu cần giữ dữ liệu local phát sinh, thống nhất chuyển dữ liệu với người quản lý trước khi đổi database.

### 5. Xem dữ liệu bằng Compass và dùng chung ảnh

Trong Compass, chọn **Add new connection**, dán URI Atlas đã điền thông tin thật, rồi **Connect** và mở database `xedi`. Kết nối Compass tới `localhost:27017` vẫn chỉ xem database local. Mọi thao tác chỉnh sửa/xóa trên Atlas hoặc Compass kết nối Atlas đều ảnh hưởng database chung của cả nhóm.

Để xem cùng ảnh Garage, điền thêm ba biến `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` của cùng Cloudinary product environment vào `BE/.env`, rồi khởi động lại backend. Nhận secret qua kênh riêng. Nếu bỏ trống cả ba, backend lưu ảnh trên ổ đĩa local và các máy khác không có những file đó. Ảnh local cũ cần upload lại; ảnh trên Cloudinary được xem qua giao diện Garage có JWT, mở trực tiếp URL `/api/garage/photos/...` không kèm token sẽ báo thiếu xác thực. Xem [hướng dẫn ảnh Garage](BE/docs/garage-staff.md#ảnh).

### Các lỗi thường gặp

| Thông báo / hiện tượng | Cách xử lý |
| --- | --- |
| `querySrv ENOTFOUND _mongodb._tcp...` | Copy lại hostname từ Atlas, kiểm tra cluster đang hoạt động. Nếu hostname đúng, kiểm tra DNS/mạng. |
| Timeout / `MongooseServerSelectionError` | Kiểm tra cluster và IP public đã Active trong IP Access List. Nếu vẫn timeout, thử hotspot điện thoại rồi thêm IP mới; mạng/firewall có thể chặn kết nối tới cổng 27017. |
| `bad auth : authentication failed` | Kiểm tra database username/password trong `BE/.env`, không dùng tài khoản website Atlas. Có thể đặt lại mật khẩu trong Database Users, cập nhật URI và kiểm tra URL-encoding. |
| Gửi kiểm định báo cần replica set hoặc Atlas | Kiểm tra backend đang dùng URI Atlas, đã khởi động lại và không còn dùng MongoDB standalone local. |
| Kết nối thành công nhưng thiếu dữ liệu | Kiểm tra đúng cluster và `MONGODB_DB_NAME=xedi`; người phụ trách kiểm tra việc seed hoặc chuyển dữ liệu. |
| Sửa `.env.example` nhưng backend không đổi | Sửa `BE/.env`; kiểm tra biến `MONGODB_URI` trong môi trường terminal nếu vẫn thấy cấu hình cũ, rồi khởi động lại backend. |

Tài liệu chính thức: [kết nối Atlas](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/), [xử lý lỗi kết nối](https://www.mongodb.com/docs/atlas/troubleshoot-connection/), [yêu cầu transaction](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/).

## Dùng Cloudinary để chia sẻ ảnh Garage

Atlas lưu dữ liệu biên bản và key ảnh; **Cloudinary lưu file ảnh**. Muốn các thành viên xem cùng biên bản và ảnh, mỗi backend phải kết nối cùng database Atlas và cùng Cloudinary product environment. Các biến môi trường được đặt trên từng máy, không tự đi theo khi pull code.

### 1. Chuẩn bị tài khoản và thông tin kết nối

Người phụ trách tạo tài khoản tại [Cloudinary](https://cloudinary.com/), chọn product environment của nhóm và vào **Settings → API Keys** để lấy:

| Biến trong backend | Giá trị lấy từ Cloudinary |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloud Name của product environment |
| `CLOUDINARY_API_KEY` | API Key |
| `CLOUDINARY_API_SECRET` | API Secret của key đó |

Thành viên tham gia sau nhận thông tin qua kênh riêng; không tạo Cloudinary environment riêng nếu muốn dùng cùng kho ảnh. Không gửi secret vào frontend, commit Git hoặc điền giá trị thật vào `.env.example`. Nếu secret bị lộ, người phụ trách thay key/secret và thông báo để mọi người cập nhật `.env`.

### 2. Cấu hình trên máy thành viên

Sau khi pull code, chạy tại **thư mục gốc repository** để cài dependency Cloudinary theo lockfile:

```powershell
npm ci --prefix BE
```

Điền đủ ba biến trong **`BE/.env`**, giữ nguyên cấu hình Atlas và các biến khác:

```dotenv
CLOUDINARY_CLOUD_NAME=<cloud_name_cua_nhom>
CLOUDINARY_API_KEY=<api_key_cua_nhom>
CLOUDINARY_API_SECRET=<api_secret_cua_nhom>
```

Thay toàn bộ phần `<...>` bằng giá trị thật và bỏ dấu `< >`. Mỗi biến chỉ khai báo một lần. Dừng backend đang chạy bằng `Ctrl+C`, rồi khởi động lại từ thư mục gốc:

```powershell
npm run dev
```

- Đủ cả ba biến: backend lưu/đọc ảnh Garage qua Cloudinary.
- Trống cả ba biến: backend dùng `BE/storage/garage-photos` hoặc `GARAGE_UPLOAD_DIRECTORY`; ảnh chỉ nằm trên máy chạy backend đó.
- Chỉ có một hoặc hai biến: backend từ chối khởi động và báo cấu hình chưa đủ.

Backend upload bằng SDK với loại **`authenticated`**, không cần tạo unsigned upload preset. Key trả về vẫn có dạng `garage-photos/<userId>/<uuid>.jpg` (hoặc `.png`, `.webp`). Khi xem ảnh, frontend gửi JWT tới backend, backend tạo URL ký có hạn để tải ảnh từ Cloudinary rồi trả nội dung ảnh về frontend. URL `/api/garage/photos/...` là địa chỉ API của ứng dụng, không phải URL public của Cloudinary.

### 3. Kiểm tra upload và chia sẻ ảnh

1. Đăng nhập tài khoản Garage Staff trên ứng dụng.
2. Mở biên bản, chọn ảnh JPG/PNG/WebP tối đa **500 KB/ảnh**, tối đa **4 ảnh/biên bản**. Chờ upload hoàn tất rồi lưu nháp hoặc gửi biên bản để lưu key ảnh vào Atlas.
3. Vào **Cloudinary → Media Library**, tìm asset theo UUID trong key ảnh. Ảnh được upload ngay lúc chọn file; có ảnh trên Cloudinary chưa có nghĩa biên bản đã được lưu.
4. Tải lại trang và mở lại biên bản: ảnh cần hiển thị trong giao diện Garage.
5. Thành viên khác dùng cùng Atlas và Cloudinary, đăng nhập tài khoản có quyền Garage rồi mở biên bản đó để kiểm tra xem ảnh dùng chung.

Mở trực tiếp URL API ảnh trong thanh địa chỉ sẽ thiếu header JWT và có thể báo `Chưa cung cấp token xác thực.` Hãy kiểm tra bằng giao diện ứng dụng sau khi đăng nhập.

### 4. Ảnh cũ và giới hạn hiện tại

Ảnh đã lưu local trước khi bật Cloudinary **không được tự chuyển lên cloud**. Khi bật Cloudinary, backend đọc key ảnh từ kho cloud; file local có cùng key không được dùng làm dự phòng. Với biên bản còn sửa được, cần đính kèm lại ảnh qua ứng dụng và lưu biên bản. Với biên bản đã khóa/gửi, cần thống nhất việc chuyển file với người phụ trách, giữ nguyên key để không làm sai liên kết dữ liệu.

Các ảnh demo trong JSON có thể chỉ có key minh họa và không có file thật. Chạy `db:seed` không tạo hoặc upload các file ảnh đó. Việc xóa ảnh khỏi danh sách đính kèm hiện chỉ bỏ liên kết trong biểu mẫu; ứng dụng chưa có luồng xóa asset trên Cloudinary hoặc tự dọn ảnh upload nhưng chưa lưu biên bản.

### Các lỗi ảnh thường gặp

| Hiện tượng | Cách kiểm tra |
| --- | --- |
| Người upload xem được, máy khác không có ảnh | Kiểm tra hai máy cùng Atlas, cùng Cloudinary environment, đủ ba biến và đã khởi động lại backend. Máy upload có thể vẫn đang dùng local. |
| `Không thể tải ảnh lên Cloudinary` | Kiểm tra bộ Cloud Name/API Key/API Secret cùng environment, key còn hoạt động, kết nối Internet và hạn mức tài khoản. |
| `Ảnh chưa có tệp hoặc không tải được` | Kiểm tra asset tồn tại, ảnh có phải key demo/file local cũ không; xem trạng thái request ảnh trong Network của trình duyệt. |
| `Không thể đọc ảnh từ Cloudinary` | Kiểm tra credentials, kết nối cloud và asset trong đúng environment; gửi HTTP status của API để người phụ trách kiểm tra. |
| `Chưa cung cấp token xác thực` | Đăng nhập lại và mở ảnh qua giao diện Garage; không kiểm tra bằng URL trực tiếp thiếu JWT. |
| Upload báo quá dung lượng hoặc sai định dạng | Chọn JPG/PNG/WebP không quá 500 KB và giữ số lượng tối đa 4 ảnh. |

Tài liệu: [lấy thông tin Cloudinary](https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials), [SDK upload Node.js](https://cloudinary.com/documentation/node_image_and_video_upload), [kiểm soát truy cập ảnh](https://cloudinary.com/documentation/control_access_to_media), [API Garage của dự án](BE/docs/garage-staff.md#ảnh).

## API

| Method | URL | Chuc nang |
| --- | --- | --- |
| GET | `/api/health` | Kiem tra BE va ket noi MongoDB |
| GET | `/api/homepage` | So xe niem yet, dia diem va chinh sach cong khai dang hieu luc |
| GET | `/api/listings` | Danh sach tin xe da published va xe da approved |
| GET | `/api/listings/:id` | Chi tiet tin xe theo listing ObjectId |
| GET | `/api/manager/dashboard?period=7d` | Dashboard van hanh cho tai khoan Manager/Admin (JWT), gom chi so, doanh thu da doi soat, yeu cau xe/su co va audit log |
| GET/PATCH | `/api/manager/vehicles` va `/api/manager/vehicles/:id/review` | Manager: danh sach xe; duyet, tu choi hoac yeu cau bo sung ho so |
| GET/PATCH | `/api/manager/incidents` va `/api/manager/incidents/:id/*` | Manager: xem su co; duyet/tu choi boi thuong hoac dong ho so |
| GET/PUT | `/api/manager/policies` va `/api/manager/policies/:type` | Manager: xem chinh sach dang ap dung; tao phien ban moi |
| GET/PATCH | `/api/manager/staff` va `/api/manager/staff/:id` | Manager: quan ly nhan vien van hanh/gara |
| POST | `/api/manager/staff` | Manager: tao tai khoan nhan vien van hanh/gara |
| GET/POST/PATCH | `/api/manager/accounts` va `/api/manager/accounts/:id` | Admin: tao tai khoan, gan nhieu role, khoa/mo khoa |
| GET/POST/PATCH | `/api/manager/roles` va `/api/manager/roles/:id` | Admin: tao role, xem role va cap nhat ten, mo ta, permissions |
| GET | `/api/manager/audit-logs` | Admin: tra cuu, loc theo ngay/action/entity va phan trang audit logs |
| GET/PATCH | `/api/manager/contracts?type=management|rental` va `/api/manager/contracts/:type/:id` | Manager: xem, ghi nhan review, de nghi amendment va cham dut hop dong quan ly |
| GET | `/api/manager/reports/finance` | Admin hoac Manager: bao cao doi soat tai chinh, co loc ngay |
| GET | `/api/manager/reports/inspections`, `/api/manager/reports/operations` | Manager: bao cao kiem dinh va hoat dong, co loc ngay |
| GET/POST | `/api/manager/reports/system` | Admin/Manager: luu va xem danh sach bao cao da tao; Admin chi thay bao cao tai chinh |
| POST | `/api/auth/login` | Dang nhap bang email/so dien thoai va mat khau (tra ve JWT & user info) |
| GET | `/api/auth/me` | Lay thong tin user hien tai qua JWT Bearer token |
| POST | `/api/auth/logout` | Dang xuat |
| GET | `/api/owner/dashboard` | Danh sach xe, doi soat thu nhap va hop dong theo Owner dang dang nhap |
| POST | `/api/owner/vehicles` | Tai ho so xe, ky thoa thuan quan ly dien tu va gui xe cho luong xac minh |

Query ho tro cho listings: `page`, `limit`, `q` (tim trong tieu de), `city`, `startAt`, `endAt`, `minPrice`, `maxPrice`, `fuelType`, `transmission`, `vehicleType`, `seats`, `sort` (`newest`, `price_asc`, `price_desc`). `startAt` va `endAt` la cap thoi gian ISO; API loai xe trung booking dang cho xu ly/thanh toan, da xac nhan, dang thue hoac khoang lich bi khoa. Ket qua tim kiem khong giu cho; tao booking sau nay can kiem tra lai va chong tranh chap dong thoi.
Query ho tro: `page`, `limit`, `q` (tieu de, mo ta, hang va mau xe), `city`, `minPrice`, `maxPrice`, `fuelType`, `transmission`, `vehicleType`, `seats`, `minYear`, `ids`, `startAt`, `endAt`, `sort` (`newest`, `price_asc`, `price_desc`). `vehicleType` nhan nhieu gia tri cach nhau bang dau phay, khong phan biet hoa thuong (vi du `sedan,suv`). `ids` la danh sach listing ObjectId cach nhau bang dau phay (toi da 100); chuoi rong tra ve danh sach rong.

`startAt` va `endAt` phai duoc gui cung nhau theo ISO 8601 co mui gio; thoi gian tra phai sau thoi gian nhan. API loai xe co `availability_blocks` hoac booking (`pending`, `awaiting_payment`, `confirmed`, `ongoing`) giao voi khoang thue: `start_at < endAt` va `end_at > startAt`. Hai khoang chi cham bien khong bi coi la trung. Ket qua tim kiem khong giu cho xe; luong dat xe sau nay can kiem tra lai lich trong giao dich.

Mat khau mac dinh cho cac tai khoan mau duoc seed tu dataset co `password_hash: null` la `123456`. Khi dang nhap thanh cong lan dau, he thong tu dong ma hoa bcrypt va luu vao MongoDB.

FE co proxy `/api` den BE khi chay `npm start`; goi `fetch('/api/listings')` hoac `fetch('/api/auth/login')` tu React. Khi deploy FE da build, can cau hinh reverse proxy `/api` toi BE.

## Pham vi hien tai

Homepage trong `FE/src/features/home/pages/HomePage.js` da duoc chuyen sang React theo mau `xedi_trang_ch_thu_xe_t_l_i_p2p`. Header, footer, the xe va dialog duoc tach thanh component. Tim theo dia diem/thoi gian, loc xe, sap xep gia, xem thong tin xe va cong cu uoc tinh thu nhap su dung API/MongoDB. Nut luu xe luu danh sach tren trinh duyet hien tai.
Man danh sach React da ket noi `/api/listings`: tim kiem, loc, sap xep va phan trang do MongoDB xu ly. FE co debounce, huy request cu, trang thai tai/loi va nut thu lai. Cac bo loc chua co truong du lieu (tien nghi, giao xe tan noi, Superhost, giam gia, dat xe nhanh) duoc khoa kem chu thich; khong tao gia tri gia. Du lieu seed hien chi co dia diem Ha Noi/Hai Phong va duong dan anh minh hoa chua co file, nen FE hien anh thay the. Chua cung cap API ghi du lieu nghiep vu, dang nhap/RBAC, dat xe, thanh toan, eKYC hay ky so.

Noi dung duyet booking, nhan/tra tai gara, hoan coc, phi hoa hong theo database va UC. Thoi han hoan coc, dieu kien huy va phi mac dinh doc tu `platform_policies` dang hieu luc. Uoc tinh thu nhap la gia niem yet x so ngay x (1 - hoa hong mac dinh), chua tru thue/chi phi phat sinh; hop dong rieng co the co muc phi khac.

Giao dien dang nhap tai `/#/login` da duoc ket noi truc tiep toi API backend `/api/auth/login` voi du lieu that tu MongoDB. Khi dang nhap thanh cong, token duoc luu vao localStorage/sessionStorage va thong tin nguoi dung duoc hien thi tren Header.

Giao dien quan tri tach theo URL va role: `/#/admin` cho `ADMIN`, `/#/manager` cho `MANAGER`. Dang nhap tu dong chuyen tai khoan den dung khu vuc; neu mo sai URL, giao dien chuyen ve khu vuc ma role duoc phep. Backend van kiem tra role theo tung endpoint: chi `MANAGER` duoc duyet xe, xu ly su co/boi thuong, sua chinh sach, quan ly nhan vien van hanh/gara, quan ly hop dong va xem bao cao van hanh; `ADMIN` duoc quan ly tai khoan, role/permission va audit logs; hai role duoc xem bao cao tai chinh. Amendment hop dong da ky duoc ghi nhu de nghi cho chu the ky, khong ghi de snapshot dieu khoan cua booking cu. Bao cao tai chinh va hoat dong co the luu thanh snapshot trong `system_reports`. Thao tac quan tri ghi audit log.

Cong chu xe tai `/#/owner` goi `/api/owner/dashboard` va `/api/owner/vehicles`. Dang ky xe yeu cau role `OWNER`, ba loai giay to xe, tu 2 den 5 anh xe va xac nhan thoa thuan. Tai lieu duoc luu trong MongoDB GridFS; xe gui thanh cong vao trang thai `submitted` cho quy trinh gara/quan ly tiep tuc.

## Kiem tra

`npm test --prefix BE` chay test model, database, API, auth, listings, homepage, Garage, Manager va Owner. Integration test tu tao replica set va database tam, seed fixture va tu don; khong sua database ung dung. Can cai MongoDB Server (`mongod`) hoac cau hinh `MONGOD_BINARY` / `INTAKE_TEST_MONGODB_URI` cho moi truong test. `npm test --prefix FE -- --watchAll=false` chay UI test.

## Tai lieu cho nhom

- [Kien truc va huong dan phat trien](docs/ARCHITECTURE.md)
- [Luồng phối hợp Manager, Garage và xác minh sự cố](BE/docs/manager-garage-workflow.md)
- [Bao cao ra soat va refactor](docs/STRUCTURE_REVIEW.md)

Frontend: `FE/src/app` va `FE/src/features/{auth,home,listings,garage,manager}`. Backend chia theo tang tai `BE/src/{routes,models,controller,service,repositories,validators,middleware,utils,config,database}`; ten file cho biet nghiep vu. `npm run build` kiem tra FE build duoc. Chi tiet FE xem `FE/SCREEN.md`.

## API tiep nhan xe (Garage Staff)

Da co API danh sach xe cho tiep nhan, kiem tra dieu kien, tao/sua nhap va xac nhan tiep nhan tai `/api/garage`. Dung JWT tu API login va quyen hien tai trong database. Xac nhan dung MongoDB transaction, yeu cau replica set/Atlas. Huong dan endpoint, body, version va cach test: [BE/docs/garage-intakes.md](BE/docs/garage-intakes.md). FE `/garage` da noi du lieu that, gom phu kien, luu nhap va xac nhan.

## API kiem dinh xe (Garage Staff)

Da co `/api/garage/inspection-vehicles`, `/api/garage/inspections` va luong tao/sua nhap, gui de xuat kiem dinh onboarding. Can permission `vehicle.inspect`, doc lap voi `vehicle.intake`. Garage Staff chi gui sang `pending`, khong tu phe duyet xe. Partial unique index yeu cau MongoDB 6.0+; gui de xuat dung transaction nen can replica set/Atlas. Chi tiet request/response va mapping FE: [BE/docs/garage-inspections.md](BE/docs/garage-inspections.md).

## Garage Staff: ban giao, nhan tra, su co va anh

FE `/garage` dung `/api/garage/workspace` de hien cong viec, tong quan va lich su that; khong luu nghiep vu trong localStorage. Da co API nhap/xac nhan ban giao va nhan tra, doi chieu hien trang pickup, tu tao su co khi co hu hong moi, gui bao cao su co rieng va upload/doc anh qua JWT. Xe co hu hong moi duoc giu o maintenance; khong tu duyet boi thuong/hoan coc. Luong Garage - Operation - Manager xem [tai lieu phoi hop](BE/docs/manager-garage-workflow.md).

Chay `npm run db:setup` de bo sung index, sau do `npm run dev`. Can MongoDB replica set/Atlas de gui/xac nhan va tao su co. Anh mac dinh luu tai `BE/storage/garage-photos` (gitignore); co the dat `GARAGE_UPLOAD_DIRECTORY`. Chi tiet API, request/version, quyen va cach kiem thu: [BE/docs/garage-staff.md](BE/docs/garage-staff.md).
