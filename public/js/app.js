// Main Application Controller - LingoBot2 Ver0.30 Implementation
window.LingoApp = {
    apiKey: "",
    mode: "Giao tiếp",
    uiLang: "tiếng Việt",
    targetLang: "us English",
    level: "Sơ cấp (CEFR A1, A2)",
    scenario: "自己紹介の会話",
    filterLang: "all",
    filterLevel: "all",
    userSelectedTtsModel: null, // Tracks user explicit TTS choice
    messages: [],
    isProcessing: false,

    // I18N Dictionary translating 100% of UI elements
    i18n: {
        "tiếng Việt": {
            tabGiaoTiep: "Giao tiếp",
            tabPhatAm: "Phát âm",
            lblUiLang: "Sử dụng:",
            lblTargetLang: "Mục tiêu:",
            resetBtn: "Đặt lại",
            endBtn: "Kết thúc",
            sendBtn: "Gửi",
            placeholder: "Nhập tin nhắn hoặc nói bằng micro...",
            scenarioTitle: "🎯 Chọn trình độ (CEFR) & Tình huống giao tiếp:",
            levelLabel: "Trình độ:",
            scenarioLabel: "Tình huống (20 chủ đề):",
            level1: "Sơ cấp A1-A2",
            level2: "Trung cấp B1-B2",
            level3: "Cao cấp C1-C2",

            catDaily: "💬 Giao tiếp hằng ngày",
            scenSelfIntro: "👋 Tự giới thiệu bản thân",
            scenDirections: "🗺️ Hỏi và chỉ đường",
            scenSmallTalk: "☀️ Thời tiết & Trò chuyện",
            scenShopping: "🛍️ Mua sắm",

            catTravel: "✈️ Du lịch & Di chuyển",
            scenAirport: "✈️ Check-in Sân bay",
            scenHotel: "🏨 Thủ tục Khách sạn",
            scenTrainBus: "🚃 Tàu điện & Xe buýt",
            scenTaxi: "🚖 Đi xe Taxi",

            catDining: "🍽️ Ẩm thực & Nhà hàng",
            scenCafe: "☕ Gọi đồ ở Quán Cafe",
            scenReserve: "📅 Đặt bàn Nhà hàng",
            scenIzakaya: "🍶 Gọi món Quán nhậu",
            scenPayment: "💳 Thanh toán tiền",

            catBusiness: "💼 Công việc & Kinh doanh",
            scenPhone: "📞 Nghe gọi Điện thoại",
            scenCard: "📇 Đổi danh thiếp & Chào hỏi",
            scenMeeting: "🗣️ Phát biểu ý kiến Cuộc họp",
            scenComplaint: "⚠️ Xử lý Khiếu nại",
            scenInterview: "💼 Phỏng vấn Xin việc",

            catTrouble: "🚨 Khẩn cấp & Sự cố",
            scenHospital: "🏥 Bệnh viện & Nhà thuốc",
            scenPolice: "👮 Cảnh sát & Thất lạc đồ",
            scenLost: "❓ Bị lạc đường",

            startBtn: "🚀 Bắt đầu hội thoại ngay",
            pronounceTitle: "🎯 Luyện Phát Âm & Ngữ Điệu (Pronunciation Practice)",
            pronounceSub: "Chọn câu mẫu bên dưới (80 câu mẫu Sơ cấp/Trung cấp/Cao cấp) hoặc tự nói qua Micro để AI phân tích phát âm.",
            filterLang: "Ngôn ngữ:",
            filterLevel: "Trình độ:",
            filterAll: "Tất cả",
            aiThinking: "AI đang suy nghĩ...",
            aiSummarizing: "AI đang tổng hợp báo cáo bài học..."
        },
        "tiếng Nhật": {
            tabGiaoTiep: "対話練習",
            tabPhatAm: "発音練習",
            lblUiLang: "UI言語:",
            lblTargetLang: "学習言語:",
            resetBtn: "リセット",
            endBtn: "終了",
            sendBtn: "送信",
            placeholder: "メッセージを入力、またはマイクで話してください...",
            scenarioTitle: "🎯 レベル(CEFR)と対話シチュエーションの選択:",
            levelLabel: "レベル:",
            scenarioLabel: "場面 (全20テーマ):",
            level1: "初級 A1-A2",
            level2: "中級 B1-B2",
            level3: "上級 C1-C2",

            catDaily: "💬 日常会話",
            scenSelfIntro: "👋 自己紹介の会話",
            scenDirections: "🗺️ 道案内の会話",
            scenSmallTalk: "☀️ 天気・世間話の会話",
            scenShopping: "🛍️ 買い物の会話",

            catTravel: "✈️ 旅行・移動",
            scenAirport: "✈️ 空港のチェックイン会話",
            scenHotel: "🏨 ホテルの宿泊手続き会話",
            scenTrainBus: "🚃 電車・バスの乗り換え会話",
            scenTaxi: "🚖 タクシーでの会話",

            catDining: "🍽️ グルメ・飲食",
            scenCafe: "☕ カフェでの注文会話",
            scenReserve: "📅 レストランの予約会話",
            scenIzakaya: "🍶 居酒屋での注文会話",
            scenPayment: "💳 会計・支払い時の会話",

            catBusiness: "💼 ビジネス",
            scenPhone: "📞 電話対応の会話",
            scenCard: "📇 名刺交換・挨拶の会話",
            scenMeeting: "🗣️ 会議での意見表明会話",
            scenComplaint: "⚠️ クレーム対応の会話",
            scenInterview: "💼 採用面接の会話",

            catTrouble: "🚨 トラブル・緊急",
            scenHospital: "🏥 病院・薬局での会話",
            scenPolice: "👮 警察・紛失物の届出会話",
            scenLost: "❓ 道に迷ったときの会話",

            startBtn: "🚀 会話を開始する",
            pronounceTitle: "🎯 発音・シャドーイング練習",
            pronounceSub: "下の例文（初級・中級・上級の計80文）を選択するかマイクで話して、AIによる発音指導を受けましょう。",
            filterLang: "言語:",
            filterLevel: "レベル:",
            filterAll: "すべて",
            aiThinking: "AIが思考中です...",
            aiSummarizing: "AIがまとめています..."
        },
        "tiếng Anh": {
            tabGiaoTiep: "Conversation",
            tabPhatAm: "Pronunciation",
            lblUiLang: "UI Eng:",
            lblTargetLang: "Target Lang:",
            resetBtn: "Reset",
            endBtn: "End",
            sendBtn: "Send",
            placeholder: "Type a message or speak into mic...",
            scenarioTitle: "🎯 Choose CEFR Level & Scenario:",
            levelLabel: "Level:",
            scenarioLabel: "Scenario (20 Topics):",
            level1: "Beginner A1-A2",
            level2: "Intermediate B1-B2",
            level3: "Advanced C1-C2",

            catDaily: "💬 Daily Conversation",
            scenSelfIntro: "👋 Self-Introduction",
            scenDirections: "🗺️ Asking & Giving Directions",
            scenSmallTalk: "☀️ Weather & Small Talk",
            scenShopping: "🛍️ Shopping",

            catTravel: "✈️ Travel & Transit",
            scenAirport: "✈️ Airport Check-in",
            scenHotel: "🏨 Hotel Check-in & Stay",
            scenTrainBus: "🚃 Train & Bus Transfer",
            scenTaxi: "🚖 Taxi Ride",

            catDining: "🍽️ Dining & Food",
            scenCafe: "☕ Ordering at Cafe",
            scenReserve: "📅 Restaurant Reservation",
            scenIzakaya: "🍶 Izakaya / Bar Order",
            scenPayment: "💳 Paying the Bill",

            catBusiness: "💼 Business",
            scenPhone: "📞 Phone Call Handling",
            scenCard: "📇 Business Card & Greetings",
            scenMeeting: "🗣️ Expressing Opinions in Meetings",
            scenComplaint: "⚠️ Handling Complaints",
            scenInterview: "💼 Job Interview",

            catTrouble: "🚨 Emergency & Trouble",
            scenHospital: "🏥 Hospital & Pharmacy",
            scenPolice: "👮 Police & Lost Items",
            scenLost: "❓ Getting Lost",

            startBtn: "🚀 Start Conversation Now",
            pronounceTitle: "🎯 Pronunciation & Intonation Practice",
            pronounceSub: "Select from 80 sample sentences (Beginner/Intermediate/Advanced) or speak into mic for AI pronunciation feedback.",
            filterLang: "Language:",
            filterLevel: "Level:",
            filterAll: "All",
            aiThinking: "AI is thinking...",
            aiSummarizing: "AI is summarizing..."
        }
    },

    // 80 Complete Sample Sentences
    sampleSentences: [
        // --- JAPANESE (30 Sentences) ---
        { id: 101, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "すみません、荷物（にもつ）を預（あず）けたいのですが。", translation: "Xin lỗi, tôi muốn gửi hành lý ạ." },
        { id: 102, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "この電車（でんしゃ）は新宿（しんじゅく）に行（い）きますか。", translation: "Tàu này có đi Shinjuku không ạ?" },
        { id: 103, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "おすすめのメニューは何（なに）ですか。", translation: "Món ăn được đề xuất là món gì ạ?" },
        { id: 104, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "お会計（かいけい）を別々（べつべつ）にお願（ねが）いします。", translation: "Làm ơn tính tiền riêng cho chúng tôi." },
        { id: 105, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "写真（しゃしん）を撮（と）っていただけますか。", translation: "Bạn có thể chụp giúp tôi một tấm hình được không?" },
        { id: 106, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "トイレはどこにありますか。", translation: "Nhà vệ sinh ở đâu vậy ạ?" },
        { id: 107, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "水（みず）を一杯（いっぱい）ください。", translation: "Cho tôi xin một ly nước lọc." },
        { id: 108, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "これを試着（しちゃく）してもいいですか。", translation: "Tôi có thể thử cái này được không?" },
        { id: 109, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "免税（めんぜい）の手続（てつづ）きはできますか。", translation: "Có thể làm thủ tục miễn thuế ở đây không?" },
        { id: 110, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "どうぞよろしくお願（ね가）いします。", translation: "Rất mong nhận được sự giúp đỡ của bạn." },

        { id: 111, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "飛行機（ひこうき）の出発（しゅっぱつ）時間（じかん）が変更（へんこう）になったようです。", translation: "Hình như giờ xuất phát chuyến bay đã bị thay đổi." },
        { id: 112, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "来週（らいしゅう）の会議（かいぎ）のスケジュールを調整（ちょうせい）していただけますか。", translation: "Bạn có thể điều chỉnh lịch họp tuần sau giúp tôi không?" },
        { id: 113, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "日本（にほん）の習慣（しゅうかん）についてもっと詳（くわ）しく知（し）りたいです。", translation: "Tôi muốn tìm hiểu kỹ hơn về tập quan Nhật Bản." },
        { id: 114, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "あいにくあしたは先約（せんやく）がありまして、出席（しゅっせき）できません。", translation: "Nuối tiếc là ngày mai tôi có hẹn trước nên không thể tham dự." },
        { id: 115, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "ご迷惑（めいわく）をおかけして大変（たいへん）申し訳（もうしわけ）ございません。", translation: "Rất xin lỗi vì đã làm phiền quý vị." },
        { id: 116, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "この問題（もんだい）について、皆様（みなさま）のご意見（いけん）をお聞（き）かせください。", translation: "Xin hãy cho tôi nghe ý kiến của mọi người về vấn đề này." },
        { id: 117, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "新（あたら）しいプロジェクトの進捗（しんちょく）状況（じょうきょう）を報告（ほうこく）します。", translation: "Tôi xin báo cáo tiến độ của dự án mới." },
        { id: 118, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "おかげさまで、無事（ぶじ）に目標（もくひょう）を達成（たっせい）することができました。", translation: "Nhờ sự hỗ trợ của bạn, chúng tôi đã đạt mục tiêu an toàn." },
        { id: 119, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "体調（たいちょう）が優（すぐ）れないため、本日は早退（そうたい）させていただきます。", translation: "Vì sức khỏe không tốt nên hôm nay tôi xin phép về sớm." },
        { id: 120, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "今後（こんご）とも変わらぬお付き合いのほど、よろしくお願（ねが）い申し上げます。", translation: "Rất mong tiếp tục duy trì mối quan hệ tốt đẹp trong tương lai." },

        { id: 121, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "多角的な視点から市場の動向を分析し、中長期的な戦略を策定する必要があります。", translation: "Cần phân tích xu hướng thị trường từ nhiều góc độ và lập chiến lược trung - dài hạn." },
        { id: 122, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "諸般の事情に鑑み、本提案の導入を一時見合わせる結論に至りました。", translation: "Căn cứ vào nhiều tình hình, chúng tôi đi đến kết luận tạm hoãn đề xuất này." },
        { id: 123, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "構造改革を断行しなければ、持続可能な成長を実現することは困難でしょう。", translation: "Nếu không quyết liệt cải cách cơ cấu, rất khó đạt được tăng trưởng bền vững." },
        { id: 124, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "双方の利害を調整し、双方にとって望ましい着地点を模索すべきです。", translation: "Cần điều hòa lợi ích đôi bên và tìm kiếm điểm đồng thuận mong muốn." },
        { id: 125, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "技術革新の波に伴い、従来のビジネスモデルの再構築が強く求められています。", translation: "Cùng với làn sóng đổi mới công nghệ, việc tái cấu trúc mô hình kinh doanh cũ là cấp thiết." },
        { id: 126, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "未曾有の危機に対処すべく、迅速かつ果断な意志決定が極めて重要となります。", translation: "Để ứng phó khủng hoảng chưa từng có, việc ra quyết định nhanh chóng và quyết đoán là cực kỳ quan trọng." },
        { id: 127, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "競合他社との差別化を図るため、顧客体験の飛躍的な向上を目指します。", translation: "Để tạo sự khác biệt với đối thủ, chúng tôi hướng tới nâng cao đột phá trải nghiệm khách hàng." },
        { id: 128, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "資源の効率的な分配を図りつつ、コスト削減の徹底に邁進いたします。", translation: "Vừa phân bổ nguồn lực hiệu quả, chúng tôi vừa nỗ lực triệt để cắt giảm chi phí." },
        { id: 129, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "組織の風通しを良くし、社員一人ひとりの主体的な挑戦を促進してまいります。", translation: "Tạo sự thông thoáng trong tổ chức và thúc đẩy thử thách chủ động của từng nhân viên." },
        { id: 130, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "今後の経済環境の不透明感を考慮し、慎重かつ柔軟な対応に努めてまいります。", translation: "Tính đến sự bất định của môi trường kinh tế sắp tới, chúng tôi sẽ ứng phó thận trọng và linh hoạt." },

        // --- ENGLISH (30 Sentences) ---
        { id: 201, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Could you please help me find the check-in counter?", translation: "Bạn có thể giúp tôi tìm quầy làm thủ tục không?" },
        { id: 202, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Where is the nearest train station from here?", translation: "Ga tàu gần nhất ở đâu vậy?" },
        { id: 203, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "I would like to order a cup of hot coffee, please.", translation: "Cho tôi gọi một ly cà phê nóng nhé." },
        { id: 204, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Excuse me, how much does this souvenir cost?", translation: "Xin lỗi, món quà lưu niệm này giá bao nhiêu?" },
        { id: 205, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Could you take a picture of us, please?", translation: "Bạn chụp giúp chúng tôi một tấm hình nhé?" },
        { id: 206, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Is there free Wi-Fi available in this hotel?", translation: "Khách sạn có Wi-Fi miễn phí không?" },
        { id: 207, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "I have a reservation under the name of Smith.", translation: "Tôi có đặt phòng trước dưới tên Smith." },
        { id: 208, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Can I try on these shoes in size eight?", translation: "Tôi có thể thử đôi giày này cỡ số 8 không?" },
        { id: 209, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Where can I exchange my money into US dollars?", translation: "Tôi có thể đổi tiền sang đô la Mỹ ở đâu?" },
        { id: 210, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Nice to meet you, hope you have a great day!", translation: "Rất vui được gặp bạn, chúc một ngày tốt lành!" },

        { id: 211, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "It seems that my flight has been delayed due to unexpected weather conditions.", translation: "Hình như chuyến bay của tôi bị hoãn do thời tiết bất ngờ." },
        { id: 212, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "Could you please reschedule our meeting to next Thursday afternoon?", translation: "Bạn có thể chuyển lịch họp sang chiều thứ Năm tuần sau không?" },
        { id: 213, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "I'm really interested in learning more about local culture and traditions.", translation: "Tôi rất thích tìm hiểu thêm về văn hóa truyền thống địa phương." },
        { id: 214, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "Unfortunately, I won't be able to attend the conference due to a prior commitment.", translation: "Thật tiếc là tôi không thể dự hội thảo vì đã có lịch trước." },
        { id: 215, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "I sincerely apologize for any inconvenience this delay may have caused you.", translation: "Tôi chân thành xin lỗi vì sự chậm trễ này đã gây phiền hà cho bạn." },
        { id: 216, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "We would greatly appreciate your valuable feedback regarding our new product.", translation: "Chúng tôi rất trân trọng phản hồi quý báu của bạn về sản phẩm mới." },
        { id: 217, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "Let me give you a quick update on the current progress of our team project.", translation: "Để tôi cập nhật nhanh tiến độ hiện tại của dự án nhóm." },
        { id: 218, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "Thanks to your continuous support, we successfully achieved our quarterly goals.", translation: "Nhờ sự hỗ trợ liên tục của bạn, chúng tôi đã đạt mục tiêu quý thành công." },
        { id: 219, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "I am feeling a bit under the weather today, so I will take a sick leave.", translation: "Hôm nay tôi thấy mệt nên xin phép nghỉ bệnh." },
        { id: 220, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "We look forward to continuing our fruitful cooperation in the upcoming year.", translation: "Chúng tôi mong tiếp tục hợp tác hiệu quả trong năm tới." },

        { id: 221, lang: "us English", level: "Cao cấp", category: "🌳 us English - Advanced C1-C2", text: "We must rigorously analyze market trends from multiple perspectives to formulate long-term strategies.", translation: "Phải phân tích nghiêm ngặt xu hướng thị trường từ nhiều góc độ để lập chiến lược dài hạn." },
        { id: 222, lang: "us English", level: "Cao cấp", category: "🌳 us English - Advanced C1-C2", text: "In light of prevailing economic uncertainties, we decided to postpone the product launch.", translation: "Căn cứ tình hình kinh tế bất ổn, chúng tôi quyết định hoãn ra mắt sản phẩm." },
        { id: 223, lang: "us English", level: "Cao cấp", category: "🌳 us English - Advanced C1-C2", text: "Implementing structural reforms is imperative to securing sustainable corporate growth.", translation: "Thực hiện cải cách cơ cấu là bắt buộc để đảm bảo tăng trưởng bền vững." },
        { id: 224, lang: "us English", level: "Cao cấp", category: "🌳 us English - Advanced C1-C2", text: "It is essential to reconcile conflicting stakeholder interests to reach a mutually beneficial consensus.", translation: "Cần hòa giải lợi ích mâu thuẫn để đạt được sự đồng thuận hai bên cùng có lợi." },
        { id: 225, lang: "us English", level: "Cao cấp", category: "🌳 us English - Advanced C1-C2", text: "Rapid technological advancement necessitates a comprehensive overhaul of traditional business paradigms.", translation: "Tiến bộ công nghệ nhanh đòi hỏi đại tu toàn diện mô hình kinh doanh truyền thống." },
        { id: 226, lang: "us English", level: "Cao cấp", category: "🌳 us English - Advanced C1-C2", text: "Swift and decisive leadership is pivotal in navigating unprecedented organizational crises.", translation: "Lãnh đạo nhanh nhạy và quyết đoán là then chốt để vượt qua khủng hoảng." },
        { id: 227, lang: "us English", level: "Cao cấp", category: "🌳 us English - Advanced C1-C2", text: "To foster competitive differentiation, we prioritize enhancing overall customer experience.", translation: "Để thúc đẩy khác biệt cạnh tranh, chúng tôi ưu tiên nâng cao trải nghiệm khách hàng." },
        { id: 228, lang: "us English", level: "Cao cấp", category: "🌳 us English - Advanced C1-C2", text: "We remain committed to optimizing resource allocation while enforcing strict cost discipline.", translation: "Chúng tôi cam kết tối ưu phân bổ nguồn lực đồng thời kỷ luật chi phí nghiêm ngặt." },
        { id: 229, lang: "us English", level: "Cao cấp", category: "🌳 us English - Advanced C1-C2", text: "Fostering a culture of transparent communication empowers employees to take initiative.", translation: "Nuôi dưỡng văn hóa giao tiếp minh bạch giúp nhân viên chủ động hơn." },
        { id: 230, lang: "us English", level: "Cao cấp", category: "🌳 us English - Advanced C1-C2", text: "Adopting a prudent yet agile approach will allow us to navigate volatile market dynamics.", translation: "Áp dụng phương pháp thận trọng nhưng linh hoạt giúp vượt biến động thị trường." },

        // --- VIETNAMESE (20 Sentences) ---
        { id: 301, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Xin chào! Rất vui được làm quen với bạn ngày hôm nay.", translation: "Hello! Nice to meet you today." },
        { id: 302, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Cho tôi hỏi quầy làm thủ tục sân bay ở đâu ạ?", translation: "Excuse me, where is the airport check-in counter?" },
        { id: 303, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Làm ơn cho tôi gọi một ly cà phê sữa đá.", translation: "Please give me an iced milk coffee." },
        { id: 304, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Cái áo này giá bao nhiêu tiền vậy bạn?", translation: "How much does this shirt cost?" },
        { id: 305, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Bạn có thể chụp giúp tôi một tấm hình được không?", translation: "Could you take a photo of me, please?" },
        { id: 306, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Cho tôi xin mật khẩu Wi-Fi của quán được không?", translation: "May I have the Wi-Fi password for the cafe?" },
        { id: 307, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Tôi đã đặt phòng trước dưới tên Nguyễn Văn An.", translation: "I booked a room under the name Nguyen Van An." },
        { id: 308, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Cho tôi thử đôi giày này cỡ số bốn mươi nhé.", translation: "Let me try these shoes in size 40." },
        { id: 309, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Cảm ơn bạn rất nhiều, chúc bạn một ngày tốt lành!", translation: "Thank you very much, have a nice day!" },
        { id: 310, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Hẹn gặp lại bạn vào thời gian sớm nhất nhé!", translation: "See you again very soon!" },

        { id: 311, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Hình như chuyến bay của tôi đã bị hoãn do thời tiết xấu.", translation: "It seems my flight was delayed due to bad weather." },
        { id: 312, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Bạn có thể vui lòng đổi lịch hẹn sang chiều thứ Năm tuần sau được không?", translation: "Could you please move our appointment to next Thursday afternoon?" },
        { id: 313, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Tôi rất muốn tìm hiểu sâu hơn về văn hóa và ẩm thực địa phương.", translation: "I really want to learn deeper about local culture and food." },
        { id: 314, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Thật tiếc là tôi không thể tham dự buổi họp vì đã có lịch từ trước.", translation: "Unfortunately, I cannot attend due to a prior schedule." },
        { id: 315, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Thành thật xin lỗi bạn vì sự bất tiện ngoài ý muốn này.", translation: "Sincere apologies for this unintended inconvenience." },
        { id: 316, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Chúng tôi rất mong nhận được ý kiến đóng góp quý báu từ phía bạn.", translation: "We look forward to receiving your valuable feedback." },
        { id: 317, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Tôi xin phép báo cáo tiến độ công việc của nhóm trong tuần qua.", translation: "Let me report the team's work progress over the past week." },
        { id: 318, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Nhờ sự hỗ trợ nhiệt tình của bạn, chúng tôi đã hoàn thành mục tiêu.", translation: "Thanks to your enthusiastic support, we completed the target." },
        { id: 319, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Hôm nay sức khỏe tôi không được tốt nên xin phép nghỉ sớm.", translation: "I'm not feeling well today so I ask to leave early." },
        { id: 320, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Hy vọng hai bên sẽ tiếp tục hợp tác tốt đẹp trong tương lai.", translation: "Hope both sides continue great cooperation in the future." }
    ],

    init() {
        this.checkApiKey();
        this.bindEvents();
        this.setupTimestamp();
        this.updateUiLanguage(this.uiLang);
        this.renderPronounceSamples();
        window.LingoLog.add("Khởi tạo LingoApp hoàn tất [LingoBot2 Ver0.30].");
    },

    updateUiLanguage(lang) {
        this.uiLang = lang;
        const dict = this.i18n[lang] || this.i18n["tiếng Việt"];

        const setTxt = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setTxt("txtTabGiaoTiep", dict.tabGiaoTiep);
        setTxt("txtTabPhatAm", dict.tabPhatAm);
        setTxt("lblUiLang", dict.lblUiLang);
        setTxt("lblTargetLang", dict.lblTargetLang);
        setTxt("txtResetBtn", dict.resetBtn);
        setTxt("txtEndBtn", dict.endBtn);
        setTxt("txtSendBtn", dict.sendBtn);
        setTxt("txtFooterEndBtn", dict.endBtn);
        setTxt("txtScenarioTitle", dict.scenarioTitle);
        setTxt("txtLevelLabel", dict.levelLabel);
        setTxt("txtScenarioLabel", dict.scenarioLabel);
        
        // Levels
        setTxt("optLevel1", dict.level1);
        setTxt("optLevel2", dict.level2);
        setTxt("optLevel3", dict.level3);

        // Categories
        setTxt("catDaily", dict.catDaily);
        setTxt("catTravel", dict.catTravel);
        setTxt("catDining", dict.catDining);
        setTxt("catBusiness", dict.catBusiness);
        setTxt("catTrouble", dict.catTrouble);

        // 20 Scenarios
        setTxt("scenSelfIntro", dict.scenSelfIntro);
        setTxt("scenDirections", dict.scenDirections);
        setTxt("scenSmallTalk", dict.scenSmallTalk);
        setTxt("scenShopping", dict.scenShopping);

        setTxt("scenAirport", dict.scenAirport);
        setTxt("scenHotel", dict.scenHotel);
        setTxt("scenTrainBus", dict.scenTrainBus);
        setTxt("scenTaxi", dict.scenTaxi);

        setTxt("scenCafe", dict.scenCafe);
        setTxt("scenReserve", dict.scenReserve);
        setTxt("scenIzakaya", dict.scenIzakaya);
        setTxt("scenPayment", dict.scenPayment);

        setTxt("scenPhone", dict.scenPhone);
        setTxt("scenCard", dict.scenCard);
        setTxt("scenMeeting", dict.scenMeeting);
        setTxt("scenComplaint", dict.scenComplaint);
        setTxt("scenInterview", dict.scenInterview);

        setTxt("scenHospital", dict.scenHospital);
        setTxt("scenPolice", dict.scenPolice);
        setTxt("scenLost", dict.scenLost);

        setTxt("startChatBtn", dict.startBtn);
        setTxt("txtPronounceTitle", dict.pronounceTitle);
        setTxt("txtPronounceSub", dict.pronounceSub);
        setTxt("lblFilterLang", dict.filterLang);
        setTxt("lblFilterLevel", dict.filterLevel);
        setTxt("chipLangAll", dict.filterAll);
        setTxt("chipLevelAll", dict.filterAll);
        setTxt("txtSummaryLoading", dict.aiSummarizing);

        const chatInput = document.getElementById("chatInput");
        if (chatInput) chatInput.placeholder = dict.placeholder;

        window.LingoLog.add(`Cập nhật 100% văn bản giao diện sang: ${lang}`);
    },

    openLogModal() {
        if (window.LingoLog) {
            window.LingoLog.openModal();
        } else {
            const modal = document.getElementById("logModal");
            if (modal) modal.classList.remove("hidden");
        }
    },

    formatFuriganaForDisplay(text) {
        if (!text) return "";
        return text
            .replace(/([\u3400-\u4dbf\u4e00-\u9fff]+)（([\u3040-\u309f\u30a0-\u30ff\s]+)）/g, '<ruby>$1<rt>$2</rt></ruby>')
            .replace(/([\u3400-\u4dbf\u4e00-\u9fff]+)\(([\u3040-\u309f\u30a0-\u30ff\s]+)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    },

    switchMode(modeType) {
        const tabGiaoTiep = document.getElementById("tabGiaoTiep");
        const tabPhatAm = document.getElementById("tabPhatAm");
        const chatContainer = document.getElementById("chatContainer");
        const pronounceContainer = document.getElementById("pronounceContainer");

        if (modeType === "PhatAm") {
            if (tabPhatAm) tabPhatAm.classList.add("active");
            if (tabGiaoTiep) tabGiaoTiep.classList.remove("active");
            
            if (chatContainer) {
                chatContainer.style.setProperty("display", "none", "important");
                chatContainer.classList.add("hidden");
            }
            if (pronounceContainer) {
                pronounceContainer.style.setProperty("display", "block", "important");
                pronounceContainer.classList.remove("hidden");
            }
            
            this.mode = "Phát âm";
            this.renderPronounceSamples();
            window.LingoLog.add("Màn hình: 🎯 Phát âm (Pronunciation Mode)");
        } else {
            if (tabGiaoTiep) tabGiaoTiep.classList.add("active");
            if (tabPhatAm) tabPhatAm.classList.remove("active");

            if (pronounceContainer) {
                pronounceContainer.style.setProperty("display", "none", "important");
                pronounceContainer.classList.add("hidden");
            }
            if (chatContainer) {
                chatContainer.style.setProperty("display", "flex", "important");
                chatContainer.classList.remove("hidden");
            }

            this.mode = "Giao tiếp";
            window.LingoLog.add("Màn hình: 💭 Giao tiếp");
        }
    },

    endSession() {
        window.LingoTTS.stop();
        window.LingoLog.add("Nhấn [Kết thúc bài học] -> Mở Báo cáo tổng kết.");
        window.LingoSummary.generateReport(this.messages, this.uiLang, this.targetLang, this.level);
    },

    setupTimestamp() {
        const timeTag = document.getElementById("setupTimestamp");
        if (timeTag) {
            timeTag.textContent = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }
    },

    getApiKey() {
        if (!this.apiKey) {
            this.apiKey = localStorage.getItem("lingobot_api_key") || "";
        }
        return this.apiKey;
    },

    setApiKey(key) {
        this.apiKey = key.trim();
        localStorage.setItem("lingobot_api_key", this.apiKey);
        window.LingoLog.add("Đã lưu API Key vào trình duyệt.");
    },

    checkApiKey() {
        const storedKey = localStorage.getItem("lingobot_api_key");
        if (storedKey && storedKey !== "demo_skipped") {
            this.apiKey = storedKey;
            this.showScenarioCard();
        }
    },

    bindEvents() {
        const uiLangSelect = document.getElementById("uiLangSelect");
        if (uiLangSelect) {
            uiLangSelect.addEventListener("change", (e) => {
                this.updateUiLanguage(e.target.value);
            });
        }

        const targetSelect = document.getElementById("targetLangSelect");
        if (targetSelect) {
            targetSelect.addEventListener("change", (e) => {
                this.targetLang = e.target.value;
                this.updateTtsModelForLanguage(this.targetLang);
                window.LingoLog.add(`Ngôn ngữ mục tiêu: ${this.targetLang}`);
            });
        }

        const ttsSelect = document.getElementById("ttsModelSelect");
        if (ttsSelect) {
            ttsSelect.addEventListener("change", (e) => {
                this.userSelectedTtsModel = e.target.value; // Store user explicit selection
                window.LingoTTS.updateActiveTtsBadge(e.target.value);
                window.LingoLog.add(`Thay đổi giọng đọc TTS thủ công: ${e.target.value}`);
            });
        }

        const levelOpts = document.querySelectorAll("#levelOptions .pill-opt");
        levelOpts.forEach(btn => {
            btn.addEventListener("click", (e) => {
                levelOpts.forEach(b => b.classList.remove("active"));
                e.currentTarget.classList.add("active");
                this.level = e.currentTarget.getAttribute("data-level");
            });
        });

        const scenarioOpts = document.querySelectorAll("#scenarioOptions .pill-opt");
        scenarioOpts.forEach(btn => {
            btn.addEventListener("click", (e) => {
                scenarioOpts.forEach(b => b.classList.remove("active"));
                e.currentTarget.classList.add("active");
                this.scenario = e.currentTarget.getAttribute("data-scenario");
                window.LingoLog.add(`Chọn tình huống giao tiếp: ${this.scenario}`);
            });
        });

        const langFilterChips = document.querySelectorAll('.pronounce-filter-bar [data-lang]');
        langFilterChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                langFilterChips.forEach(c => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.filterLang = e.currentTarget.getAttribute('data-lang');
                this.renderPronounceSamples();
            });
        });

        const levelFilterChips = document.querySelectorAll('.pronounce-filter-bar [data-level]');
        levelFilterChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                levelFilterChips.forEach(c => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.filterLevel = e.currentTarget.getAttribute('data-level');
                this.renderPronounceSamples();
            });
        });

        const sendBtn = document.getElementById("sendBtn");
        if (sendBtn) {
            sendBtn.addEventListener("click", () => this.handleSendMessage());
        }

        const chatInput = document.getElementById("chatInput");
        if (chatInput) {
            chatInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    window.LingoLog.add("Phím ENTER được nhấn (Đã ngăn gửi tin nhắn).");
                }
            });
        }
    },

    renderPronounceSamples() {
        const listEl = document.getElementById("sampleSentencesList");
        if (!listEl) return;

        listEl.innerHTML = "";

        const filtered = this.sampleSentences.filter(item => {
            const matchLang = (this.filterLang === 'all' || item.lang === this.filterLang);
            const matchLevel = (this.filterLevel === 'all' || item.level === this.filterLevel);
            return matchLang && matchLevel;
        });

        if (filtered.length === 0) {
            listEl.innerHTML = `<p style="color:#78716c; padding:12px;">Không tìm thấy câu mẫu phù hợp với bộ lọc.</p>`;
            return;
        }

        filtered.forEach(item => {
            const card = document.createElement("div");
            card.className = "sample-sentence-item";

            const headerDiv = document.createElement("div");
            headerDiv.className = "sentence-header";
            const tagSpan = document.createElement("span");
            tagSpan.className = "category-tag";
            tagSpan.textContent = item.category;
            headerDiv.appendChild(tagSpan);

            const mainDiv = document.createElement("div");
            mainDiv.className = "sentence-main";
            mainDiv.innerHTML = this.formatFuriganaForDisplay(item.text);

            const subDiv = document.createElement("div");
            subDiv.className = "sentence-sub";
            subDiv.textContent = item.translation;

            const actionsDiv = document.createElement("div");
            actionsDiv.className = "sentence-actions";

            const playBtn = document.createElement("button");
            playBtn.type = "button";
            playBtn.className = "btn-sample btn-sample-play";
            playBtn.textContent = "▶ Nghe mẫu";
            playBtn.addEventListener("click", () => window.LingoTTS.playText(item.text, playBtn));

            const recBtn = document.createElement("button");
            recBtn.type = "button";
            recBtn.className = "btn-sample btn-sample-record";
            recBtn.textContent = "🎙️ Thu âm & Chấm điểm";
            recBtn.addEventListener("click", () => this.assessPronunciation(item.text));

            actionsDiv.appendChild(playBtn);
            actionsDiv.appendChild(recBtn);

            card.appendChild(headerDiv);
            card.appendChild(mainDiv);
            card.appendChild(subDiv);
            card.appendChild(actionsDiv);

            listEl.appendChild(card);
        });
    },

    async assessPronunciation(targetText) {
        const feedbackBox = document.getElementById("pronounceFeedback");
        const feedbackText = document.getElementById("pronounceFeedbackText");
        
        if (feedbackBox) feedbackBox.classList.remove("hidden");
        const dict = this.i18n[this.uiLang] || this.i18n["tiếng Việt"];
        if (feedbackText) feedbackText.innerHTML = `<em>${dict.aiThinking}</em>`;

        window.LingoLog.add(`Phân tích phát âm cho câu: "${targetText}"`);

        const prompt = `Bạn là một chuyên gia huấn luyện phát âm và ngữ điệu ngôn ngữ.
Hãy hướng dẫn chi tiết cách phát âm chuẩn câu sau:
Câu mẫu: "${targetText}"
Ngôn ngữ nhận xét: ${this.uiLang}

Xuất phản hồi ngắn gọn bằng ${this.uiLang}:
1. **Phân tích âm tiết & trọng âm**
2. **Lưu ý nối âm & ngữ điệu**
3. **Mẹo luyện tập hiệu quả**`;

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: this.getApiKey(),
                    messages: [{ role: "user", content: prompt }]
                })
            });

            const data = await res.json();
            if (res.ok && data.reply) {
                feedbackText.innerHTML = window.LingoSummary.markdownToHtml(data.reply);
                window.LingoTTS.playText(targetText);
            } else {
                feedbackText.innerHTML = `<span style="color:red">Lỗi: ${data.error}</span>`;
            }
        } catch (e) {
            if (feedbackText) feedbackText.innerHTML = `<span style="color:red">Lỗi kết nối: ${e.message}</span>`;
        }
    },

    updateTtsModelForLanguage(lang) {
        // Do NOT overwrite if user explicitly selected a voice model!
        if (this.userSelectedTtsModel) return;

        const select = document.getElementById("ttsModelSelect");
        if (!select) return;
        if (lang.includes("日本語")) select.value = "ja-JP-Chirp3-HD-F";
        else if (lang.includes("English")) select.value = "en-US-Chirp3-HD-F";
        else select.value = "vi-VN-Neural2-A";

        if (window.LingoTTS) {
            window.LingoTTS.updateActiveTtsBadge(select.value);
        }
    },

    showScenarioCard() {
        const scenarioBubbleRow = document.getElementById("scenarioBubbleRow");
        if (scenarioBubbleRow) scenarioBubbleRow.classList.remove("hidden");
    },

    startConversation() {
        const scenarioBubbleRow = document.getElementById("scenarioBubbleRow");
        const setupRow = document.getElementById("setupBubbleRow");
        if (scenarioBubbleRow) scenarioBubbleRow.classList.add("hidden");
        if (setupRow) setupRow.classList.add("hidden");

        window.LingoLog.add(`Bắt đầu hội thoại. Trình độ: ${this.level} | Tình huống: ${this.scenario}`);

        const systemPrompt = this.buildSystemPrompt();
        this.fetchAiResponse([], systemPrompt);
    },

    resetConversation() {
        this.messages = [];
        window.LingoTTS.stop();
        
        const container = document.getElementById("chatContainer");
        if (container) {
            const rows = container.querySelectorAll(".chat-row:not(#setupBubbleRow):not(#scenarioBubbleRow)");
            rows.forEach(r => r.remove());
        }

        const setupRow = document.getElementById("setupBubbleRow");
        const scenarioBubbleRow = document.getElementById("scenarioBubbleRow");
        if (setupRow) setupRow.classList.remove("hidden");
        if (scenarioBubbleRow) scenarioBubbleRow.classList.remove("hidden");

        window.LingoLog.add("Đã đặt lại cuộc trò chuyện.");
    },

    buildSystemPrompt() {
        return `Bạn là LingoBot2 - Trợ lý luyện ngôn ngữ AI thông minh, ưu tiên phản hồi nhanh với gemini-3.6-flash.

Cấu hình hội thoại:
- Chế độ: ${this.mode}
- Ngôn ngữ học: ${this.targetLang}
- Ngôn ngữ nhận xét: ${this.uiLang} (MỌI LỜI GIẢI THÍCH, NHẬN XÉT, SỬA LỖI PHẢI BẰNG ${this.uiLang})
- Trình độ (CEFR): ${this.level}
- Tình huống: ${this.scenario}

Quy tắc ứng xử:
1. Đóng vai đối phương chuẩn xác trong tình huống "${this.scenario}". Trả lời chính bằng ${this.targetLang} chuẩn xác theo trình độ ${this.level}. Nếu ${this.targetLang} là tiếng Nhật, hãy ghi kèm phiên âm Furigana trong ngoặc đơn như 荷物（にもつ）để hiển thị thẻ ruby cho người học dễ đọc.
2. Nếu người dùng nói sai ngữ pháp hoặc từ vựng, nhẹ nhàng sửa lỗi bằng ${this.uiLang} ở đầu tin nhắn.
3. Đặt 1 câu hỏi tương tác ngắn ở cuối để duy trì nhịp độ giao tiếp tự nhiên trong tình huống "${this.scenario}".
4. Trả lời ngắn gọn (2-3 câu) để phản hồi siêu nhanh.`;
    },

    async handleSendMessage() {
        if (this.isProcessing) return;

        const chatInput = document.getElementById("chatInput");
        const text = chatInput ? chatInput.value.trim() : "";

        if (!this.getApiKey() && (text.startsWith("AIzaSy") || text.length > 20)) {
            this.setApiKey(text);
            chatInput.value = "";
            this.showScenarioCard();
            alert("Google API Key を設定しました！");
            return;
        }

        if (!this.getApiKey()) {
            alert("Gemini AI を使用するには Google API Key を入力してください。");
            return;
        }

        if (!text) return;
        chatInput.value = "";

        this.appendMessage("user", text);

        const systemPrompt = this.buildSystemPrompt();
        await this.fetchAiResponse(this.messages, systemPrompt);
    },

    async fetchAiResponse(historyMessages, systemPrompt) {
        this.isProcessing = true;
        const typingBubble = this.showTypingIndicator();

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: this.getApiKey(),
                    messages: historyMessages,
                    system_instruction: systemPrompt
                })
            });

            const data = await response.json();
            this.removeTypingIndicator(typingBubble);

            if (response.ok && data.reply) {
                const reply = data.reply;
                const modelUsed = data.display_model || data.used_model || "gemini-3.6-flash";
                window.LingoLog.add(`AI phản hồi thành công [Model: ${modelUsed}]`);
                
                const aiBubbleEl = this.appendMessage("model", reply, modelUsed);

                const playBtn = aiBubbleEl.querySelector(".btn-play");
                window.LingoTTS.playText(reply, playBtn);
            } else {
                const errText = data.error || "Không thể kết nối tới Gemini AI.";
                this.appendMessage("model", `⚠️ ${errText}`);
                window.LingoLog.add("Lỗi AI Chat: " + errText);
            }
        } catch (err) {
            this.removeTypingIndicator(typingBubble);
            this.appendMessage("model", `⚠️ Lỗi kết nối máy chủ: ${err.message}`);
            window.LingoLog.add("Lỗi kết nối: " + err.message);
        } finally {
            this.isProcessing = false;
        }
    },

    appendMessage(role, content, usedModel = null) {
        this.messages.push({ role, content });

        const container = document.getElementById("chatContainer");
        const row = document.createElement("div");
        row.className = `chat-row ${role === 'user' ? 'user-row' : 'ai-row'}`;

        const bubble = document.createElement("div");
        bubble.className = "chat-bubble";

        const textDiv = document.createElement("div");
        textDiv.className = "bubble-text";
        textDiv.innerHTML = this.formatFuriganaForDisplay(content).replace(/\n/g, "<br>");

        const metaDiv = document.createElement("div");
        metaDiv.className = "message-meta";

        const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const timeSpan = document.createElement("span");
        timeSpan.className = "msg-time";

        // Display "Gemini-Other" if used model is not 3.6-flash or 3.5-flash
        let formattedModelTag = usedModel;
        if (usedModel) {
            if (usedModel.includes("Gemini-Other") || (usedModel !== "gemini-3.6-flash" && usedModel !== "gemini-3.5-flash")) {
                formattedModelTag = "Gemini-Other";
            }
        }

        timeSpan.textContent = `${timeStr} ${formattedModelTag ? '• ' + formattedModelTag : ''}`;
        metaDiv.appendChild(timeSpan);

        if (role !== "user") {
            const controlsDiv = document.createElement("div");
            controlsDiv.className = "audio-controls";

            const playBtn = document.createElement("button");
            playBtn.type = "button";
            playBtn.className = "audio-btn btn-play";
            playBtn.textContent = "▶ Phát";
            playBtn.addEventListener("click", () => window.LingoTTS.playText(content, playBtn));

            const stopBtn = document.createElement("button");
            stopBtn.type = "button";
            stopBtn.className = "audio-btn btn-stop";
            stopBtn.textContent = "⏹ Dừng";
            stopBtn.addEventListener("click", () => window.LingoTTS.stop());

            const downloadBtn = document.createElement("button");
            downloadBtn.type = "button";
            downloadBtn.className = "audio-btn btn-download";
            downloadBtn.textContent = "⬇ Tải MP3";
            downloadBtn.title = "Tải tệp âm thanh MP3 về máy";
            downloadBtn.addEventListener("click", () => window.LingoTTS.downloadAudio(content, playBtn._cachedAudioUrl));

            controlsDiv.appendChild(playBtn);
            controlsDiv.appendChild(stopBtn);
            controlsDiv.appendChild(downloadBtn);
            metaDiv.appendChild(controlsDiv);
        }

        bubble.appendChild(textDiv);
        bubble.appendChild(metaDiv);
        row.appendChild(bubble);
        container.appendChild(row);

        container.scrollTop = container.scrollHeight;

        return bubble;
    },

    showTypingIndicator() {
        const container = document.getElementById("chatContainer");
        const row = document.createElement("div");
        row.className = "chat-row ai-row typing-row";
        
        const dict = this.i18n[this.uiLang] || this.i18n["tiếng Việt"];
        const thinkingMsg = dict.aiThinking || "AI đang suy nghĩ...";

        row.innerHTML = `
            <div class="chat-bubble" style="background:#1d4ed8; color:#fff;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="spinner" style="width:16px; height:16px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div>
                    <span style="font-size:0.85rem;">${thinkingMsg}</span>
                </div>
            </div>
        `;
        container.appendChild(row);
        container.scrollTop = container.scrollHeight;
        return row;
    },

    removeTypingIndicator(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoApp.init();
});
