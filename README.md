# XeDi

Ung dung thue xe tu lai: React JavaScript, Node.js, Express va MongoDB qua Mongoose.

```text
FE/                    Ung dung React hien tai
BE/
  data/                18 file JSON du lieu mau cua nhom
  scripts/             Tao collection, index va nhap du lieu
  src/config/          Cau hinh moi truong va ket noi MongoDB
  src/database/        Index, khoi tao collection va seed
  src/models/          18 schema/model Mongoose
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

Can Node.js >= 20.19 va MongoDB Server dang chay. MongoDB Compass la cong cu xem du lieu; BE ket noi truc tiep voi MongoDB Server.

Backend dung kien truc `Routes -> Controller -> Service -> Repository -> Mongoose Model`. Khi cap nhat tu ban Native Driver, chay `npm ci --prefix BE` va `npm run db:setup`; database hien co tiep tuc dung duoc, khong can seed lai. Chi tiet schema, connection va transaction xem [kien truc backend](docs/ARCHITECTURE.md#mongoose-và-dữ-liệu-hiện-có).

Tai thu muc goc:

```powershell
npm run install:all
Copy-Item BE/.env.example BE/.env
npm run db:seed
npm run dev
```

Khong can copy de len `.env` neu file da ton tai. Dieu chinh `MONGODB_URI` trong `BE/.env` neu dung Atlas hoac MongoDB co tai khoan. Khong commit `.env`.

- FE: http://localhost:3000
- BE: http://127.0.0.1:5000/api/health
- Compass URI: `mongodb://127.0.0.1:27017`
- Database mac dinh: `xedi`

`npm run db:setup` tao 18 collection va index. `npm run db:seed` thuc hien setup roi nhap du lieu, chuyen `$oid` thanh ObjectId va `$date` thanh Date. Chay lai seed chi them ID chua co, giu nguyen ban ghi da ton tai; khong xoa collection. Neu du lieu hien co vi pham unique index, script bao loi de kiem tra.

Co the chay rieng tung ben trong hai terminal:

```powershell
npm run dev:be
```

```powershell
npm run dev:fe
```

## API

| Method | URL | Chuc nang |
| --- | --- | --- |
| GET | `/api/health` | Kiem tra BE va ket noi MongoDB |
| GET | `/api/homepage` | So xe niem yet, dia diem va chinh sach cong khai dang hieu luc |
| GET | `/api/listings` | Danh sach tin xe da published va xe da approved |
| GET | `/api/listings/:id` | Chi tiet tin xe theo listing ObjectId |
| GET | `/api/manager/dashboard?period=7d` | Dashboard van hanh cho tai khoan Manager/Admin (JWT), gom chi so, doanh thu da doi soat, yeu cau xe/su co va audit log |
| GET/PATCH | `/api/manager/vehicles` va `/api/manager/vehicles/:id/review` | Danh sach xe; duyet, tu choi hoac yeu cau bo sung ho so |
| GET/PATCH | `/api/manager/incidents` va `/api/manager/incidents/:id/*` | Xem su co; duyet/tu choi boi thuong hoac dong ho so |
| GET/PUT | `/api/manager/policies` va `/api/manager/policies/:type` | Xem chinh sach dang ap dung; tao phien ban moi |
| GET/PATCH | `/api/manager/staff` va `/api/manager/staff/:id` | Liet ke nhan su, doi vai tro va trang thai tai khoan |
| GET | `/api/manager/reports/finance`, `/api/manager/reports/inspections` | Bao cao doi soat tai chinh va lich su kiem dinh, co loc ngay |
| POST | `/api/auth/login` | Dang nhap bang email/so dien thoai va mat khau (tra ve JWT & user info) |
| GET | `/api/auth/me` | Lay thong tin user hien tai qua JWT Bearer token |
| POST | `/api/auth/logout` | Dang xuat |

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

Dashboard quan ly tai `/#/manager` goi cac endpoint `/api/manager/*` va chi cho phep tai khoan co role hien tai `MANAGER` hoac `ADMIN`. API tinh xe tu listings published, ho so cho duyet va su co chua dong tu collections tuong ung; doanh thu lay phi nen tang trong `owner_settlements` da thanh toan, hoat dong lay tu `audit_logs`. Query dashboard `period` chap nhan `7d`, `30d` hoac `month`. Thao tac duyet, boi thuong, dong su co, sua chinh sach va quan ly nhan su deu ghi audit log.

## Kiem tra

`npm test --prefix BE` chay test model, database, API, auth, listings, homepage, Garage va Manager. Integration test tu tao replica set va database tam, seed fixture va tu don; khong sua database ung dung. Can cai MongoDB Server (`mongod`) hoac cau hinh `MONGOD_BINARY` / `INTAKE_TEST_MONGODB_URI` cho moi truong test. `npm test --prefix FE -- --watchAll=false` chay UI test.

## Tai lieu cho nhom

- [Kien truc va huong dan phat trien](docs/ARCHITECTURE.md)
- [Bao cao ra soat va refactor](docs/STRUCTURE_REVIEW.md)

Frontend: `FE/src/app` va `FE/src/features/{auth,home,listings,garage,manager}`. Backend chia theo tang tai `BE/src/{routes,models,controller,service,repositories,validators,middleware,utils,config,database}`; ten file cho biet nghiep vu. `npm run build` kiem tra FE build duoc. Chi tiet FE xem `FE/SCREEN.md`.

## API tiep nhan xe (Garage Staff)

Da co API danh sach xe cho tiep nhan, kiem tra dieu kien, tao/sua nhap va xac nhan tiep nhan tai `/api/garage`. Dung JWT tu API login va quyen hien tai trong database. Xac nhan dung MongoDB transaction, yeu cau replica set/Atlas. Huong dan endpoint, body, version va cach test: [BE/docs/garage-intakes.md](BE/docs/garage-intakes.md). FE `/garage` da noi xac thuc; du lieu cong viec van la ban thu nghiem local, chua noi cac API nghiep vu nay.

## API kiem dinh xe (Garage Staff)

Da co `/api/garage/inspection-vehicles`, `/api/garage/inspections` va luong tao/sua nhap, gui de xuat kiem dinh onboarding. Can permission `vehicle.inspect`, doc lap voi `vehicle.intake`. Garage Staff chi gui sang `pending`, khong tu phe duyet xe. Partial unique index yeu cau MongoDB 6.0+; gui de xuat dung transaction nen can replica set/Atlas. Chi tiet request/response va mapping FE: [BE/docs/garage-inspections.md](BE/docs/garage-inspections.md).
