# EZPOS - Project Summary & Status
*Ngày cập nhật gần nhất: 11/07/2026*

## 1. Giới thiệu dự án
Dự án **EZPOS** là một ứng dụng Desktop (Point of Sale - POS) offline-first chạy độc lập trên máy tính (Windows/macOS) thông qua **Electron Framework**. Ứng dụng được xây dựng bằng React, Vite, TailwindCSS, và sử dụng IndexedDB (thông qua thư viện Dexie) để lưu trữ dữ liệu trực tiếp dưới ổ cứng của người dùng, mang lại trải nghiệm mượt mà, độc lập hoàn toàn với internet.

## 2. Các công nghệ cốt lõi
- **Core:** React (Vite) đóng gói trong **Electron Framework**
- **Styling & UI:** Tailwind CSS, Framer Motion (hiệu ứng mượt mà), Lucide React (icon đồng nhất).
- **Database:** Dexie.js (IndexedDB wrapper) lưu trữ offline mạnh mẽ dưới thiết bị.
- **Tính năng mở rộng:** Tích hợp API SePay (xác nhận chuyển khoản tự động), in hóa đơn nhiệt (thermal printer) 2 liên tự động qua **Hệ thống PDF Spooler chạy ngầm của Windows/macOS** kết nối trực tiếp với máy in XP-80C.

## 3. Các tính năng đã hoàn thiện

### 🛒 Màn hình Bán Hàng (POSScreen & CartColumn)
- Quét mã vạch tự động thêm vào giỏ hàng. Hỗ trợ đa dạng đơn vị tính thực tế: Lẻ, Lốc (Mid), Sỉ (Wholesale).
- Hiển thị cảnh báo số lượng tồn kho thấp trực tiếp trên giỏ hàng.
- **Tính năng Khuyến mãi thông minh:** Tự động phát hiện và trừ tiền khi giỏ hàng đạt điều kiện "Mua X tặng Y". Trợ lý gợi ý (Upsell hint) ngay dưới sản phẩm *"Mua thêm X để được tặng Y"*.
- **Chiết khấu riêng lẻ từng mặt hàng:** Cho phép nhập mức giảm giá riêng cho từng sản phẩm trực tiếp từ giỏ hàng hoặc modal thanh toán. Hộp nhập thiết kế rộng rãi có dấu phẩy phân tách nghìn và chặn phím Enter kích hoạt thanh toán ngoài ý muốn.
- Modal Thanh toán trực quan:
  - **Tiền mặt:** Có máy tính tiền thối tự động, phím tắt mệnh giá tiền nhanh.
  - **Chuyển khoản (VietQR):** Quét mã QR, tự động dò tìm giao dịch qua SePay API để tự động xác nhận đã nhận tiền (không cần check app ngân hàng).
  - **Ghi nợ:** Liên kết trực tiếp với thông tin Khách hàng. **Khóa cố định Ghi Nợ khi ở tab Giao Sỉ** và tự động giữ trạng thái ghi nợ sau khi hoàn thành đơn để phục vụ giao sỉ liên tục.

### 📦 Quản lý Kho Hàng (InventoryScreen)
- Thêm/Sửa chi tiết/Xóa sản phẩm với đầy đủ thông tin: Mã vạch (cho phép sửa trực tiếp), Tên, Giá nhập, Giá bán lẻ/lốc/sỉ, Giá nợ lẻ/lốc/sỉ, Số lượng tồn, Cảnh báo hết hàng.
- Tích hợp **Chiết khấu theo số lượng (Quantity Discounts):** Cho phép thiết lập các mức giá chiết khấu bậc thang (Ví dụ: Mua từ 5 thùng giảm 5,000đ/thùng) trực tiếp khi cấu hình sản phẩm.
- Tính năng **Nhập hàng (Stock Intake):** Phiếu nhập kho chi tiết, tự động cập nhật số lượng tồn hiện tại.
- In tem mã vạch (Barcode/QR code) cho từng sản phẩm.

### 👥 Sổ Công Nợ & Khách Hàng (CustomersScreen)
- **Tạo nhanh khách hàng thủ công:** Cho phép nhập Tên, SĐT và số nợ ban đầu của khách trực tiếp từ sổ nợ.
- **Cấu hình Bảng giá riêng biệt:** Thiết lập giá bán sỉ/lẻ đặc quyền cho từng khách hàng ứng với đơn vị tính chuẩn từ kho hàng. Hiển thị song song giá niêm yết kho để so sánh đối chiếu trực quan.
- **Áp dụng tự động:** Tự động tra cứu và áp dụng bảng giá riêng của khách hàng khi bật chế độ Ghi Nợ (Giao sỉ) lúc bán POS.
- **Định dạng dấu phẩy hàng nghìn tự động (Commas Formatting):** Tự động thêm dấu phẩy phân tách khi nhập số tiền nợ đầu kỳ, giá riêng mới, số tiền trả nợ, tránh gõ nhầm chữ số.

### 🎁 Quản lý Khuyến Mãi (PromotionsScreen)
- Thiết lập các chương trình "Mua M tặng N".
- Có nút Tắt/Bật nhanh chương trình.
- Popup Modal xác nhận Xóa được thiết kế đẹp mắt (UI đồng nhất, không dùng alert mặc định của trình duyệt).

### 📊 Lịch Sử & Báo Cáo (HistoryReportsScreen)
- Xem lại toàn bộ hóa đơn đã bán, cho phép in lại hóa đơn bất kỳ lúc nào.
- **Xóa hóa đơn hoàn trả kho & công nợ:** Cho phép xóa đơn hàng cũ trong lịch sử, tự động hoàn trả số lượng sản phẩm vào tồn kho theo đúng tỷ lệ quy đổi và trừ nợ lũy tiến tương ứng cho khách hàng nếu là đơn ghi nợ.
- Bộ lọc theo thời gian (Hôm nay, 7 ngày, 30 ngày, Tùy chỉnh).
- Xem biểu đồ doanh thu và tính toán lợi nhuận tự động.
- Tính năng **Giao Ca:** Chốt doanh thu cuối ngày.

### ⚙️ Cài Đặt (SettingsScreen)
- Thiết lập thông tin cửa hàng (Tên, SĐT, Địa chỉ, Lời chào trên hóa đơn).
- Thiết lập Thuế VAT (bật/tắt, % mặc định).
- Cấu hình SePay API Key để tự động xác nhận chuyển khoản.
- **Sao lưu & Khôi phục (Backup/Restore):** Xuất toàn bộ dữ liệu ra file `.json` để bảo vệ dữ liệu, hoặc chuyển dữ liệu sang máy tính khác (hoàn toàn offline).

## 4. Cấu trúc Database (Dexie)
Các bảng dữ liệu hiện tại trong `db.js`:
- `products`: id, barcode, name, prices, stock, lowStockAlert, quantityDiscounts, ...
- `orders`: id, orderCode, items (mảng chứa sản phẩm), totalAmount, method, date, customerPreviousDebt, customerRemainingDebt, ...
- `customers`: id, phone, name, debt, points, specialPrices (bảng giá riêng lẻ/lốc/sỉ).
- `customerTransactions`: id, customerPhone, timestamp, type ('debt' hoặc 'payment'), amount, orderId, note (mô tả chi tiết sản phẩm hoặc ghi chú thanh toán), remainingDebt (dư nợ lũy tiến ngay sau giao dịch).
- `promotions`: id, name, type, buyProductId, buyQuantity, getQuantity, isActive.
- `settings`: Thông tin cấu hình hệ thống.
- `inventory_logs`: Lịch sử nhập kho (Stock intake).
- `debt_logs`: Lịch sử trả nợ của khách hàng (legacy).

## 5. Các nâng cấp giao diện nổi bật (UI/UX Overhaul - 06/2026)
Hệ thống được thiết kế theo phong cách SaaS tối giản cao cấp kết hợp các điểm nhấn retro:
- **Giao diện Cuốn Sổ Tay Lò Xo:** Khi xem lịch sử công nợ của khách, màn hình chuyển thành một trang giấy màu kem (#fdfaf2) cổ điển có gáy xoắn lò xo 3D, dòng kẻ ngang và lề đỏ chạy dọc. Nhật ký nợ tăng/giảm được trình bày mạch lạc kèm danh sách mặt hàng và số nợ lũy tiến sau mỗi dòng giao dịch.
- **In Hóa Đơn 2 Liên Chuyên Biệt (PDF Spooler Độc Lập & Đa Nền Tảng):**
  - **Hóa đơn Bán lẻ:** In 1 bản tiêu chuẩn với các thông tin thanh toán tiền mặt/chuyển khoản thông thường.
  - **Hóa đơn Ghi nợ 2 Liên:** Tự động in đồng thời **Liên 1 (Giao khách hàng)** và **Liên 2 (Cửa hàng lưu)** cách nhau bởi đường cắt kéo nét đứt `✂ - - - - - CẮT TẠI ĐÂY - - - - - ✂`.
  - **Thống kê nợ trên bill in:** Hiển thị rõ số dư nợ cũ, nợ phát sinh đơn này, tổng nợ hiện tại và 2 khung ký nhận nợ cho Khách hàng và Người lập phiếu.
  - **Kiến trúc in ấn đa nền tảng:**
    * **Trên Windows:** Đẩy PDF trực tiếp vào Spooler qua SumatraPDF (thư viện `pdf-to-printer`) bằng tùy chọn `scale: "noscale"`.
    * **Trên macOS:** Sử dụng lệnh native `lp` của hệ thống in CUPS (`lp -d "Tên_Máy_In" "Đường_Dẫn_PDF"`) giúp tương thích 100% không cần cài đặt thêm.
  - **Thuật toán tự động đo chiều cao hóa đơn (Smart Auto-Cut):** Chiều cao PDF được tính động bằng DOM `offsetHeight` của phần tử `.print-only` chia cho 96 DPI cộng thêm 0.5 inch lề dưới, giúp máy in tự chém cắt giấy vừa khít cuối bill mà không bị lãng phí giấy.
  - **Cơ chế đo chiều cao offscreen đồng nhất (Screen Measurement):** Thay vì chỉ áp dụng khổ in 64mm trong `@media print`, lớp `.print-only` được định dạng `width: 64mm; padding; font-family; box-sizing;` ở phạm vi **toàn cục (global)**. Nhờ đó, khi nằm offscreen (`position: absolute; left: -9999px;`), phần tử này có cách quấn dòng chữ giống hệt khi in thật, giúp Electron đo chiều cao chính xác 100%, khắc phục lỗi tràn trang làm đôi khiến máy in tự chém giấy ở chân hóa đơn bán lẻ.
  - **Màu sắc in nhiệt:** Mọi chữ trên bill in đều bắt buộc dùng màu đen thuần túy (`text-black`), không dùng các màu xám (`text-gray-400`, `text-gray-500`) vì đầu in nhiệt nhị phân sẽ tự động lọc bỏ các màu xám nhạt khiến chữ bị biến mất.
  - **Cấu hình lề chống rụng chữ & Căn giữa cơ học:**
    * Khổ rộng PDF và CSS thiết lập chuẩn **`64mm`** (vùng in nhiệt khả dụng thực tế của đầu in 80mm).
    * Lề trái **`7.5mm`** và lề phải **`0.5mm`** (CSS `padding` của `.print-only`). Sự bất đối xứng này bù trừ cho độ lệch trái vật lý `4mm` của đầu in cơ học trên cuộn giấy 80mm, giúp chữ in ra nằm **Chính giữa tờ giấy** và chữ kết thúc ở `63.5mm` (dưới ngưỡng 64mm unprintable) để chữ `đ`, `t` không bao giờ bị cắt hay quấn dòng.
- **Tối ưu hiệu năng kho hàng (Lazy Rendering & Shimmer Skeleton):** 
  * Áp dụng **Lazy Rendering** (chỉ vẽ 50 sản phẩm đầu tiên khi tải tab, bấm nút "Tải thêm" để xem tiếp 50 sản phẩm) giúp tab Menu trượt mượt mà. 
  * Kết hợp trạng thái **Trì hoãn tải danh sách (Delay Mount 250ms) & hiệu ứng Shimmer Skeleton** (đang tải) trong lúc tab Menu trượt, giúp loại bỏ hoàn toàn độ nghẽn luồng React và giữ hiệu ứng trượt 60fps mượt mà như lụa. 
  * Phòng chống lỗi sập màn hình trắng (TypeError: `.length` of undefined) bằng cách chuẩn hóa các lệnh đếm số lượng qua biến mảng an toàn `productsList.length`.
- **Tắt theo dõi hàng tồn kho (Bypass Inventory Tracking):**
  * Tích hợp tuỳ chọn cài đặt cục bộ `hideStock`. Khi bật, hệ thống ẩn cột số lượng và thay bằng badge `"Đang bán"`, ẩn toàn bộ cảnh báo tồn kho thấp ở trang Kho hàng và tắt đèn đỏ nhấp nháy báo động ở biểu tượng menu chính.
  * Quy trình thanh toán (`POSScreen.jsx`) tự động bỏ qua toàn bộ khối lệnh trừ số lượng trong DB khi cài đặt này hoạt động, giữ nguyên vẹn 100% số lượng tồn kho gốc.
- **Mã hóa đơn ngẫu nhiên bảo mật doanh số:**
  * Thay thế mã hóa đơn tăng dần tuần tự (`HĐ-1`, `HĐ-2`...) bằng **số ngẫu nhiên gồm 6 chữ số** (ví dụ: `HĐ-440099`) được sinh tự động khi checkout.
  * Tích hợp cơ chế dò tìm trùng lặp tự động (collision checking) trước khi ghi đè ID thủ công vào bảng Dexie `orders`, bảo mật thông tin kinh doanh khỏi sự dòm ngó bên ngoài.
- **Thanh điều hướng nổi (Floating Dock)**: Chuyển đổi header thành thanh kính mờ lơ lửng. Sử dụng **Framer Motion `layoutId`** để làm viên thuốc nền trượt mượt mà giữa các tab. Hỗ trợ cơ chế **HashRouter** giúp hoạt động trơn tru trong môi trường ứng dụng Desktop (`file://`).
- **Quét mã vạch trực quan**: Thiết kế máy quét với vòng tròn radar đồng tâm đứt nét và **đường laser neon quét dọc tự động** trượt lên xuống tạo cảm giác hiện đại.
- **Segmented Control độc lập**: Bộ chuyển đổi Đơn vị tính (Lẻ/Lốc/Sỉ) trong giỏ hàng sử dụng `layoutId` độc lập cho từng sản phẩm.
- **Bảng dữ liệu tối giản (Stripe Style)**: Viền mỏng, khoảng cách thoáng đãng, các badge tồn kho màu sắc nổi bật với hoạt họa nhấp nháy báo hết hàng.
- **Cập nhật Tự động Đa Nền Tảng (Auto-Update qua GitHub Releases)**:
  * Tích hợp `electron-updater` liên kết trực tiếp với GitHub Releases.
  * Hỗ trợ tự động dò bản mới, tải ngầm (có thanh tiến trình phần trăm trên UI Settings) và tự động cài đặt cho cả Windows (`.exe`) và macOS (`.dmg`).
  * Khắc phục lỗi CommonJS/ESM khi đóng gói bằng cách import theo chuẩn: `import pkg from 'electron-updater'; const { autoUpdater } = pkg;`.
- **Báo cáo Phân tích Chuyên sâu (Advanced Dashboard & Export)**:
  * Trang lịch sử được tái thiết kế thành Dashboard hiện đại với **Biểu đồ Tròn (PieChart)** hiển thị trực quan tỉ trọng thanh toán (Tiền mặt/Chuyển khoản).
  * Xếp hạng Top 5 Sản phẩm bán chạy bằng **Biểu đồ Cột ngang (BarChart)** với hiệu ứng gradient vàng đồng (Amber) tôn vinh sản phẩm "gánh doanh thu".
  * Tính năng **Xuất dữ liệu (Export to CSV/Excel)** chỉ với một chạm, hỗ trợ truy xuất lập tức toàn bộ lịch sử bán hàng và tính toán sổ sách kế toán.


## 6. Hướng dẫn Resume (Dành cho AI)
Khi người dùng mở lại dự án và yêu cầu bạn đọc file này:
1. Nắm rõ toàn bộ logic kinh doanh (Business logic) như đã mô tả ở trên.
2. Tất cả các components UI đều được viết dưới dạng functional components (React) và nằm trong thư mục `/src/components`.
3. Database logic tập trung ở file `/src/db.js`.
4. Khi cải tiến UI, luôn giữ đúng nguyên lý xếp chồng z-index cho các cấu trúc trượt động `layoutId` (`z-0` cho underlay, `relative z-10` cho label chữ phía trên) để giữ độ sắc nét của màu sắc.
5. Không thay đổi hoặc phá vỡ bộ cấu hình in ấn 64mm (padding 7.5mm trái, 0.5mm phải) để tránh làm lệch hoặc quấn lề chữ in hóa đơn.
6. Không thay đổi hoặc phá vỡ bộ icon hiện tại (đang dùng `lucide-react`) và các hiệu ứng `framer-motion`.
7. Đảm bảo các định dạng hình học cốt lõi của hóa đơn (`.print-only` padding, width) luôn được định nghĩa ở phạm vi toàn cục (global) ngoài media query để bảo toàn tính chính xác của thuật toán đo chiều cao tự động chém giấy.

---
*Dự án đã sẵn sàng cho môi trường Production và đã được đóng gói thành công thành file cài đặt Windows (.exe) độc lập trong thư mục `release/`.*
