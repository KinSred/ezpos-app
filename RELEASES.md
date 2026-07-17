# Nhật ký Phát hành (Release Notes)

Đây là tài liệu ghi nhận các thay đổi, tính năng mới, và lỗi đã được khắc phục qua từng phiên bản của phần mềm EZPOS.

---

## [v1.0.2] - 2026-07-17
### ✨ Cập nhật mã nguồn & Tối ưu hóa (Refactoring & Security)
- **Tái cấu trúc toàn diện (Phase 1 & Phase 2):** Chuyển đổi kiến trúc sang dạng `Feature-based`. Chia nhỏ thành công các "Component khổng lồ" nghìn dòng (như `InventoryScreen`, `HistoryReportsScreen`, `CustomersScreen`) thành các Sub-component độc lập, giúp mã nguồn cực kì gọn gàng, siêu dễ bảo trì và nâng cấp sau này.
- **Vá lỗ hổng bảo mật (Security Fix):** Cập nhật `electron/main.js` để tự động bật lại kiểm tra chứng chỉ SSL an toàn tuyệt đối khi ở môi trường Production.
- **Dọn dẹp hệ thống:** Loại bỏ hàng loạt hàm thừa, script rác, xóa bỏ các thư viện chưa sử dụng để file ứng dụng nhẹ nhất có thể.

### ✨ Tính năng mới (New Features)
- **Thêm tính năng Phí Khác:** Trong màn hình thanh toán, giờ đây thu ngân có thể thêm các khoản "Khác" (ví dụ: phí vận chuyển, phí dịch vụ thêm). Khoản tiền này sẽ được cộng trực tiếp vào tổng tiền.
- **Phím tắt mới:** Thêm phím tắt `Ctrl + P` (hoặc `Cmd + P` trên Mac) tại màn hình thanh toán để nhập Phí Khác. Bảng Hướng dẫn Phím tắt cũng được cập nhật trong Cài Đặt.
- **Hóa đơn và Báo cáo:** Cập nhật mẫu in hóa đơn bán hàng và màn hình lịch sử đơn hàng để hiển thị chi tiết khoản phí khác.
- **In mã vạch dán sản phẩm:** Hỗ trợ tính năng chọn số lượng và in mã vạch (Barcode) dán trực tiếp lên sản phẩm chưa có mã vạch từ màn hình Quản lý Kho.
- Tối ưu hóa mẫu in mã vạch dạng tối giản (chỉ gồm vạch và số) tương thích hoàn hảo với máy in nhiệt Xprinter 80mm.
- Ứng dụng kỹ thuật `createPortal` để đảm bảo máy in tự động cắt giấy đúng vị trí, không in ra giấy trắng liên tục.
- Cải thiện và hoán đổi bố cục giao diện Cài Đặt.
- Phát hành bản build đóng gói `.dmg` cho Mac và `.exe` cho máy Windows.

---

## [v1.0.1] - 2026-07-13
### ✨ Tính năng mới (New Features)
- Phát hành bản build đóng gói `.dmg` dành cho macOS.
- Cải thiện độ trễ máy quét mã vạch và đồng bộ LAN.

---

## [v1.0.0] - Bản Phát Hành Đầu Tiên
### ✨ Tính năng cốt lõi (Core Features)
- Bán hàng siêu tốc (Offline-first) với IndexedDB (Dexie).
- Hỗ trợ chế độ giá Sỉ / Lẻ / Lốc linh hoạt.
- Tích hợp VietQR + kiểm tra giao dịch tự động qua SePay.
- Quản lý công nợ khách hàng, đơn nợ.
- In ngầm (Silent Print) hóa đơn nhiệt K80.
- Giao diện thân thiện, chế độ Light/Dark Mode (TailwindCSS).
