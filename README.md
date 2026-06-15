# Homework Repo Tool - Web UI

Công cụ quản lý bài tập lập trình với giao diện web. Cho phép bạn tạo, quản lý và tổ chức các repository bài tập trên GitHub.

## 📋 Chức Năng

- 🎯 Tạo repository bài tập trên GitHub
- 📁 Quản lý workspace và thư mục làm việc
- 📝 Lưu lịch sử bài tập
- 🔗 Tích hợp GitHub API
- 💻 Giao diện web dễ sử dụng

## 🚀 Cách Cài Đặt

### Yêu Cầu
- Python 3.7+
- Node.js & npm
- GitHub CLI (`gh`) được cài đặt và xác thực

### Bước 1: Clone Repository
```bash
git clone https://github.com/tunhanduc2007-netizen/toolgithub.git
cd toolgithub
```

### Bước 2: Cài Đặt Dependencies

**Python:**
```bash
pip install flask
```

**Node.js (nếu cần):**
```bash
npm install
```

### Bước 3: Xác Thực GitHub
```bash
gh auth login
```

## 🎮 Cách Chạy

### Cách 1: Sử dụng Shell Script
```bash
./start.sh
```

### Cách 2: Chạy Flask trực tiếp
```bash
python app.py
```

### Cách 3: Chạy từ run.py
```bash
python run.py
```

Ứng dụng sẽ chạy trên: **http://localhost:5000**

## 📂 Cấu Trúc Project

```
homework-repo-web/
├── app.py              # Flask application chính
├── run.py              # Script chạy ứng dụng
├── start.sh            # Shell script khởi động
├── package.json        # Node.js dependencies
├── static/
│   ├── app.js          # JavaScript frontend
│   └── style.css       # CSS styling
└── templates/
    └── index.html      # HTML template
```

## 🛠️ Công Nghệ Sử Dụng

- **Backend:** Flask (Python)
- **Frontend:** HTML, CSS, JavaScript
- **API:** GitHub API
- **CLI:** GitHub CLI (gh)

## 📝 Cách Sử Dụng

1. Mở trình duyệt và truy cập `http://localhost:5000`
2. Nhập thông tin bài tập của bạn
3. Chọn thư mục workspace
4. Ứng dụng sẽ tự động tạo repository trên GitHub
5. Xem lịch sử bài tập của bạn

## 🤝 Đóng Góp

Nếu bạn muốn cải thiện dự án, vui lòng:
1. Fork repository này
2. Tạo branch mới (`git checkout -b feature/YourFeature`)
3. Commit thay đổi (`git commit -m 'Add some feature'`)
4. Push lên branch (`git push origin feature/YourFeature`)
5. Mở Pull Request

## 📄 Giấy Phép

ISC License

## 👨‍💻 Tác Giả

Được tạo bởi TNDUCK

## ❓ Hỗ Trợ

Nếu gặp vấn đề, hãy kiểm tra:
- Bạn đã cài đặt tất cả dependencies?
- Bạn đã xác thực GitHub CLI?
- Port 5000 có bị chiếm không?
- Kiểm tra console log để xem lỗi chi tiết

---

**Vui lòng sử dụng công cụ này để quản lý bài tập một cách hiệu quả! 🎓**
