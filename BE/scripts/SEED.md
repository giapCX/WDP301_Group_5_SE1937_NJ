# Du lieu mau MongoDB

16 collection / 68 documents theo tourist_car_rental_schema.dbml. Giu ID so va ten field snake_case; MongoDB tu sinh them _id. Datetime dung BSON Date, tien VND dung Number nguyen. Cac gia tri status la quy uoc demo vi DBML khong dinh nghia enum.

Chay tu thu muc BE:

```powershell
npm install
npm run seed:check
npm run seed
```

Script doc MONGO_URI tu BE/.env va mac dinh ghi vao database tourist_car_rental_demo. Co the doi ten bang bien SEED_DB_NAME. De API doc du lieu nay, dat ten database trong MONGO_URI cua API thanh tourist_car_rental_demo.

Seed tao unique index theo schema, chi insert ID chua ton tai, khong xoa hay ghi de document cu. Nen dung database demo rieng de tranh trung ID voi du lieu khac. Script khong dung transaction; neu loi giua chung, sua loi va chay lai.

Tai khoan: demo1@example.com den demo9@example.com. Mat khau demo: Demo@12345. Thu tu role: admin, manager, operator, garage_staff, driver, driver, renter, renter, renter. password_hash co format scrypt$salt$hex (Node crypto.scryptSync, key length 64); backend hien chua co auth, can bo xac minh tuong ung khi tich hop, khong dung truc tiep bcrypt.compare.

Du lieu hoan toan gia lap, moc ngay 11-12/2026. Booking co pending, confirmed, in_progress, completed, cancelled; bao gom diem dung, phan cong tai xe, khuyen mai, thanh toan, hoan tien, kiem tra xe, bao tri, su co va danh gia. Demo dinh gia theo so ngay, chua gom phi tai xe hay thue vi schema khong quy dinh.
