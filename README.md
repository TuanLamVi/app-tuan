# MyGroups - Ứng dụng quản lý nhóm cộng đồng

MyGroups là ứng dụng chuyên nghiệp giúp các nhóm (clann, lớp học, dự án) quản lý tài chính và hoạt động nội bộ một cách minh bạch, realtime và bảo mật.

## ✨ Tính năng nổi bật

- **Quản lý nhóm (Management):** Theo dõi hoạt động, tin tức và thành viên.
- **Tài chính (Finance):** Thu/Chi minh bạch, duyệt giao dịch bởi Trưởng/Phó nhóm.
- **Chiến dịch (Campaigns):** Quản lý các hoạt động, sự kiện riêng biệt của nhóm.
- **Bản tin (News):** Cập nhật thông báo quan trọng đến toàn bộ thành viên.
- **Realtime Notifications:** Thông báo tức thì khi có lời mời, giao dịch được duyệt hoặc tin mới.
- **Bảo mật:** Phân quyền Owner/Deputy/Member chặt chẽ qua Firestore Security Rules.
- **Dark Mode:** Giao diện tối hiện đại, bảo vệ mắt.
- **Export CSV:** Xuất báo cáo giao dịch tài chính chuyên nghiệp.

## 🛠 Công nghệ sử dụng

- **Frontend:** React 18, Vite, TypeScript.
- **Styling:** Tailwind CSS, Framer Motion (`motion/react`).
- **Backend:** Firebase (Auth, Firestore, Hosting).
- **Icons:** Lucide React.
- **Toasts:** React Hot Toast.

## 🚀 Hướng dẫn chạy Project

### 1. Trên trình duyệt (Web)
- Mở URL Preview được cung cấp bởi AI Studio.
- Đăng nhập/Đăng ký để bắt đầu trải nghiệm.

### 2. Thiết lập Firebase (Nếu muốn triển khai riêng)
- Truy cập [Firebase Console](https://console.firebase.google.com/).
- Tạo project mới và bật **Authentication (Email/Google)**, **Firestore**.
- Deploy Rules: Sử dụng nội dung file `firestore.rules`.
- Cập nhật config trong `firebase-applet-config.json`.

### 3. Trải nghiệm trên Mobile (PWA)
Ứng dụng được thiết kế **Responsive Mobile-first**. Bạn có thể:
- Mở URL ứng dụng bằng Safari (iOS) hoặc Chrome (Android).
- Chọn "Thêm vào màn hình chính" (Add to Home Screen) để sử dụng như một ứng dụng Native (PWA).

## 📂 Kiến trúc mã nguồn

- `src/services`: Xử lý logic nghiệp vụ & API.
- `src/hooks`: Quản lý state & dữ liệu realtime.
- `src/pages`: Toàn bộ màn hình ứng dụng.
- `src/components`: UI components dùng chung (Modal, Card, UI Elements).

---
*Phát triển bởi Google AI Studio Build.*
