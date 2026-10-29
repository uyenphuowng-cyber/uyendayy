# Sổ Học Điện Tử — bản web độc lập

Sổ học kiểu NotebookLM cho sinh viên Kỹ thuật Điện tử – Máy tính. Bản này **không cần Claude.ai**: chỉ là một trang web tĩnh (HTML + JavaScript), đưa lên hosting miễn phí nào cũng chạy.

| Phần | Bản web độc lập dùng gì |
|---|---|
| Lưu môn học, bài học, tài liệu | IndexedDB trong trình duyệt của bạn (có sao lưu/khôi phục ra tệp `.json`) |
| Trợ lý AI, slide, video, quiz, mô hình 3D… | **Google Gemini (AI Studio, có gói miễn phí)** hoặc Claude API, bằng API key của bạn (chỉ lưu trên máy bạn) |
| Đăng nhập Google, Google Calendar | Google Identity Services + Google Calendar API (cần **OAuth Client ID**) |
| Video YouTube | Phát ngay trong trang (trình phát nhúng youtube-nocookie) |
| Mở nhanh / dùng khi mạng yếu | Service worker + có thể "Cài đặt như ứng dụng" (PWA) |

## 1. Chạy thử trên máy

Trang phải được mở qua `http://` (không mở trực tiếp file `index.html`), vì service worker và đăng nhập Google không chạy với `file://`.

```bash
cd so-hoc-web
python3 -m http.server 8080
# mở http://localhost:8080
```

## 2. Đưa lên mạng (chọn một cách)

**Netlify Drop (dễ nhất, không cần tài khoản Git):**
1. Vào https://app.netlify.com/drop
2. Kéo cả thư mục `so-hoc-web` vào trang → nhận địa chỉ dạng `https://ten-ngau-nhien.netlify.app`.
3. Có thể đổi tên miền con trong *Site configuration → Change site name*.

**GitHub Pages:**
1. Tạo repository mới (ví dụ `so-hoc`), tải toàn bộ nội dung thư mục `so-hoc-web` lên nhánh `main` (tệp `index.html` nằm ở gốc).
2. *Settings → Pages → Build and deployment → Source: Deploy from a branch*, chọn `main` / `(root)` → Save.
3. Vài phút sau trang có ở `https://<tên-github>.github.io/so-hoc/`.

**Cloudflare Pages / Vercel:** tạo dự án mới, chọn "upload" hoặc nối repository, *Build command* để trống, *Output directory* là thư mục chứa `index.html`.

## 3. Bật trợ lý AI (Google AI Studio hoặc Claude)

**Google Gemini — có gói miễn phí (mặc định):**
1. Vào https://aistudio.google.com/apikey → đăng nhập Google → **Create API key**.
2. Mở trang → biểu tượng bánh răng **Cài đặt AI & tài khoản** → chọn **Google Gemini (AI Studio)** → dán key → **Thử kết nối** → **Lưu**.
3. Mô hình mặc định: `gemini-3.8-flash` (chính) và `gemini-3.5-flash-lite` (nhanh). Bấm **Lấy danh sách mô hình từ tài khoản** để chọn mô hình khác mà key của bạn dùng được (ví dụ bản Pro).
4. Gói miễn phí giới hạn số lượt mỗi phút/ngày; tạo slide/video dài có thể bị báo "quá tải" → đợi một lúc. Theo điều khoản của Google, nội dung gửi qua gói miễn phí có thể được dùng để cải thiện sản phẩm — không gửi tài liệu mật.

**Claude (Anthropic):** tạo key tại https://console.anthropic.com/settings/keys (tài khoản API trả theo lượng dùng, khác gói Claude Pro) → trong Cài đặt chọn **Claude** → dán key.

Lưu ý bảo mật: key được lưu trong `localStorage` của trình duyệt và gửi thẳng tới máy chủ của nhà cung cấp. Chỉ nhập key trên máy của bạn. Không bao giờ ghi key vào `config.js` hay đưa lên GitHub. Với AI Studio có thể giới hạn key chỉ dùng cho "Generative Language API" trong Google Cloud Console.

## 4. Bật đăng nhập Google & Google Calendar

1. Vào https://console.cloud.google.com → tạo Project mới.
2. *APIs & Services → Library* → bật **Google Calendar API**.
3. *APIs & Services → OAuth consent screen* → User type **External** → điền tên ứng dụng, email → thêm scope `.../auth/calendar.events` → ở mục *Test users* thêm email Google của bạn (ví dụ email sinh viên VGU).
4. *APIs & Services → Credentials → Create credentials → OAuth client ID* → loại **Web application** → mục **Authorized JavaScript origins** thêm địa chỉ trang, ví dụ `https://ten-cua-ban.netlify.app` và `http://localhost:8080`.
5. Sao chép **Client ID** (dạng `xxxx.apps.googleusercontent.com`) và:
   - dán vào trang: *Cài đặt → Google Client ID*, hoặc
   - ghi vào `config.js` (`googleClientId: "..."`) để ai mở trang cũng dùng được.
6. Bấm **Đăng nhập bằng Google**. Lần đầu Google hiện cảnh báo "ứng dụng chưa được xác minh" vì đang ở chế độ thử nghiệm → *Nâng cao → Tiếp tục*.

Client ID không phải mật khẩu nên để trong `config.js` là bình thường. Nếu tài khoản trường (Google Workspace của VGU) chặn ứng dụng bên ngoài, hãy dùng tài khoản Gmail cá nhân hoặc nhờ quản trị cho phép.

## 5. Cập nhật phiên bản mới lên Netlify

Nếu đã đưa trang lên bằng Netlify Drop: vào https://app.netlify.com → chọn trang → tab **Deploys** → kéo thư mục `so-hoc-web` mới vào ô "Drag and drop your site output folder here". Địa chỉ trang giữ nguyên, dữ liệu trong trình duyệt không mất.

## 6. Dữ liệu

- Mọi thứ nằm trong trình duyệt trên **từng máy**. Đổi máy/trình duyệt → dùng *Cài đặt → Tải bản sao lưu* rồi *Khôi phục từ tệp* trên máy mới.
- Xóa dữ liệu duyệt web (cookie, dữ liệu trang) sẽ xóa sổ học → hãy sao lưu định kỳ.
- Nhập tài liệu Moodle: trên Moodle VGU chọn *Download folder* (tệp ZIP) rồi thả vào ô **Thêm nguồn (+)**.

## 7. Bản nâng cấp v12: kéo đổi kích thước, nhạc từ link, cài như ứng dụng

- **Kéo để đổi kích thước** (kích thước được lưu lại):
  - Khối trang chủ: rê chuột vào khối, kéo **cạnh phải** để đổi độ rộng (12 nấc), **cạnh dưới** để đổi chiều cao, **góc dưới phải** để đổi cả hai. Bấm đúp vào tay nắm để về mặc định. Dùng được phím ← → / ↑ ↓ khi tay nắm đang được chọn.
  - Cột các trang (môn học, lịch học, phòng lab, báo cáo, studio…): kéo vạch giữa hai cột. Trang bài học vẫn dùng thanh kéo sẵn có.
  - Bảng bên trái (Sổ học của tôi, Giao diện…): kéo mép phải.
  - Hộp thoại và widget nổi: kéo góc dưới phải.
- **Nhạc từ link:** kéo một link (YouTube, YouTube Music, SoundCloud, Spotify, tệp .mp3/.m4a/.ogg, Google Drive, Dropbox) hoặc tệp nhạc thả vào nút loa trên cùng — khi đang kéo sẽ hiện ô “Thả vào đây để phát nhạc”. Cũng có thể dán link vào ô **Link nhạc** trong bảng âm thanh, hoặc bấm Ctrl+V ở trang chủ. Trình phát mini có bài trước/tiếp, lặp 1 bài hoặc phát lần lượt, âm lượng; kéo thanh tiêu đề để di chuyển, kéo góc để phóng to.
  - YouTube/SoundCloud phát qua trình phát nhúng của chính họ; Spotify chỉ phát bằng nút ▶ trong khung (chưa đăng nhập Spotify thì nghe 30 giây).
- **Cài như ứng dụng:** trên Chrome/Edge (máy tính, Android) có nút **Cài ứng dụng** ở thanh trên cùng. iPhone/iPad: Safari → Chia sẻ → *Thêm vào MH chính*. Ứng dụng có lối tắt (Bài học mới, Lịch học, Nhạc), nhận link được chia sẻ từ app khác (Android), và hiện số bài tập cần làm trên biểu tượng.

## 8. Cấu trúc tệp

```
index.html            khung trang
app.js                toàn bộ giao diện và tính năng
app-plus.js / .css    v12: kéo đổi kích thước, nhạc từ link, cài ứng dụng
platform.js           lưu trữ IndexedDB, Claude API, Google, tải tệp
config.js             cấu hình (Google Client ID, mô hình mặc định)
sw.js                 service worker (mở nhanh, dùng khi mất mạng)
manifest.webmanifest  thông tin cài đặt như ứng dụng
icon-192.png, icon-512.png
```

Thư viện ngoài được tải từ CDN khi cần: KaTeX (công thức), three.js (mô hình 3D), pdf.js (đọc PDF), mammoth (đọc DOCX), JSZip (giải nén ZIP Moodle), Google Fonts.
