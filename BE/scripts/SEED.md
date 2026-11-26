# Du lieu mau MongoDB

17 collection / 112 sample documents theo tourist_car_rental_schema.dbml. Giu ID so va ten field snake_case; MongoDB tu sinh them _id. Datetime dung BSON Date, tien VND dung Number nguyen. Cac gia tri status la quy uoc demo vi DBML khong dinh nghia enum.

Chay tu thu muc BE:

```powershell
npm install
npm run seed:check
npm run seed
```

Script seed va API cung doc MONGO_URI tu BE/.env. Dat duong dan database trong URI la tourist_car_rental_demo.

Seed tao unique index theo schema, chi insert ID chua ton tai, khong xoa hay ghi de document cu. Nen dung database demo rieng de tranh trung ID voi du lieu khac. Script khong dung transaction; neu loi giua chung, sua loi va chay lai.

Tai khoan: demo1@example.com den demo9@example.com. Mat khau demo: Demo@12345. Thu tu role: admin, manager, operator, garage_staff, driver, driver, renter, renter, renter. password_hash co format scrypt$salt$hex (Node crypto.scryptSync, key length 64); backend hien chua co auth, can bo xac minh tuong ung khi tich hop, khong dung truc tiep bcrypt.compare.

Du lieu hoan toan gia lap, moc ngay 11-12/2026. Booking co pending, confirmed, in_progress, completed, cancelled; bao gom diem dung, phan cong tai xe, thanh toan, hoan tien, kiem tra xe, bao tri, su co va danh gia. Demo dinh gia theo so ngay, chua gom phi tai xe hay thue vi schema khong quy dinh.

## Booking review fields

Bookings bo sung reviewed_by (Number/user_id hoac null), reviewed_at (BSON Date hoac null), rejection_reason (String hoac null). Null nghia la chua ghi nhan thong tin; khong suy dien nguoi/thoi diem duyet cho du lieu cu.

```powershell
npm run db:booking-review-fields
```

Migration dung cung MONGO_URI voi seed. Chi them field chua ton tai voi gia tri null, giu nguyen field da co va booking_status. npm run seed cung tu dong ap dung migration nay.

Quy uoc cho API se trien khai: pending -> confirmed/rejected. Khi quyet dinh, luu reviewed_by va reviewed_at; khi rejected phai co rejection_reason. Thay doi nay chi bo sung du lieu, chua trien khai API duyet/tu choi.

Vehicle schedule_version defaults to 0 in new sample documents. Seed also adds the field to existing vehicles where missing; it does not reset existing versions. Use npm run db:vehicle-schedule-version for migration only. Booking approval now requires a replica set; see the root README for npm run db:local and the port 27017 connection string.


Collection booking_change_requests co 3 yeu cau mau (rejected, approved, pending) cho booking_id=2. Chi luu snapshot truoc/sau va thong tin xu ly, khong thay doi booking. Xem BE/src/models/booking-change-request.md.

## Hồ sơ Manager demo dùng cho hợp đồng

Chạy từ thư mục BE: `npm run seed:manager-demo`.
Kiểm tra trước, không ghi database: `npm run seed:manager-demo -- --check`.
Script đọc MONGO_URI từ BE/.env, tìm đúng Manager active có email demo2@example.com và chỉ bổ sung tên đơn vị, địa chỉ, MST, điện thoại còn thiếu. Không đổi mật khẩu, tên, vai trò hoặc thông tin đã có; chạy lại được. Nếu chưa có tài khoản mẫu, tạo dữ liệu trên database demo bằng seed hiện có trước.
Sau khi chạy, Operator bấm Tải lại hồ sơ Manager. Script này không sửa lỗi route hoặc backend đang chạy code cũ.
