const { hash } = require("./buildFamilyProducts");

/**
 * Bộ dựng người đánh giá và đánh giá cho catalogue mở rộng.
 *
 * HAI RÀNG BUỘC PHẢI GIỮ (chép lại từ đầu `reviews.data.js`)
 * ----------------------------------------------------------
 * 1. Mỗi sản phẩm ACTIVE cần **tối thiểu 3 review APPROVED**, vì
 *    `aiRepository.findRepresentativeReviews` lấy `perProduct = 3`.
 * 2. Trong đó phải có **ít nhất một đánh giá 2–3 sao**. Hàm đó sắp theo rating
 *    giảm dần rồi lấy hai đầu trên và một đầu dưới; một sản phẩm toàn 5 sao thì
 *    đầu dưới cũng là lời khen, và tính năng so sánh AI không có gì để viết vào
 *    phần NHƯỢC ĐIỂM.
 *
 * Nội dung vì thế phải CỤ THỂ. "Máy đẹp, đóng gói tốt" không cho mô hình chất
 * liệu nào để so sánh hai sản phẩm với nhau, nên mỗi câu dưới đây nói về một
 * thứ đo được: pin tụt sau bao lâu, quạt ồn ở tải nào, phím bấm nặng ra sao.
 *
 * Cách sinh là tất định theo `key` của sản phẩm: chạy seed lại vẫn ra đúng bộ
 * đánh giá đó, nên hai lượt đo recommender so sánh được với nhau.
 */

// ── Người đánh giá ──────────────────────────────────────────────────────────

// 12 khách viết tay trong `users.data.js` không đủ cho 202 sản phẩm: mỗi người
// sẽ phải đứng tên gần 50 bài, mà `(user_id, product_id)` là duy nhất nên số
// cặp khả dụng cũng không đủ. Nhóm dưới đây là người mua đã xác thực, chỉ dùng
// để đánh giá, và cố ý KHÔNG có địa chỉ giao hàng hay lịch sử đơn.
const REVIEWER_NAMES = [
  "Nguyễn Hoài Nam", "Phạm Thu Trang", "Đỗ Quang Huy", "Vũ Thị Ngọc Ánh",
  "Bùi Anh Tuấn", "Hoàng Mai Linh", "Đặng Xuân Trường", "Lý Thanh Vân",
  "Ngô Đức Thắng", "Trịnh Khánh Chi", "Dương Bá Lộc", "Cao Thuỳ Dung",
  "Lương Việt Anh", "Phan Kim Ngân", "Tạ Minh Khoa", "Hồ Diệu Linh",
  "Đinh Công Hậu", "Mai Phương Thảo", "Chu Tiến Đạt", "Tô Hải Yến",
  "Lâm Quốc Bảo", "Nghiêm Lan Chi", "Võ Trọng Nhân", "Từ Bảo Trâm",
];

const AVATAR_IDS = [
  "1507003211169-0a1dd7228f2d", "1438761681033-6461ffad8d80", "1472099645785-5658abf4ff4e",
  "1544005313-94ddf0286df2", "1519085360753-af0119f7cbe7", "1534528741775-53994a69daeb",
];

const extraReviewers = REVIEWER_NAMES.map((fullName, index) => {
  const number = index + 1;
  return {
    key: `reviewer${number}`,
    email: `reviewer${number}@gmail.com`,
    fullName,
    phone: `09223450${String(number).padStart(2, "0")}`,
    role: "CUSTOMER",
    status: "ACTIVE",
    emailVerifiedAt: new Date("2026-03-01T08:00:00Z"),
    lastLoginAt: new Date("2026-08-12T09:00:00Z"),
    avatarUrl: `https://images.unsplash.com/photo-${AVATAR_IDS[index % AVATAR_IDS.length]}?w=300&auto=format&fit=crop&q=80`,
    auth: { provider: "LOCAL", password: "Customer@123456" },
    addresses: [],
  };
});

const REVIEWER_KEYS = extraReviewers.map((reviewer) => reviewer.key);

// ── Nội dung theo nhóm hàng ─────────────────────────────────────────────────

// Nhóm danh mục dùng chung một kho câu. Cùng nhóm thì thứ đáng khen và đáng chê
// giống nhau — laptop thì nói về quạt và pin, màn hình thì nói về màu và viền.
const REVIEW_GROUP = {
  laptopGaming: "laptopGaming", laptopOffice: "laptopThin", laptopCreator: "laptopThin",
  macbook: "laptopThin", smartphone: "phone", smartphoneMid: "phone", tablet: "tablet",
  headphone: "headphone", speaker: "speaker", smartwatch: "smartwatch",
  monitor: "monitor", peripheral: "peripheral", charging: "charging", storage: "storage",
};

// Điều kiện áp dụng của một câu đánh giá.
//
// Một kho câu dùng chung cho cả danh mục lá sẽ ghép nhầm: bài "hộp sạc hơi to"
// rơi vào tai nghe chụp tai không có hộp, bài "tiếng ù khi bật chống ồn" rơi
// vào chiếc không hề có chống ồn, bài "pin dùng cả tuần" rơi vào bàn phím cắm
// dây. Trên trang sản phẩm thì đó là bảng thông số và phần đánh giá nói ngược
// nhau; tệ hơn, `findRepresentativeReviews` đưa đúng những bài đó cho mô hình
// và tính năng so sánh sẽ nêu một nhược điểm không có thật.
//
// Mỗi vị từ đọc từ chính thông số hoặc tên sản phẩm, không phải từ một trường
// khai tay — khai tay thì thêm sản phẩm mới là lại quên đánh dấu.
const specOf = (family, key) => {
  const raw = family.specs[key];
  return Array.isArray(raw) ? raw[1] : raw;
};
const specNum = (family, key) => {
  const raw = family.specs[key];
  return Array.isArray(raw) && typeof raw[0] === "number" ? raw[0] : null;
};

const GUARDS = {
  // Âm thanh. "hộp sạc" trong thông số pin là dấu hiệu chắc chắn của tai nghe
  // nhét tai, chắc hơn là dò chữ "True Wireless" trong tên: AirPods 4 là tai
  // nghe nhét tai mà tên không có cụm đó.
  anc: (f) => f.specs.ancSupport?.[0] === true,
  noAnc: (f) => f.specs.ancSupport?.[0] !== true,
  tws: (f) => /hộp sạc/i.test(specOf(f, "batteryLife") || ""),
  notTws: (f) => !/hộp sạc/i.test(specOf(f, "batteryLife") || ""),
  hasBattery: (f) => (specNum(f, "batteryLife") || 0) > 0,
  noBattery: (f) => (specNum(f, "batteryLife") || 0) === 0,

  // Chuột và bàn phím dùng chung một danh mục lá. Bộ combo khớp cả hai vị từ,
  // nên nó lấy được câu của cả chuột lẫn bàn phím.
  mouse: (f) => /chuột/i.test(f.name),
  keyboard: (f) => /bàn phím/i.test(f.name),
  wireless: (f) => (specNum(f, "batteryLife") || 0) > 0,

  // Sạc, pin dự phòng và hub nằm chung một lá. Chỉ pin dự phòng mới khai
  // `capacity`.
  powerbank: (f) => f.specs.capacity !== undefined,
  notPowerbank: (f) => f.specs.capacity === undefined,
  hub: (f) => /hub/i.test(f.name),
  notHub: (f) => !/hub/i.test(f.name),

  // Ổ cứng ngoài, thẻ nhớ và SSD gắn trong.
  portableDrive: (f) => /di động/i.test(f.name),
  memoryCard: (f) => /thẻ nhớ/i.test(f.name),
  internalDrive: (f) => /gắn trong/i.test(f.name),
};

const allowed = (entry, family) => (entry[2] || []).every((name) => GUARDS[name](family));

// Ba bậc: `good` là 5 sao, `mixed` là 4 sao, `critical` là 2–3 sao. Bậc
// `critical` mới là bậc quan trọng nhất ở đây — nó là nguyên liệu duy nhất cho
// phần nhược điểm của tính năng so sánh.
//
// Phần tử thứ ba là danh sách điều kiện; thiếu nó nghĩa là câu dùng được cho
// mọi sản phẩm trong nhóm.
const CONTENT = {
  laptopGaming: {
    good: [
      ["Chơi game mát hơn máy cũ nhiều", "Mình test Cyberpunk 2077 thiết lập Ultra khoảng 2 tiếng, nhiệt CPU giữ quanh 82 độ và không thấy tụt khung hình. Quạt có nghe rõ nhưng là tiếng gió đều chứ không rít. Bàn phím gõ nảy, chơi xong ngồi code tiếp vẫn thoải mái."],
      ["Đúng thứ mình cần cho cả game lẫn dựng video", "Render một dự án Premiere 15 phút ở 1080p mất khoảng 6 phút, nhanh hơn laptop văn phòng cũ gần ba lần. Màn hình màu khá chuẩn ngay khi mở hộp, mình chỉ chỉnh lại độ sáng. Cổng kết nối đủ, không phải mang thêm hub."],
      ["Hiệu năng trên giá tiền rất tốt", "So với mấy máy cùng tầm mình xem ở cửa hàng thì con này nhỉnh hơn ở phần tản nhiệt. Chạy benchmark liên tục 30 phút vẫn giữ được xung, không bị tụt về mức cơ bản như máy vỏ mỏng. Loa thì bình thường, mình cắm tai nghe."],
      ["Máy chắc chắn, bản lề không ọp ẹp", "Dùng được hơn một tháng, mở gập nhiều lần mà bản lề vẫn chặt, không bị rung màn khi gõ mạnh. Nhiệt khi chơi game giữ ổn định nhờ hai quạt chạy độc lập. Phần mềm quản lý quạt của hãng dễ hiểu, chỉnh ba mức là đủ dùng."],
      ["Nâng cấp được nên yên tâm dùng lâu", "Mình tháo đáy gắn thêm một thanh RAM và một ổ SSD nữa, ốc dễ tháo và không có kẹp nhựa nào bị gãy. Sau khi nâng lên thì mở nhiều máy ảo cùng lúc không còn giật. Sạc kèm hơi nặng, đi làm mình để lại ở nhà."],
    ],
    mixed: [
      ["Mạnh nhưng ồn hơn mình nghĩ", "Hiệu năng không có gì phải bàn, game nào cũng chạy tốt. Chỉ là khi vào chế độ Turbo thì quạt kêu khá to, họp online phải tắt mic. Ở chế độ cân bằng thì im hơn nhiều mà hiệu năng vẫn đủ dùng."],
      ["Tốt, trừ khoản pin", "Cắm điện thì máy chạy rất mượt, không chê gì. Rút sạc ra làm việc văn phòng chỉ được khoảng 4 tiếng, chơi game thì hơn một tiếng là hết. Xác định đây là máy để bàn di động chứ không phải máy mang đi cả ngày."],
      ["Ổn, nhưng nặng", "Cấu hình đúng như mô tả, chạy tốt mọi thứ mình cần. Nhược điểm là cả máy lẫn sạc cộng lại gần 3.5kg, đeo balo đi xa thì mỏi vai. Ai hay di chuyển nên cân nhắc bản 14 inch."],
      ["Màn hình là điểm trừ nhỏ", "Máy chạy tốt, tản nhiệt ổn, giá hợp lý. Riêng màn hình thì độ sáng hơi thấp, ngồi cạnh cửa sổ ban ngày phải kéo rèm mới nhìn rõ. Màu cũng nhạt hơn màn rời của mình một chút, làm đồ hoạ thì nên cắm màn ngoài."],
      ["Đáng tiền nhưng đèn bàn phím hơi loè", "Hiệu năng và tản nhiệt đều tốt trong tầm giá. Đèn RGB bàn phím sáng khá gắt, ban đêm mình phải giảm xuống mức thấp nhất. Phần mềm chỉnh đèn cũng hơi nặng, mình gỡ bớt các tiện ích không dùng."],
    ],
    critical: [
      ["Quạt ồn và nóng vùng chiếu nghỉ tay", "Chơi game khoảng 40 phút là vùng bên trái chiếu nghỉ tay nóng lên rõ, đặt cổ tay lên thấy khó chịu. Quạt ở chế độ hiệu năng kêu to hơn mình tưởng nhiều. Hiệu năng thì đúng quảng cáo, nhưng phải chấp nhận đánh đổi này."],
      ["Pin quá ngắn so với mô tả", "Hãng ghi pin lớn nhưng thực tế mình làm văn phòng, độ sáng 50%, chỉ được hơn 3 tiếng là phải cắm. Đi học cả buổi sáng là phải mang theo sạc. Máy chạy nhanh nhưng mình thất vọng ở khoản này."],
      ["Vỏ nhựa bám vân tay và ọp ở phần nắp", "Ấn vào giữa nắp máy thấy hơi lún và màn hình gợn sóng. Mặt lưng bám vân tay, lau xong nửa ngày lại thấy. Bên trong máy chạy tốt nên mình vẫn giữ, nhưng hoàn thiện không tương xứng với giá."],
      ["Loa yếu, thiếu dải trầm", "Tiếng ra mỏng, xem phim hay chơi game đều phải cắm tai nghe mới nghe được tiếng bước chân. Âm lượng tối đa cũng không lớn, phòng có tiếng quạt là át luôn. Các phần còn lại của máy thì ổn."],
      ["Webcam và micro tệ", "Họp online nhìn hình rất nhiễu, thiếu sáng là mặt tối om. Micro thu cả tiếng quạt máy vào nên đồng nghiệp hay bảo nghe ồn. Mình phải mua thêm webcam rời, tính ra đội thêm chi phí."],
    ],
  },
  laptopThin: {
    good: [
      ["Nhẹ và pin đủ cho cả ngày làm việc", "Mình mang đi quán làm cả ngày, sáng 8h tới chiều 5h vẫn còn pin, chủ yếu là gõ tài liệu và mở khoảng 20 tab trình duyệt. Máy gần như không nghe tiếng quạt. Bàn phím gõ êm, ngồi thư viện không làm phiền ai."],
      ["Màn hình đẹp hơn mong đợi", "Màu ngay khi mở hộp đã khá chuẩn, xem ảnh và xem phim đều thích. Độ sáng đủ để ngồi gần cửa sổ vẫn nhìn rõ. Máy mỏng nên nhét vào ngăn laptop của balo không bị chật."],
      ["Chạy mượt các tác vụ lập trình web", "Mình mở VS Code cùng Docker và hai trình duyệt, máy vẫn phản hồi nhanh, không thấy đơ. Nhiệt giữ quanh 60-70 độ nên chiếu nghỉ tay chỉ hơi ấm. Cổng USB-C sạc được bằng củ sạc điện thoại 65W khi quên mang sạc theo."],
      ["Hoàn thiện chắc, đáng tiền", "Vỏ kim loại không ọp, mở một tay được và bản lề giữ chắc ở mọi góc. Touchpad rộng và nhận cử chỉ chính xác, mình gần như không cần chuột rời. Bật máy từ trạng thái ngủ nhanh, gần như mở nắp là dùng được ngay."],
      ["Máy văn phòng đúng nghĩa", "Dùng Word, Excel và họp Teams cả ngày không có gì để chê. Loa nghe rõ lời thoại, họp không cần tai nghe. Quạt hầu như không chạy trừ khi mình xuất file PDF nặng."],
    ],
    mixed: [
      ["Tốt nhưng cổng kết nối hơi ít", "Máy mỏng nhẹ, pin tốt, đúng nhu cầu của mình. Chỉ có hai cổng USB-C nên cắm sạc là còn đúng một cổng, mình phải mua thêm hub. Ngoài ra không có gì phàn nàn."],
      ["Đẹp, nhưng nóng khi làm nặng", "Tác vụ văn phòng thì mát và im. Khi mình xuất video hoặc chạy build lâu thì phần trên bàn phím nóng lên rõ và máy giảm hiệu năng xuống. Với đúng nhu cầu văn phòng thì vẫn là lựa chọn tốt."],
      ["Pin tốt nhưng sạc hơi lâu", "Pin dùng cả ngày là điểm mình thích nhất. Nhưng sạc từ 10% lên đầy mất gần hai tiếng, không có sạc nhanh như điện thoại. Nếu quên cắm buổi tối thì sáng hơi cuống."],
      ["Màn hình bóng, hay bị loá", "Màu sắc và độ nét đều tốt. Nhưng bề mặt bóng nên ngồi ngược sáng thấy rõ bóng mình trong màn. Dán thêm miếng chống chói thì đỡ nhưng màu bị bệt đi một chút."],
      ["Ổn, chỉ tiếc không nâng cấp được", "Hiệu năng và pin đều tốt cho công việc hằng ngày. RAM hàn chết nên mua bao nhiêu là dùng bấy nhiêu, mình hơi tiếc vì đã không chọn bản cao hơn. Ổ cứng thì vẫn thay được."],
    ],
    critical: [
      ["Máy nóng và giảm hiệu năng khi làm lâu", "Chạy build dự án khoảng 15 phút là nhiệt lên cao và tốc độ tụt thấy rõ, lần build sau lâu hơn lần đầu gần gấp rưỡi. Vỏ kim loại nóng ở vùng gần màn hình. Làm việc nhẹ thì vẫn ổn."],
      ["Loa và webcam ở mức tối thiểu", "Loa nghe mỏng, không có tiếng trầm, xem phim phải cắm tai nghe. Webcam lúc thiếu sáng nhiễu hạt rất nhiều, họp online nhìn không rõ mặt. Các phần khác của máy thì tốt."],
      ["Touchpad hay nhận nhầm", "Khi gõ nhanh thì mép bàn tay chạm vào touchpad làm con trỏ nhảy lung tung, mình phải vào cài đặt tắt bớt. Sau khi chỉnh thì đỡ nhưng chưa hết hẳn. Phần còn lại của máy không có vấn đề."],
      ["Pin thực tế thấp hơn quảng cáo khá nhiều", "Hãng ghi con số rất đẹp nhưng mình dùng thật, sáng vừa phải, chỉ được khoảng 6 tiếng chứ không tới mức công bố. Mở nhiều tab là tụt nhanh hơn nữa. Vẫn đủ một buổi làm việc nhưng đừng kỳ vọng cả ngày."],
      ["Bàn phím hành trình quá nông", "Gõ nhiều thấy mỏi đầu ngón vì phím gần như không có độ lún, cảm giác như gõ vào mặt bàn. Mất khoảng hai tuần mới quen. Ai gõ văn bản nhiều nên thử trực tiếp trước khi mua."],
    ],
  },
  phone: {
    good: [
      ["Pin trâu thật, dùng hai ngày mới sạc", "Mình dùng mức trung bình gồm nhắn tin, xem YouTube khoảng một tiếng và chụp vài chục tấm, tối về vẫn còn hơn 40%. Sạc nhanh nên cắm lúc ăn sáng là gần đầy. Máy không nóng khi vừa sạc vừa dùng."],
      ["Camera chụp ban ngày rất nét", "Ảnh ngoài trời chi tiết tốt, màu hơi rực một chút nhưng đăng mạng xã hội thì hợp. Chế độ chân dung tách tóc khá sạch, ít bị ăn vào nền. Quay video chống rung ổn khi vừa đi vừa quay."],
      ["Màn hình mượt, nhìn ngoài nắng rõ", "Chuyển sang tần số quét cao rồi thì quay lại máy cũ thấy giật ngay. Độ sáng đủ để dùng ngoài trời buổi trưa mà không phải che tay. Loa kép nghe xem phim khá đã."],
      ["Máy mượt, chơi game ổn định", "Mình chơi Liên Quân và PUBG thiết lập cao, khung hình giữ đều, không tụt lúc giao tranh đông người. Sau 30 phút máy có ấm ở viền nhưng không nóng tới mức phải nghỉ. Nhận cuộc gọi lúc đang chơi cũng không bị giật."],
      ["Đáng tiền trong tầm giá này", "So với mấy máy cùng giá mình cầm thử thì con này hơn ở màn hình và pin. Phần mềm ít ứng dụng rác hơn mình nghĩ, gỡ vài cái là xong. Nhận diện khuôn mặt nhanh, mở khoá gần như tức thì."],
    ],
    mixed: [
      ["Tốt nhưng camera đêm chưa đủ", "Ban ngày ảnh rất ổn. Chụp tối trong nhà hàng thiếu sáng thì bắt đầu bệt chi tiết và có nhiễu. Nếu chủ yếu chụp ban ngày thì đây vẫn là lựa chọn tốt."],
      ["Hiệu năng ổn, nhưng máy hơi nặng tay", "Cấu hình chạy tốt mọi thứ mình cần. Cầm lâu thì thấy nặng và dày, bỏ túi quần jean hơi cộm. Đổi lại pin lớn nên mình chấp nhận."],
      ["Ổn, nhưng sạc thì chậm hơn kỳ vọng", "Máy dùng hằng ngày rất tốt. Sạc kèm trong hộp công suất thấp, phải mua thêm củ rời mới đạt tốc độ như quảng cáo. Hơi tiếc vì giá máy không rẻ."],
      ["Đẹp nhưng dễ bám vân tay", "Mặt lưng bóng nhìn sang nhưng cầm một lúc là đầy vân tay, phải lau liên tục hoặc đeo ốp. Đeo ốp vào thì mất cái đẹp ban đầu. Các phần khác thì mình hài lòng."],
      ["Máy tốt, phần mềm hơi nhiều thông báo", "Phần cứng không có gì để chê trong tầm giá. Hệ điều hành của hãng hay đẩy thông báo quảng cáo, phải vào tắt từng mục. Sau khi tắt hết thì dùng rất ổn."],
    ],
    critical: [
      ["Nóng khi chơi game lâu", "Chơi khoảng 25 phút là vùng camera nóng rõ, cầm ngang tay chạm vào thấy khó chịu và máy tự giảm độ sáng. Khung hình cũng tụt xuống sau mốc đó. Dùng thường ngày thì không sao."],
      ["Pin tụt nhanh sau vài tháng", "Lúc mới mua dùng được gần hai ngày, sau khoảng ba tháng thì chỉ còn một ngày là phải sạc. Không rõ do phần mềm cập nhật hay do pin. Các phần khác vẫn chạy tốt."],
      ["Loa chỉ có một bên, xem phim lệch tiếng", "Cầm ngang xem phim thì tiếng chỉ ra một phía, nghe rất lệch. Âm lượng tối đa cũng không lớn. Cắm tai nghe thì hết vấn đề nhưng ở tầm giá này mình mong có loa kép."],
      ["Camera góc rộng kém hơn hẳn camera chính", "Chuyển sang góc rộng là thấy ảnh mềm đi và màu lệch so với ống chính, ghép bộ ảnh nhìn không đồng đều. Ống chính thì tốt. Coi như máy có một camera dùng được."],
      ["Rung phản hồi rẻ tiền", "Gõ phím rung lạch cạch nghe như nhựa va nhau chứ không đầm, mình phải tắt hẳn. Chi tiết nhỏ nhưng dùng hằng ngày nên thấy rõ. Ngoài ra máy chạy nhanh và pin tốt."],
    ],
  },
  tablet: {
    good: [
      ["Học online và ghi chú rất tiện", "Mình dùng ghi chép bài giảng bằng bút, độ trễ thấp nên viết gần như trên giấy. Màn hình lớn chia đôi mở tài liệu một bên và ghi chú một bên vẫn đủ rộng. Pin học cả buổi sáng còn hơn nửa."],
      ["Xem phim rất đã nhờ loa nhiều hướng", "Bốn loa cho tiếng khá đầy, xem phim trên giường không cần tai nghe. Màn hình màu đẹp và đủ sáng. Máy mỏng nên cầm một tay đọc truyện một lúc cũng không mỏi."],
      ["Thay được laptop cho việc nhẹ", "Mình gắn bàn phím rời và dùng để trả lời email, sửa tài liệu, họp online. Với đúng những việc đó thì máy đủ dùng và nhẹ hơn laptop nhiều. Chuyển qua lại giữa các ứng dụng mượt."],
      ["Hiệu năng dư cho nhu cầu của mình", "Mở nhiều tab, vẽ trong Procreate và xem video cùng lúc vẫn không thấy khựng. Máy chỉ hơi ấm khi vẽ lâu. Sạc từ 20% lên đầy khoảng một tiếng rưỡi."],
      ["Màn hình tần số quét cao đáng tiền", "Cuộn trang và lướt ảnh mượt hơn hẳn tablet cũ của mình. Đọc PDF chữ nhỏ vẫn rõ, không phải phóng to. Trọng lượng nhẹ nên cầm đọc lâu thoải mái."],
    ],
    mixed: [
      ["Tốt nhưng bút phải mua rời", "Máy dùng rất ổn cho học tập. Tiếc là trong hộp không kèm bút, mua thêm thì đội giá lên đáng kể. Nếu chỉ xem phim đọc báo thì không cần bút."],
      ["Ổn, nhưng ứng dụng cho tablet còn ít", "Phần cứng tốt, màn đẹp. Một số ứng dụng mình hay dùng vẫn là bản phóng to từ điện thoại, nhìn thô trên màn lớn. Không phải lỗi của máy nhưng ảnh hưởng trải nghiệm."],
      ["Pin ổn nhưng sạc lâu", "Dùng được gần hai ngày với nhu cầu học tập. Sạc lại thì mất hơn hai tiếng vì củ kèm theo công suất thấp. Mua củ rời mạnh hơn thì nhanh hơn nhiều."],
      ["Màn đẹp nhưng viền hơi dày", "Chất lượng hiển thị tốt, màu và độ sáng đều ổn. Viền màn hình dày hơn các mẫu mới, nhìn hơi cũ. Bù lại cầm hai tay không bị chạm nhầm vào màn."],
      ["Loa tốt nhưng bị che khi cầm ngang", "Âm thanh khá hay khi để trên bàn. Cầm ngang xem phim thì lòng bàn tay hay bịt mất một loa, tiếng nhỏ hẳn đi. Đặt lên giá đỡ là hết vấn đề."],
    ],
    critical: [
      ["Không thay được laptop như mình tưởng", "Gõ văn bản dài trên bàn phím rời vẫn khó chịu hơn laptop, và việc quản lý cửa sổ rất hạn chế. Mình quay lại dùng nó chủ yếu để xem phim và đọc tài liệu. Máy không lỗi, chỉ là kỳ vọng của mình sai."],
      ["Chậm khi mở nhiều ứng dụng", "Mở quá ba ứng dụng là ứng dụng nền bị tải lại từ đầu, đang viết dở phải mở lại. RAM có vẻ không đủ cho cách mình dùng. Việc đơn giản thì vẫn mượt."],
      ["Nặng khi cầm đọc lâu", "Màn lớn thì thích nhưng cầm một tay đọc sách khoảng 20 phút là mỏi cổ tay. Phải kê gối hoặc mua giá đỡ. Nếu chủ yếu cầm tay thì nên chọn bản nhỏ hơn."],
      ["Camera chỉ dùng được để quét tài liệu", "Ảnh chụp bằng tablet này nhiễu và bệt, chụp bảng trong lớp thiếu sáng là chữ nhoè. Quay video họp thì tạm được. Mình không kỳ vọng nhiều nhưng vẫn thấy kém hơn dự tính."],
      ["Không có khe thẻ nhớ, bản gốc nhanh đầy", "Mình mua bản dung lượng thấp và đầy sau khoảng hai tháng vì tải phim với tài liệu. Không cắm thêm thẻ được nên phải xoá bớt liên tục. Ai định lưu nhiều nên chọn bản cao hơn ngay từ đầu."],
    ],
  },
  headphone: {
    good: [
      ["Chống ồn tốt hơn mong đợi", "Đi xe buýt bật chống ồn là tiếng động cơ giảm hẳn, chỉ còn tiếng nói chuyện mờ mờ. Trong văn phòng gần như không nghe tiếng điều hoà. Đeo hai tiếng liền vẫn không thấy ép tai.", ["anc"]],
      ["Chất âm cân bằng, nghe thể loại nào cũng hợp", "Dải trầm có lực nhưng không lấn, giọng hát rõ và tách bạch. Nghe nhạc acoustic thấy được tiếng dây đàn. Có ứng dụng chỉnh EQ nên mình kéo lại theo ý một chút."],
      ["Pin dùng cả tuần mới phải sạc", "Mình nghe khoảng 3 tiếng mỗi ngày, gần một tuần mới cắm sạc lại. Sạc nhanh 10 phút là dùng được thêm mấy tiếng. Kết nối lại với điện thoại nhanh, không phải vào cài đặt ghép lại.", ["hasBattery"]],
      ["Đàm thoại rõ, đồng nghiệp không phàn nàn", "Gọi ngoài đường có gió mà đầu bên kia vẫn nghe rõ giọng mình. Chuyển giữa laptop và điện thoại nhanh, không phải ghép lại. Micro thu giọng gọn, ít lẫn tiếng nền."],
      ["Nhỏ gọn, bỏ túi rất tiện", "Hộp sạc bỏ vừa túi quần, mang theo cả ngày không vướng. Chất âm vượt kỳ vọng ở kích thước này. Chế độ xuyên âm nghe tự nhiên, ra quầy trả tiền không cần tháo tai nghe.", ["tws"]],
      ["Đệm tai êm, đeo cả buổi làm việc được", "Đệm dày và lực kẹp vừa phải nên đeo ba tiếng liền tai không bị ê. Đai đầu chỉnh nhiều nấc, đội mũ vào vẫn vừa. Cách âm thụ động đã đủ để không nghe tiếng bàn phím cơ của người bên cạnh.", ["notTws"]],
    ],
    mixed: [
      ["Âm hay nhưng chống ồn ở mức khá thôi", "Nghe nhạc thì rất thích, chi tiết và rộng. Chống ồn cắt được tiếng ù đều nhưng tiếng người nói vẫn lọt khá nhiều. Đi máy bay thì đủ dùng, ngồi văn phòng ồn thì chưa đã.", ["anc"]],
      ["Tốt, nhưng đeo lâu hơi nóng tai", "Cách âm tốt một phần vì đệm tai ép khá chặt. Đổi lại đeo quá hai tiếng là tai nóng và phải tháo ra nghỉ. Mùa mát thì không thành vấn đề.", ["notTws"]],
      ["Pin ổn, nhưng hộp sạc to", "Tai nghe nhẹ và đeo thoải mái. Hộp sạc thì dày hơn các mẫu cùng tầm, bỏ túi áo hơi cộm. Bù lại pin tổng dài hơn.", ["tws"]],
      ["Chất âm ổn, ứng dụng thì hơi rối", "Tai nghe nghe hay và kết nối ổn định. Ứng dụng đi kèm nhiều mục lồng nhau, tìm chỗ chỉnh EQ mất một lúc. Cài xong rồi thì không phải mở lại nữa."],
      ["Hay nhưng dải trầm hơi nhiều", "Mặc định bass khá mạnh, nghe nhạc điện tử thì đã nhưng nghe giọng hát thì bị lấn. Kéo EQ xuống hai bậc là cân bằng lại được. Nếu thích âm trung tính thì phải chỉnh."],
    ],
    critical: [
      ["Tiếng ù nhẹ khi bật chống ồn", "Ở phòng yên tĩnh bật chống ồn mà không phát nhạc thì nghe rõ tiếng ù áp suất trong tai, đeo lâu thấy tức. Có nhạc thì không để ý. Mình phải tắt chống ồn khi ngồi làm việc yên tĩnh.", ["anc"]],
      ["Cảm ứng chạm hay nhận nhầm", "Chỉnh lại tai nghe cho vừa là vô tình dừng nhạc hoặc chuyển bài. Không tắt riêng được thao tác chạm nên phải quen dần. Chất âm thì không có vấn đề gì.", ["tws"]],
      ["Đeo chưa chắc khi vận động", "Đi bộ thì ổn nhưng chạy bộ khoảng mười phút là bên phải bắt đầu tụt ra, phải đẩy lại. Mình đã đổi cả ba cỡ nút tai kèm theo. Ai tập nhiều nên chọn loại có móc vành tai.", ["tws"]],
      ["Pin thực tế ngắn hơn công bố", "Hãng ghi con số rất dài nhưng đó là khi mở âm lượng nhỏ trong phòng yên tĩnh. Mình dùng thật ở mức nghe được ngoài đường thì chỉ được khoảng hai phần ba con số đó. Vẫn đủ một ngày làm việc.", ["hasBattery"]],
      ["Không gập gọn được, hộp đựng cồng kềnh", "Tai nghe chỉ xoay dẹt chứ không gập vào trong nên hộp đựng rất to, chiếm gần nửa ngăn balo. Chất âm thì tốt. Chỉ là mang đi lại bất tiện.", ["notTws"]],
      ["Kẹp đầu chặt, đeo kính là đau thái dương", "Mình đeo kính nên gọng bị ép vào thái dương, khoảng một tiếng là phải tháo ra. Nới đai hết cỡ vẫn còn chặt, chắc phải chờ đệm giãn ra. Âm thanh thì không có gì để chê.", ["notTws"]],
      ["Dây tín hiệu cứng và dễ rối", "Dây kèm theo khá cứng, cuộn lại là xoắn và để một lúc là rối. Mình phải mua dây rời mềm hơn. Chất âm thì đúng tầm tiền.", ["notTws", "noAnc"]],
    ],
  },
  speaker: {
    good: [
      ["Tiếng to và đầy hơn kích thước của nó", "Mở trong phòng khoảng 20m2 ở mức âm lượng 70% là đã kín phòng, không bị vỡ tiếng. Dải trầm có lực rõ ràng. Ghép hai chiếc thành stereo thì còn tách bạch hơn nữa."],
      ["Chống nước nên mang đi đâu cũng được", "Mình mang ra hồ bơi và đi cắm trại, dính nước với cát mà rửa vòi xong vẫn chạy bình thường. Pin đủ cho cả buổi chiều. Dây đeo kèm theo tiện để móc vào balo.", ["hasBattery"]],
      ["Kết nối nhanh và ổn định", "Bật lên là tự nối lại với điện thoại, không phải vào cài đặt. Đi xa khoảng 10 mét vẫn không bị ngắt quãng. Nút bấm vật lý to, tay ướt vẫn bấm được."],
      ["Âm cân bằng, nghe được nhiều thể loại", "Không bị đẩy bass quá tay như nhiều loa di động khác, giọng hát vẫn rõ. Nghe podcast cũng dễ chịu. Có ứng dụng chỉnh EQ nếu muốn thêm trầm."],
      ["Để bàn làm việc rất hợp", "Đặt hai bên màn hình, nghe nhạc và xem phim đều tốt hơn loa laptop rất nhiều. Có nhiều cổng nên cắm được cả máy tính lẫn điện thoại. Núm xoay chỉnh âm lượng tiện hơn là mò trong phần mềm.", ["noBattery"]],
    ],
    mixed: [
      ["Hay nhưng pin ngắn hơn mong đợi", "Chất âm tốt và to. Mở ở mức lớn thì chỉ được khoảng hai phần ba thời lượng hãng công bố. Mở vừa phải thì đúng như quảng cáo.", ["hasBattery"]],
      ["Tốt, nhưng hơi nặng để mang đi", "Tiếng rất đã cho kích thước này. Đổi lại cầm lâu thì mỏi tay, bỏ balo cũng chiếm chỗ. Để cố định một chỗ thì không vấn đề gì.", ["hasBattery"]],
      ["Ổn, nhưng thiếu cổng vào 3.5mm", "Dùng không dây thì tiện và ổn định. Muốn cắm dây từ máy cũ thì không có cổng, phải mua đầu chuyển. Ngoài ra không có gì phàn nàn.", []],
      ["Âm hay nhưng sạc bằng cổng cũ", "Tiếng tốt trong tầm giá. Tiếc là vẫn dùng cổng sạc đời cũ nên phải mang thêm một sợi dây riêng. Hy vọng bản sau đổi sang USB-C.", ["hasBattery"]],
      ["Tốt nhưng đèn báo hơi chói", "Loa chạy ổn, tiếng đầy. Đèn báo nguồn sáng khá gắt, để trong phòng ngủ ban đêm thấy khó chịu. Phải quay mặt đèn vào tường."],
    ],
    critical: [
      ["Dải trầm bị vỡ khi mở lớn", "Mở quá 80% âm lượng là tiếng trầm bắt đầu rè và méo, nghe rõ nhất ở nhạc có nhiều bass. Dưới mức đó thì tốt. Ai hay mở to cho đông người nghe nên cân nhắc bản công suất cao hơn."],
      ["Độ trễ cao khi xem video", "Nghe nhạc thì không sao nhưng xem phim là thấy tiếng lệch khẩu hình rõ ràng. Một số ứng dụng tự bù trễ, một số thì không. Mình chủ yếu dùng để nghe nhạc nên vẫn giữ."],
      ["Pin chai nhanh", "Sau khoảng nửa năm thì thời lượng còn chưa tới một nửa so với lúc mới mua. Không thay pin được. Chất âm thì vẫn như cũ.", ["hasBattery"]],
      ["Tiếng bị mỏng khi để xa tường", "Đặt sát tường thì trầm đầy, kéo ra giữa phòng là tiếng mỏng hẳn. Phải kê đúng chỗ mới nghe hay. Với loa di động thì đây là hạn chế khó chịu."],
      ["Nút bấm khó phân biệt khi không nhìn", "Các nút cùng kích thước và nằm sát nhau, tối trời mò bấm rất hay nhầm giữa tăng âm lượng và chuyển bài. Dùng lâu thì quen. Phần còn lại thì ổn."],
    ],
  },
  smartwatch: {
    good: [
      ["Theo dõi giấc ngủ khá sát", "Mình đối chiếu với giờ đi ngủ thực tế thì số liệu lệch chừng mười phút, chấp nhận được. Đeo ngủ không vướng vì dây mềm và mặt không quá dày. Sáng dậy có bảng tổng hợp dễ hiểu."],
      ["Pin lâu nên không phải nhớ sạc", "Mình sạc một lần rồi quên luôn cả tuần, đeo cả ngày lẫn đêm và bật đo nhịp tim liên tục. Sạc lại khoảng một tiếng là đầy. Khác hẳn đồng hồ cũ phải cắm mỗi tối."],
      ["Đo nhịp tim khi tập khá chính xác", "Mình chạy bộ và đối chiếu với dây đeo ngực, chênh vài nhịp là cùng. GPS bắt nhanh, đường chạy vẽ ra sát thực tế. Ứng dụng xuất được dữ liệu sang phần mềm khác."],
      ["Màn hình sáng rõ khi ra ngoài trời", "Chạy giữa trưa vẫn nhìn được số liệu mà không phải che tay. Chế độ luôn hiển thị không tốn pin nhiều như mình lo. Cảm ứng nhạy kể cả khi tay có mồ hôi."],
      ["Nhẹ, đeo cả ngày quên mất là đang đeo", "Mặt đồng hồ mỏng và dây mềm nên cổ tay không bị hằn. Thông báo rung vừa đủ để biết mà không giật mình. Đổi dây rất nhanh, có chốt tháo sẵn."],
    ],
    mixed: [
      ["Tốt nhưng phụ thuộc điện thoại", "Các tính năng sức khoẻ đều ổn. Nhưng nhiều thứ chỉ mở được khi ghép với điện thoại cùng hãng, dùng với máy khác là mất bớt. Mua thì nên xem kỹ phần tương thích."],
      ["Pin ổn nhưng tụt nhanh khi bật GPS", "Dùng thường ngày thì pin rất tốt. Bật GPS chạy bộ một tiếng là tụt khoảng 15%, đi leo núi cả ngày thì phải mang sạc. Biết trước thì không thành vấn đề."],
      ["Đẹp nhưng mặt hơi to với cổ tay nhỏ", "Nhìn thì sang và màn rộng dễ đọc. Cổ tay mình nhỏ nên đeo thấy hơi thừa, xoay dễ bị lệch. Nên thử bản kích thước nhỏ hơn nếu cổ tay dưới 16cm."],
      ["Ổn, nhưng ứng dụng bên thứ ba còn ít", "Phần theo dõi sức khoẻ làm tốt. Kho ứng dụng thì thưa, chủ yếu dùng mấy thứ có sẵn. Với mình thì đủ nhưng ai muốn cài nhiều sẽ thấy thiếu."],
      ["Tốt nhưng đo SpO2 hay lỗi", "Nhịp tim và bước chân thì ổn định. Đo nồng độ oxy thì hay báo không đọc được, phải ngồi yên đo lại vài lần. Có thể do mình đeo hơi lỏng."],
    ],
    critical: [
      ["Phải sạc mỗi ngày", "Với cách mình dùng gồm bật màn luôn hiển thị và đo nhịp tim liên tục thì tối về là còn khoảng 20%. Nghĩa là gần như phải cắm sạc hằng ngày, không đeo ngủ được. Các tính năng thì tốt."],
      ["Dây kèm theo gây ngứa", "Đeo liên tục vài ngày là cổ tay mẩn đỏ, phải tháo ra cho da thở. Mình đổi sang dây vải mua ngoài thì hết. Nên tính thêm chi phí đổi dây."],
      ["Thông báo hay đến trễ", "Có lúc tin nhắn hiện trên đồng hồ chậm hơn điện thoại vài phút, hoặc không hiện cho tới khi mình nâng cổ tay. Thử cài lại vẫn vậy. Phần theo dõi sức khoẻ thì không có lỗi này."],
      ["Đếm bước chân sai khi lái xe", "Đi xe máy đường xóc là đồng hồ cộng thêm cả nghìn bước, số liệu cả ngày thành không dùng được. Đi bộ thì đếm đúng. Mong hãng lọc tốt hơn."],
      ["Mặt kính xước sớm", "Mới đeo hơn một tháng đã có mấy vết xước nhỏ dù mình không va đập mạnh, chỉ quệt vào khung cửa. Nhìn ngược sáng thấy rõ. Nên dán màn hình ngay từ đầu."],
    ],
  },
  monitor: {
    good: [
      ["Màu ngay khi mở hộp đã chuẩn", "Mình đo lại bằng thiết bị cân màu thì sai lệch rất nhỏ, gần như không phải chỉnh gì. Làm ảnh in ra khớp với những gì thấy trên màn. Chân đế nâng hạ xoay đủ hướng nên kê đúng tầm mắt dễ dàng."],
      ["Chơi game mượt hẳn so với màn 60Hz", "Chuyển từ màn cũ sang là thấy khác ngay ở thao tác kéo chuột và xoay góc nhìn. Không thấy bóng mờ khi vật thể di chuyển nhanh. Cài đặt trong menu rõ ràng, không phải mò."],
      ["Độ phân giải cao nên chữ rất nét", "Ngồi code cả ngày mắt đỡ mỏi hơn hẳn màn Full HD cũ. Không gian màn hình rộng, mở hai cửa sổ cạnh nhau vẫn đọc thoải mái. Viền mỏng nên ghép hai màn nhìn liền mạch."],
      ["Cắm một dây là xong", "Cắm USB-C từ laptop là vừa có hình, vừa sạc máy, vừa dùng được mấy cổng USB trên màn. Bàn làm việc gọn hẳn. Chuyển màn sang máy khác chỉ mất vài giây."],
      ["Đáng tiền, hoàn thiện chắc chắn", "Chân đế nặng và vững, gõ phím mạnh màn không rung. Nút điều khiển kiểu cần gạt dễ dùng hơn nhiều so với mấy nút bấm nhỏ. Không thấy hở sáng ở góc."],
    ],
    mixed: [
      ["Đẹp nhưng chân đế chiếm nhiều chỗ", "Hình ảnh và độ mượt đều tốt. Chân đế thiết kế loe ra nên chiếm khá nhiều diện tích bàn, mình phải mua giá treo rời. Có lỗ bắt chuẩn VESA nên đổi dễ."],
      ["Tốt, nhưng loa tích hợp yếu", "Màn hình thì không có gì để chê trong tầm giá. Loa tích hợp chỉ dùng tạm khi không có loa rời, tiếng mỏng và nhỏ. Mình vẫn cắm loa ngoài."],
      ["Ổn, nhưng menu chỉnh hơi khó hiểu", "Chất lượng hiển thị tốt. Các mục trong menu đặt tên lạ nên mất một lúc mới tìm được chỗ tắt phần làm nét quá tay. Chỉnh xong rồi thì không phải đụng lại."],
      ["Màu đẹp nhưng độ sáng chưa cao", "Trong phòng kín thì rất ổn. Ngồi cạnh cửa sổ ban ngày thì thấy hơi tối, phải kéo rèm. Nếu bàn làm việc nhiều sáng thì nên chọn bản sáng hơn."],
      ["Hài lòng, chỉ tiếc thiếu cổng USB", "Hình ảnh đúng như kỳ vọng và giá hợp lý. Không có hub USB nên vẫn phải cắm chuột phím thẳng vào máy tính. Với bàn gọn thì hơi bất tiện."],
    ],
    critical: [
      ["Hở sáng ở góc dưới bên phải", "Xem phim nền đen trong phòng tối là thấy rõ một vệt sáng ở góc. Dùng ban ngày hoặc nội dung sáng thì không để ý. Mình vẫn dùng nhưng ở tầm giá này thì thấy tiếc."],
      ["Tấm nền có hiện tượng bóng mờ", "Kéo cửa sổ nhanh qua nền tối là thấy vệt mờ đuổi theo. Chỉnh mức overdrive lên thì đỡ nhưng lại xuất hiện viền sáng ngược. Chơi game nhịp chậm thì không ảnh hưởng."],
      ["Chân đế không nâng hạ được", "Chỉ ngả trước sau chứ không chỉnh được độ cao, mình phải kê mấy quyển sách bên dưới cho đúng tầm mắt. Nhìn khá tạm bợ. Chất lượng hình ảnh thì tốt."],
      ["Màu mặc định bị đẩy quá rực", "Mở hộp lên là màu rất chói, da người nhìn đỏ bệt. Phải vào chỉnh về chế độ sRGB và giảm độ bão hoà mới dùng được. Sau khi chỉnh thì ổn."],
      ["Nguồn rời to và dây ngắn", "Cục nguồn ngoài khá lớn, ổ cắm bên cạnh bị che mất. Dây nguồn cũng ngắn nên phải mua dây nối. Màn hình thì không có vấn đề."],
    ],
  },
  peripheral: {
    good: [
      ["Dùng cả ngày không mỏi cổ tay", "Mình gõ và rê chuột khoảng tám tiếng mỗi ngày, sau hai tuần thì cảm giác mỏi ở cổ tay giảm rõ so với thiết bị cũ. Bề mặt bám tay, không trơn khi tay có mồ hôi. Kết nối ổn định, không thấy rớt lần nào."],
      ["Pin lâu ngoài sức tưởng tượng", "Sạc một lần dùng được hàng tháng với cường độ làm việc hằng ngày. Có cảnh báo pin yếu sớm nên không bị hết đột ngột. Sạc nhanh, cắm vài phút là dùng tiếp được.", ["wireless"]],
      ["Chuyển giữa nhiều máy rất tiện", "Mình để máy bàn ở công ty và laptop cá nhân, bấm một nút là đổi, không phải ghép lại từ đầu. Độ trễ gần như không cảm nhận được. Một đầu thu dùng chung cho cả bộ.", ["wireless"]],
      ["Gõ êm, ngồi phòng chung không làm phiền ai", "Tiếng phím nhỏ và đục chứ không lách cách, đồng nghiệp ngồi cạnh không phàn nàn. Hành trình phím vừa đủ, gõ nhanh ít bị sai. Kê tay kèm theo dùng được luôn.", ["keyboard"]],
      ["Nhẹ và chính xác khi chơi game", "Rê nhanh vẫn bám mục tiêu, không thấy hiện tượng trôi hay nhảy con trỏ. Nhẹ nên vẩy cổ tay không tốn sức, chơi lâu đỡ mỏi. Phần mềm lưu được cấu hình vào bộ nhớ trong.", ["mouse"]],
    ],
    mixed: [
      ["Tốt nhưng phần mềm đi kèm nặng", "Thiết bị dùng rất ổn. Phần mềm quản lý thì chiếm nhiều bộ nhớ và tự khởi động cùng máy. Mình lưu cấu hình vào thiết bị rồi gỡ hẳn phần mềm."],
      ["Ổn, nhưng hơi to với tay nhỏ", "Cầm chắc và các nút đặt hợp lý. Tay mình nhỏ nên với tới nút phụ hơi khó, phải đổi cách cầm. Ai tay to thì sẽ vừa.", ["mouse"]],
      ["Gõ tốt nhưng đèn nền tốn pin", "Cảm giác phím rất thích. Bật đèn nền thì pin chỉ được hơn một tuần, tắt đi thì hàng tháng. Mình tắt đèn và dùng thoải mái.", ["keyboard","wireless"]],
      ["Chắc chắn nhưng nặng", "Khung kim loại làm thiết bị rất vững, không xê dịch khi gõ mạnh. Đổi lại nặng, mang đi lại thì bất tiện. Để cố định trên bàn thì đây là điểm cộng."],
      ["Tốt, nhưng thiếu cụm phím số", "Bố cục gọn nên chuột kê gần hơn, vai đỡ mỏi. Làm kế toán nhập số nhiều thì lại thiếu, phải mua bàn phím số rời. Tuỳ nhu cầu mà chọn.", ["keyboard"]],
    ],
    critical: [
      ["Lớp phủ bị bong sau vài tháng", "Chỗ đặt ngón cái bắt đầu bong lớp phủ mềm và dính tay khi trời nóng. Mới dùng khoảng bốn tháng. Chức năng thì vẫn hoạt động bình thường.", ["mouse"]],
      ["Độ trễ rõ khi dùng Bluetooth", "Qua đầu thu riêng thì mượt, nhưng chuyển sang Bluetooth là thấy con trỏ hơi khựng lúc bắt đầu di chuyển. Làm việc thì chịu được, chơi game thì không. Nên dùng đầu thu kèm theo.", ["wireless"]],
      ["Nút cuộn bị nhảy ngược", "Cuộn xuống đôi khi trang nhảy ngược lên một đoạn, nhất là khi cuộn nhanh. Vệ sinh và cài lại phần mềm vẫn còn. Các nút khác thì bình thường.", ["mouse"]],
      ["Phím gõ ồn hơn mô tả", "Hãng ghi là êm nhưng thực tế gõ nhanh vẫn nghe lách cách rõ, họp online phải tắt mic. Thay đệm lót bên trong thì đỡ được một phần. Cảm giác gõ thì tốt.", ["keyboard"]],
      ["Chân đế nghiêng dễ gãy", "Chân gạt phía sau bằng nhựa mỏng, mình gạt ra gạt vào vài lần là thấy lỏng và một bên nứt. Phải kê tạm. Phần còn lại dùng vẫn tốt."],
    ],
  },
  charging: {
    good: [
      ["Nhỏ gọn mà sạc đủ nhanh", "Mình đi công tác chỉ mang đúng nó thay cho hai củ sạc cũ, cắm được cả laptop lẫn điện thoại. Kích thước bỏ túi áo khoác vừa. Sạc điện thoại từ 20% lên 80% khoảng nửa tiếng."],
      ["Sạc được laptop nên bỏ hẳn sạc gốc", "Công suất đủ để chạy laptop khi đang làm việc chứ không chỉ sạc lúc tắt máy. Cắm thêm điện thoại cùng lúc vẫn ổn, chỉ chậm hơn một chút. Vỏ chỉ ấm chứ không nóng."],
      ["Đi chơi xa rất yên tâm", "Dung lượng đủ sạc đầy điện thoại mấy lần, cả nhóm dùng chung một buổi đi chơi vẫn còn. Có màn hình báo phần trăm nên biết còn bao nhiêu. Nặng nhưng chấp nhận được.", ["powerbank"]],
      ["Một cổng cho tất cả thiết bị", "Cắm vào là có đủ cổng hình, mạng dây và thẻ nhớ, khỏi mang ba thứ lỉnh kỉnh. Xuất ra màn ngoài ổn định, không bị nhấp nháy. Vỏ nhôm tản nhiệt tốt.", ["hub"]],
      ["Chân cắm gập được nên không vướng", "Bỏ vào túi không bị chọc rách lớp lót như củ sạc cũ. Cắm vào ổ nhiều lỗ không che mất ổ bên cạnh. Sạc nhanh đúng như mô tả.", ["notPowerbank","notHub"]],
    ],
    mixed: [
      ["Tốt nhưng nóng khi sạc nhiều thiết bị", "Sạc một thiết bị thì chỉ ấm. Cắm đủ ba cổng cùng lúc thì vỏ nóng lên rõ, sờ vào thấy hơi khó chịu. Không tới mức đáng lo nhưng nên để chỗ thoáng."],
      ["Ổn nhưng không kèm dây", "Củ sạc thì tốt và đúng công suất. Trong hộp không có dây nên phải mua thêm dây chịu được công suất cao. Tính ra tổng chi phí đội lên.", ["notPowerbank"]],
      ["Dùng tốt, chỉ là nặng", "Dung lượng lớn nên yên tâm, nhưng bỏ balo thấy rõ trọng lượng. Đi trong thành phố thì hơi thừa. Đi xa hoặc cắm trại thì rất đáng.", ["powerbank"]],
      ["Công suất chia hơi khó đoán", "Khi cắm nhiều thiết bị thì công suất tự chia lại, có lúc laptop bị tụt xuống mức thấp. Phải rút bớt thiết bị nhỏ ra. Cắm một mình thì đúng công suất công bố."],
      ["Tốt nhưng đèn báo sáng cả đêm", "Sạc nhanh và ổn định. Đèn báo xanh khá sáng, để đầu giường ban đêm thì chói. Mình phải xoay mặt đèn xuống."],
    ],
    critical: [
      ["Sạc chậm hơn con số quảng cáo", "Công suất ghi trên vỏ là tổng của tất cả cổng chứ không phải của từng cổng. Cắm riêng laptop thì chỉ đạt khoảng hai phần ba con số đó. Không sai nhưng cách ghi dễ gây hiểu nhầm."],
      ["Nóng đáng lo khi sạc laptop", "Sạc laptop khoảng hai mươi phút là vỏ nóng tới mức cầm lâu thấy rát. Mình phải để trên mặt kính cho thoát nhiệt. Hoạt động thì vẫn bình thường."],
      ["Dung lượng thực thấp hơn ghi trên vỏ", "Ghi 10000mAh nhưng thực tế sạc đầy được điện thoại khoảng một lần rưỡi chứ không phải hai lần như mình tính. Hao hụt khi chuyển đổi là bình thường nhưng vẫn hơi tiếc. Tốc độ sạc thì đúng.", ["powerbank"]],
      ["Cổng bị lỏng sau vài tháng", "Cắm dây vào phải xoay một lúc mới ăn, động nhẹ là ngắt sạc. Mới dùng chừng ba tháng. Các cổng còn lại thì vẫn chặt."],
      ["Không sạc được thiết bị công suất thấp", "Tai nghe và đồng hồ của mình cắm vào thì đèn nháy rồi tự ngắt, chắc do dòng quá nhỏ nên thiết bị tưởng đã tháo ra. Sạc điện thoại và laptop thì bình thường. Phải giữ lại củ sạc cũ cho mấy thứ nhỏ."],
    ],
  },
  storage: {
    good: [
      ["Chép dữ liệu nhanh hơn hẳn ổ cũ", "Chép một thư mục 50GB toàn video mất khoảng một phút, ổ cơ cũ của mình phải mất gần mười phút. Dựng phim trực tiếp trên ổ không thấy giật khi tua. Vỏ chỉ ấm chứ không nóng."],
      ["Nhỏ gọn, bỏ túi mang đi quay", "Kích thước bằng cái bật lửa, bỏ túi máy ảnh không chiếm chỗ. Dây kèm theo có cả hai đầu nên cắm máy nào cũng được. Tốc độ ổn định trong suốt quá trình chép.", ["portableDrive"]],
      ["Quay 4K liên tục không bị ngắt", "Mình quay sự kiện hơn một tiếng liên tục, thẻ không báo lỗi và không rớt khung nào. Chép sang máy tính cũng nhanh. Đúng như thông số công bố.", ["memoryCard"]],
      ["Lắp vào máy là nhận ngay", "Không phải cài thêm gì, cắm vào là dùng. Định dạng lại theo chuẩn của mình mất chưa tới một phút. Tốc độ đọc đo bằng phần mềm đúng như hãng ghi.", ["internalDrive"]],
      ["Bền, mình làm rơi mấy lần vẫn chạy", "Vỏ bọc chắc nên rơi từ mặt bàn xuống sàn gạch vài lần mà dữ liệu không sao. Mang theo đi công trường bụi bặm cũng không vấn đề gì. Tốc độ vẫn giữ nguyên sau một năm.", ["portableDrive"]],
    ],
    mixed: [
      ["Nhanh nhưng nóng khi chép lâu", "Chép vài chục GB đầu thì rất nhanh. Chép liên tục quá khoảng 100GB là vỏ nóng và tốc độ tụt xuống còn một nửa. Nghỉ vài phút rồi chép tiếp thì lại nhanh."],
      ["Tốt, nhưng cần cổng đời mới mới đạt tốc độ", "Cắm vào máy đời mới thì nhanh đúng như quảng cáo. Cắm vào laptop cũ cổng đời trước thì chỉ được khoảng một phần ba. Nên kiểm tra cổng của máy trước khi mua."],
      ["Ổn nhưng dây hơi ngắn", "Ổ chạy tốt và nhanh. Dây kèm theo chỉ khoảng 20cm, cắm vào máy bàn là ổ bị treo lủng lẳng. Mình mua dây dài hơn thay vào.", ["portableDrive"]],
      ["Dung lượng thực ít hơn ghi trên hộp", "Ghi 1TB nhưng khi định dạng xong còn khoảng 930GB. Đây là chuyện bình thường của ngành nhưng người mua lần đầu dễ bất ngờ. Tốc độ thì đúng."],
      ["Nhanh nhưng phần mềm kèm theo thừa", "Tốc độ tốt. Phần mềm sao lưu và mã hoá của hãng thì mình không dùng, xoá đi cho gọn. Sau đó ổ hoạt động bình thường."],
    ],
    critical: [
      ["Tốc độ tụt mạnh khi chép file lớn", "Chép thư mục ảnh RAW khoảng 200GB thì nửa đầu rất nhanh, nửa sau tụt xuống còn khoảng một phần tư. Bộ nhớ đệm hết là thấy rõ. Với file nhỏ lẻ thì không gặp vấn đề."],
      ["Nóng tới mức phải ngừng giữa chừng", "Chép liên tục khoảng mười lăm phút là ổ nóng tới mức máy tính báo cảnh báo nhiệt và ngắt kết nối. Phải để nguội rồi cắm lại. Mình phải kê thêm quạt nhỏ.", ["portableDrive"]],
      ["Không tương thích tốt với máy quay của mình", "Máy tính nhận bình thường nhưng máy quay báo lỗi định dạng, phải định dạng lại ngay trên máy quay mới dùng được. Sau đó thì ổn định. Nên kiểm tra danh sách tương thích trước.", ["memoryCard"]],
      ["Vỏ nhựa rẻ tiền", "Bên trong chạy tốt nhưng vỏ mỏng, bóp nhẹ là thấy lún và kêu. Rơi một lần từ độ cao thấp thì nứt góc. Dữ liệu không sao nhưng nhìn không yên tâm.", ["portableDrive"]],
      ["Đèn báo hoạt động quá mờ", "Đèn nhỏ và tối, khó biết ổ đang ghi hay đã xong, mấy lần mình rút sớm. May chưa mất dữ liệu. Mong hãng làm đèn rõ hơn.", ["portableDrive"]],
    ],
  },
};

// ── Câu chốt trích thông số thật ────────────────────────────────────────────

// Mười nhóm x ba bậc x năm mẫu câu là 150 câu, nhưng chia cho 175 sản phẩm thì
// mỗi câu vẫn lặp hàng chục lần và người xem lướt hai sản phẩm cùng nhóm là
// nhận ra ngay. Câu chốt dưới đây nhét số liệu THẬT của chính sản phẩm đó vào
// cuối bài, nên hai bài cùng khuôn vẫn khác nhau ở phần nội dung đo được — và
// đó cũng chính là phần mà tính năng so sánh AI đọc tới.
const specValue = (family, key) => {
  const raw = family.specs[key];
  return Array.isArray(raw) ? raw[1] : raw;
};

const TAIL = {
  laptopGaming: [
    (f) => `Cấu hình mình mua là ${specValue(f, "ram")} với ${specValue(f, "storage")}.`,
    (f) => `Bản mình dùng chạy ${specValue(f, "gpu")} trên màn ${specValue(f, "screen")}.`,
    (f) => `Máy nặng ${specValue(f, "weight")} và pin ${specValue(f, "battery")}, đúng như trang sản phẩm ghi.`,
  ],
  laptopThin: [
    (f) => `Bản mình mua là ${specValue(f, "ram")} và ${specValue(f, "storage")}.`,
    (f) => `Máy nặng ${specValue(f, "weight")}, màn hình ${specValue(f, "screen")}.`,
    (f) => `Chip là ${specValue(f, "cpu")}, pin ${specValue(f, "battery")}.`,
  ],
  phone: [
    (f) => `Bản mình dùng là ${specValue(f, "ram")} và ${specValue(f, "storage")}.`,
    (f) => `Pin ${specValue(f, "battery")}, màn ${specValue(f, "screen")}.`,
    (f) => `Máy chạy ${specValue(f, "chipset")}, camera sau ${specValue(f, "cameraRear")}.`,
  ],
  tablet: [
    (f) => `Bản mình mua là ${specValue(f, "storage")}, màn ${specValue(f, "screen")}.`,
    (f) => `Máy dùng ${specValue(f, "chipset")} với ${specValue(f, "ram")}.`,
    (f) => `Pin ${specValue(f, "battery")} đúng như mô tả.`,
  ],
  headphone: [
    (f) => `Thông số pin ghi là ${specValue(f, "batteryLife")}.`,
    (f) => `Kết nối qua ${specValue(f, "bluetoothVersion")}.`,
    (f) => `Màng loa ${specValue(f, "driverSize")}, chuẩn kháng nước ${specValue(f, "waterproofRating")}.`,
  ],
  speaker: [
    (f) => `Cấu hình loa là ${specValue(f, "driverSize")}.`,
    (f) => `Pin ghi trên hộp là ${specValue(f, "batteryLife")}.`,
    (f) => `Kết nối ${specValue(f, "bluetoothVersion")}, kháng nước ${specValue(f, "waterproofRating")}.`,
  ],
  smartwatch: [
    (f) => `Bản mình đeo là ${specValue(f, "caseSize")}.`,
    (f) => `Pin công bố ${specValue(f, "batteryLife")}, chống nước ${specValue(f, "waterResistance")}.`,
    (f) => `Màn hình ${specValue(f, "screenType")}.`,
  ],
  monitor: [
    (f) => `Mình mua bản ${specValue(f, "screenSize")}, ${specValue(f, "resolution")}.`,
    (f) => `Tần số quét ${specValue(f, "refreshRate")} trên tấm nền ${specValue(f, "panelType")}.`,
    (f) => `Độ sáng ${specValue(f, "brightness")}, cổng gồm ${specValue(f, "connectivity")}.`,
  ],
  peripheral: [
    (f) => `Thiết bị nặng ${specValue(f, "weight")}.`,
    (f) => `Pin công bố ${specValue(f, "batteryLife")}, kết nối ${specValue(f, "connectivity")}.`,
    (f) => `Cơ chế bên trong là ${specValue(f, "panelType")}.`,
  ],
  charging: [
    (f) => `Bản mình mua ghi ${specValue(f, "power")}, ${specValue(f, "portCount")}.`,
    (f) => `Bố trí cổng là ${specValue(f, "connectivity")}.`,
    (f) => `Công suất ${specValue(f, "power")} đúng như trang sản phẩm.`,
  ],
  storage: [
    (f) => `Bản mình mua là ${specValue(f, "capacity")}, chuẩn ${specValue(f, "interface")}.`,
    (f) => `Tốc độ công bố ${specValue(f, "readSpeed")}.`,
    (f) => `Dung lượng ${specValue(f, "capacity")}, cắm qua ${specValue(f, "connectivity")}.`,
  ],
};

// ── Sinh đánh giá ───────────────────────────────────────────────────────────

const REVIEW_DATES = [
  "2026-05-12", "2026-05-28", "2026-06-09", "2026-06-23",
  "2026-07-04", "2026-07-17", "2026-07-30", "2026-08-08", "2026-08-19",
];

// Ba hoặc bốn bài mỗi sản phẩm. Ô cuối LUÔN là bậc `critical`, đó là ràng buộc
// số 2 ở đầu tệp chứ không phải một lựa chọn văn phong.
const RATING_PLANS = [
  [5, 4, 3],
  [5, 4, 2],
  [5, 5, 4, 3],
  [5, 4, 4, 2],
];

function tierOf(rating) {
  if (rating >= 5) return "good";
  if (rating === 4) return "mixed";
  return "critical";
}

function buildFamilyReviews(families) {
  const reviews = [];

  families.forEach((family) => {
    const seed = hash(family.key);
    const plan = RATING_PLANS[seed % RATING_PLANS.length];
    const group = REVIEW_GROUP[family.cat];
    const pool = CONTENT[group];

    plan.forEach((rating, index) => {
      const tier = tierOf(rating);

      // Lọc trước khi bốc, không phải bốc rồi kiểm: bốc rồi mới loại thì một
      // sản phẩm có ít câu hợp lệ sẽ trượt suất và mất luôn bài đánh giá.
      const eligible = pool[tier].filter((entry) => allowed(entry, family));

      if (eligible.length === 0) {
        throw new Error(
          `Không có câu đánh giá bậc "${tier}" nào hợp với ${family.key} (${family.cat}). ` +
            "Nới điều kiện hoặc thêm câu vào kho.",
        );
      }

      const [title, body] = eligible[(seed + index * 3) % eligible.length];
      const tail = TAIL[group][(seed + index * 5) % TAIL[group].length](family);
      const content = `${body} ${tail}`;

      // Bước nhảy 7 và 24 là số nguyên tố cùng nhau, nên `n` bài của cùng một
      // sản phẩm luôn rơi vào 24 người khác nhau. Trùng người là vi phạm chỉ
      // mục duy nhất trên (user_id, product_id).
      const reviewerIndex = (seed + index * 7) % REVIEWER_KEYS.length;

      reviews.push({
        userKey: REVIEWER_KEYS[reviewerIndex],
        productKey: family.key,
        rating,
        title,
        content,
        status: "APPROVED",
        reviewedAt: new Date(`${REVIEW_DATES[(seed + index) % REVIEW_DATES.length]}T09:00:00Z`),
      });
    });
  });

  return reviews;
}

module.exports = { extraReviewers, buildFamilyReviews };
