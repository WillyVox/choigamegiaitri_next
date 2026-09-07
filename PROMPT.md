# Prompt 1
PHẦN 1:
Nghiên cứu chuyên sâu, tìm hiểu sâu sắc và update cho mình các game ở trong uploaded files: 
- gây nghiện
- game có nhiều levels, độ khó tăng dần qua mỗi level
- giao diện tối ưu và bắt mắt
- hấp dẫn người chơi
- tạo cảm giác muốn chơi hoài
- cách chơi dễ thao tác
- phù hợp với mọi lứa tuổi
- game để chơi trong thời gian rảnh 
- game để thư giản
- game build và chơi trên web browser
- hiển thì vừa vặn và đẹp đẽ trên cả desktop và điện thoại

và mục tiêu chính của game là add quảng cáo kiếm tiền nên
- đặt SEO tối ưu và tuyệt vời
- có sẵn place holders cho Quảng cáo set up sau này
- sau mỗi level kết thúc hoặc game over thì chạy quảng cáo video hiển thị ngay trong khung game container, người dùng có thể skip sau 10s


PHẦN 2: THIẾT KẾ GAME BẮT MẮT, GÂY NGHIỆN & TỐI ƯU QUẢNG CÁO

Để game thu hút người chơi ở mọi lứa tuổi và mang lại dòng tiền AdSense/AdMob tối đa, bạn cần áp dụng mô hình Hyper-Casual Game Loop.
1. Cơ chế Game Loop "Gây Nghiện" (Hook Model)
* Dễ thao tác (One-Touch Control): Thao tác chỉ bằng 1 ngón tay (Drag & Drop, Tap to Match, Swipe). Không cần hướng dẫn phức tạp.
* Tăng dần độ khó (Flow State): * Level 1–5: Cực dễ để tạo cảm giác chiến thắng nhanh (Dopamine hit).
    * Level 6+: Bắt đầu xuất hiện chướng ngại vật, giới hạn thời gian hoặc giới hạn số lượt đi (Moves).
* Hiệu ứng thị giác & Âm thanh (Juiciness):
    * Khi ăn điểm/hoàn thành khối: Có hiệu ứng nổ pháo hoa, hạt sáng (particles), rung màn hình (Screen Shake).
    * Âm thanh combo vui tai (Do-Re-Mi-Fa-Sol tăng dần theo chuỗi combo).
2. Lựa chọn dòng Game phù hợp nhất
Tên Game	Thể loại	Lối chơi cốt lõi	Lý do gây nghiện
Fruit Merge (Ghép Trái Cây / Suika)	Physics Puzzle	Thả các trái cây nhỏ rơi xuống để nhập thành trái lớn hơn (nhỏ nhất là Dâu, lớn nhất là Dưa Hấu).	Cơ chế vật lý chân thực, không gian chơi giới hạn tạo sự gay cấn khi sắp tràn ly.
Block Blast / Color Match	Grid Puzzle	Xếp các khối hình (như Tetris) vào lưới 8 \times 8 để xóa hàng/cột.	Không giới hạn thời gian, kích thích tư duy sắp xếp.


PHẦN 3: KIẾN TRÚC TỐI ƯU QUẢNG CÁO (MONETIZATION STRATEGY)
Để đạt doanh thu quảng cáo cao mà không làm người chơi bỏ game:
1. Vị trí đặt Quảng cáo Banner (Ad Banner)
* Cố định ở đáy màn hình (Sticky Bottom Banner 320 \times 50).
* Đảm bảo khung chơi (Game Canvas) nằm lọt lòng ở giữa, không bị che khuất bởi Banner trên cả iPhone (có notch/home bar) và Android.
2. Quảng cáo Xen kẽ (Interstitial Ads)
* Cho xuất hiện sau khi kết thúc một Level hoặc khi Game Over.
* Quy tắc: Không hiển thị quá dồn dập (giãn cách ít nhất 60-90\text{ giây} giữa các lần xuất hiện).

3. Quảng cáo Thưởng (Rewarded Ads - Tỉ lệ chuyển đổi cao nhất)
* Cho phép người chơi xem 15–30\text{ giây} video để:
    * Chơi tiếp (Continue/Revive) khi bị thua ở điểm số kỉ lục.
    * Dùng trợ giúp (Power-ups): Xóa bớt khối thừa, gỡ bom, đổi lượt.
    * Nhận X2 điểm số cuối màn chơi.


PHẦN 4: KỸ THUẬT WEB GAME TRÊN NEXT.JS (RESPONSIVE)
Để game chạy mượt 60\text{ FPS} trên mobile browser:
* Công nghệ Canvas: Sử dụng Phaser.js hoặc Pixi.js tích hợp vào Next.js (chỉ render ở Client-side qua dynamic import với { ssr: false }).

* Tỷ lệ Màn hình Tối ưu:
    * Cố định khung Game Canvas ở tỷ lệ 9:16 (Mobile Vertical View).
    * Trên Desktop: Hiển thị khung game ở giữa màn hình với background làm mờ (Blur) hai bên hông.


# Prompt 2

the [aircfraft] does not move when mouse move, please fix that issue, also check and study in-depth to improve current implementation:
logic
layout
user-friendly
smoothy
beautifully
run perfectly on web desktop and mobile


# Prompt 3

tạo cho mình 6 icons cho 6 tựa game này để mình hiện thị trên web của mình với những tiêu chí sau 
- đơn giản
- thân thiện với người dùng
- hình hiện tại
- màu sáng tươi sáng, sang trọng
- cân đối hài hoà hiển thị trên web
- dung lượng nhẹ
- hình ảnh bắt mắt
- hài hoà với theme hiện tại của web


# Prompt 4

Mình muốn gắn tools để theo dõi lượng truy cập và chi tiết người dùng trên trang web mình, hãy nghiên cứu chuyên sâu, tìm hiểu sâu sắc và đưa cho mình các giải pháp và cách thức thực hiện