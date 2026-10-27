# XeDi

Ung dung thue xe tu lai: React JavaScript, Node.js va MongoDB.

```text
FE/                    Ung dung React hien tai
BE/
  data/                18 file JSON du lieu mau cua nhom
  scripts/             Tao collection, index va nhap du lieu
  src/config/          Cau hinh moi truong va ket noi MongoDB
  src/database/        Danh sach collection va index
  src/routes/          API danh sach va chi tiet xe cho thue
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

## API ban dau

| Method | URL | Chuc nang |
| --- | --- | --- |
| GET | `/api/health` | Kiem tra BE va ket noi MongoDB |
| GET | `/api/listings` | Danh sach tin xe da published va xe da approved |
| GET | `/api/listings/:id` | Chi tiet tin xe theo listing ObjectId |

Query ho tro: `page`, `limit`, `q` (tim trong tieu de), `minPrice`, `maxPrice`, `fuelType`, `transmission`, `vehicleType`, `seats`, `sort` (`newest`, `price_asc`, `price_desc`).

Vi du: `/api/listings?fuelType=electric&sort=price_asc&page=1&limit=6`.

FE co proxy `/api` den BE khi chay `npm start`; goi `fetch('/api/listings')` tu React. Khi deploy FE da build, can cau hinh reverse proxy `/api` toi BE.

## Pham vi hien tai

Giu giao dien React hien co; chua chuyen cac mockup HTML trong ZIP thanh React. API hien tai phuc vu buoc dau cho man danh sach/chi tiet xe, chua loc lich trong theo ngay thue. Chua cung cap API ghi du lieu nghiep vu, dang nhap/RBAC, dat xe, thanh toan, eKYC hay ky so. Cac tich hop that se duoc them sau khi chot nha cung cap va tai khoan sandbox.

Du lieu mau duoc giu nguyen nhu nhom cung cap (bao gom mat khau null, giao dich DEMO, file anh/tai lieu minh hoa va mot so moc thoi gian chua hop ly). Khong dung du lieu mau de chung minh thanh toan hay xac minh danh tinh that.

Database chua chot schema nen buoc nay chi tao collection va index, chua ap dat validation nghiep vu. Cac quan he tham chieu khong phai foreign key duoc MongoDB tu dong kiem tra.

## Kiem tra

`npm test --prefix BE` chay integration test API voi MongoDB va du lieu da seed, chi doc du lieu. `npm run build` kiem tra FE build duoc.
