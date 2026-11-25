# Operations workspace

Workflow người 4. Dùng lại BookingSidebar, OperatorTopbar, ManagerSidebar, TripForm, VietnamDateTimeField, formatter và API phụ phí/đổi lịch/dispatch hiện có.

- api/: HTTP qua api/client, thông báo lỗi và các base path.
- hooks/: tải dữ liệu, abort request, refresh, trạng thái lỗi/loading.
- components/: form hành động, lịch sử, phân trang, phụ phí, hủy, sự cố và panel Renter.
- pages/: workspace Operator và Manager, bộ lọc và phân trang.
- styles/: CSS phạm vi op-*; chỉ bổ sung style cho nút dùng chung trong panel mới.

Xem docs/WORKFLOW_4.md và docs/WORKFLOW_4_SPEC.md để lấy Use Cases, API, dữ liệu, sơ đồ và checklist test. Không dùng mock data khi API lỗi. Các giao dịch thu/hoàn dùng mô phỏng theo cấu hình hiện tại.
