# XeDi

Ung dung thue xe tu lai: React JavaScript, Node.js va MongoDB.

```text
FE/                    Ung dung React hien tai
BE/
  data/                18 file JSON du lieu mau cua nhom
  scripts/             Tao collection, index va nhap du lieu
  src/config/          Cau hinh moi truong va ket noi MongoDB
  src/database/        Danh sach collection va index
  src/routes/          API danh sach, chi tiet xe cho thue va xac thuc
  src/app.js           Express app
  src/server.js        Diem khoi dong backend
```

## Cai dat

Can Node.js >= 20.19 va MongoDB Server dang chay. MongoDB Compass la cong cu xem du lieu; BE ket noi truc tiep voi MongoDB Server.

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
| POST | `/api/auth/login` | Dang nhap bang email/so dien thoai va mat khau (tra ve JWT & user info) |
| GET | `/api/auth/me` | Lay thong tin user hien tai qua JWT Bearer token |
| POST | `/api/auth/logout` | Dang xuat |

Query ho tro cho listings: `page`, `limit`, `q` (tim trong tieu de), `city`, `startAt`, `endAt`, `minPrice`, `maxPrice`, `fuelType`, `transmission`, `vehicleType`, `seats`, `sort` (`newest`, `price_asc`, `price_desc`). `startAt` va `endAt` la cap thoi gian ISO; API loai xe trung booking dang cho xu ly/thanh toan, da xac nhan, dang thue hoac khoang lich bi khoa. Ket qua tim kiem khong giu cho; tao booking sau nay can kiem tra lai va chong tranh chap dong thoi.

Mat khau mac dinh cho cac tai khoan mau duoc seed tu dataset co `password_hash: null` la `123456`. Khi dang nhap thanh cong lan dau, he thong tu dong ma hoa bcrypt va luu vao MongoDB.

FE co proxy `/api` den BE khi chay `npm start`; goi `fetch('/api/listings')` hoac `fetch('/api/auth/login')` tu React. Khi deploy FE da build, can cau hinh reverse proxy `/api` toi BE.

## Pham vi hien tai

Homepage trong `FE/src/pages/HomePage.js` da duoc chuyen sang React theo mau `xedi_trang_ch_thu_xe_t_l_i_p2p`. Header, footer, the xe va dialog duoc tach thanh component. Tim theo dia diem/thoi gian, loc xe, sap xep gia, xem thong tin xe va cong cu uoc tinh thu nhap su dung API/MongoDB. Nut luu xe luu danh sach tren trinh duyet hien tai.

Noi dung duyet booking, nhan/tra tai gara, hoan coc, phi hoa hong theo database va UC. Thoi han hoan coc, dieu kien huy va phi mac dinh doc tu `platform_policies` dang hieu luc. Uoc tinh thu nhap la gia niem yet x so ngay x (1 - hoa hong mac dinh), chua tru thue/chi phi phat sinh; hop dong rieng co the co muc phi khac.

Giao dien dang nhap tai `/#/login` da duoc ket noi truc tiep toi API backend `/api/auth/login` voi du lieu that tu MongoDB. Khi dang nhap thanh cong, token duoc luu vao localStorage/sessionStorage va thong tin nguoi dung duoc hien thi tren Header.

## Kiem tra

`npm test --prefix BE` chay integration test API voi MongoDB va du lieu da seed (bao gom test listings, homepage va authentication/login). `npm test --prefix FE -- --watchAll=false` chay UI test.
