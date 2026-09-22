// Bộ câu hỏi vàng cho bộ truy hồi RAG: mỗi câu gán sẵn chunk đúng.
//
// Chunk được định danh bằng cặp `doc` + `heading` chứ không phải id, vì
// `embedChunks.js` truncate bảng mỗi lần chạy nên UUID đổi sau mỗi lần embed.
// `doc` khớp cột `sourceName`, `heading` khớp dòng `## ...` mở đầu chunk.
//
// Điểm liên quan có hai mức, cùng quy ước với phép đo ở mục 6.4:
//   rel = 2  chunk trả lời thẳng câu hỏi
//   rel = 1  chunk bổ trợ, chấp nhận được nhưng không phải chỗ tốt nhất
//
// Ba nhóm câu theo 7.8.6:
//   NUMERIC   ràng buộc số — hỏi đúng một con số hoặc một ngưỡng
//   SEMANTIC  ngữ nghĩa — lời khách nói, gần như không trùng từ với văn bản
//   POLICY    chính sách — câu nằm giữa hai mục dễ nhầm, hoặc bắc qua hai tài liệu

const WARRANTY = "Chính sách bảo hành";
const RETURN = "Chính sách đổi trả và hoàn tiền";
const SHIPPING = "Chính sách vận chuyển";
const PAYMENT = "Phương thức thanh toán";
const INSTALLMENT = "Chính sách trả góp";
const MEMBERSHIP = "Chương trình thành viên TechShop";
const PROMOTION = "Quy định khuyến mãi";
const PRIVACY = "Chính sách bảo mật thông tin";
const CONTACT = "Liên hệ hỗ trợ";
const FAQ = "Câu hỏi thường gặp";
const TECH = "Hỗ trợ kỹ thuật";

const questions = [
  // ── NUMERIC ────────────────────────────────────────────────────────────────
  // Hỏi thẳng một con số. Đây là nhóm mà khớp từ khoá mạnh nhất, vì câu hỏi
  // thường dùng đúng từ của văn bản.
  { id: "num-01", group: "NUMERIC", q: "Đơn hàng từ bao nhiêu tiền thì được miễn phí vận chuyển?", gold: [{ doc: SHIPPING, heading: "Phí vận chuyển", rel: 2 }] },
  { id: "num-02", group: "NUMERIC", q: "Laptop được bảo hành bao nhiêu tháng?", gold: [{ doc: WARRANTY, heading: "Thời gian bảo hành", rel: 2 }] },
  { id: "num-03", group: "NUMERIC", q: "Pin và sạc của điện thoại được bảo hành mấy tháng?", gold: [{ doc: WARRANTY, heading: "Thời gian bảo hành", rel: 2 }] },
  { id: "num-04", group: "NUMERIC", q: "Thời hạn đổi trả hàng là bao nhiêu ngày?", gold: [{ doc: RETURN, heading: "Thời hạn đổi trả", rel: 2 }] },
  { id: "num-05", group: "NUMERIC", q: "Đơn hàng thanh toán khi nhận hàng tối đa bao nhiêu tiền?", gold: [{ doc: PAYMENT, heading: "Thanh toán khi nhận hàng (COD)", rel: 2 }, { doc: FAQ, heading: "Đặt hàng", rel: 1 }] },
  { id: "num-06", group: "NUMERIC", q: "Phí xử lý khi đổi trả vì đổi ý là bao nhiêu phần trăm?", gold: [{ doc: RETURN, heading: "Điều kiện đổi trả", rel: 2 }] },
  { id: "num-07", group: "NUMERIC", q: "Hoàn tiền qua VNPay mất bao nhiêu ngày làm việc?", gold: [{ doc: RETURN, heading: "Chính sách hoàn tiền", rel: 2 }] },
  { id: "num-08", group: "NUMERIC", q: "Sản phẩm giá từ bao nhiêu thì được mua trả góp?", gold: [{ doc: INSTALLMENT, heading: "Giới thiệu chung", rel: 2 }] },
  { id: "num-09", group: "NUMERIC", q: "Kỳ hạn trả góp qua thẻ tín dụng dài nhất là bao nhiêu tháng?", gold: [{ doc: INSTALLMENT, heading: "Trả góp qua thẻ tín dụng", rel: 2 }] },
  { id: "num-10", group: "NUMERIC", q: "Lãi suất trả góp qua công ty tài chính là bao nhiêu một tháng?", gold: [{ doc: INSTALLMENT, heading: "Trả góp qua đối tác tài chính", rel: 2 }] },
  { id: "num-11", group: "NUMERIC", q: "Cần chi tiêu bao nhiêu để lên hạng Gold?", gold: [{ doc: MEMBERSHIP, heading: "Hạng thành viên", rel: 2 }] },
  { id: "num-12", group: "NUMERIC", q: "Một điểm thưởng quy đổi được bao nhiêu tiền?", gold: [{ doc: MEMBERSHIP, heading: "Giới thiệu", rel: 2 }] },
  { id: "num-13", group: "NUMERIC", q: "Điểm thưởng có hiệu lực trong bao lâu?", gold: [{ doc: MEMBERSHIP, heading: "Quy tắc tích điểm", rel: 2 }] },
  { id: "num-14", group: "NUMERIC", q: "Mỗi lần dùng điểm thưởng tối thiểu bao nhiêu điểm?", gold: [{ doc: MEMBERSHIP, heading: "Sử dụng điểm thưởng", rel: 2 }] },
  { id: "num-15", group: "NUMERIC", q: "Phí giao hàng nhanh trong ngày là bao nhiêu?", gold: [{ doc: SHIPPING, heading: "Thời gian giao hàng", rel: 2 }] },
  { id: "num-16", group: "NUMERIC", q: "Gói bảo hành mở rộng có giá bao nhiêu?", gold: [{ doc: WARRANTY, heading: "Bảo hành mở rộng", rel: 2 }] },
  { id: "num-17", group: "NUMERIC", q: "Mã xác nhận quên mật khẩu có hiệu lực bao lâu?", gold: [{ doc: FAQ, heading: "Tài khoản", rel: 2 }] },

  // ── SEMANTIC ───────────────────────────────────────────────────────────────
  // Lời khách nói thật, cố ý tránh dùng từ của văn bản. Đây là nhóm dùng để
  // kiểm chứng embedding có thật sự hơn khớp từ khoá hay không.
  { id: "sem-01", group: "SEMANTIC", q: "Máy mới mua về đã bị lỗi màn hình, tôi muốn lấy lại tiền", gold: [{ doc: RETURN, heading: "Điều kiện đổi trả", rel: 2 }, { doc: RETURN, heading: "Chính sách hoàn tiền", rel: 1 }] },
  { id: "sem-02", group: "SEMANTIC", q: "Tôi mua nhầm rồi, giờ trả lại có mất gì không", gold: [{ doc: RETURN, heading: "Điều kiện đổi trả", rel: 2 }] },
  { id: "sem-03", group: "SEMANTIC", q: "Lỡ tay làm rơi vỡ màn hình thì shop có sửa miễn phí không", gold: [{ doc: WARRANTY, heading: "Các trường hợp không được bảo hành", rel: 2 }] },
  { id: "sem-04", group: "SEMANTIC", q: "Con tem dán trên máy bị rách thì còn được bảo hành nữa không", gold: [{ doc: WARRANTY, heading: "Điều kiện được bảo hành", rel: 2 }] },
  { id: "sem-05", group: "SEMANTIC", q: "Nhà tôi ngoài đảo thì bao lâu mới nhận được hàng", gold: [{ doc: SHIPPING, heading: "Thời gian giao hàng", rel: 2 }] },
  { id: "sem-06", group: "SEMANTIC", q: "Lúc shipper gọi mà tôi đang bận không nghe máy được thì sao", gold: [{ doc: SHIPPING, heading: "Giao hàng không thành công", rel: 2 }] },
  { id: "sem-07", group: "SEMANTIC", q: "Tôi muốn mở ra xem hàng rồi mới đưa tiền có được không", gold: [{ doc: SHIPPING, heading: "Kiểm tra hàng khi nhận", rel: 2 }, { doc: PAYMENT, heading: "Thanh toán khi nhận hàng (COD)", rel: 1 }] },
  { id: "sem-08", group: "SEMANTIC", q: "Tôi không có thẻ ngân hàng nào cả thì mua góp được không", gold: [{ doc: INSTALLMENT, heading: "Trả góp qua đối tác tài chính", rel: 2 }] },
  { id: "sem-09", group: "SEMANTIC", q: "Tôi muốn trả hết nợ sớm hơn hợp đồng thì có bị phạt không", gold: [{ doc: INSTALLMENT, heading: "Tất toán trước hạn", rel: 2 }] },
  { id: "sem-10", group: "SEMANTIC", q: "Tôi có hai mã, dùng cả hai cho một đơn được không", gold: [{ doc: PROMOTION, heading: "Quy định không cộng dồn", rel: 2 }] },
  { id: "sem-11", group: "SEMANTIC", q: "Sao tôi nhập mã vào mà nó báo không hợp lệ", gold: [{ doc: PROMOTION, heading: "Mã giảm giá", rel: 2 }] },
  { id: "sem-12", group: "SEMANTIC", q: "Shop có đem thông tin của tôi đi bán cho ai không", gold: [{ doc: PRIVACY, heading: "Chia sẻ thông tin", rel: 2 }] },
  { id: "sem-13", group: "SEMANTIC", q: "Tôi muốn shop xoá sạch dữ liệu của tôi khỏi hệ thống", gold: [{ doc: PRIVACY, heading: "Quyền của khách hàng", rel: 2 }] },
  { id: "sem-14", group: "SEMANTIC", q: "Mấy giờ thì còn gọi được cho shop", gold: [{ doc: CONTACT, heading: "Tổng đài hỗ trợ khách hàng", rel: 2 }] },
  { id: "sem-15", group: "SEMANTIC", q: "Tôi muốn than phiền về thái độ của nhân viên", gold: [{ doc: CONTACT, heading: "Phản hồi và khiếu nại", rel: 2 }] },
  { id: "sem-16", group: "SEMANTIC", q: "Máy tính vừa mua về thì cần làm gì trước khi dùng", gold: [{ doc: TECH, heading: "Cài đặt ban đầu", rel: 2 }] },
  { id: "sem-17", group: "SEMANTIC", q: "Cài lại win xong máy không bắt được wifi nữa", gold: [{ doc: TECH, heading: "Driver và phần mềm", rel: 2 }] },

  // ── POLICY ─────────────────────────────────────────────────────────────────
  // Câu nằm giữa hai mục dễ nhầm trong cùng một tài liệu, hoặc phải chọn đúng
  // tài liệu giữa nhiều tài liệu cùng nói về tiền và thời hạn.
  { id: "pol-01", group: "POLICY", q: "Mua trong đợt flash sale thì được đổi trả trong mấy ngày?", gold: [{ doc: RETURN, heading: "Thời hạn đổi trả", rel: 2 }] },
  { id: "pol-02", group: "POLICY", q: "Hàng thanh lý có được đổi trả không?", gold: [{ doc: RETURN, heading: "Thời hạn đổi trả", rel: 2 }, { doc: RETURN, heading: "Các sản phẩm không áp dụng đổi trả", rel: 1 }] },
  { id: "pol-03", group: "POLICY", q: "Tai nghe nhét tai đã bóc seal có trả lại được không?", gold: [{ doc: RETURN, heading: "Các sản phẩm không áp dụng đổi trả", rel: 2 }] },
  { id: "pol-04", group: "POLICY", q: "Sửa bảo hành kéo dài bao lâu thì được đổi máy mới?", gold: [{ doc: WARRANTY, heading: "Quy trình bảo hành", rel: 2 }] },
  { id: "pol-05", group: "POLICY", q: "Tôi làm mất phiếu bảo hành rồi thì phải làm sao?", gold: [{ doc: WARRANTY, heading: "Điều kiện được bảo hành", rel: 2 }] },
  { id: "pol-06", group: "POLICY", q: "Đơn đã giao cho bên vận chuyển rồi thì huỷ thế nào?", gold: [{ doc: FAQ, heading: "Hủy đơn hàng", rel: 2 }] },
  { id: "pol-07", group: "POLICY", q: "Huỷ đơn đã thanh toán trước thì bao lâu nhận lại tiền?", gold: [{ doc: FAQ, heading: "Hủy đơn hàng", rel: 2 }, { doc: RETURN, heading: "Chính sách hoàn tiền", rel: 1 }] },
  { id: "pol-08", group: "POLICY", q: "Chuyển khoản mà quên ghi mã đơn hàng thì xử lý ra sao?", gold: [{ doc: PAYMENT, heading: "Chuyển khoản ngân hàng", rel: 2 }] },
  { id: "pol-09", group: "POLICY", q: "Dùng thẻ phát hành ở nước ngoài có bị tính thêm phí không?", gold: [{ doc: PAYMENT, heading: "Thẻ tín dụng và thẻ ghi nợ quốc tế", rel: 2 }] },
  { id: "pol-10", group: "POLICY", q: "Khi nào thì tôi nhận được hoá đơn VAT?", gold: [{ doc: PAYMENT, heading: "Hóa đơn và chứng từ", rel: 2 }] },
  { id: "pol-11", group: "POLICY", q: "Thành viên Platinum được ưu đãi gì về giao hàng?", gold: [{ doc: MEMBERSHIP, heading: "Hạng thành viên", rel: 2 }] },
  { id: "pol-12", group: "POLICY", q: "Năm nay tôi mua ít đi thì có bị tụt hạng thành viên không?", gold: [{ doc: MEMBERSHIP, heading: "Duy trì và hạ hạng", rel: 2 }] },
  { id: "pol-13", group: "POLICY", q: "Đơn dùng mã giảm sâu có được tích điểm không?", gold: [{ doc: MEMBERSHIP, heading: "Quy tắc tích điểm", rel: 2 }] },
  { id: "pol-14", group: "POLICY", q: "Sản phẩm Apple có được áp thêm mã giảm giá không?", gold: [{ doc: PROMOTION, heading: "Điều kiện áp dụng khuyến mãi", rel: 2 }] },
  { id: "pol-15", group: "POLICY", q: "Mã giảm giá đã hết hạn có xin gia hạn được không?", gold: [{ doc: PROMOTION, heading: "Thời hạn khuyến mãi", rel: 2 }] },
  { id: "pol-16", group: "POLICY", q: "Laptop Dell thì kích hoạt bảo hành điện tử ở đâu?", gold: [{ doc: TECH, heading: "Kích hoạt bảo hành điện tử", rel: 2 }] },
];

// Câu cố ý nằm ngoài ngữ liệu: nghe hợp lý với một cửa hàng công nghệ nhưng
// không tài liệu nào trả lời. Dùng để đo tỉ lệ bịa và để chọn ngưỡng similarity.
const outOfCorpus = [
  { id: "out-01", q: "TechShop có dịch vụ cho thuê laptop theo tháng không?" },
  { id: "out-02", q: "Phí gói quà tặng khi đặt hàng online là bao nhiêu?" },
  { id: "out-03", q: "Chương trình thu cũ đổi mới được trợ giá bao nhiêu phần trăm?" },
  { id: "out-04", q: "TechShop có bán gói bảo hiểm rơi vỡ màn hình không?" },
  { id: "out-05", q: "Tôi đặt trước sản phẩm chưa ra mắt được không?" },
  { id: "out-06", q: "TechShop có giao hàng ra nước ngoài không?" },
  { id: "out-07", q: "Nhân viên TechShop được mua hàng giảm giá bao nhiêu?" },
  { id: "out-08", q: "TechShop có bán sim và gói cước di động không?" },
  { id: "out-09", q: "Có dịch vụ vệ sinh bảo dưỡng laptop định kỳ không?" },
  { id: "out-10", q: "TechShop có nhận sửa máy mua ở nơi khác không?" },
  { id: "out-11", q: "Có chương trình giá riêng cho khách hàng doanh nghiệp mua số lượng lớn không?" },
  { id: "out-12", q: "TechShop có bán linh kiện thay thế lẻ như màn hình laptop không?" },
  { id: "out-13", q: "Có dịch vụ lắp đặt máy tính để bàn tận nhà không?" },
  { id: "out-14", q: "TechShop có tuyển nhân viên bán hàng không?" },
  // Năm câu dưới hỏi một dữ kiện cụ thể về công ty mà ngữ liệu KHÔNG hề nêu.
  // Đây là loại câu mô hình ngôn ngữ dễ bịa nhất, vì nó luôn có sẵn một con số
  // nghe hợp lý để điền vào.
  { id: "out-15", q: "TechShop được thành lập năm nào?" },
  { id: "out-16", q: "Doanh thu năm ngoái của TechShop là bao nhiêu?" },
  { id: "out-17", q: "TechShop hiện có bao nhiêu nhân viên?" },
  { id: "out-18", q: "Mã số thuế của TechShop là gì?" },
  { id: "out-19", q: "Ai là người sáng lập TechShop?" },
  { id: "out-20", q: "TechShop có bao nhiêu kho hàng trên toàn quốc?" },
];

module.exports = { questions, outOfCorpus };
