# Checklist kiểm định và biên bản xe XeDi

Đặc tả nghiệp vụ v1 cho F03–F05, F11, F14–F16 và F21. Các tiêu chí bên dưới dùng để thiết kế màn hình, API và ca kiểm thử XeDi. Garage chịu trách nhiệm ghi phương pháp kiểm tra và kết quả kỹ thuật theo từng loại xe.

## 1. Checklist kiểm định đầu vào

Operation lưu bản khai của Owner và phiên bản giấy tờ đã sàng lọc. Garage mở đúng hồ sơ được phân công, đối chiếu từng khác biệt với bản khai và ghi nhận hiện trạng độc lập. Mỗi dòng checklist có kết quả, phương pháp kiểm tra, số đo và đơn vị nếu có, ghi chú và ảnh tham chiếu.

| Hạng mục | Garage ghi nhận | Điều kiện chặn kết luận đạt |
|---|---|---|
| Định danh và hồ sơ | Biển số, số khung/VIN, hãng, mẫu, đời xe. Đối chiếu xe thực tế với hồ sơ Operation đã kiểm tra | Sai xe, không đọc được định danh, hồ sơ bắt buộc thiếu hoặc không khớp |
| ODO và nhiên liệu/pin | Số km, mức nhiên liệu/pin, đèn cảnh báo, ảnh bảng đồng hồ | Thiếu số liệu, không đọc được hoặc chênh lệch chưa giải thích |
| Ngoại thất, kính và gương | Từng vị trí xước, móp, nứt, vỡ, góc nhìn và tình trạng đóng mở | Hư hỏng ảnh hưởng tầm nhìn, đóng mở an toàn hoặc nghi ảnh hưởng kết cấu |
| Nội thất và an toàn người ngồi | Ghế, dây an toàn, khóa cửa, cảnh báo túi khí, hư hỏng nội thất | Dây an toàn, khóa hoặc hệ thống an toàn cần sửa |
| Lốp và bánh xe | Từng bánh, dấu hiệu mòn/hư hỏng, số đo theo phương pháp Garage áp dụng, lốp dự phòng hoặc bộ vá nếu có | Lốp/bánh không bảo đảm sử dụng theo kết luận kỹ thuật |
| Phanh, lái và hệ thống treo | Phanh chính/phanh đỗ, độ bất thường khi điều khiển, cảnh báo và kết quả thử phù hợp | Bất thường ảnh hưởng khả năng phanh hoặc điều khiển |
| Động cơ hoặc truyền động điện | Khởi động, cảnh báo, tiếng động bất thường, dấu hiệu quá nhiệt, hư hỏng nhìn thấy | Lỗi ảnh hưởng vận hành an toàn hoặc chưa xác định được mức độ |
| Rò rỉ và gầm xe | Vị trí, loại chất lỏng nếu xác định được, dấu hiệu và ảnh | Rò rỉ đang diễn ra hoặc nghi có nguy cơ an toàn cần xác minh |
| Đèn, còi, gạt mưa | Chức năng hoạt động và mục bị lỗi | Thiết bị cần thiết cho việc vận hành an toàn bị lỗi |
| Chìa khóa, giấy tờ bàn giao và phụ kiện | Tên, số lượng, hiện trạng, danh mục theo xe đã thỏa thuận | Thiếu mục bắt buộc để tiếp nhận hoặc vận hành |

### Kết quả từng mục và kết luận báo cáo

| Kết quả từng mục | Cách áp dụng |
|---|---|
| Đạt | Garage đã kiểm tra và đáp ứng tiêu chí của mục |
| Lỗi có thể ghi nhận | Lỗi thẩm mỹ hoặc khác biệt nhỏ đã được Garage xác nhận không ảnh hưởng an toàn, chức năng hay điều kiện vận hành. Bắt buộc có ảnh và mô tả |
| Không đạt | Có lỗi cần sửa hoặc điều kiện chặn trong bảng. Bắt buộc ghi căn cứ và bước xử lý |
| Chưa xác minh | Thiếu dữ liệu, chưa kiểm tra được hoặc chưa rõ mức độ. Ghi lý do, giữ hồ sơ chờ bổ sung |
| Không áp dụng | Chỉ dùng cho mục không có trên loại xe đó, ghi lý do |

- **Đạt (`pass`)** khi tất cả mục bắt buộc đã kiểm tra, không có điều kiện chặn, mọi lỗi có thể ghi nhận đã có chứng cứ và mọi chênh lệch với bản khai đã được giải thích.
- **Cần sửa, kiểm định lại (`requires_repair`)** khi Garage xác định lỗi có thể khắc phục. Đợt sau tham chiếu báo cáo trước và ghi phần đã sửa cùng kết quả kiểm tra lại.
- **Không đạt (`fail`)** khi Garage kết luận xe không đủ điều kiện kỹ thuật để đề xuất nhận. Hồ sơ thiếu hoặc mục chưa xác minh thì trả bổ sung, chưa chốt kết luận.
- **Manager** duyệt đúng phiên bản báo cáo `pass`, đã đủ hồ sơ và bằng chứng. Manager có thể yêu cầu bổ sung, kiểm định lại hoặc từ chối và phải ghi lý do. Quyết định duyệt mở bước lập hợp đồng quản lý. Nếu chủ xe bất đồng về hiện trạng, lưu nội dung bất đồng và làm rõ trước khi chốt hồ sơ dùng để ký.

## 2. Khối thông tin dùng chung trên mọi mẫu

| Trường | Nội dung điền |
|---|---|
| Nhận diện | Mã hồ sơ, loại mẫu, phiên bản, mã xe và biển số, gara, mã hợp đồng quản lý hoặc booking tương ứng |
| Người và thời gian | Người lập, bên giao, bên nhận, người được ủy quyền và căn cứ ủy quyền nếu có, giờ thực tế, giờ ghi nhận và giờ xác nhận |
| Hiện trạng | ODO, nhiên liệu/pin, cảnh báo, danh sách lỗi theo từng vị trí, ảnh toàn xe và bảng đồng hồ, ảnh cận từng lỗi, phụ kiện và số lượng |
| Tài liệu đối chiếu | Mã và phiên bản của biên bản/báo cáo gốc. Mỗi chênh lệch chỉ rõ mục hoặc ảnh được so sánh |
| Xác nhận | Mỗi bên xem cùng phiên bản. Lưu tài khoản xác nhận, thời điểm và kết quả đồng ý, bất đồng hoặc chưa xác nhận. Có ô ghi nội dung bất đồng |
| Kết quả | Kết luận, công việc tiếp theo, người chịu trách nhiệm và mã sự cố nếu có |

Ảnh toàn xe gồm phía trước, sau, trái, phải và nội thất. Lỗi cần ít nhất ảnh nhận ra vị trí và ảnh cận thấy mức độ. Lưu ảnh trong hồ sơ có kiểm soát quyền xem. Hồ sơ đã xác nhận lưu nguyên phiên bản. Sửa sai bằng bản bổ sung nêu lý do, người sửa, thời điểm, liên kết bản cũ và xác nhận lại phần thay đổi khi cần.

## 3. Mẫu báo cáo và biên bản

### A. Báo cáo kiểm định đầu vào

- **Tham chiếu** — Mã bản khai Owner, đợt kiểm định và Garage Staff được phân công.
- **Điền** — Checklist mục 1, chênh lệch giữa khai báo và thực tế theo từng mục, ảnh, lỗi cần sửa và kết luận kỹ thuật.
- **Xác nhận** — Garage gửi báo cáo. Owner xem phần hiện trạng và ghi đồng ý hoặc bất đồng. Manager ghi quyết định và phiên bản báo cáo dùng để duyệt. Hồ sơ đã chốt được tham chiếu khi lập hợp đồng.

### B. Biên bản tiếp nhận xe từ chủ

- **Tham chiếu** — Hợp đồng quản lý đã ký còn hiệu lực và báo cáo kiểm định đã duyệt.
- **Điền** — Xe và người giao thực tế, danh sách chìa khóa, giấy tờ, phụ kiện, hiện trạng lúc giao và mọi thay đổi kể từ kiểm định.
- **Xác nhận** — Owner/người được ủy quyền và Garage xác nhận cùng biên bản. Xe chuyển `at_garage` sau khi tiếp nhận hợp lệ. Sai xe, thiếu điều kiện hoặc hiện trạng thay đổi đáng kể thì dừng tiếp nhận và chuyển Operation xử lý. Biên bản này là mốc để đối chiếu khi trả xe cho Owner.

### C. Biên bản giao xe cho khách thuê

- **Tham chiếu** — Booking, hợp đồng thuê và hồ sơ hiện trạng gần nhất của xe.
- **Điền** — Giờ nhận thực tế, người nhận và kết quả đối chiếu quyền nhận xe, ODO, nhiên liệu/pin, ảnh, lỗi có sẵn, phụ kiện và cảnh báo khi sử dụng nếu có.
- **Xác nhận** — Garage và khách xác nhận trước khi giao. Bất đồng về hiện trạng thì sửa bản nháp cùng khách hoặc chuyển Operation. Sau bàn giao hợp lệ, booking chuyển `ongoing`, xe chuyển `rented`. Biên bản đã xác nhận là mốc gốc của booking.

### D. Biên bản nhận xe từ khách thuê

- **Tham chiếu** — Biên bản giao đã xác nhận của chính booking. Nếu thiếu mốc gốc, ghi thiếu căn cứ và chuyển Operation xác minh.
- **Điền** — Giờ xe về thực tế, hiện trạng trả, ODO, nhiên liệu/pin, phụ kiện, bảng chênh lệch theo mục 4 và ý kiến khách. Ghi giờ xe về ngay cả khi việc kiểm tra hoặc xác nhận diễn ra sau.
- **Xác nhận** — Garage ghi nhận việc nhận lại xe. Khách xác nhận hoặc ghi bất đồng. Nếu khách vắng mặt hoặc từ chối ký, lưu lý do, ảnh và người chứng kiến nếu có. Việc kết thúc sử dụng xe và xác nhận trách nhiệm là hai kết quả riêng.
- **Kết quả** — Xe đủ điều kiện trở về `at_garage`. Có lỗi an toàn hoặc hư hỏng mới/nặng thêm thì chuyển `maintenance`, tạo hồ sơ sự cố và chặn giao tiếp. Trường hợp chưa xác minh được mức độ thì giữ chặn lịch đến khi Garage kiểm tra xong.

### E. Biên bản bàn giao lại xe cho chủ

- **Tham chiếu** — Hợp đồng quản lý, biên bản tiếp nhận ban đầu, hồ sơ sửa chữa/sự cố liên quan và công việc trả xe.
- **Điền** — Giờ giao thực tế, hiện trạng, ODO, nhiên liệu/pin, chìa khóa và phụ kiện. Ghi riêng lỗi cũ, thay đổi trong thời gian XeDi giữ xe, hạng mục đã sửa và nghĩa vụ còn mở.
- **Xác nhận** — Garage và Owner/người được ủy quyền xác nhận phần giao nhận thực tế. Nếu Owner đã nhận xe nhưng bất đồng hiện trạng, lưu hai kết quả riêng và mở/giữ hồ sơ tranh chấp. Chỉ ghi `returned_to_owner` khi có căn cứ xác nhận xe đã được giao thực tế.

## 4. Mẫu bảng chênh lệch và chuyển xử lý sự cố

| Vị trí hoặc mục | Lúc giao và ảnh | Lúc nhận và ảnh | Chênh lệch | Ý kiến và xử lý tiếp |
|---|---|---|---|---|
| [Vị trí cụ thể hoặc mã lỗi] | [Hiện trạng gốc, mã ảnh] | [Hiện trạng mới, mã ảnh] | [Giữ nguyên / Mới / Nặng thêm / Đã sửa / Chưa xác minh] | [Ý kiến của bên liên quan, công việc tiếp theo] |

So khớp theo vị trí và lỗi cụ thể. Ví dụ, cửa trái đã trầy vẫn là lỗi cũ, vết móp mới ở cản sau là dòng khác dù cả hai lần đều đánh giá ngoại thất `damaged`. ODO lúc trả thấp hơn lúc giao phải được xác minh và ghi hiệu chỉnh có căn cứ.

Khi chuyển sự cố, Garage đính kèm biên bản gốc, biên bản mới, ảnh từng chênh lệch và quyết định chặn xe. Operation ghi thời điểm thông báo Owner/khách, phản hồi từng bên, nguyên nhân đã xác minh hoặc còn bỏ ngỏ, căn cứ điều khoản và báo giá nếu có. Manager ghi quyết định, khoản được duyệt và lý do. Việc phát hiện lỗi hoặc ký nhận hiện trạng chỉ ghi nhận sự kiện, chưa phê duyệt bồi thường hay khấu trừ cọc.

## 5. Ca nghiệm thu cho bước triển khai

1. Owner khai xe bình thường, Garage phát hiện rò dầu đang diễn ra. Báo cáo chỉ rõ mục chặn và Manager chưa thể duyệt cho đến khi có đợt kiểm định đạt.
2. Xe có vết xước cũ được ghi ảnh, Garage xác nhận lỗi thẩm mỹ và Owner xác nhận. Báo cáo có thể đạt và biên bản tiếp nhận giữ nguyên vết xước làm mốc.
3. Khách trả xe với vết xước cũ giữ nguyên. Bảng so sánh chỉ ra ảnh lúc giao và lúc trả, không tạo sự cố hư hỏng mới cho vết xước đó.
4. Xe trả có vết móp mới trong nhóm ngoại thất vốn đã `damaged`. Bảng ghi dòng lỗi mới, xe bị chặn cho thuê và hồ sơ sự cố tham chiếu hai biên bản.
5. Khách đã trả xe nhưng từ chối xác nhận hiện trạng. Hệ thống ghi đúng giờ xe về, giữ nội dung bất đồng và thông báo các bên qua hồ sơ sự cố.
6. Khi trả xe cho Owner, Garage đối chiếu biên bản nhập gara và hồ sơ sửa chữa. Owner xác nhận đã nhận xe, phần bất đồng về hư hỏng tiếp tục được theo dõi nếu có.

### Ghi chú triển khai

Owner xem báo cáo, biên bản và phản hồi trong **Đội xe của tôi → Xem hiện trạng**. Garage nhập checklist trong **Kiểm định xe** và xử lý yêu cầu rút xe ở **Trả xe cho chủ**. Manager xem kết quả và phản hồi tại **Kiểm duyệt xe**, xem bằng chứng giao nhận trong hồ sơ sự cố. Các báo cáo và biên bản cũ giữ cách đọc tương thích khi thiếu checklist hoặc danh sách lỗi.

Ở bản triển khai này, Garage ghi phương pháp, số đo và chênh lệch ở ô ghi chú của từng mục. Garage đính ảnh và gắn ảnh tham chiếu cho lỗi, chưa có bước kiểm tra bắt buộc từng góc chụp. Đối chiếu trả xe cho chủ lấy biên bản tiếp nhận làm mốc và vẫn cần Garage ghi các sửa chữa liên quan vào biên bản. Xác nhận trả xe cập nhật việc giao nhận, còn tranh chấp và đối soát tiếp tục theo hồ sơ riêng.
