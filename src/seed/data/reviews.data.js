/**
 * Seed data for Reviews
 *
 * **Mỗi sản phẩm ACTIVE phải có ít nhất một đánh giá 2–3 sao.** Đây không phải
 * sở thích văn phong mà là ràng buộc của tính năng so sánh AI:
 * `aiRepository.findRepresentativeReviews` sắp theo rating giảm dần rồi lấy hai
 * đầu trên và một đầu dưới, nên một sản phẩm toàn 5 sao thì đầu dưới cũng là
 * lời khen và model không có gì để viết vào phần NHƯỢC ĐIỂM. Luật chống bịa ở
 * mục 7.0.1 khi đó trả về "chưa có dữ liệu đánh giá chi tiết" — chạy đúng luật,
 * nhưng tính năng mất một nửa giá trị.
 *
 * Vì `perProduct = 3`, mỗi sản phẩm cần **tối thiểu 3 review APPROVED** mới lấp
 * đủ ba khe. Ở đây mỗi sản phẩm có 3–5 review.
 *
 * Nội dung cố ý cụ thể — pin tụt sau bao lâu, quạt ồn ở tải nào, loa yếu dải
 * nào, chỗ nào hoàn thiện chưa tới. Lời khen chung chung ("máy đẹp, đóng gói
 * tốt") không cho model chất liệu nào để so sánh hai sản phẩm với nhau.
 *
 * `products.data.js` KHÔNG còn khai `reviewCount` / `averageRating`. Hai cột đó
 * do `reviewSeeder` tính từ chính các dòng dưới đây — xem chú thích ở đó.
 *
 * Quy ước: mỗi cặp (userKey, productKey) chỉ xuất hiện một lần, khớp với unique
 * index `uq_review_order_item` trên (user_id, product_id, order_item_id).
 */

const reviewsData = [
  // ----------------------------------------------------
  // LAPTOPS: MacBook Pro 14 M3 Pro
  // ----------------------------------------------------
  {
    userKey: "customer1",
    productKey: "macbookPro14M3",
    rating: 5,
    title: "Máy quá mạnh, màn hình đẹp xuất sắc!",
    content: "Mình dùng để render After Effects và lập trình backend, máy chạy cực mát và hầu như không nghe tiếng quạt. Màn hình 120Hz mượt mà màu sắc chuẩn xác tuyệt đối. Đóng gói của TechShop rất cẩn thận, giao hàng hỏa tốc trong ngày.",
    status: "APPROVED",
    reviewedAt: new Date("2026-07-20T10:00:00Z"),
  },
  {
    userKey: "customer2",
    productKey: "macbookPro14M3",
    rating: 5,
    title: "Xứng đáng từng đồng, pin dùng cả ngày không hết",
    content: "Màu Space Black cực kỳ sang trọng, ít bám vân tay hơn bản Midnight của Air. Bàn phím gõ êm tay, loa ngoài đỉnh nhất trong tất cả các dòng laptop hiện nay.",
    status: "APPROVED",
    reviewedAt: new Date("2026-07-25T14:30:00Z"),
  },
  {
    userKey: "customer3",
    productKey: "macbookPro14M3",
    rating: 4,
    title: "Hiệu năng tuyệt vời nhưng 18GB RAM là hơi sát với công việc của mình",
    content: "Mình dựng phim 4K multicam trong Premiere, mở thêm Chrome 30 tab là thấy máy bắt đầu swap sang SSD, quạt lúc đó mới quay và nghe rõ ở khoảng cách gần. Nếu ai làm nặng thật nên cân nhắc bản 36GB ngay từ đầu vì RAM hàn chết không nâng cấp được. Bù lại vỏ nhôm hoàn thiện không có kẽ hở nào, bản lề mở một tay rất chắc.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-14T09:20:00Z"),
  },
  {
    userKey: "customer4",
    productKey: "macbookPro14M3",
    rating: 3,
    title: "Máy tốt nhưng cụm cổng và tai thỏ màn hình vẫn làm mình khó chịu",
    content: "Chỉ có 3 cổng Type-C nên cắm màn hình ngoài với ổ cứng di động là hết chỗ, vẫn phải mang hub theo. Tai thỏ camera che mất phần menu bar khi mở nhiều ứng dụng, làm việc với Final Cut là thấy bất tiện. Webcam 1080p cũng chỉ ở mức tạm, họp Teams trong phòng thiếu sáng bị nhiễu hạt khá nhiều. Hiệu năng thì không có gì phải bàn.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-28T15:40:00Z"),
  },

  // ----------------------------------------------------
  // LAPTOPS: MacBook Air 13 M2
  // ----------------------------------------------------
  {
    userKey: "customer4",
    productKey: "macbookAir13M2",
    rating: 5,
    title: "Mỏng nhẹ, đẹp, học sinh sinh viên dùng 4 năm đại học vô tư",
    content: "Mua cho con gái đi học đại học, máy nhẹ mang balo không mỏi vai, pin học cả ngày trên giảng đường không cần mang củ sạc theo.",
    status: "APPROVED",
    reviewedAt: new Date("2026-07-28T09:00:00Z"),
  },
  {
    userKey: "customer6",
    productKey: "macbookAir13M2",
    rating: 4,
    title: "Không quạt nên im lặng tuyệt đối, nhưng render lâu là bị giảm hiệu năng",
    content: "Máy không có quạt nên hoàn toàn không có tiếng ồn, ngồi thư viện rất thích. Đổi lại khi export video 15 phút trong iMovie thì vỏ nhôm phía trên bàn phím nóng lên rõ và tốc độ tụt xuống khoảng nửa sau quá trình. Dùng văn phòng, học tập, xem phim thì không bao giờ gặp chuyện này.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-12T13:10:00Z"),
  },
  {
    userKey: "customer7",
    productKey: "macbookAir13M2",
    rating: 3,
    title: "Bản 256GB chật, loa mỏng hơn hẳn bản Pro",
    content: "Cài Xcode với vài simulator là ổ cứng còn hơn 60GB, phải dọn liên tục. Loa nghe nhạc thiếu bass rõ rệt so với MacBook Pro, xem phim nên cắm tai nghe. Màn hình 60Hz sau khi dùng máy 120Hz thì thấy hơi khựng khi cuộn trang. Vẫn cho 3 sao vì với tầm giá này pin và độ mỏng nhẹ thì khó máy nào bằng.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-25T10:30:00Z"),
  },
  {
    userKey: "customer8",
    productKey: "macbookAir13M2",
    rating: 5,
    title: "Pin thực tế 13 tiếng làm văn phòng, quá đủ cho nhu cầu của mình",
    content: "Mình làm kế toán, mở Excel bảng lớn với Chrome cả ngày mà tối về vẫn còn khoảng 20% pin. Bàn phím Magic Keyboard gõ nảy tay, trackpad rộng và chính xác nhất trong các laptop mình từng dùng.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-01T08:45:00Z"),
  },

  // ----------------------------------------------------
  // LAPTOPS: ASUS ROG Zephyrus G16
  // ----------------------------------------------------
  {
    userKey: "customer11",
    productKey: "rogZephyrusG16",
    rating: 5,
    title: "Màn hình OLED 240Hz đẹp không tì vết",
    content: "Chơi Cyberpunk 2077 và Black Myth Wukong bật Ray Tracing max setting cực kỳ mượt mà. Vỏ máy kim loại hoàn thiện sắc sảo như MacBook mà cấu hình lại khủng.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-06T20:30:00Z"),
  },
  {
    userKey: "customer12",
    productKey: "rogZephyrusG16",
    rating: 5,
    title: "Máy gaming mà mỏng 1.85kg, mang đi làm không thấy nặng",
    content: "Trước dùng Legion 2.5kg mang đi công tác rất mệt, đổi qua G16 nhẹ hơn hẳn mà RTX 4070 vẫn kéo tốt mọi game ở 2.5K. Bàn phím hành trình sâu, gõ code cả ngày không mỏi.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-18T19:15:00Z"),
  },
  {
    userKey: "customer1",
    productKey: "rogZephyrusG16",
    rating: 4,
    title: "Quạt ở chế độ Turbo ồn thật sự, phải đeo tai nghe",
    content: "Ở chế độ Performance thì quạt còn chấp nhận được, nhưng bật Turbo để chơi game nặng thì tiếng quạt rít lên nghe rõ cả phòng, buổi tối chơi khuya là phải đeo tai nghe. Do máy mỏng nên khu vực phím WASD cũng ấm lên sau một tiếng chơi. Hiệu năng và màn hình thì xuất sắc, chỉ là đừng mong máy mỏng mà mát và im được.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-22T21:00:00Z"),
  },
  {
    userKey: "customer2",
    productKey: "rogZephyrusG16",
    rating: 3,
    title: "Pin chơi game chỉ hơn một tiếng, RAM hàn chết không nâng được",
    content: "Pin 90Wh nghe to nhưng rút sạc chơi game thì được khoảng 70 phút là hết, mà hiệu năng cũng bị giới hạn mạnh khi dùng pin. RAM LPDDR5X hàn trực tiếp lên bo, 32GB là con số cuối cùng, không có khe nâng cấp như Legion. Củ sạc 240W to và nặng, mang theo cùng máy thì lợi thế mỏng nhẹ mất kha khá. Máy tốt nhưng cần biết rõ mấy điểm này trước khi xuống tiền 66 triệu.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-03T16:20:00Z"),
  },

  // ----------------------------------------------------
  // LAPTOPS: Dell XPS 15 9530
  // ----------------------------------------------------
  {
    userKey: "customer1",
    productKey: "dellXps15",
    rating: 5,
    title: "Hoàn thiện nhôm nguyên khối và sợi carbon, sang nhất phân khúc Windows",
    content: "Vỏ nhôm CNC với mặt trong bằng sợi carbon dệt, cầm chắc tay và không hề flex khi ấn mạnh vào giữa bàn phím. Màn hình InfinityEdge viền mỏng 500 nits, ngồi cạnh cửa sổ vẫn nhìn rõ. Trackpad kính lớn nhất mình từng dùng trên laptop Windows.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-11T10:00:00Z"),
  },
  {
    userKey: "customer2",
    productKey: "dellXps15",
    rating: 4,
    title: "Màu chuẩn 100% sRGB rất được, nhưng chỉ FHD+ ở tầm giá 53 triệu",
    content: "Mình chỉnh ảnh Lightroom, màu ra chuẩn không cần calibrate lại nhiều. Tuy nhiên ở mức giá này mà chỉ có tấm nền FHD+ 1920x1200 thì hơi thiệt, bản OLED 3.5K phải bù thêm tiền. Pin 86Wh dùng văn phòng được khoảng 8 tiếng, đủ một ngày làm việc.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-19T14:30:00Z"),
  },
  {
    userKey: "customer3",
    productKey: "dellXps15",
    rating: 4,
    title: "Loa 4 driver hay bất ngờ, webcam thì vẫn kém",
    content: "Hệ thống loa 4 loa có bass thật sự, xem phim và họp online không cần loa ngoài — điểm này hơn hẳn mấy máy Windows cùng tầm. Ngược lại webcam đặt trên viền màn hình nhưng chất lượng chỉ 720p, họp Zoom nhìn khá mờ và bị bệt màu trong phòng đèn vàng.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-26T11:45:00Z"),
  },
  {
    userKey: "customer4",
    productKey: "dellXps15",
    rating: 2,
    title: "Nóng và throttle nặng khi dựng phim, bàn phím cụm mũi tên khó dùng",
    content: "Đây là điểm mình thất vọng nhất: render Premiere khoảng 20 phút là CPU tụt xuống dưới 2.5GHz, đáy máy nóng đến mức không đặt lên chân được, quạt gào liên tục. Máy mỏng mà nhét i7-13700H với RTX 4050 vào thì tản không kịp. Thêm nữa cụm phím mũi tên lên/xuống bị chia nửa kích thước rất khó bấm khi làm Excel, và không có cổng USB-A hay HDMI nào — mọi thứ phải qua hub. Mua về làm văn phòng và đồ họa nhẹ thì tốt, làm nặng thì nên chọn máy dày hơn.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-02T17:10:00Z"),
  },

  // ----------------------------------------------------
  // LAPTOPS: Lenovo Legion Pro 5 16IRX9
  // ----------------------------------------------------
  {
    userKey: "customer5",
    productKey: "lenovoLegion5Pro",
    rating: 5,
    title: "Tản nhiệt Coldfront 5.0 quá tốt, chơi 4 tiếng CPU vẫn dưới 80 độ",
    content: "Đây là lý do chính mình chọn Legion thay vì máy mỏng hơn. Chơi Elden Ring liên tục 4 tiếng, CPU giữ quanh 78 độ và GPU 72 độ, không hề tụt xung. RTX 4060 ở đây chạy TGP 140W đầy đủ nên fps cao hơn rõ so với cùng card trên máy mỏng chạy 105W.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-13T20:00:00Z"),
  },
  {
    userKey: "customer6",
    productKey: "lenovoLegion5Pro",
    rating: 5,
    title: "Nâng cấp được RAM và SSD, mua 43 triệu mà dùng được nhiều năm",
    content: "Máy có 2 khe RAM DDR5 nên mình mua bản 16GB rồi tự thêm thanh 16GB nữa, tổng 32GB mà tốn thêm có hơn 1 triệu. Còn khe SSD thứ hai để lắp thêm ổ chứa game. Bàn phím TrueStrike hành trình 1.5mm gõ rất thoả, có cả cụm numpad đầy đủ.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-20T18:30:00Z"),
  },
  {
    userKey: "customer7",
    productKey: "lenovoLegion5Pro",
    rating: 4,
    title: "Màn hình 240Hz sáng 500 nits tốt, nhưng loa thì rất tệ",
    content: "Tấm IPS 2560x1600 240Hz phủ 100% sRGB, chơi game và làm việc đều ổn. Điểm trừ lớn là loa: chỉ 2 loa 2W đặt dưới đáy máy, âm mỏng và không có bass, mở to bị rè. Xem YouTube thôi cũng nên cắm tai nghe. Với máy gaming thì chấp nhận được nhưng đừng kỳ vọng gì ở loa.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-27T21:15:00Z"),
  },
  {
    userKey: "customer8",
    productKey: "lenovoLegion5Pro",
    rating: 3,
    title: "Nặng 2.5kg cộng củ sạc 300W, đây là máy để bàn chứ không mang đi được",
    content: "Máy nặng 2.5kg, thêm củ sạc 300W to bằng cục gạch nữa thì balo lên gần 3.5kg, mang đi học mỗi ngày là cực hình. Pin rút sạc chỉ được khoảng 3 tiếng làm văn phòng và không chơi game nổi. Nhựa ở nắp máy cũng bám vân tay và có hiện tượng flex nhẹ khi mở một tay. Hiệu năng trên giá tiền thì rất tốt, nhưng phải xác định đây là máy cắm điện một chỗ.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-04T09:50:00Z"),
  },

  // ----------------------------------------------------
  // LAPTOPS: Lenovo ThinkPad X1 Carbon Gen 12
  // ----------------------------------------------------
  {
    userKey: "customer9",
    productKey: "thinkpadX1Carbon",
    rating: 5,
    title: "1.09kg mà vẫn đạt chuẩn quân đội, bàn phím ThinkPad vô địch",
    content: "Máy nhẹ hơn cả MacBook Air mà vỏ sợi carbon xoắn không hề kêu. Bàn phím hành trình sâu và phản hồi rõ, mình gõ tài liệu 8 tiếng một ngày không mỏi tay — không có laptop mỏng nào bằng được ở điểm này. TrackPoint đỏ dùng quen rồi thì không cần chuột nữa.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-10T08:30:00Z"),
  },
  {
    userKey: "customer10",
    productKey: "thinkpadX1Carbon",
    rating: 5,
    title: "Màn hình OLED 2.8K với webcam 5MP, họp online chuyên nghiệp hẳn",
    content: "Tấm OLED 120Hz màu đen sâu, đọc tài liệu và xem phim đều đẹp. Webcam 5MP kèm màn trập vật lý và dàn mic 4 hướng, khách hàng bảo tiếng mình rõ hơn hẳn so với máy cũ. Có cả 2 cổng Thunderbolt 4 lẫn 2 USB-A và HDMI nên không cần hub.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-21T10:20:00Z"),
  },
  {
    userKey: "customer11",
    productKey: "thinkpadX1Carbon",
    rating: 4,
    title: "Pin 57Wh với màn OLED là điểm yếu, dùng thực tế chỉ 6 tiếng",
    content: "Pin chỉ 57Wh mà phải kéo màn OLED 2.8K 120Hz nên thực tế mình dùng được khoảng 6 tiếng làm văn phòng, phải hạ tần số quét xuống 60Hz mới lên được 8 tiếng. Máy mỏng nên quạt cũng quay sớm, khi mở nhiều tab Chrome cùng Teams là nghe tiếng vù nhẹ. Bù lại sạc rất nhanh, 30 phút được hơn nửa pin.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-29T15:00:00Z"),
  },
  {
    userKey: "customer12",
    productKey: "thinkpadX1Carbon",
    rating: 3,
    title: "Giá 59 triệu nhưng chỉ có card tích hợp và loa yếu",
    content: "Ở mức giá gần 60 triệu mà chỉ có Intel Arc tích hợp, không làm được đồ họa 3D hay chơi game gì đáng kể. Loa hướng xuống nghe mỏng, thiếu dải trầm hoàn toàn, kém xa MacBook cùng tầm giá. Màn OLED bóng nên ngồi dưới đèn tuýp bị phản chiếu khá rõ, và mình cũng hơi lo burn-in khi mở Excel với thanh công cụ tĩnh suốt ngày. Máy tốt cho người cần nhẹ, bền, bàn phím đẹp — nhưng phải trả giá cao cho đúng ba thứ đó.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-05T11:30:00Z"),
  },

  // ----------------------------------------------------
  // LAPTOPS: ASUS Zenbook 14 OLED UX3405MA
  // ----------------------------------------------------
  {
    userKey: "customer1",
    productKey: "asusZenbook14Oled",
    rating: 5,
    title: "Màn OLED 3K 120Hz 600 nits ở giá 29 triệu là quá đáng đồng tiền",
    content: "Tấm nền OLED 2880x1800 sáng 600 nits khi xem HDR, màu rực và đen sâu, đẹp hơn cả mấy máy 40 triệu dùng IPS. Máy nhẹ 1.2kg, vỏ nhôm hoàn thiện tốt, bản lề mở được 180 độ. Pin 75Wh dùng văn phòng khoảng 10 tiếng.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-15T09:40:00Z"),
  },
  {
    userKey: "customer2",
    productKey: "asusZenbook14Oled",
    rating: 4,
    title: "Loa Harman Kardon khá ổn, nhưng quạt kêu lạch cạch ở tải nhẹ",
    content: "Loa có bass nhẹ và tiếng vocal rõ, xem phim trên giường không cần loa ngoài. Điểm trừ là quạt của máy bật/tắt liên tục kể cả khi chỉ duyệt web, tiếng không to nhưng cứ lên xuống nên dễ để ý trong phòng yên tĩnh. Vào BIOS đặt chế độ Whisper thì đỡ hơn nhiều.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-23T13:20:00Z"),
  },
  {
    userKey: "customer3",
    productKey: "asusZenbook14Oled",
    rating: 4,
    title: "Core Ultra 5 làm văn phòng thừa sức, đồ họa nặng thì không",
    content: "Mình lập trình web, mở Docker với VS Code và chục tab Chrome vẫn mượt. Nhưng thử dựng video 4K trong DaVinci thì máy nóng nhanh và xuất chậm hơn hẳn máy có card rời. Bàn phím gõ tạm ổn, hành trình hơi nông so với ThinkPad. Webcam 1080p có Windows Hello nhận mặt nhanh.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-30T16:00:00Z"),
  },
  {
    userKey: "customer4",
    productKey: "asusZenbook14Oled",
    rating: 3,
    title: "Màn hình bóng, chỉ 2 cổng Type-C và RAM hàn chết",
    content: "Tấm OLED không có lớp chống chói nên ngồi quán cà phê gần cửa kính là thấy mặt mình trong màn hình. Máy chỉ có 2 cổng Thunderbolt cộng 1 USB-A, cắm sạc là mất một cổng nên gần như luôn phải dùng hub. RAM 16GB hàn chết không nâng cấp được, mua bây giờ thì 3-4 năm nữa sẽ thấy chật. Màn hình đẹp và giá tốt vẫn là điểm mạnh nhất của máy này.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-05T10:10:00Z"),
  },

  // ----------------------------------------------------
  // LAPTOPS: Dell Inspiron 14 5430
  // ----------------------------------------------------
  {
    userKey: "customer5",
    productKey: "dellInspiron14",
    rating: 5,
    title: "19 triệu có 16GB RAM, 512GB SSD kèm Office bản quyền là quá hợp lý",
    content: "Mua cho em trai vào đại học, cấu hình 16GB RAM ở tầm giá này rất khó tìm, lại tặng kèm Office Home & Student vĩnh viễn nên không phải mua thêm. Màn hình 14 inch tỷ lệ 16:10 chống chói, học online và soạn tài liệu rất thoải mái.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-12T08:00:00Z"),
  },
  {
    userKey: "customer6",
    productKey: "dellInspiron14",
    rating: 4,
    title: "Máy mát và im, pin 54Wh được khoảng 7 tiếng học tập",
    content: "Con i5-1335U là chip tiết kiệm điện nên máy gần như không nóng và quạt hầu như không quay khi chỉ soạn Word với duyệt web. Pin thực tế mình đo được gần 7 tiếng ở độ sáng 50%. Sạc bằng cổng Type-C nên dùng chung củ sạc điện thoại được.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-19T09:30:00Z"),
  },
  {
    userKey: "customer7",
    productKey: "dellInspiron14",
    rating: 4,
    title: "Bàn phím gõ êm, nhưng vỏ nhựa và bản lề hơi ọp ẹp",
    content: "Bàn phím có đèn nền, gõ êm và không bị ồn, làm việc buổi tối rất tiện. Đổi lại toàn bộ vỏ là nhựa, ấn vào vùng giữa bàn phím thấy lún nhẹ, mở nắp một tay thì màn hình bị lắc. Ở mức giá 19 triệu thì mình thấy chấp nhận được nhưng đừng so với máy vỏ nhôm.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-24T14:15:00Z"),
  },
  {
    userKey: "customer8",
    productKey: "dellInspiron14",
    rating: 3,
    title: "Màn hình chỉ 250 nits và màu nhợt, làm đồ họa thì không được",
    content: "Đây là điểm yếu rõ nhất: tấm nền WVA độ sáng khoảng 250 nits, phủ màu thấp nên ảnh nhìn nhợt nhạt, chỉnh ảnh hay thiết kế là sai màu. Ra ngoài trời hoặc ngồi cạnh cửa sổ là gần như không thấy gì. Loa cũng nhỏ và rè khi mở lớn. Máy này chỉ nên mua cho học tập, văn phòng và giải trí nhẹ.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-31T11:00:00Z"),
  },
  {
    userKey: "customer9",
    productKey: "dellInspiron14",
    rating: 2,
    title: "Iris Xe không kéo nổi việc gì nặng, SSD cũng chậm hơn kỳ vọng",
    content: "Mình tưởng 16GB RAM là chạy được đồ họa nhẹ nhưng card tích hợp Iris Xe render Premiere cực chậm, xuất một video 10 phút mất gần nửa tiếng và máy nóng lên rõ ở phía trái bàn phím. Chơi game thì chỉ được vài tựa nhẹ ở mức thấp. Ổ SSD PCIe trong máy đo được khoảng 2000MB/s, thấp hơn nhiều máy cùng giá. Nếu chỉ Word, Excel, Chrome thì máy ổn, còn ngoài phạm vi đó là hụt hơi ngay.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-06T16:40:00Z"),
  },

  // ----------------------------------------------------
  // SMARTPHONES: iPhone 15 Pro Max
  // ----------------------------------------------------
  {
    userKey: "customer3",
    productKey: "iphone15ProMax",
    rating: 5,
    title: "Khung Titan nhẹ rõ rệt so với bản 14 Pro Max",
    content: "Cầm trên tay nhẹ hơn hẳn, viền bo cong nhẹ không bị cấn tay như thế hệ trước. Camera zoom 5x chụp concert và phong cảnh siêu nét, cổng Type-C tiện lợi dùng chung sạc với Mac.",
    status: "APPROVED",
    reviewedAt: new Date("2026-07-22T08:15:00Z"),
  },
  {
    userKey: "customer4",
    productKey: "iphone15ProMax",
    rating: 4,
    title: "Máy rất tốt nhưng sạc hơi ấm khi chơi game nặng",
    content: "Hiệu năng chip A17 Pro mạnh mẽ, Dynamic Island tiện lợi. Lúc chơi Genshin Impact máy có ấm lên ở viền kim loại nhưng sau bản cập nhật iOS mới đã mát hơn nhiều.",
    status: "APPROVED",
    reviewedAt: new Date("2026-07-29T16:00:00Z"),
  },
  {
    userKey: "customer5",
    productKey: "iphone15ProMax",
    rating: 5,
    title: "Quay video 4K60 ProRes ổn định nhất trong các điện thoại mình từng dùng",
    content: "Mình quay vlog, chống rung của 15 Pro Max đi bộ vẫn êm như gimbal, màu da người lên tự nhiên không cần chỉnh. Nút Action thay cho cần gạt rung tiện hơn nhiều vì gán được vào chế độ camera. Pin quay liên tục 4K được khoảng hơn một tiếng rưỡi mới báo nóng.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-16T12:30:00Z"),
  },
  {
    userKey: "customer6",
    productKey: "iphone15ProMax",
    rating: 3,
    title: "Sạc 20W quá chậm và pin 4422mAh không bằng máy Android cùng tầm",
    content: "Sạc từ 0 lên 100% mất hơn một tiếng rưỡi trong khi mấy máy Android tầm này sạc 45-120W chỉ mất 20-40 phút. Pin dùng nặng có Instagram với TikTok thì tối là phải cắm sạc, không dư dả như con số 4422mAh nghe tưởng nhiều. Máy vẫn nặng 221g, để trong túi áo thấy trĩu. Camera và độ mượt thì không có gì phải bàn, chỉ là mấy điểm trên khiến mình không cho điểm cao hơn.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-31T18:20:00Z"),
  },

  // ----------------------------------------------------
  // SMARTPHONES: Samsung Galaxy S24 Ultra
  // ----------------------------------------------------
  {
    userKey: "customer5",
    productKey: "galaxyS24Ultra",
    rating: 5,
    title: "Galaxy AI đỉnh cao, màn hình chống chói cực tốt",
    content: "Màn hình phẳng với kính Gorilla Armor chống lóa ngoài trời nắng siêu đỉnh. Tính năng Khoanh tròn tìm kiếm và dịch trực tiếp hỗ trợ công việc rất nhiều.",
    status: "APPROVED",
    reviewedAt: new Date("2026-07-26T11:20:00Z"),
  },
  {
    userKey: "customer6",
    productKey: "galaxyS24Ultra",
    rating: 4,
    title: "Bút S-Pen tiện lợi, camera zoom 100x sắc nét",
    content: "S-Pen ghi chú nhanh khi màn hình khóa rất hữu ích cho người làm văn phòng. Pin 5000mAh onscreen thoải mái hơn 7 tiếng liên tục.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-01T09:40:00Z"),
  },
  {
    userKey: "customer7",
    productKey: "galaxyS24Ultra",
    rating: 5,
    title: "Cam kết 7 năm cập nhật và pin 5000mAh, mua một lần dùng rất lâu",
    content: "Samsung cam kết 7 năm update Android nên mình không phải nghĩ đến đổi máy trong nhiều năm. Pin 5000mAh dùng nặng cả ngày vẫn còn khoảng 25% buổi tối, sạc 45W được hơn nửa pin trong 30 phút. Máy chạy Snapdragon 8 Gen 3 bản for Galaxy nên chơi game và đa nhiệm rất mượt, không thấy nóng bất thường.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-17T14:50:00Z"),
  },
  {
    userKey: "customer8",
    productKey: "galaxyS24Ultra",
    rating: 3,
    title: "Zoom 100x chỉ để cho vui, camera 10MP tele 3x là bước lùi",
    content: "Ảnh zoom 100x nhìn trên điện thoại thì tạm nhưng mở trên máy tính là thấy bết như tranh vẽ, dùng thực tế gần như không. Samsung còn hạ camera tele 3x từ 10x quang học của bản S23 Ultra xuống 5x nên khoảng zoom trung bình kém hơn thế hệ trước. Máy nặng 232g và to, dùng một tay là không thể. Xử lý ảnh cũng đẩy màu và làm nét quá tay, da người nhìn không tự nhiên bằng iPhone. Bù lại màn hình và pin thì tuyệt vời.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-02T20:00:00Z"),
  },

  // ----------------------------------------------------
  // SMARTPHONES: Xiaomi 14 Pro
  // ----------------------------------------------------
  {
    userKey: "customer10",
    productKey: "xiaomi14Pro",
    rating: 5,
    title: "Sạc 120W đầy pin trong 20 phút, dùng rồi là không quay lại được",
    content: "Cắm sạc lúc đánh răng buổi sáng, ra khỏi nhà là pin đã đầy. Sạc 120W từ 0 lên 100% mình bấm đồng hồ đúng 21 phút, sạc không dây 50W cũng nhanh hơn cả sạc có dây của nhiều máy khác. Màn hình LTPO 2K sáng 3000 nits, ra nắng trưa vẫn đọc rõ tin nhắn.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-14T07:30:00Z"),
  },
  {
    userKey: "customer11",
    productKey: "xiaomi14Pro",
    rating: 4,
    title: "Camera Leica màu rất có chất, nhưng cần chọn đúng profile",
    content: "Chế độ Leica Authentic cho màu trầm và tương phản cao, chụp phố buổi tối rất có không khí. Nhưng phải chủ động chuyển profile vì Leica Vibrant thì lại đẩy màu khá gắt. Cụm 3 camera đều 50MP nên zoom 3.2x không bị tụt chất lượng. 16GB RAM giữ được rất nhiều app trong nền.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-22T19:40:00Z"),
  },
  {
    userKey: "customer12",
    productKey: "xiaomi14Pro",
    rating: 4,
    title: "Hiệu năng ngang máy 34 triệu mà giá chỉ 23 triệu",
    content: "Cùng con Snapdragon 8 Gen 3 với S24 Ultra mà giá thấp hơn 11 triệu, chơi Genshin max setting 60fps ổn định, có nóng lên ở viền nhưng không đến mức phải bỏ máy xuống. Khung nhôm và mặt kính cong hoàn thiện chắc chắn, không hề có cảm giác hàng giá rẻ.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-28T21:20:00Z"),
  },
  {
    userKey: "customer1",
    productKey: "xiaomi14Pro",
    rating: 3,
    title: "HyperOS nhiều ứng dụng rác và quảng cáo, hậu mãi cũng là dấu hỏi",
    content: "Máy vừa mở hộp đã có cả chục app cài sẵn mình không dùng, một số còn đẩy thông báo quảng cáo trong ứng dụng hệ thống, phải mất buổi tối ngồi tắt từng cái. Cam kết cập nhật chỉ 4 năm Android, ngắn hơn 7 năm của Samsung. Máy bản quốc tế nên bảo hành ở Việt Nam không rộng như Apple hay Samsung. Phần cứng thì thực sự tốt trên giá tiền, phần mềm và hậu mãi là chỗ phải cân nhắc.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-04T13:00:00Z"),
  },

  // ----------------------------------------------------
  // TABLETS: iPad Pro 12.9 M2
  // ----------------------------------------------------
  {
    userKey: "customer2",
    productKey: "ipadPro129M2",
    rating: 5,
    title: "Màn Mini-LED XDR xem phim HDR đẹp hơn cả TV nhà mình",
    content: "Tấm Mini-LED 2732x2048 độ sáng đỉnh 1600 nits, xem phim HDR trên Netflix thấy vùng tối có chi tiết và vùng sáng không bị cháy. Kết hợp 120Hz ProMotion với Apple Pencil thì vẽ trong Procreate gần như không có độ trễ, cảm giác như vẽ trên giấy.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-13T10:15:00Z"),
  },
  {
    userKey: "customer3",
    productKey: "ipadPro129M2",
    rating: 5,
    title: "Chip M2 mạnh ngang laptop, 4 loa nghe cực hay",
    content: "Mình dựng video trong LumaFusion với 3 track 4K vẫn tua mượt không rớt khung. Hệ thống 4 loa có âm trường rộng và bass thật, xem phim không cần tai nghe. Máy mỏng và hoàn thiện nhôm liền khối rất chắc tay.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-20T15:30:00Z"),
  },
  {
    userKey: "customer4",
    productKey: "ipadPro129M2",
    rating: 4,
    title: "Bản 128GB nhanh hết chỗ và phụ kiện thì quá đắt",
    content: "Máy 32 triệu nhưng chỉ có 128GB, cài vài app đồ họa với lưu ít video 4K là hết, mà iPad không có khe thẻ nhớ. Muốn dùng đủ thì phải mua thêm Apple Pencil 2 khoảng 3.5 triệu và Magic Keyboard gần 9 triệu, đội tổng chi phí lên rất nhiều. Bản thân máy thì không có gì để phàn nàn.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-27T09:00:00Z"),
  },
  {
    userKey: "customer5",
    productKey: "ipadPro129M2",
    rating: 3,
    title: "Phần cứng thừa sức nhưng iPadOS vẫn giới hạn, và máy nặng để cầm tay",
    content: "Có chip M2 mạnh như MacBook nhưng iPadOS không cho chạy phần mềm desktop, Stage Manager chia cửa sổ vẫn cứng nhắc và giới hạn số app. Mình mua với ý định thay laptop nhưng cuối cùng vẫn phải mở máy tính để làm mấy việc đơn giản như quản lý file hay chạy Docker. Máy 682g cầm đọc sách trên giường khoảng 20 phút là mỏi tay, bản 11 inch phù hợp hơn nếu chỉ đọc và ghi chú. Đắt tiền cho một phần mềm chưa tương xứng với phần cứng.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-03T11:20:00Z"),
  },

  // ----------------------------------------------------
  // TABLETS: Samsung Galaxy Tab S9 Ultra
  // ----------------------------------------------------
  {
    userKey: "customer6",
    productKey: "galaxyTabS9Ultra",
    rating: 5,
    title: "Màn 14.6 inch AMOLED kèm S-Pen miễn phí, ghi chú họp quá thích",
    content: "Màn hình 14.6 inch to như laptop, chia đôi cửa sổ đọc tài liệu bên này ghi chú bên kia rất thoải mái. S-Pen tặng kèm trong hộp chứ không phải mua thêm như Apple Pencil, độ trễ thấp và có cả cảm biến lực. Máy còn kháng nước IP68, làm rơi nước không phải lo.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-15T13:45:00Z"),
  },
  {
    userKey: "customer7",
    productKey: "galaxyTabS9Ultra",
    rating: 4,
    title: "Pin 11200mAh trụ được 2 ngày, có khe thẻ nhớ tiện hơn iPad",
    content: "Pin dùng đọc tài liệu và xem phim nhẹ được gần 2 ngày mới sạc. Máy có khe MicroSD lắp thẻ 1TB nên không phải cân nhắc bản dung lượng cao, điểm này hơn iPad rõ ràng. Chế độ DeX biến máy thành desktop có cửa sổ thật sự, làm việc đa nhiệm tốt hơn iPadOS.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-23T08:30:00Z"),
  },
  {
    userKey: "customer8",
    productKey: "galaxyTabS9Ultra",
    rating: 4,
    title: "To quá nên chỉ dùng được khi kê bàn hoặc gác chân",
    content: "Máy 14.6 inch nặng 732g, cầm một tay là không thể, mình luôn phải kê bàn hoặc dựng vào gối. Cho vào balo cũng phải chọn loại ngăn lớn. Đổi lại nếu ngồi bàn làm việc thì diện tích màn hình này thay được màn hình phụ. Cần xác định rõ đây là máy để bàn, không phải máy cầm tay.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-29T17:10:00Z"),
  },
  {
    userKey: "customer9",
    productKey: "galaxyTabS9Ultra",
    rating: 3,
    title: "Ứng dụng Android cho tablet vẫn kém, camera trước đặt sai chỗ",
    content: "Đây là vấn đề cố hữu: rất nhiều app Android chỉ là bản điện thoại kéo giãn ra, chữ và nút bấm to bất thường, kém xa hệ sinh thái app cho iPad. Camera trước kép đặt ở viền cạnh dài nên khi dùng máy dọc để họp là thấy mặt mình từ bên hông. Cụm camera sau 13MP cũng chỉ ở mức tạm dùng để scan tài liệu. Phần cứng và S-Pen thì rất tốt, phần mềm mới là chỗ hụt.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-05T14:00:00Z"),
  },

  // ----------------------------------------------------
  // AUDIO: Sony WH-1000XM5
  // ----------------------------------------------------
  {
    userKey: "customer7",
    productKey: "sonyWh1000Xm5",
    rating: 5,
    title: "Chống ồn đỉnh chóp, đeo êm tai không bị đau đầu",
    content: "Khử tiếng ồn trên máy bay và văn phòng ồn ào cực tốt. Chất âm bass chắc nịch, âm trường thoáng đãng. Rất hài lòng về dịch vụ tư vấn của shop.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-04T15:10:00Z"),
  },
  {
    userKey: "customer8",
    productKey: "sonyWh1000Xm5",
    rating: 5,
    title: "Pin 30 tiếng có ANC, đi công tác không cần mang sạc",
    content: "Mình bay Hà Nội - TP.HCM tuần hai lần, sạc một lần dùng cả tuần. Đeo liên tục 5 tiếng trên máy bay tai không bị nóng hay ép, đệm tai mềm hơn hẳn bản XM4. Đàm thoại có 8 micro nên đối tác nghe rõ dù mình đứng ngoài đường.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-18T11:00:00Z"),
  },
  {
    userKey: "customer9",
    productKey: "sonyWh1000Xm5",
    rating: 4,
    title: "Âm hay nhưng bass hơi nhiều, phải chỉnh EQ mới trung tính",
    content: "Mặc định Sony đẩy dải trầm khá mạnh, nghe nhạc EDM thì phê nhưng nghe acoustic hay nhạc cụ mộc thì bass lấn lên tiếng vocal. Vào app Headphones Connect hạ bass xuống 2 nấc là cân bằng lại. Hỗ trợ LDAC nghe nhạc lossless trên Android rất rõ chi tiết, còn iPhone thì chỉ có AAC nên không tận dụng được.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-26T16:30:00Z"),
  },
  {
    userKey: "customer10",
    productKey: "sonyWh1000Xm5",
    rating: 3,
    title: "Không gập được nên hộp rất to, và khung nhựa dễ xước",
    content: "Sony bỏ bản lề gập của XM4 nên hộp đựng XM5 to gần gấp đôi, nhét vào balo laptop là chiếm hết một ngăn — với tai nghe mua để mang đi thì đây là bước lùi khó hiểu. Khung headband bằng nhựa nhám, mới dùng hai tháng đã có vài vết xước nhỏ và không thay được đệm tai bằng hàng ngoài. Tai nghe cũng không kháng nước nên đi mưa hay tập thể thao là không dùng được. Chất âm và chống ồn thì vẫn hàng đầu.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-01T19:20:00Z"),
  },

  // ----------------------------------------------------
  // AUDIO: Apple AirPods Pro 2 (USB-C)
  // ----------------------------------------------------
  {
    userKey: "customer8",
    productKey: "airpodsPro2",
    rating: 5,
    title: "Tiện dụng tuyệt đối khi dùng trong hệ sinh thái Apple",
    content: "Chuyển đổi thiết bị giữa iPhone và MacBook liền mạch không có độ trễ. Chế độ Adaptive Audio tự giảm âm lượng khi mình bắt đầu nói chuyện với đồng nghiệp.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-05T18:00:00Z"),
  },
  {
    userKey: "customer9",
    productKey: "airpodsPro2",
    rating: 5,
    title: "Chống ồn tốt nhất trong các tai true wireless mình từng dùng",
    content: "Chip H2 khử ồn thực sự hơn bản đời một khoảng rõ, đi xe bus tiếng động cơ gần như tắt hẳn. Chế độ Xuyên âm tự nhiên đến mức quên là đang đeo tai nghe. Có IP54 nên đi mưa nhỏ hay chạy bộ ra mồ hôi không phải lo.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-19T07:40:00Z"),
  },
  {
    userKey: "customer10",
    productKey: "airpodsPro2",
    rating: 4,
    title: "Pin tai chỉ 6 tiếng, họp online cả ngày là không đủ",
    content: "Mỗi bên tai được khoảng 6 tiếng có ANC, mình họp liên tục buổi sáng là phải bỏ vào hộp sạc lúc nghỉ trưa. Hộp bù thêm 24 tiếng nên tổng thể vẫn ổn, chỉ là không liền mạch được như tai over-ear 30 tiếng. Đổi sang cổng USB-C là thay đổi rất đáng, dùng chung sạc với iPhone và MacBook.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-27T12:00:00Z"),
  },
  {
    userKey: "customer11",
    productKey: "airpodsPro2",
    rating: 2,
    title: "Dùng với Android mất gần hết tính năng, chất âm cũng chỉ AAC",
    content: "Mình đổi sang điện thoại Android và gần như mất hết giá trị của cặp tai này: không có Âm thanh không gian, không tự chuyển thiết bị, không đổi được chế độ chống ồn, không cả kiểm tra pin tử tế và không có app để chỉnh EQ. Codec cao nhất chỉ là AAC, không có LDAC hay aptX nên nghe nhạc lossless là vô nghĩa. Đầu silicon cũng làm tai mình bí sau khoảng hai tiếng. Nếu bạn ở trong hệ sinh thái Apple thì đây là 5 sao, còn ngoài ra thì có nhiều lựa chọn tốt hơn ở cùng giá.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-04T20:30:00Z"),
  },

  // ----------------------------------------------------
  // AUDIO: Marshall Stanmore III
  // ----------------------------------------------------
  {
    userKey: "customer12",
    productKey: "marshallStanmore3",
    rating: 5,
    title: "Vừa nghe nhạc hay vừa là đồ decor phòng khách sang trọng",
    content: "Âm trầm sâu lắng, tiếng guitar và vocal rõ từng chi tiết. Thiết kế da cổ điển và núm xoay kim loại mang lại cảm xúc hoài niệm rất đẹp.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-03T17:15:00Z"),
  },
  {
    userKey: "customer1",
    productKey: "marshallStanmore3",
    rating: 5,
    title: "Woofer 50W đánh cả phòng 25m2, ba núm xoay chỉnh âm rất trực quan",
    content: "Loa woofer 50W cộng hai tweeter 15W cho tiếng đủ lớn để mở tiệc trong phòng khách 25m2 mà không rè. Ba núm xoay đồng cho âm lượng, bass và treble chỉnh bằng tay rất thích, không phải mở app. Hoàn thiện vinyl bọc khung gỗ nhìn và cầm đều thấy đắt tiền.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-16T20:00:00Z"),
  },
  {
    userKey: "customer2",
    productKey: "marshallStanmore3",
    rating: 4,
    title: "Chất âm ấm và dày, nhưng không phải loa cho người cần trung tính",
    content: "Marshall tinh chỉnh theo hướng ấm, bass dày và mid nhấn, nghe rock với blues thì rất có chất. Nhưng nếu bạn cần âm trung tính để nghe classical hay jazz thì loa này đẩy màu âm khá nhiều, phải hạ bass xuống mới nghe chi tiết được. Không có mic nên không dùng được trợ lý ảo.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-24T18:40:00Z"),
  },
  {
    userKey: "customer3",
    productKey: "marshallStanmore3",
    rating: 3,
    title: "Phải cắm điện liên tục, 10 triệu mà không có pin và Wi-Fi",
    content: "Loa không có pin, bắt buộc cắm nguồn 100-240V nên không mang ra sân hay đi picnic được — mua rồi mới thấy bất tiện, cần loa di động thì phải chọn dòng khác. Ở giá gần 10 triệu mà chỉ có Bluetooth, không có Wi-Fi, AirPlay hay Spotify Connect, nên nghe nhạc là điện thoại phải ở gần và có cuộc gọi đến là nhạc ngắt. Loa mono không tạo được âm trường stereo rộng, muốn stereo phải mua hai cái. Tiếng hay và đẹp thì đúng, nhưng tính năng thì thiếu so với giá.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-02T16:10:00Z"),
  },

  // ----------------------------------------------------
  // AUDIO: Sony WF-1000XM5
  // ----------------------------------------------------
  {
    userKey: "customer10",
    productKey: "sonyWf1000Xm5",
    rating: 5,
    title: "Nhỏ hơn bản XM4 25% mà chống ồn còn tốt hơn",
    content: "Bản XM4 to và cấn tai, XM5 nhỏ gọn hơn hẳn nên mình đeo được 4 tiếng liên tục không đau. Chip QN2e với 6 micro khử tiếng ồn văn phòng và tiếng điều hòa gần như hoàn toàn. Driver Dynamic X 8.4mm cho bass chắc và tiếng vocal rất rõ.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-11T09:15:00Z"),
  },
  {
    userKey: "customer11",
    productKey: "sonyWf1000Xm5",
    rating: 5,
    title: "Có LDAC nghe nhạc lossless, đàm thoại rõ hơn AirPods",
    content: "Hỗ trợ LDAC nên stream Apple Music lossless trên Android nghe được chi tiết mà AAC bỏ mất. Micro có xử lý AI khử ồn nên gọi ngoài đường đối tác vẫn nghe rõ tiếng mình. App Headphones Connect chỉnh EQ 5 dải và đặt chế độ theo địa điểm rất chi tiết.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-21T14:20:00Z"),
  },
  {
    userKey: "customer12",
    productKey: "sonyWf1000Xm5",
    rating: 4,
    title: "Pin 8 tiếng tốt nhưng hộp chỉ bù thêm 16 tiếng",
    content: "Mỗi bên tai 8 tiếng có ANC là dài hơn AirPods Pro rõ, nhưng hộp sạc chỉ bù được 16 tiếng nên tổng 24 tiếng, thấp hơn nhiều đối thủ 30 tiếng. Hộp cũng làm bằng nhựa nhám dễ bám bẩn và không sạc ngược được từ điện thoại. Chỉ kháng nước IPX4 nên tập gym ổn còn đi mưa to thì nên tránh.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-30T10:50:00Z"),
  },
  {
    userKey: "customer1",
    productKey: "sonyWf1000Xm5",
    rating: 3,
    title: "Đầu silicon polyurethane dễ tuột khi chạy bộ, giá lại cao",
    content: "Đệm tai bằng bọt polyurethane bám tai tốt khi ngồi yên nhưng chạy bộ khoảng 15 phút là bên phải bắt đầu tuột dần, phải đẩy lại liên tục — tai nghe không có vành hay móc nên không phù hợp cho vận động mạnh. Đệm này cũng nhanh bẩn và không mua thay thế dễ như đầu silicon thường. Giá 7 triệu cho tai true wireless cũng khá cao khi hãng khác có LDAC và chống ồn tốt ở mức 4-5 triệu. Chất âm thì đúng là hạng nhất.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-06T08:20:00Z"),
  },
  {
    userKey: "customer6",
    productKey: "sonyWf1000Xm5",
    rating: 1,
    title: "Đánh giá spam vi phạm chính sách",
    content: "Bình luận chứa nội dung quảng cáo spam liên kết ngoài đã bị hệ thống phát hiện và ẩn.",
    status: "HIDDEN", // HIDDEN review edge case!
    reviewedAt: new Date("2026-08-09T08:00:00Z"),
  },

  // ----------------------------------------------------
  // WEARABLES: Apple Watch Ultra 2
  // ----------------------------------------------------
  {
    userKey: "customer1",
    productKey: "appleWatchUltra2",
    rating: 5,
    title: "Đồng hồ dã ngoại đỉnh nhất mình từng sở hữu",
    content: "Mình dùng đi trekking Tà Năng Phan Dũng định vị GPS cực chuẩn, pin trụ được 3 ngày không cần sạc. Màn hình 3000 nits siêu sáng xem rõ dưới trời nắng gắt.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-07T12:00:00Z"),
  },
  {
    userKey: "customer2",
    productKey: "appleWatchUltra2",
    rating: 5,
    title: "Vỏ Titan và kính Sapphire sau 6 tháng không một vết xước",
    content: "Mình làm công trường, va quệt liên tục mà mặt kính Sapphire vẫn sạch không vết nào, khung Titan chỉ hơi mờ đi chút ở cạnh. Kháng nước 100m nên đi lặn biển Nha Trang không phải tháo ra. Nút Action màu cam gán vào bấm đo vòng lặp tập rất tiện khi đeo găng tay.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-17T07:00:00Z"),
  },
  {
    userKey: "customer3",
    productKey: "appleWatchUltra2",
    rating: 4,
    title: "Pin 36 tiếng tốt cho Apple Watch nhưng vẫn kém đồng hồ Garmin",
    content: "So với các dòng Apple Watch khác thì 36 tiếng là dài, mình sạc hai ngày một lần. Nhưng nếu bật GPS đo chạy bộ liên tục thì tụt nhanh, một buổi chạy 2 tiếng ăn khoảng 15% pin. Mấy đồng hồ thể thao chuyên dụng cùng giá trụ được cả tuần. Chọn Ultra 2 là vì hệ sinh thái và tính năng sức khỏe, không phải vì pin.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-25T18:00:00Z"),
  },
  {
    userKey: "customer4",
    productKey: "appleWatchUltra2",
    rating: 3,
    title: "49mm quá to và dày với tay nhỏ, 22 triệu mà chỉ dùng được với iPhone",
    content: "Mặt 49mm dày 14.4mm nặng 61g, tay mình nhỏ nên đeo nhìn thô và ngủ đêm bị cấn, phải tháo ra nên mất luôn tính năng theo dõi giấc ngủ. Máy chỉ hoạt động với iPhone, ai dùng Android là bỏ hẳn ý định. Ở Việt Nam tính năng đo huyết áp không có và ECG cũng cần bật vùng khác mới dùng được. Giá 22 triệu cho một đồng hồ phải sạc hai ngày một lần vẫn là khó thuyết phục nếu bạn không thực sự leo núi hay lặn biển.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-01T21:30:00Z"),
  },

  // ----------------------------------------------------
  // WEARABLES: Samsung Galaxy Watch 6 Classic
  // ----------------------------------------------------
  {
    userKey: "customer2",
    productKey: "galaxyWatch6Classic",
    rating: 5,
    title: "Viền xoay vật lý dùng rồi mới thấy hơn hẳn cảm ứng",
    content: "Vành Bezel xoay tách tiếng lách cách rất thoả tay, lướt danh sách thông báo hay chọn menu nhanh và chính xác hơn nhiều so với chạm vào màn hình bé. Đeo găng tay hay tay ướt vẫn điều khiển được. Vỏ thép không gỉ 47mm hoàn thiện chắc và nhìn ra dáng đồng hồ truyền thống chứ không như miếng nhựa vuông.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-14T08:10:00Z"),
  },
  {
    userKey: "customer3",
    productKey: "galaxyWatch6Classic",
    rating: 4,
    title: "Cảm biến BIA đo mỡ cơ khá hay, theo dõi giấc ngủ chi tiết",
    content: "Cảm biến BIA đo tỷ lệ mỡ và khối cơ, mình đối chiếu với máy InBody ở phòng gym thì lệch không nhiều, dùng để theo dõi xu hướng rất ổn. Phân tích giấc ngủ chia giai đoạn và cho điểm mỗi sáng, có cả phát hiện ngáy qua điện thoại. Chuẩn 5ATM kèm MIL-STD-810H nên đi mưa và va đập không lo.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-22T06:50:00Z"),
  },
  {
    userKey: "customer4",
    productKey: "galaxyWatch6Classic",
    rating: 4,
    title: "Giá 9 triệu mà tính năng gần bằng đồng hồ 20 triệu",
    content: "So với Apple Watch Ultra 2 hơn 20 triệu thì đồng hồ này có ECG, đo huyết áp, BIA, GPS đầy đủ ở mức giá chưa tới một nửa. Màn Super AMOLED 1.5 inch sắc nét, sáng đủ đọc ngoài trời. Điểm trừ là bản Bluetooth không có eSIM nên phải mang điện thoại theo khi ra ngoài.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-29T09:20:00Z"),
  },
  {
    userKey: "customer5",
    productKey: "galaxyWatch6Classic",
    rating: 2,
    title: "Pin thực tế chỉ hơn một ngày, và nhiều tính năng bị khoá nếu không dùng máy Samsung",
    content: "Hãng ghi 40 tiếng nhưng đó là khi tắt màn hình luôn sáng. Mình bật AOD với theo dõi nhịp tim liên tục thì tối là còn khoảng 20%, tức là phải sạc mỗi ngày — mà sạc thì mất gần 2 tiếng và phải dùng đế riêng, không sạc chung với điện thoại được. Vấn đề thứ hai là mình dùng iPhone: đồng hồ này gần như không hỗ trợ iOS, còn với điện thoại Android hãng khác thì đo ECG và huyết áp cũng bị khoá vì cần app Samsung Health Monitor chỉ chạy trên máy Samsung. Viền xoay và thiết kế thì đẹp thật, nhưng mua rồi mới biết mấy giới hạn này.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-06T19:00:00Z"),
  },

  // ----------------------------------------------------
  // ACCESSORIES: Logitech MX Master 3S
  // ----------------------------------------------------
  {
    userKey: "customer9",
    productKey: "logitechMxMaster3S",
    rating: 5,
    title: "Chuột quốc dân cho coder và designer",
    content: "Cuộn trang nghìn dòng code trong 1 giây cực phê. Click chuột cực kỳ êm không gây tiếng động phiền người xung quanh. Dùng 2 tháng mới cần cắm sạc 1 lần.",
    status: "APPROVED",
    reviewedAt: new Date("2026-07-30T10:45:00Z"),
  },
  {
    userKey: "customer10",
    productKey: "logitechMxMaster3S",
    rating: 5,
    title: "Thiết kế công thái học cứu rỗi cổ tay",
    content: "Trước đây mình hay bị mỏi cổ tay khi dùng chuột thường, chuyển qua MX Master 3S đỡ hẳn. Phần mềm Logi Options+ tùy biến nút bấm rất thông minh.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-08T09:00:00Z"),
  },
  {
    userKey: "customer11",
    productKey: "logitechMxMaster3S",
    rating: 4,
    title: "Cảm biến 8000 DPI dùng trên kính được, nhưng không phải chuột để chơi game",
    content: "Cảm biến Darkfield hoạt động cả trên mặt bàn kính, điểm này rất tiện. Tuy nhiên tần số phản hồi chỉ 125Hz và chuột hơi nặng 141g nên chơi game FPS là thấy trễ và ì tay rõ so với chuột gaming. Đây là chuột làm việc, đừng mua để chơi game.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-20T11:30:00Z"),
  },
  {
    userKey: "customer12",
    productKey: "logitechMxMaster3S",
    rating: 3,
    title: "Chỉ dành cho tay phải, lớp cao su bên hông bắt đầu bong sau một năm",
    content: "Chuột thiết kế bất đối xứng cho tay phải, người thuận tay trái là không dùng được. Con MX Master 3 cũ của mình dùng khoảng một năm thì lớp cao su ở phần đặt ngón cái bắt đầu nhớp và bong nhẹ, đây là bệnh chung của dòng này nên mình vẫn hơi lo. Nút cuộn ngang hơi khó với tới nếu bàn tay nhỏ. Giá 2.5 triệu cho một con chuột cũng không rẻ. Trải nghiệm cuộn và độ êm thì thực sự chưa có đối thủ.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-03T14:40:00Z"),
  },

  // ----------------------------------------------------
  // ACCESSORIES: Logitech MX Keys S
  // ----------------------------------------------------
  {
    userKey: "customer6",
    productKey: "logitechMxKeysS",
    rating: 5,
    title: "Phím lõm hình cầu gõ chính xác, kết nối 3 máy đổi bằng một nút",
    content: "Mặt phím lõm ôm đúng đầu ngón tay nên gõ ít bị lệch, hành trình ngắn kiểu kéo cắt gõ nhanh và rất êm — ngồi phòng chung không ai bị phiền. Easy-Switch cho phép gán 3 thiết bị, mình để máy làm việc, laptop cá nhân và iPad, bấm một nút là nhảy sang, dùng chung với MX Master 3S qua một đầu Logi Bolt.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-16T08:50:00Z"),
  },
  {
    userKey: "customer7",
    productKey: "logitechMxKeysS",
    rating: 4,
    title: "Khung kim loại chắc nặng, nhưng đèn nền cảm biến hơi phiền",
    content: "Tấm nền kim loại nên bàn phím nặng và không xê dịch khi gõ mạnh, hoàn thiện rất đầm tay. Đèn nền tự bật khi tay lại gần nghe hay nhưng thực tế nó hay bật/tắt không đúng lúc và ăn pin khá nhiều, mình tắt hẳn thì dùng được vài tháng một lần sạc thay vì hơn một tuần.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-24T10:20:00Z"),
  },
  {
    userKey: "customer8",
    productKey: "logitechMxKeysS",
    rating: 4,
    title: "Bàn phím văn phòng tốt nhưng không kê được độ cao",
    content: "Gõ tài liệu cả ngày rất thoải mái, có cả phím tắt emoji và dictation khá tiện. Nhược điểm là bàn phím phẳng, không có chân kê phía sau để nâng độ nghiêng, ai quen gõ bàn phím dốc sẽ phải mua kê tay riêng. Sạc bằng USB-C là điểm cộng.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-31T13:30:00Z"),
  },
  {
    userKey: "customer9",
    productKey: "logitechMxKeysS",
    rating: 3,
    title: "3 triệu cho bàn phím kéo cắt, cảm giác gõ vẫn không bằng phím cơ",
    content: "Ở mức giá 3 triệu thì mình kỳ vọng hơn: đây vẫn là cơ chế kéo cắt hành trình nông, gõ êm và chính xác nhưng không có độ nảy và phản hồi như phím cơ switch nâu cùng tầm giá. Vỏ nhựa ABS ở phần viền bám dầu tay và bóng dần sau vài tháng. Không thay được keycap hay switch, cũng không có phần mềm macro sâu như bàn phím gaming. Phù hợp cho người cần yên tĩnh và kết nối nhiều máy, còn nếu ưu tiên cảm giác gõ thì nên xem phím cơ.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-05T17:00:00Z"),
  },

  // ----------------------------------------------------
  // MONITORS: LG UltraGear 27GR95QE-B
  // ----------------------------------------------------
  {
    userKey: "customer2",
    productKey: "lgUltraGearOled27",
    rating: 5,
    title: "Tần số quét 240Hz phản hồi 0.03ms bắn CS2 quá đã",
    content: "Màu đen sâu thẳm của tấm nền OLED vượt trội hoàn toàn so với màn hình IPS thông thường. Chân đế nâng hạ xoay dọc rất tiện dụng.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-09T14:00:00Z"),
  },
  {
    userKey: "customer3",
    productKey: "lgUltraGearOled27",
    rating: 5,
    title: "0.03ms là khác biệt thấy được, không còn vệt mờ khi quay người",
    content: "Chuyển từ màn IPS 1ms sang đây, cảnh quay người nhanh trong Apex hết hẳn vệt nhoè phía sau đối thủ. Phủ 98.5% DCI-P3 nên ngoài chơi game còn dựng video được. Có 2 cổng HDMI 2.1 nên cắm cả PS5 với PC cùng lúc ở 120Hz.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-19T20:40:00Z"),
  },
  {
    userKey: "customer4",
    productKey: "lgUltraGearOled27",
    rating: 4,
    title: "Chữ viền màu do lớp subpixel WOLED, làm việc văn bản hơi mỏi mắt",
    content: "Tấm WOLED của LG dùng cách xếp subpixel khác nên chữ đen trên nền trắng bị viền màu hồng/xanh mỏng, đọc code hay Word lâu là thấy mỏi mắt hơn màn IPS. Bật ClearType và tăng cỡ chữ thì đỡ nhiều. Chơi game và xem phim thì không ảnh hưởng gì. Độ sáng toàn màn hình cũng chỉ khoảng 200 nits nên phòng nhiều nắng là hơi tối.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-27T15:20:00Z"),
  },
  {
    userKey: "customer5",
    productKey: "lgUltraGearOled27",
    rating: 3,
    title: "22 triệu cho 27 inch 2K, cộng thêm nỗi lo burn-in khi làm việc",
    content: "Giá gần 22 triệu cho màn 27 inch chỉ 2K là rất cao, cùng tiền đó mua được màn IPS 4K 144Hz cỡ lớn hơn. Mình dùng máy này vừa làm việc vừa chơi game nên khá lo burn-in vì thanh taskbar và thanh công cụ IDE đứng yên cả ngày — phải bật trình bảo vệ màn hình, tự dịch pixel và ẩn taskbar, khá bất tiện. Loa tích hợp thì không có. Nếu thuần chơi game thì đây là màn tuyệt vời, còn dùng lẫn công việc văn bản thì nên cân nhắc.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-04T11:10:00Z"),
  },

  // ----------------------------------------------------
  // MONITORS: Dell UltraSharp U2724D
  // ----------------------------------------------------
  {
    userKey: "customer3",
    productKey: "dellUltraSharpU2724D",
    rating: 5,
    title: "Màn hình IPS Black chuẩn màu đồ họa 100% sRGB",
    content: "Thiết kế viền siêu mỏng, cổng kết nối Type-C cấp nguồn tiện lợi cho laptop. Tần số quét 120Hz mượt mà hơn hẳn bản U2722D trước đây.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-08T16:30:00Z"),
  },
  {
    userKey: "customer4",
    productKey: "dellUltraSharpU2724D",
    rating: 5,
    title: "Một cổng Type-C thay cả dock, bàn làm việc gọn hẳn",
    content: "Cắm một dây USB-C từ màn hình vào MacBook là có luôn hình, mạng, 3 cổng USB-A 10Gbps và sạc máy — mình bỏ được hẳn cái dock 2 triệu. Có DisplayPort out để nối chuỗi màn thứ hai. Chân đế nâng hạ, xoay dọc, ngả trước sau đầy đủ và rất chắc.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-18T09:40:00Z"),
  },
  {
    userKey: "customer5",
    productKey: "dellUltraSharpU2724D",
    rating: 4,
    title: "Tương phản 2000:1 hơn IPS thường rõ, nhưng vẫn không bằng OLED",
    content: "Tấm IPS Black cho màu đen sâu hơn hẳn IPS thường, xem phim trong phòng tối đỡ bị xám. Nhưng so với màn OLED thì vẫn thấy khác biệt rõ, và vẫn có hiện tượng hở sáng nhẹ ở góc dưới bên phải máy mình. Phủ 98% Display P3 nên chỉnh ảnh và video đều tin được, không phải calibrate thêm.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-26T13:50:00Z"),
  },
  {
    userKey: "customer6",
    productKey: "dellUltraSharpU2724D",
    rating: 3,
    title: "Không có loa, 120Hz cũng không đủ cho game và 2K trên 27 inch là hơi thô",
    content: "Màn hình 12 triệu mà không có loa tích hợp, phải mua loa ngoài hoặc cắm tai nghe vào jack. Tần số 120Hz là bước tiến so với 60Hz nhưng nếu chơi game bắn súng thì vẫn kém xa mấy màn 165-240Hz cùng giá. Mật độ điểm 2560x1440 trên 27 inch nhìn chữ vẫn thấy răng nếu ngồi gần, làm đồ họa chi tiết mình vẫn thích 4K hơn. Đây là màn hình văn phòng và đồ họa rất tốt, chỉ cần đúng kỳ vọng.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-06T10:30:00Z"),
  },

  // ----------------------------------------------------
  // ACCESSORIES: Anker Prime 100W GaN
  // ----------------------------------------------------
  {
    userKey: "customer10",
    productKey: "lowStockSample1",
    rating: 5,
    title: "Một củ sạc thay cho ba, sạc được cả MacBook lẫn điện thoại cùng lúc",
    content: "Cắm MacBook Pro vào cổng C1 và iPhone vào C2 thì máy tự chia 65W với 30W, cả hai đều sạc nhanh. Củ GaN nhỏ hơn hẳn củ 96W nguyên bản của Apple mà công suất lại cao hơn, đi công tác mình chỉ mang đúng cái này với một dây. Vỏ chỉ ấm nhẹ khi sạc đầy tải.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-17T09:00:00Z"),
  },
  {
    userKey: "customer11",
    productKey: "lowStockSample1",
    rating: 4,
    title: "Chia công suất khá thông minh nhưng cắm 3 thiết bị thì mỗi cổng còn ít",
    content: "Cắm một thiết bị thì cổng C được đủ 100W, nhưng khi cắm cả ba thì tổng vẫn là 100W chia ra nên laptop chỉ còn khoảng 45W, sạc chậm hơn rõ. Cổng USB-A giới hạn 22.5W nên chỉ phù hợp sạc tai nghe hay đồng hồ. Biết trước cách chia thì dùng rất ổn.",
    status: "APPROVED",
    reviewedAt: new Date("2026-08-28T11:40:00Z"),
  },
  {
    userKey: "customer12",
    productKey: "lowStockSample1",
    rating: 3,
    title: "Chân cắm liền không gập được, và không tặng kèm dây",
    content: "Chân cắm của bản này liền khối không gập vào được nên nhét trong túi laptop hay cấn và dễ làm xước máy, mấy củ Anker khác gập được thì gọn hơn nhiều. Trong hộp cũng không có dây Type-C nào, muốn dùng đủ 100W phải mua thêm dây hỗ trợ 5A khoảng 300-400 nghìn nữa. Củ sạc thì mát và ổn định, chỉ là hai điểm trên làm trải nghiệm mở hộp kém đi.",
    status: "APPROVED",
    reviewedAt: new Date("2026-09-05T15:20:00Z"),
  },

  // ----------------------------------------------------
  // Edge case: PENDING review chờ kiểm duyệt (Admin Moderation)
  //
  // Giữ nguyên trạng thái PENDING: đây là dữ liệu để thử luồng duyệt review của
  // admin, và cũng để kiểm rằng `reviewSeeder` chỉ đếm dòng APPROVED — sản phẩm
  // macbookAir13M2 có 5 dòng nhưng `review_count` phải ra 4.
  // ----------------------------------------------------
  {
    userKey: "customer5",
    productKey: "macbookAir13M2",
    rating: 3,
    title: "Máy dùng ổn nhưng bản 256GB tốc độ SSD thấp hơn bản 512GB",
    content: "Tổng thể máy tốt, tuy nhiên nếu ai làm đồ họa nặng nên cân nhắc nâng cấp lên bản 512GB hoặc 16GB RAM để dùng lâu dài.",
    status: "PENDING", // PENDING review edge case!
    reviewedAt: new Date("2026-08-10T11:00:00Z"),
  },
];

module.exports = reviewsData;
