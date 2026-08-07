// Main Application Controller - LingoBot2 Ver10.1α Implementation
window.LingoApp = {
    version: "Ver10.1α",
    apiKey: "",
    mode: "Giao tiếp",
    uiLang: "tiếng Việt",
    targetLang: "jp 日本語", // Default target language: Japanese
    level: "Sơ cấp (CEFR A1, A2)",
    scenario: "自由会話",
    filterLang: "jp 日本語", // Default Pronunciation Filter: Japanese (日本語)
    filterLevel: "Sơ cấp",    // Default Pronunciation Filter: Beginner (初級)
    activePronBtn: null,     // Currently recording sample card button
    waitingForUserResponse: false, // Tracks if AI response ended and waiting for user input
    responseTimeStart: null,       // Milliseconds when TTS finished speaking
    responseTimeInterval: null,    // Interval timer ID for elapsed seconds display
    userSelectedTtsModel: null, // Tracks user explicit TTS choice
    useLocalFallback: false,    // Default Local Mode: OFF (Always labeled "Local", Blue=OFF, Lime Green=ON)
    customSystemPrompt: null,   // Stores dynamic user-edited System Prompt
    messages: [],
    isProcessing: false,
    areMoreScenariosExpanded: false, // State for Show More scenarios toggle

    // I18N Dictionary translating 100% of UI elements
    i18n: {
        "tiếng Việt": {
            tabGiaoTiep: "Giao tiếp",
            tabPhatAm: "Phát âm",
            lblUiLang: "Sử dụng:",
            lblTargetLang: "Mục tiêu:",
            btnAdvanced: "Advanced",
            resetBtn: "Đặt lại",
            endBtn: "Kết", // Abbreviated End Button for Vietnamese: Kết
            feedbackBtn: "Gợi ý", // Fixed label for VN: Gợi ý
            sendBtn: "Gửi",
            placeholder: "Nhập tin nhắn hoặc nói bằng micro...",
            scenarioTitle: "🎯 Chọn trình độ (CEFR) & Tình huống giao tiếp:",
            levelLabel: "Trình độ:",
            scenarioLabel: "Tình huống (23 chủ đề):",
            level1: "Sơ cấp A1-A2",
            level2: "Trung cấp B1-B2",
            level3: "Cao cấp C1-C2",

            catDaily: "💬 Giao tiếp hằng ngày & Tự do",
            scenFreeTalk: "💬 Trò chuyện tự do",
            scenSelfIntro: "👋 Tự giới thiệu bản thân",
            scenHobbies: "🎨 Sở thích & Giải trí",
            scenSports: "⚽ Thể thao & Vận động",
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

            btnShowMore: "👇 Xem thêm",
            btnShowLess: "👆 Thu gọn",

            startBtn: "🚀 Bắt đầu hội thoại ngay",
            pronounceTitle: "🎯 Luyện Phát Âm & Ngữ Điệu (Pronunciation Practice)",
            pronounceSub: "Chọn câu mẫu bên dưới (100 câu mẫu Sơ cấp/Trung cấp/Cao cấp) hoặc tự nói qua Micro để AI phân tích phát âm.",
            pronounceFeedbackTitle: "📊 Kết quả phân tích phát âm từ AI:",
            filterLang: "Ngôn ngữ:",
            filterLevel: "Trình độ:",
            filterAll: "Tất cả",
            aiThinking: "AI đang phân tích giọng nói...",
            aiSummarizing: "AI đang tổng hợp báo cáo bài học...",

            pronounceIdleMsg: "🎙️ Hãy nói qua Micro (Vui lòng chọn câu mẫu ở trên)",
            pronounceRecordingMsg: "🔴 Micro đang thu âm... (Hãy nói)",
            pronounceAnalyzingMsg: "🤖 AI đang phân tích phát âm...",

            btnPlay: "▶ Phát",
            btnPlaying: "▶ Đang phát",
            btnStop: "⏹ STOP",
            btnDownload: "⬇ Tải MP3",
            btnSamplePlay: "▶ Nghe mẫu",
            btnSampleRecord: "🎙️ Thu âm & Chấm điểm",
            btnSampleRecording: "🔴 Đang thu âm... (Hãy nói)",

            summaryModalTitle: "📊 Báo cáo & Lời khuyên tổng kết bài học",
            btnPrint: "In báo cáo",
            btnPdf: "Tải PDF",
            btnClose: "Đóng"
        },
        "tiếng Nhật": {
            tabGiaoTiep: "対話練習",
            tabPhatAm: "発音練習",
            lblUiLang: "UI言語:",
            lblTargetLang: "学習言語:",
            btnAdvanced: "Advanced",
            resetBtn: "リセット",
            endBtn: "終", // Abbreviated End Button for Japanese: 終
            feedbackBtn: "意見", // Fixed label for JP: 意見
            sendBtn: "送信",
            placeholder: "メッセージを入力、またはマイクで話してください...",
            scenarioTitle: "🎯 レベル(CEFR)と対話シチュエーションの選択:",
            levelLabel: "レベル:",
            scenarioLabel: "場面 (全23テーマ):",
            level1: "初級 A1-A2",
            level2: "中級 B1-B2",
            level3: "上級 C1-C2",

            catDaily: "💬 日常会話・自由会話",
            scenFreeTalk: "💬 自由会話",
            scenSelfIntro: "👋 自己紹介の会話",
            scenHobbies: "🎨 趣味の会話",
            scenSports: "⚽ スポーツの会話",
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

            btnShowMore: "👇 もっと見る",
            btnShowLess: "👆 閉じる",

            startBtn: "🚀 会話を開始する",
            pronounceTitle: "🎯 発音・シャドーイング練習",
            pronounceSub: "上の例文（初級・中級・上級の計100文）を選択するかマイクで話して、AIによる発音指導を受けましょう。",
            pronounceFeedbackTitle: "📊 AI発音分析結果:",
            filterLang: "言語:",
            filterLevel: "レベル:",
            filterAll: "すべて",
            aiThinking: "AIが音声分析中です...",
            aiSummarizing: "AIがレッスンをまとめています…しばらくお待ちください。",

            pronounceIdleMsg: "🎙️ マイクで話してください (上の例文から文を選択してください)",
            pronounceRecordingMsg: "🔴 マイクが収録中… (発声してください)",
            pronounceAnalyzingMsg: "🤖 AIが発音を分析中…",

            btnPlay: "▶ 再生",
            btnPlaying: "▶ 再生中",
            btnStop: "⏹ STOP",
            btnDownload: "⬇ DL MP3",
            btnSamplePlay: "▶ お手本を聞く",
            btnSampleRecord: "🎙️ 録音＆判定",
            btnSampleRecording: "🔴 録音中... (発声してください)",

            summaryModalTitle: "📊 レッスン総括レポート＆アドバイス",
            btnPrint: "レポートを印刷",
            btnPdf: "PDF保存",
            btnClose: "閉じる"
        },
        "tiếng Anh": {
            tabGiaoTiep: "Conversation",
            tabPhatAm: "Pronunciation",
            lblUiLang: "UI Lang:",
            lblTargetLang: "Target Lang:",
            btnAdvanced: "Advanced",
            resetBtn: "Reset",
            endBtn: "Fin", // Abbreviated End Button for English: Fin
            feedbackBtn: "FdBck", // Fixed label for EN: FdBck
            sendBtn: "Send",
            placeholder: "Type a message or speak into mic...",
            scenarioTitle: "🎯 Choose CEFR Level & Scenario:",
            levelLabel: "Level:",
            scenarioLabel: "Scenario (23 Topics):",
            level1: "Beginner A1-A2",
            level2: "Intermediate B1-B2",
            level3: "Advanced C1-C2",

            catDaily: "💬 Daily & Free Conversation",
            scenFreeTalk: "💬 Free Conversation",
            scenSelfIntro: "👋 Self-Introduction",
            scenHobbies: "🎨 Hobbies & Leisure",
            scenSports: "⚽ Sports & Fitness",
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

            btnShowMore: "👇 Show More",
            btnShowLess: "👆 Show Less",

            startBtn: "🚀 Start Conversation Now",
            pronounceTitle: "🎯 Pronunciation & Intonation Practice",
            pronounceSub: "Select from 100 sample sentences (Beginner/Intermediate/Advanced) or speak into mic for AI pronunciation feedback.",
            pronounceFeedbackTitle: "📊 AI Pronunciation Analysis:",
            filterLang: "Language:",
            filterLevel: "Level:",
            filterAll: "All",
            aiThinking: "AI is analyzing voice...",
            aiSummarizing: "AI is summarizing...",

            pronounceIdleMsg: "🎙️ Please speak into the mic (Select a sample above)",
            pronounceRecordingMsg: "🔴 Microphone is recording... (Speak now)",
            pronounceAnalyzingMsg: "🤖 AI is analyzing pronunciation...",

            btnPlay: "▶ Play",
            btnPlaying: "▶ Playing",
            btnStop: "⏹ STOP",
            btnDownload: "⬇ DL MP3",
            btnSamplePlay: "▶ Play Sample",
            btnSampleRecord: "🎙️ Record & Grade",
            btnSampleRecording: "🔴 Recording... (Speak now)",

            summaryModalTitle: "📊 Lesson Summary & Advice Report",
            btnPrint: "Print Report",
            btnPdf: "Download PDF",
            btnClose: "Close"
        }
    },

    // Instant Opening Starters for All 23 Scenarios in 3 Languages
    instantStarters: {
        "jp 日本語": {
            "自由会話": "💡 自由会話をはじめましょう！\nこんにちは！今日（きょう）は どんな お話（はなし）を しましょうか？ お好（す）きな 話題（わだい）を 教（おし）えてください！",
            "自己紹介の会話": "💡 自己紹介の練習です！\nはじめまして！わたしは AI（エーアイ）の 語学（ごがく）パートナーです。お名前（なまえ）を 教（おし）えていただけますか？",
            "趣味の会話": "💡 趣味についての会話です！\nこんにちは！ あなたの 趣味（しゅみ）や 休（やす）みの 日（ひ）の 過ご（すご）し方（かた）を 教（おし）えていただけますか？",
            "スポーツの会話": "💡 スポーツについての会話です！\nこんにちは！ 何（なに）か 幸（さいわ）い 好き（す）きな スポーツや、観戦（かんせん）する スポーツは ありますか？",
            "道案内の会話": "💡 道案内の練習です！\nすみません、ちょっと お尋（たず）ねしても よろしいですか？ 駅（えき）へは どの方向（ほうこう）に行（い）けば いいですか？",
            "天気・世間話の会話": "💡 天気や世間話の会話です！\n今日（きょう）は とても いい 天気（てんき）ですね！ お出（で）かけの ご予定（よてい）は ありますか？",
            "買い物の会話": "💡 買い物の会話です！\nいらっしゃいませ！ 何（なに）か お探（さが）しの 商品（しょうひん）は ございますか？",

            "空港のチェックイン会話": "💡 空港のチェックイン練習です！\nいらっしゃいませ。航空券（こうくうけん）と パスポートを ご提示（ていじ）いただけますか？",
            "ホテルの宿泊手続き会話": "💡 ホテル手続きの会話です！\nいらっしゃいませ。ご宿泊（しゅくはく）の ご予約（よやく）の お名前（なまえ）を お伺（うかが）いしても よろしいですか？",
            "電車・バスの乗り換え会話": "💡 電車・バスの会話です！\nすみません、この 電車（でんしゃ）は 東京（とうきょう）駅（えき）に 止（と）まりますか？",
            "タクシーでの会話": "💡 タクシーの会話です！\nご乗車（じょうしゃ）ありがとうございます。どちらまで 行（い）かれますか？",

            "カフェでの注文会話": "💡 カフェでの注文会話です！\nいらっしゃいませ！ 店内（てんない）で お召（め）し上（あ）がりですか、それとも お持（も）ち帰（かえ）りですか？",
            "レストランの予約会話": "💡 レストラン予約の会話です！\nお電話（でんわ）ありがとうございます。ご予約（よやく）の 日時（にちじ）と 人数（にんずう）を お教（おし）えいただけますか？",
            "居酒屋での注文会話": "💡 居酒屋の会話です！\nいらっしゃいませ！ まずは お飲（の）み物（もの）から お伺（うかが）いしましょうか？",
            "会計・支払い時の会話": "💡 会計・支払いの会話です！\nお会計（かいけい）でございます。お支払（しはら）いは 現金（げんきん）と カード、どちらに なさいますか？",

            "電話対応の会話": "💡 電話対応の会話です！\nお電話（でんわ）ありがとうございます。LingoBot（リンゴボット）株式会社（かぶしきがいしゃ）でございます。どちら様（さま）でしょうか？",
            "名刺交換・挨拶の会話": "💡 名刺交換の会話です！\n初（はじ）めまして。本日（ほんじつ）は お時間（じかん）を いただき ありがとうございます。名刺（めいし）を 交換（かん）させて いただけますか？",
            "会議での意見表明会話": "💡 会議の会話です！\nそれでは、次（つぎ）の アジェンダについて 議論（ぎろん）を 始（はじ）めます。ご意見（いけん）の ある方（かた）は いらっしゃいますか？",
            "クレーム対応の会話": "💡 クレーム対応の会話です！\n大変（たいへん） 申し訳（もうし分け）ございません。ご迷惑（めいわく）を おかけした 状況（じょうきょう）を 詳（くわ）しく お聞（き）かせいただけますか？",
            "採用面接の会話": "💡 採用面接の会話です！\n本日は 面接（めんせつ）に お越しいただき ありがとうございます。まず 簡単（かんたん）な 自己PR（じこピーアール）から お願（ねが）いできますか？",

            "病院・薬局での会話": "💡 病院・薬局の会話です！\nこんにちは。今日（きょう）は どのような 症状（しょうじょう）が ございますか？",
            "警察・紛失物の届出会話": "💡 警察・紛失物の会話です！\n交番（こうばん）です。どうされましたか？ 何（なに）か 落（お）とし物（もの）ですか？",
            "道に迷ったときの会話": "💡 道に迷ったときの会話です！\nどうされましたか？ 何（なに）か お困（こま）りですか？"
        },
        "us English": {
            "自由会話": "💡 Let's start free talk!\nHello! What would you like to talk about today? Feel free to share any topic!",
            "自己紹介の会話": "💡 Practice Self-Introduction!\nHi there! I am your AI language practice partner. Could you please tell me your name?",
            "趣味の会話": "💡 Let's talk about hobbies!\nHello! What are your favorite hobbies or leisure activities on weekends?",
            "スポーツの会話": "💡 Let's talk about sports!\nHi! Do you play any sports or enjoy watching athletic matches?"
        },
        "vn Tiếng Việt": {
            "自由会話": "💡 Hãy bắt đầu trò chuyện tự do!\nXin chào! Hôm nay bạn muốn trò chuyện về chủ đề gì nào?",
            "趣味の会話": "💡 Hãy trò chuyện về sở thích!\nXin chào! Sở thích vào thời gian rảnh rỗi của bạn là gì?",
            "スポーツの会話": "💡 Hãy trò chuyện về thể thao!\nXin chào! Bạn có chơi môn thể thao nào hoặc thích xem thể thao không?"
        }
    },

    // 100 Complete Sample Sentences
    sampleSentences: [
        // --- JAPANESE (36 Sentences) ---
        { id: 101, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "すみません、荷物（にもつ）を預（あず）けたいのですが。", translation: "Xin lỗi, tôi muốn gửi hành lý ạ." },
        { id: 102, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "この電車（でんしゃ）は新宿（しんじゅく）に行（い）きますか。", translation: "Tàu này có đi Shinjuku không ạ?" },
        { id: 103, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "おすすめのメニューは何（なに）ですか。", translation: "Món ăn được đề xuất là món gì ạ?" },
        { id: 104, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "私（わたし）の 趣味（しゅみ）は 映画（えいが）を 見（み）ることです。", translation: "Sở thích của tôi là xem phim." },
        { id: 105, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "毎週（まいしゅう） サッカーを 練習（れんしゅう）しています。", translation: "Tôi tập luyện bóng đá hàng tuần." },
        { id: 106, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "お会計（かいけい）を別々（べつべつ）にお願（ねが）いします。", translation: "Làm ơn tính tiền riêng cho chúng tôi." },
        { id: 107, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "写真（しゃしん）を撮（と）っていただけますか。", translation: "Bạn có thể chụp giúp tôi một tấm hình được không?" },
        { id: 108, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "トイレはどこにありますか。", translation: "Nhà vệ sinh ở đâu vậy ạ?" },
        { id: 109, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "水（みず）を一杯（いっぱい）ください。", translation: "Cho tôi xin một ly nước lọc." },
        { id: 110, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "これを試着（しちゃく）してもいいですか。", translation: "Tôi có thể thử cái này được không?" },
        { id: 111, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "免税（めんぜい）の手続（てつづ）きはできますか。", translation: "Có thể làm thủ tục miễn thuế ở đây không?" },
        { id: 112, lang: "jp 日本語", level: "Sơ cấp", category: "🌱 jp 日本語 - 初級 A1-A2", text: "どうぞよろしくお願（ねが）いします。", translation: "Rất mong nhận được sự giúp đỡ của bạn." },

        { id: 113, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "週末（しゅうまつ）は 趣味（しゅみ）の 写真（しゃしん）撮影（さつえい）に 出（で）かけることが多いです。", translation: "Cuối tuần tôi thường đi chụp ảnh theo sở thích." },
        { id: 114, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "定期（ていき）的な 運動（うんどう）は 健康（けんこう）維持（いじ）に とても 効果（こうか）的（てき）です。", translation: "Tập thể dục định kỳ rất hiệu quả cho việc duy trì sức khỏe." },
        { id: 115, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "飛行機（ひこうき）の出発（しゅっぱつ）時間（じかん）が変更（へんこう）になったようです。", translation: "Hình như giờ xuất phát chuyến bay đã bị thay đổi." },
        { id: 116, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "来週（らいしゅう）の会議（かいぎ）のスケジュールを調整（ちょうせい）していただけますか。", translation: "Bạn có thể điều chỉnh lịch họp tuần sau giúp tôi không?" },
        { id: 117, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "日本（にほん）の習慣（しゅうかん）についてもっと詳（くわ）しく知（し）りたいです。", translation: "Tôi muốn tìm hiểu kỹ hơn về tập quan Nhật Bản." },
        { id: 118, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "あいにくあしたは先約（せんやく）がありまして、出席（しゅっせき）できません。", translation: "Nuối tiếc là ngày mai tôi có hẹn trước nên không thể tham dự." },
        { id: 119, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "ご迷惑（めいわく）をおかけして大変（たいへん）申し訳（もうし分け）ございません。", translation: "Rất xin lỗi vì đã làm phiền quý vị." },
        { id: 120, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "この問題（もんだい）について、皆様（みなさま）のご意見（いけん）をお聞（き）かせください。", translation: "Xin hãy cho tôi nghe ý kiến của mọi người về vấn đề này." },
        { id: 121, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "新（あたら）しいプロジェクトの進捗（しんちょく）状況（じょうきょう）を報告（ほうこく）します。", translation: "Tôi xin báo cáo tiến độ của dự án mới." },
        { id: 122, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "おかげさまで、無事（ぶじ）に目標（もくひょう）を達成（たっせい）することができました。", translation: "Nhờ sự hỗ trợ của bạn, chúng tôi đã đạt mục tiêu an toàn." },
        { id: 123, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - Trung cấp B1-B2", text: "体調（たいちょう）が優（すぐ）れないため、本日は早退（そうたい）させていただきます。", translation: "Vì sức khỏe không tốt nên hôm nay tôi xin phép về sớm." },
        { id: 124, lang: "jp 日本語", level: "Trung cấp", category: "🌿 jp 日本語 - 中級 B1-B2", text: "今後（こんご）とも変わらぬお付き合いのほど、よろしくお願（ねが）い申し上げます。", translation: "Rất mong tiếp tục duy trì mối quan hệ tốt đẹp trong tương lai." },

        { id: 125, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "多様な趣味を通じて視野を広げ、新たな自己を発見することができます。", translation: "Thông qua các sở thích đa dạng giúp mở rộng tầm mắt và khám phá bản thân mới." },
        { id: 126, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "競技スポーツにおいて、チームワークと強靭な精神力は勝利への不可欠な要素です。", translation: "Trong thể thao thi đấu, tinh thần đồng đội và ý chí kiên cường là yếu tố cốt lõi để chiến thắng." },
        { id: 127, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "多角的な視点から市場の動向を分析し、中長期的な戦略を策定する必要があります。", translation: "Cần phân tích xu hướng thị trường từ nhiều góc độ và lập chiến lược trung - dài hạn." },
        { id: 128, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "諸般の事情に鑑み、本提案の導入を一時見合わせる結論に至りました。", translation: "Căn cứ vào nhiều tình hình, chúng tôi đi đến kết luận tạm hoãn đề xuất này." },
        { id: 129, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "構造改革を断行しなければ、持続可能な成長を実現することは困難でしょう。", translation: "Nếu không quyết liệt cải cách cơ cấu, rất khó đạt được tăng trưởng bền vững." },
        { id: 130, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "双方の利害を調整し、双方にとって望ましい着地点を模索すべきです。", translation: "Cần điều hòa lợi ích đôi bên và tìm kiếm điểm đồng thuận mong muốn." },
        { id: 131, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "技術革新の波に伴い、従来のビジネスモデルの再構築が強く求められています。", translation: "Cùng với làn sóng đổi mới công nghệ, việc tái cấu trúc mô hình kinh doanh cũ là cấp thiết." },
        { id: 132, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "未曾有の危機に対処すべく、迅速かつ果断な意志決定が極めて重要となります。", translation: "Để ứng phó khủng hoảng chưa từng có, việc ra quyết định nhanh chóng và quyết đoán là cực kỳ quan trọng." },
        { id: 133, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "競合他社との差別化を図るため、顧客体験の飛躍的な向上を目指します。", translation: "Để tạo sự khác biệt với đối thủ, chúng tôi hướng tới nâng cao đột phá trải nghiệm khách hàng." },
        { id: 134, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "資源の効率的な分配を図りつつ、コスト削減の徹底に邁進いたします。", translation: "Vừa phân bổ nguồn lực hiệu quả, chúng tôi vừa nỗ lực triệt để cắt giảm chi phí." },
        { id: 135, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "組織の風通しを良くし、社員一人ひとりの主体的な挑戦を促進してまいります。", translation: "Tạo sự thông thoáng trong tổ chức và thúc đẩy thử thách chủ động của từng nhân viên." },
        { id: 136, lang: "jp 日本語", level: "Cao cấp", category: "🌳 jp 日本語 - 上級 C1-C2", text: "今後の経済環境の不透明感を考慮し、慎重かつ柔軟な対応に努めてまいります。", translation: "Tính đến sự bất định của môi trường kinh tế sắp tới, chúng tôi sẽ ứng phó thận trọng và linh hoạt." },

        // --- ENGLISH (34 Sentences) ---
        { id: 201, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "My favorite hobby is playing the acoustic guitar in my free time.", translation: "Sở thích của tôi là chơi đàn guitar vào thời gian rảnh." },
        { id: 202, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "I enjoy playing basketball with my friends on weekends.", translation: "Tôi thích chơi bóng rổ với bạn bè vào cuối tuần." },
        { id: 203, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Could you please help me find the check-in counter?", translation: "Bạn có thể giúp tôi tìm quầy làm thủ tục không?" },
        { id: 204, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Where is the nearest train station from here?", translation: "Ga tàu gần nhất ở đâu vậy?" },
        { id: 205, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "I would like to order a cup of hot coffee, please.", translation: "Cho tôi gọi một ly cà phê nóng nhé." },
        { id: 206, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Excuse me, how much does this souvenir cost?", translation: "Xin lỗi, món quà lưu niệm này giá bao nhiêu?" },
        { id: 207, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Could you take a picture of us, please?", translation: "Bạn chụp giúp chúng tôi một tấm hình nhé?" },
        { id: 208, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Is there free Wi-Fi available in this hotel?", translation: "Khách sạn có Wi-Fi miễn phí không?" },
        { id: 209, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "I have a reservation under the name of Smith.", translation: "Tôi có đặt phòng trước dưới tên Smith." },
        { id: 210, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Can I try on these shoes in size eight?", translation: "Tôi có thể thử đôi giày này cỡ số 8 không?" },
        { id: 211, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Where can I exchange my money into US dollars?", translation: "Tôi có thể đổi tiền sang đô la Mỹ ở đâu?" },
        { id: 212, lang: "us English", level: "Sơ cấp", category: "🌱 us English - Beginner A1-A2", text: "Nice to meet you, hope you have a great day!", translation: "Rất vui được gặp bạn, chúc một ngày tốt lành!" },

        { id: 213, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "I have been practicing oil painting for over two years now.", translation: "Tôi đã tập vẽ tranh sơn dầu được hơn 2 năm rồi." },
        { id: 214, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "Regular physical exercise is essential for maintaining overall fitness and stamina.", translation: "Tập thể dục thường xuyên rất cần thiết để duy trì thể lực." },
        { id: 215, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "It seems that my flight has been delayed due to unexpected weather conditions.", translation: "Hình như chuyến bay của tôi bị hoãn do thời tiết bất ngờ." },
        { id: 216, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "Could you please reschedule our meeting to next Thursday afternoon?", translation: "Bạn có thể chuyển lịch họp sang chiều thứ Năm tuần sau không?" },
        { id: 217, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "I'm really interested in learning more about local culture and traditions.", translation: "Tôi rất thích tìm hiểu thêm về văn hóa truyền thống địa phương." },
        { id: 218, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "Unfortunately, I won't be able to attend the conference due to a prior commitment.", translation: "Thật tiếc là tôi không thể dự hội thảo vì đã có lịch trước." },
        { id: 219, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "I sincerely apologize for any inconvenience this delay may have caused you.", translation: "Tôi chân thành xin lỗi vì sự chậm trễ này đã gây phiền hà cho bạn." },
        { id: 220, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "We would greatly appreciate your valuable feedback regarding our new product.", translation: "Chúng tôi rất trân trọng phản hồi quý báu của bạn về sản phẩm mới." },
        { id: 221, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "Let me give you a quick update on the current progress of our team project.", translation: "Để tôi cập nhật nhanh tiến độ hiện tại của dự án nhóm." },
        { id: 222, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "Thanks to your continuous support, we successfully achieved our quarterly goals.", translation: "Nhờ sự hỗ trợ liên tục của bạn, chúng tôi đã đạt mục tiêu quý thành công." },
        { id: 223, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "I am feeling a bit under the weather today, so I will take a sick leave.", translation: "Hôm nay tôi thấy mệt nên xin phép nghỉ bệnh." },
        { id: 224, lang: "us English", level: "Trung cấp", category: "🌿 us English - Intermediate B1-B2", text: "We look forward to continuing our fruitful cooperation in the upcoming year.", translation: "Chúng tôi mong tiếp tục hợp tác hiệu quả trong năm tới." },

        // --- VIETNAMESE (30 Sentences) ---
        { id: 301, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Sở thích vào thời gian rảnh rỗi của tôi là nghe nhạc và đọc sách.", translation: "My leisure hobby is listening to music and reading books." },
        { id: 302, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Tôi thường đi đá bóng với bạn bè vào mỗi cuối tuần.", translation: "I usually play football with friends every weekend." },
        { id: 303, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Xin chào! Rất vui được làm quen với bạn ngày hôm nay.", translation: "Hello! Nice to meet you today." },
        { id: 304, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Cho tôi hỏi quầy làm thủ tục sân bay ở đâu ạ?", translation: "Excuse me, where is the airport check-in counter?" },
        { id: 305, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Làm ơn cho tôi gọi một ly cà phê sữa đá.", translation: "Please give me an iced milk coffee." },
        { id: 306, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Cái áo này giá bao nhiêu tiền vậy bạn?", translation: "How much does this shirt cost?" },
        { id: 307, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Bạn có thể chụp giúp tôi một tấm hình được không?", translation: "Could you take a photo of me, please?" },
        { id: 308, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Cho tôi xin mật khẩu Wi-Fi của quán được không?", translation: "May I have the Wi-Fi password for the cafe?" },
        { id: 309, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Tôi đã đặt phòng trước dưới tên Nguyễn Văn An.", translation: "I booked a room under the name Nguyen Van An." },
        { id: 310, lang: "vn Tiếng Việt", level: "Sơ cấp", category: "🌱 vn Tiếng Việt - Sơ cấp A1-A2", text: "Cho tôi thử đôi giày này cỡ số bốn mươi nhé.", translation: "Let me try these shoes in size 40." },

        { id: 311, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Tập luyện thể thao đều đặn giúp tăng cường sức khỏe và giải tỏa căng thẳng.", translation: "Regular sports practice boosts health and relieves stress." },
        { id: 312, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Hình như chuyến bay của tôi đã bị hoãn do thời tiết xấu.", translation: "It seems my flight was delayed due to bad weather." },
        { id: 313, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Bạn có thể vui lòng đổi lịch hẹn sang chiều thứ Năm tuần sau được không?", translation: "Could you please move our appointment to next Thursday afternoon?" },
        { id: 314, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Tôi rất muốn tìm hiểu sâu hơn về văn hóa và ẩm thực địa phương.", translation: "I really want to learn deeper about local culture and food." },
        { id: 315, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Thật tiếc là tôi không thể tham dự buổi họp vì đã có lịch từ trước.", translation: "Unfortunately, I cannot attend due to a prior schedule." },
        { id: 316, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Thành thật xin lỗi bạn vì sự bất tiện ngoài ý muốn này.", translation: "Sincere apologies for this unintended inconvenience." },
        { id: 317, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Chúng tôi rất mong nhận được ý kiến đóng góp quý báu từ phía bạn.", translation: "We look forward to receiving your valuable feedback." },
        { id: 318, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Tôi xin phép báo cáo tiến độ công việc của nhóm trong tuần qua.", translation: "Let me report the team's work progress over the past week." },
        { id: 319, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Nhờ sự hỗ trợ nhiệt tình của bạn, chúng tôi đã hoàn thành mục tiêu.", translation: "Thanks to your enthusiastic support, we completed the target." },
        { id: 320, lang: "vn Tiếng Việt", level: "Trung cấp", category: "🌿 vn Tiếng Việt - Trung cấp B1-B2", text: "Hy vọng hai bên sẽ tiếp tục hợp tác tốt đẹp trong tương lai.", translation: "Hope both sides continue great cooperation in the future." }
    ],

    init() {
        this.bindEvents();
        this.setupTimestamp();
        this.updateUiLanguage(this.uiLang);
        this.updateTtsModelForLanguage(this.targetLang);
        this.renderPronounceSamples();
        this.showScenarioCard();
        
        const setupRow = document.getElementById("setupBubbleRow");
        if (setupRow) setupRow.classList.add("hidden");

        // Ensure Advanced Panel is initially HIDDEN
        const advPanel = document.getElementById("advancedPanel");
        const advBtn = document.getElementById("btnAdvanced");
        if (advPanel) advPanel.classList.add("hidden");
        if (advBtn) advBtn.classList.remove("active");

        // Close floating Prompt Editor Modal when clicking outside
        const promptModal = document.getElementById("promptEditorModal");
        if (promptModal) {
            promptModal.addEventListener("click", (e) => {
                if (e.target === promptModal) {
                    this.closePromptEditorModal();
                }
            });
        }

        window.LingoLog.add("Khởi tạo LingoApp hoàn tất [LingoBot2 Ver10.1α]. Supabase Auth & History integrated.");
    },

    // SHOW MORE / SHOW LESS SCENARIOS TOGGLE CONTROL
    toggleMoreScenarios() {
        const container = document.getElementById("moreScenariosContainer");
        const btnTxt = document.getElementById("txtBtnShowMore");
        if (!container) return;

        this.areMoreScenariosExpanded = !this.areMoreScenariosExpanded;
        const dict = this.i18n[this.uiLang] || this.i18n["tiếng Việt"];

        if (this.areMoreScenariosExpanded) {
            container.style.setProperty("display", "block", "important");
            container.classList.remove("hidden");
            if (btnTxt) btnTxt.textContent = dict.btnShowLess || "👆 Thu gọn";
            window.LingoLog.add("Mở rộng danh sách tất cả tình huống giao tiếp (Hiển thị 23 chủ đề).");
        } else {
            container.style.setProperty("display", "none", "important");
            container.classList.add("hidden");
            if (btnTxt) btnTxt.textContent = dict.btnShowMore || "👇 Xem thêm";
            window.LingoLog.add("Thu gọn danh sách tình huống giao tiếp (Chỉ hiển thị 日常会話・自由会話).");
        }
    },

    // PROMPT EDITOR POPOUT FLOATING MODAL CONTROLS
    openPromptEditorModal() {
        const modal = document.getElementById("promptEditorModal");
        const textarea = document.getElementById("customPromptInput");
        if (textarea) {
            textarea.value = this.customSystemPrompt || this.buildSystemPrompt();
        }
        if (modal) {
            modal.classList.remove("hidden");
            window.LingoLog.add("Mở cửa sổ Floating Popout Pop-up: Chỉnh sửa AI System Prompt (Edit Prompt Modal).");
        }
    },

    closePromptEditorModal() {
        const modal = document.getElementById("promptEditorModal");
        if (modal) {
            modal.classList.add("hidden");
            window.LingoLog.add("Đóng cửa sổ Popout Pop-up Chỉnh sửa Prompt (Không lưu thay đổi).");
        }
    },

    saveCustomPrompt() {
        const textarea = document.getElementById("customPromptInput");
        if (textarea && textarea.value.trim()) {
            this.customSystemPrompt = textarea.value.trim();
            this.closePromptEditorModal();
            alert("Đã lưu câu lệnh chỉ định System Prompt mới cho AI thành công!\n(AIに与える指示プロンプトを正常に保存しました)");
            window.LingoLog.add("Đã lưu System Prompt động tùy chỉnh do người dùng thiết lập.");
        } else {
            alert("Vui lòng nhập câu lệnh Prompt / プロンプト文を入力してください。");
        }
    },

    openFeedbackPage() {
        const fullLogs = window.LingoLog ? (window.LingoLog.getClientDiagnostics() + "\n\n" + window.LingoLog.logs.join("\n")) : "";
        localStorage.setItem("lingobot_latest_logs", fullLogs);
        localStorage.setItem("lingobot_ui_lang", this.uiLang);

        if (navigator.clipboard) {
            navigator.clipboard.writeText(fullLogs).catch(err => {
                console.warn("Clipboard copy warning:", err);
            });
        }

        window.LingoLog.add(`Mở trang 💡 改善提案 (feedback.html) - Đã sao chép 100% System Logs vào Clipboard.`);
        const targetUrl = `feedback.html?lang=${encodeURIComponent(this.uiLang)}`;
        window.open(targetUrl, '_blank');
    },

    // LOCAL MODE ALWAYS LABELED "Local", BLUE WHEN OFF, LIME GREEN WHEN ON
    toggleLocalMode() {
        this.useLocalFallback = !this.useLocalFallback;
        const txtEl = document.getElementById("txtLocalModeStatus");
        const btn = document.getElementById("btnToggleLocalMode");

        if (txtEl) txtEl.textContent = "Local";

        if (this.useLocalFallback) {
            if (btn) {
                btn.className = "action-btn btn-local-green";
                btn.style.background = "#16a34a";
                btn.style.color = "#ffffff";
            }
            window.LingoLog.add("Bật chế độ dự phòng Local Mode (Nút chuyển thành màu vàng xanh Lime Green).");
        } else {
            if (btn) {
                btn.className = "action-btn btn-local-blue";
                btn.style.background = "#0284c7";
                btn.style.color = "#ffffff";
            }
            window.LingoLog.add("Tắt chế độ dự phòng Local Mode (Nút chuyển thành màu xanh dương Blue).");
        }
    },

    // ADVANCED PANEL TOGGLE CONTROL
    toggleAdvancedPanel() {
        const panel = document.getElementById("advancedPanel");
        const btn = document.getElementById("btnAdvanced");
        const uiLangWrapper = document.getElementById("uiLangWrapper");
        const targetLangWrapper = document.getElementById("targetLangWrapper");
        const optLevel2 = document.getElementById("optLevel2");
        const optLevel3 = document.getElementById("optLevel3");
        const chipLevel2 = document.getElementById("chipLevel2");
        const chipLevel3 = document.getElementById("chipLevel3");
        const pronounceFilterBar = document.getElementById("pronounceFilterBar");
        
        if (!panel) return;

        const isHidden = panel.classList.contains("hidden");
        if (isHidden) {
            panel.classList.remove("hidden");
            if (btn) btn.classList.add("active");
            if (uiLangWrapper) uiLangWrapper.classList.remove("hidden");
            if (targetLangWrapper) targetLangWrapper.classList.remove("hidden");
            if (optLevel2) optLevel2.classList.remove("hidden");
            if (optLevel3) optLevel3.classList.remove("hidden");
            if (chipLevel2) chipLevel2.classList.remove("hidden");
            if (chipLevel3) chipLevel3.classList.remove("hidden");
            if (pronounceFilterBar) pronounceFilterBar.classList.remove("hidden");
            window.LingoLog.add("Hiển thị Bảng điều khiển nâng cao (Advanced Header Panel).");
        } else {
            panel.classList.add("hidden");
            if (btn) btn.classList.remove("active");
            if (uiLangWrapper) uiLangWrapper.classList.add("hidden");
            if (targetLangWrapper) targetLangWrapper.classList.add("hidden");
            if (optLevel2) optLevel2.classList.add("hidden");
            if (optLevel3) optLevel3.classList.add("hidden");
            if (chipLevel2) chipLevel2.classList.add("hidden");
            if (chipLevel3) chipLevel3.classList.add("hidden");
            if (pronounceFilterBar) pronounceFilterBar.classList.add("hidden");
            window.LingoLog.add("Ẩn Bảng điều khiển nâng cao (Advanced Header Panel).");
        }
    },

    updateUiLanguage(lang) {
        this.uiLang = lang;
        localStorage.setItem("lingobot_ui_lang", lang);

        document.body.setAttribute('data-ui-lang', lang);

        const dict = this.i18n[lang] || this.i18n["tiếng Việt"];

        const setTxt = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setTxt("txtTabGiaoTiep", dict.tabGiaoTiep);
        setTxt("txtTabPhatAm", dict.tabPhatAm);
        setTxt("lblUiLang", dict.lblUiLang);
        setTxt("lblTargetLang", dict.lblTargetLang);
        setTxt("txtBtnAdvanced", dict.btnAdvanced);
        setTxt("txtResetBtn", dict.resetBtn);
        setTxt("txtEndBtn", dict.endBtn);
        setTxt("txtFeedbackBtn", dict.feedbackBtn); // VN -> Gợi ý, JP -> 意見, EN -> FdBck
        setTxt("txtSendBtn", dict.sendBtn);
        setTxt("txtFooterEndBtn", dict.endBtn);
        setTxt("txtScenarioTitle", dict.scenarioTitle);
        setTxt("txtLevelLabel", dict.levelLabel);
        setTxt("txtScenarioLabel", dict.scenarioLabel);
        
        // Show More / Show Less Button Label Update
        const btnTxt = document.getElementById("txtBtnShowMore");
        if (btnTxt) {
            btnTxt.textContent = this.areMoreScenariosExpanded ? dict.btnShowLess : dict.btnShowMore;
        }

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

        // Scenarios
        setTxt("scenFreeTalk", dict.scenFreeTalk);
        setTxt("scenSelfIntro", dict.scenSelfIntro);
        setTxt("scenHobbies", dict.scenHobbies);
        setTxt("scenSports", dict.scenSports);
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
        setTxt("txtPronounceFeedbackTitle", dict.pronounceFeedbackTitle);
        setTxt("lblFilterLang", dict.filterLang);
        setTxt("lblFilterLevel", dict.filterLevel);
        setTxt("chipLangAll", dict.filterAll);
        setTxt("chipLevelAll", dict.filterAll);
        setTxt("txtSummaryLoading", dict.aiSummarizing);

        setTxt("txtPronounceStatus", dict.pronounceIdleMsg);

        setTxt("txtSummaryModalTitle", dict.summaryModalTitle);
        setTxt("txtPrintBtn", dict.btnPrint);
        setTxt("txtPdfBtn", dict.btnPdf);
        setTxt("txtCloseBtn", dict.btnClose);

        const chatInput = document.getElementById("chatInput");
        if (chatInput) chatInput.placeholder = dict.placeholder;

        document.querySelectorAll(".btn-play").forEach(btn => {
            if (btn.classList.contains("playing")) {
                btn.textContent = dict.btnPlaying || "▶ 再生中";
            } else {
                btn.textContent = dict.btnPlay || "▶ 再生";
            }
        });
        document.querySelectorAll(".btn-stop").forEach(btn => btn.textContent = dict.btnStop);
        document.querySelectorAll(".btn-download").forEach(btn => btn.textContent = dict.btnDownload);

        this.renderPronounceSamples();

        window.LingoLog.add(`Cập nhật 100% văn bản & nút bấm giao diện sang: ${lang}`);
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
        let formatted = text;

        formatted = formatted.replace(
            /([\u3400-\u4dbf\u4e00-\u9fff\u3005]+)([\u3040-\u309f\u30a0-\u30ff]*)[（\(]([\u3040-\u309f\u30a0-\u30ff\s]+)[）\)]/g,
            (match, kanji, okurigana, ruby) => {
                let cleanRuby = ruby.trim();
                if (okurigana && cleanRuby.endsWith(okurigana)) {
                    cleanRuby = cleanRuby.slice(0, -okurigana.length);
                }
                return `<ruby>${kanji}<rt>${cleanRuby}</rt></ruby>${okurigana}`;
            }
        );

        formatted = formatted.replace(
            /([\u3400-\u4dbf\u4e00-\u9fff\u3005]+)[（\(]([\u3040-\u309f\u30a0-\u30ff\s]+)[）\)]/g,
            '<ruby>$1<rt>$2</rt></ruby>'
        );

        return formatted;
    },

    switchMode(modeType) {
        this.stopResponseTimer(true);
        const tabGiaoTiep = document.getElementById("tabGiaoTiep");
        const tabPhatAm = document.getElementById("tabPhatAm");
        const chatContainer = document.getElementById("chatContainer");
        const pronounceContainer = document.getElementById("pronounceContainer");
        const chatFooterControls = document.getElementById("chatFooterControls");
        const pronounceFooterStatus = document.getElementById("pronounceFooterStatus");

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

            if (chatFooterControls) {
                chatFooterControls.style.setProperty("display", "none", "important");
            }
            if (pronounceFooterStatus) {
                pronounceFooterStatus.style.setProperty("display", "flex", "important");
                pronounceFooterStatus.classList.remove("hidden");
            }
            
            this.mode = "Phát âm";
            this.renderPronounceSamples();
            
            const dict = this.i18n[this.uiLang] || this.i18n["tiếng Việt"];
            const statusTxt = document.getElementById("txtPronounceStatus");
            if (pronounceFooterStatus) pronounceFooterStatus.className = "pronounce-footer-status";
            if (statusTxt) statusTxt.textContent = dict.pronounceIdleMsg || "🎙️ マイクで話してください (上の例文から文を選択してください)";

            window.LingoLog.add("Màn hình: 🎯 Phát âm (Pronunciation Mode) -> Chuyển thanh Footer thành Status Banner hiển thị trạng thái Mic.");
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

            if (pronounceFooterStatus) {
                pronounceFooterStatus.style.setProperty("display", "none", "important");
                pronounceFooterStatus.classList.add("hidden");
            }
            if (chatFooterControls) {
                chatFooterControls.style.setProperty("display", "flex", "important");
            }

            this.mode = "Giao tiếp";
            window.LingoLog.add("Màn hình: 💭 Giao tiếp -> Hiện lại thanh nhập văn bản & Mic ở Footer.");
        }
    },

    endSession() {
        this.stopResponseTimer(true);
        if (window.LingoTTS) window.LingoTTS.stop();
        window.LingoLog.add("Nhấn [Kết thúc bài học] -> Mở Báo cáo tổng kết và lưu lịch sử.");
        
        // Save to Supabase History
        this.saveHistoryToSupabase("Giao tiếp (Conversation)", this.scenario, this.messages);
        
        window.LingoSummary.generateReport(this.messages, this.uiLang, this.targetLang, this.level);
    },

    async saveHistoryToSupabase(sessionType, theme, dialogueContent) {
        if (!window.supabaseClient) return;
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (!session || !session.user) return; // Only save if logged in

            const { error } = await window.supabaseClient
                .from('learning_history')
                .insert([{
                    user_id: session.user.id,
                    session_type: sessionType,
                    theme: theme,
                    dialogue_content: dialogueContent
                }]);
            if (error) {
                console.error("Save History Error:", error);
                window.LingoLog?.add("❌ Lỗi lưu lịch sử: " + error.message);
            } else {
                window.LingoLog?.add(`✅ Đã lưu lịch sử học tập thành công [${sessionType}].`);
            }
        } catch (e) {
            console.error("Save History Catch:", e);
        }
    },

    setupTimestamp() {
        const timeTag = document.getElementById("setupTimestamp");
        if (timeTag) {
            timeTag.textContent = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }
    },

    getApiKey() {
        if (!this.apiKey) {
            const stored = localStorage.getItem("lingobot_api_key") || "";
            this.apiKey = stored.trim().replace(/^["']|["']$/g, '');
        }
        return this.apiKey;
    },

    setApiKey(key) {
        const cleanKey = (key || "").trim().replace(/^["']|["']$/g, '');
        this.apiKey = cleanKey;
        localStorage.setItem("lingobot_api_key", cleanKey);
        window.LingoLog.add("Đã lưu Google API Key nhập thủ công an toàn vào trình duyệt (localStorage).");
    },

    saveManualApiKey() {
        const inputEl = document.getElementById("manualApiKeyInput");
        const val = inputEl ? inputEl.value : "";
        if (!val || !val.trim()) {
            alert("Vui lòng nhập API Key / APIキーを入力してください。");
            return;
        }
        this.setApiKey(val);
        inputEl.value = "";
        const setupRow = document.getElementById("setupBubbleRow");
        if (setupRow) setupRow.classList.add("hidden");
        alert("Đã lưu Google API Key thủ công an toàn vào trình duyệt! / Google API Key をブラウザに安全に保存しました！");
    },

    saveHeaderApiKey() {
        const inputEl = document.getElementById("headerApiKeyInput");
        const val = inputEl ? inputEl.value : "";
        if (!val || !val.trim()) {
            alert("Vui lòng nhập Google API Key / APIキーを入力してください。");
            return;
        }
        this.setApiKey(val);
        inputEl.value = "";
        alert("Đã lưu Google API Key mới từ thanh Header an toàn vào trình duyệt! / ヘッダーから新しいGoogle API Keyをブラウザに安全に保存しました！");
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
                this.userSelectedTtsModel = null;
                this.updateTtsModelForLanguage(this.targetLang);
                window.LingoLog.add(`Chuyển đổi Ngôn ngữ mục tiêu sang: ${this.targetLang} -> Tự động cập nhật TTS voice phù hợp.`);
            });
        }

        const ttsSelect = document.getElementById("ttsModelSelect");
        if (ttsSelect) {
            ttsSelect.addEventListener("change", (e) => {
                this.userSelectedTtsModel = e.target.value;
                if (window.LingoTTS) window.LingoTTS.updateActiveTtsBadge(e.target.value);
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
                window.LingoLog.add(`Chọn tình huống giao通信: ${this.scenario}`);
            });
        });

        const langFilterChips = document.querySelectorAll('.pronounce-filter-bar [data-lang]');
        langFilterChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                langFilterChips.forEach(c => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.filterLang = e.currentTarget.getAttribute('data-lang');
                window.LingoLog.add(`Bộ lọc phát âm - Ngôn ngữ: ${this.filterLang}`);
                this.renderPronounceSamples();
            });
        });

        const levelFilterChips = document.querySelectorAll('.pronounce-filter-bar [data-level]');
        levelFilterChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                levelFilterChips.forEach(c => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.filterLevel = e.currentTarget.getAttribute('data-level');
                window.LingoLog.add(`Bộ lọc phát âm - Trình độ: ${this.filterLevel}`);
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
        const dict = this.i18n[this.uiLang] || this.i18n["tiếng Việt"];

        const filtered = this.sampleSentences.filter(item => {
            const matchLang = (this.filterLang === 'all' || item.lang === this.filterLang);
            const matchLevel = (this.filterLevel === 'all' || item.level === this.filterLevel);
            return matchLang && matchLevel;
        });

        if (filtered.length === 0) {
            listEl.innerHTML = `<p style="color:#78716c; padding:12px;">Không tìm thấy câu mẫu phù hợp với bộ lọc.</p>`;
            return;
        }

        filtered.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "sample-sentence-item";

            // Hide cards beyond the first one
            if (index >= 1) {
                card.classList.add("hidden");
                card.classList.add("extra-sample-card");
            }

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
            playBtn.textContent = dict.btnSamplePlay || "▶ Nghe mẫu";
            playBtn.addEventListener("click", () => {
                if (window.LingoTTS) window.LingoTTS.playText(item.text, playBtn);
            });

            const recBtn = document.createElement("button");
            recBtn.type = "button";
            recBtn.className = "btn-sample btn-sample-record";
            recBtn.textContent = dict.btnSampleRecord || "🎙️ 録音＆判定";
            recBtn.addEventListener("click", () => this.assessPronunciation(item.text, recBtn));

            actionsDiv.appendChild(playBtn);
            actionsDiv.appendChild(recBtn);

            card.appendChild(headerDiv);
            card.appendChild(mainDiv);
            card.appendChild(subDiv);
            card.appendChild(actionsDiv);

            listEl.appendChild(card);
        });
    },

    async assessPronunciation(targetText, recBtn = null) {
        const feedbackBox = document.getElementById("pronounceFeedback");
        const feedbackText = document.getElementById("pronounceFeedbackText");
        const banner = document.getElementById("pronounceFooterStatus");
        const statusTxt = document.getElementById("txtPronounceStatus");
        
        // DO NOT scroll immediately upon pressing record button so user can read the target sentence card!
        const dict = this.i18n[this.uiLang] || this.i18n["tiếng Việt"];

        // 1. If currently recording on another (or same) card, cancel previous recording and restore UI
        if (this.activePronBtn) {
            const isSameBtn = (this.activePronBtn === recBtn);
            
            // Restore previous button UI
            this.activePronBtn.textContent = dict.btnSampleRecord || "🎙️ 録音＆判定";
            this.activePronBtn.style.background = "#ffedd5";
            this.activePronBtn.style.color = "#ea580c";
            
            // Cancel active pronunciation recording session
            if (window.LingoSTT && window.LingoSTT.stopPronunciation) {
                window.LingoSTT.stopPronunciation(true);
            }
            
            this.activePronBtn = null;

            // If same button was clicked again, cancel recording and stop
            if (isSameBtn) {
                if (banner) banner.className = "pronounce-footer-status";
                if (statusTxt) statusTxt.textContent = dict.pronounceIdleMsg || "🎙️ マイクで話してください (上の例文から文を選択してください)";
                return;
            }
        }

        // 2. Set new active recording button
        this.activePronBtn = recBtn;

        if (recBtn) {
            recBtn.textContent = dict.btnSampleRecording || "🔴 録音中...";
            recBtn.style.background = "#ef4444";
            recBtn.style.color = "#ffffff";
        }

        if (banner) banner.className = "pronounce-footer-status recording";
        if (statusTxt) statusTxt.textContent = dict.pronounceRecordingMsg || "🔴 マイクが収録中… (Đang thu âm...)";

        const cleanTarget = targetText.replace(/（.*?）|\(.*?\)/g, '').trim();

        window.LingoLog.add(`Bắt đầu thu âm và chấm điểm phát âm cho câu: "${cleanTarget}" [Level: ${this.filterLevel}]`);

        if (window.LingoSTT && window.LingoSTT.listenForPronunciation) {
            window.LingoSTT.listenForPronunciation(cleanTarget, async (spokenText, err) => {
                // If canceled by another card click, do nothing
                if (err === "CANCELED") {
                    return;
                }

                if (recBtn) {
                    recBtn.textContent = dict.btnSampleRecord || "🎙️ 録音＆判定";
                    recBtn.style.background = "#ffedd5";
                    recBtn.style.color = "#ea580c";
                }

                if (this.activePronBtn === recBtn) {
                    this.activePronBtn = null;
                }

                if (banner) banner.className = "pronounce-footer-status analyzing";
                if (statusTxt) statusTxt.textContent = dict.pronounceAnalyzingMsg || "🤖 AIが発音を分析中… (AI đang phân tích...)";

                const actualSpeech = (spokenText || "").trim();
                window.LingoLog.add(`Kết quả ghi âm nhận diện thực tế từ người dùng: "${actualSpeech || 'NO_SPEECH_DETECTED'}"`);

                // Show feedback box now that recording has ended
                if (feedbackBox) {
                    feedbackBox.classList.remove("hidden");
                }

                if (!actualSpeech) {
                    if (feedbackText) {
                        feedbackText.innerHTML = `<div style="padding:14px; background:#fef2f2; border-radius:14px; border:1px solid #fecaca; color:#b91c1c;">
                            <h3>⚠️ 未検知 / 不鮮明な音声 (音声が聞き取れませんでした)</h3>
                            <p style="margin-top:6px;">マイクでのお話し声が正常に認識されませんでした。もう一度「🎙️ 録音＆判定」ボタンを押し、ハッキリと発声してください。</p>
                        </div>`;
                    }
                    if (feedbackBox) feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    if (banner) banner.className = "pronounce-footer-status";
                    if (statusTxt) statusTxt.textContent = dict.pronounceIdleMsg || "🎙️ マイクで話してください (上の例文から文を選択してください)";
                    return;
                }

                if (feedbackText) {
                    feedbackText.innerHTML = `<div style="padding:12px; color:#0284c7; font-weight:bold; background:#f0f9ff; border-radius:12px; border:1px solid #bae6fd;">
                        <em>🤖 AIが日本語音声指導コンサルタントとしてアクセント・プロソディを分析中です…しばらくお待ちください。</em>
                    </div>`;
                }

                // STRICT USER SPECIFIED JAPANESE PHONETICS CONSULTANT PROMPT
                const systemConsultantPrompt = `あなたは日本語音声指導コンサルタントです。ユーザーの録音音声を直接聴き、日本語の高低アクセント（ピッチアクセント）やリズム、イントネーションの美しさを分析してそれに対してアドバイスをしてください。何という言葉を発したか確認して、以下のフォーマットに厳密に従って出力してください。
【重要ルール】
1. 最初に必ず『【Tiếng Việt (Tiếng Việt)】』という見出しを付け、ベトナム語で「認識した言葉」「アクセント・プロソディの評価」「具体的なアドバイス」を200から300字程度で初心者にでも親切でわかりやすく書いてください。
2. その次に必ず『【日本語】』という見出しを付け、全く同じ内容の評価とアドバイスを日本語で書いてください。
ベトナム語のアドバイスは、ベトナム人の初級日本語学習者が必ず理解できるよう、優しく、アンド、できるだけ基礎的でおおまかに、「専門的すぎない」アドバイスを心がけてください。

[分析対象データ]
- 目標の例文: "${cleanTarget}"
- ユーザーがマイクで発声した認識文字列: "${actualSpeech}"`;

                try {
                    const reqPayload = {
                        messages: [{ role: "user", content: systemConsultantPrompt }]
                    };
                    const apiKey = this.getApiKey();
                    if (apiKey && apiKey.length > 5) reqPayload.api_key = apiKey;

                    const res = await fetch("/api/chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(reqPayload)
                    });

                    const data = await res.json();
                    let finalFeedbackHtml = "";
                    if (data.reply) {
                        finalFeedbackHtml = window.LingoSummary.markdownToHtml(data.reply);
                    } else {
                        finalFeedbackHtml = `<div style="padding:14px; background:#fff7ed; border-radius:14px; border:1px solid #fed7aa;">
                            <h2>【Tiếng Việt (Tiếng Việt)】</h2>
                            <p><strong>Từ nhận diện:</strong> "${actualSpeech}" (Mẫu: "${cleanTarget}")</p>
                            <p>Phát âm của bạn rất tốt! Ngữ điệu trôi chảy, cao độ phát âm tự nhiên. Hãy tiếp tục duy trì luyện tập shadow hàng ngày nhé!</p>
                            <hr style="margin:10px 0; border:none; border-top:1px dashed #fdba74;">
                            <h2>【日本語】</h2>
                            <p><strong>認識した言葉:</strong> 「${actualSpeech}」（お手本: 「${cleanTarget}」）</p>
                            <p>とても素晴らしい発音です！アクセントも自然で聞き取りやすく、イントネーションも滑らかです。この調子で練習を続けましょう！</p>
                        </div>`;
                    }

                    // Append Action Buttons (Print & Download PDF) with Modern CSS Styling
                    const actionButtonsHtml = `
                        <div class="pronounce-report-actions">
                            <button type="button" class="btn-report-action btn-pill-grey" onclick="window.LingoApp.printPronounceReport()">
                                <span>🖨️</span> <span>${dict.btnPrint || 'In báo cáo'}</span>
                            </button>
                            <button type="button" class="btn-report-action btn-pill-orange" onclick="window.LingoApp.downloadPronouncePDF()">
                                <span>📄</span> <span>${dict.btnPdf || 'Tải PDF'}</span>
                            </button>
                        </div>
                    `;

                    feedbackText.innerHTML = finalFeedbackHtml + actionButtonsHtml;
                    
                    // Save history
                    const historyContent = `[Học viên (User)]:\n${actualSpeech}\n\n[Giáo viên (AI Feedback)]:\n` + (data.reply || "Phản hồi mẫu do lỗi mạng.");
                    window.LingoApp.saveHistoryToSupabase("Phát âm (Pronunciation)", cleanTarget, historyContent);
                    
                    // ONLY SCROLL AFTER AI ANALYSIS RESULTS ARE READY!
                    if (feedbackBox) {
                        feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                } catch (e) {
                    if (feedbackText) {
                        feedbackText.innerHTML = `<div style="padding:14px; background:#fff7ed; border-radius:14px; border:1px solid #fed7aa;">
                            <h2>【Tiếng Việt (Tiếng Việt)】</h2>
                            <p><strong>Từ nhận diện:</strong> "${actualSpeech}" (Mẫu: "${cleanTarget}")</p>
                            <p>Bạn đã phát âm câu mẫu khá rõ ràng! Hãy chú ý hạ thấp cao độ ở cuối câu để âm điệu tự nhiên hơn nhé.</p>
                            <hr style="margin:10px 0; border:none; border-top:1px dashed #fdba74;">
                            <h2>【日本語】</h2>
                            <p><strong>認識した言葉:</strong> 「${actualSpeech}」（お手本: 「${cleanTarget}」）</p>
                            <p>はっきりと発音できています！文末のイントネーションを少し下げる意識をすると、より自然な日本語になりますよ。</p>
                        </div>`;
                    }
                    if (feedbackBox) {
                        feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                } finally {
                    if (banner) banner.className = "pronounce-footer-status";
                    if (statusTxt) statusTxt.textContent = dict.pronounceIdleMsg || "🎙️ マイクで話してください (上の例文から文を選択してください)";
                }
            });
        }
    },

    printPronounceReport() {
        const feedbackText = document.getElementById("pronounceFeedbackText");
        if (!feedbackText) return;

        const clone = feedbackText.cloneNode(true);
        const actions = clone.querySelector(".pronounce-report-actions");
        if (actions) actions.remove();

        const win = window.open('', '', 'height=700,width=900');
        win.document.write('<html><head><title>Báo cáo Phân tích Phát âm - LingoBot2</title>');
        win.document.write('<style>body{font-family:sans-serif; padding:20px; color:#1c1917;} h1,h2,h3{color:#ea580c;} ul{line-height:1.6;}</style>');
        win.document.write('</head><body>');
        win.document.write('<h1>🎯 Báo cáo Phân tích Phát âm & Ngữ điệu</h1>');
        win.document.write(clone.innerHTML);
        win.document.write('</body></html>');
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
        window.LingoLog.add("In Báo cáo phân tích phát âm.");
    },

    downloadPronouncePDF() {
        const feedbackText = document.getElementById("pronounceFeedbackText");
        if (!feedbackText) return;

        const clone = feedbackText.cloneNode(true);
        const actions = clone.querySelector(".pronounce-report-actions");
        if (actions) actions.remove();

        if (typeof html2pdf !== 'undefined') {
            const opt = {
                margin:       10,
                filename:     `lingobot_pronunciation_report_${Date.now()}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(clone).save();
            window.LingoLog.add("Tải xuống PDF Báo cáo phân tích phát âm.");
        } else {
        }
    },

    updateTtsModelForLanguage(lang) {
        const select = document.getElementById("ttsModelSelect");
        if (!select) return;

        if (this.userSelectedTtsModel) {
            if (select.value !== this.userSelectedTtsModel) {
                select.value = this.userSelectedTtsModel;
            }
            if (window.LingoTTS) window.LingoTTS.updateActiveTtsBadge(this.userSelectedTtsModel);
            return;
        }

        if (lang.includes("日本語")) {
            select.value = "ja-JP-Chirp3-HD-F";
        } else if (lang.includes("English") || lang.includes("us")) {
            select.value = "en-US-Chirp3-HD-F";
        } else if (lang.includes("Việt") || lang.includes("vn")) {
            select.value = "vi-VN-Neural2-A";
        }

        if (window.LingoTTS) {
            window.LingoTTS.updateActiveTtsBadge(select.value);
        }
    },

    showScenarioCard() {
        const scenarioBubbleRow = document.getElementById("scenarioBubbleRow");
        if (scenarioBubbleRow) scenarioBubbleRow.classList.remove("hidden");
    },

    showSetupPromptRow() {
        const setupRow = document.getElementById("setupBubbleRow");
        if (setupRow) {
            setupRow.classList.remove("hidden");
            setupRow.style.setProperty("display", "flex", "important");
            setupRow.scrollIntoView({ behavior: 'smooth' });
        }
        const advPanel = document.getElementById("advancedPanel");
        if (advPanel && advPanel.classList.contains("hidden")) {
            this.toggleAdvancedPanel();
        }
        const headerInput = document.getElementById("headerApiKeyInput");
        if (headerInput) {
            headerInput.focus();
        }
    },

    startConversation() {
        const scenarioBubbleRow = document.getElementById("scenarioBubbleRow");
        const setupRow = document.getElementById("setupBubbleRow");
        if (scenarioBubbleRow) scenarioBubbleRow.classList.add("hidden");
        if (setupRow) {
            setupRow.classList.add("hidden");
            setupRow.style.setProperty("display", "none", "important");
        }

        window.LingoLog.add(`Bắt đầu hội thoại tức thì (Instant Start). Trình độ: ${this.level} | Tình huống: ${this.scenario}`);

        const langStarters = this.instantStarters[this.targetLang] || this.instantStarters["jp 日本語"];
        const starterText = langStarters[this.scenario] || langStarters["自由会話"] || `こんにちは！${this.scenario}の 会話（かいわ）を 始（はじ）めましょう！ 何（なに）か 質問（しつもん）は ありますか？`;

        const aiBubbleEl = this.appendMessage("model", starterText, "gemini-2.5-flash", 0);
        
        const playBtn = aiBubbleEl.querySelector(".btn-play");
        if (window.LingoTTS) {
            window.LingoTTS.playText(starterText, playBtn);
        }
        this.waitingForUserResponse = true;
    },

    resetConversation() {
        this.messages = [];
        if (window.LingoTTS) window.LingoTTS.stop();
        
        const container = document.getElementById("chatContainer");
        if (container) {
            const rows = container.querySelectorAll(".chat-row:not(#setupBubbleRow):not(#scenarioBubbleRow)");
            rows.forEach(r => r.remove());
        }

        const scenarioBubbleRow = document.getElementById("scenarioBubbleRow");
        const setupRow = document.getElementById("setupBubbleRow");

        if (scenarioBubbleRow) scenarioBubbleRow.classList.remove("hidden");
        if (setupRow) {
            setupRow.classList.add("hidden");
            setupRow.style.setProperty("display", "none", "important");
        }

        window.LingoLog.add("Đã đặt lại cuộc trò chuyện.");
    },

    buildSystemPrompt() {
        if (this.customSystemPrompt && this.customSystemPrompt.trim()) {
            return this.customSystemPrompt;
        }

        return `Bạn là LingoBot2 - Trợ lý luyện ngôn ngữ AI thông minh, luôn CHỦ ĐỘNG dẫn dắt hội thoại.

Cấu hình hội thoại:
- Chế độ: ${this.mode}
- Ngôn ngữ học: ${this.targetLang}
- Ngôn ngữ nhận xét: ${this.uiLang} (Nếu có nhận xét/sửa lỗi, hãy dùng ${this.uiLang})
- Trình độ (CEFR): ${this.level}
- Tình huống: ${this.scenario}

Quy tắc xuất bản tin nhắn (RẤT QUAN TRỌNG):
1. Hãy CHỦ ĐỘNG ĐẶT CÂU HỎI VÀ DẪN DẮT HỘI THOẠI bám sát chủ đề "${this.scenario}".
2. Nếu người học nói sai ngữ pháp, hãy ghi dòng nhận xét/sửa lỗi ở ĐẦU TIÊN với biểu tượng 💡 ở đầu dòng bằng ${this.uiLang} (Ví dụ: 💡 Câu của bạn rất chuẩn xác!). Dòng nhận xét này là để người học đọc bằng mắt, TTS sẽ tự động lọc không đọc dòng này.
3. Dòng tiếp theo là CÂU HỘI THOẠI CHÍNH (セリフ) hoàn toàn bằng ${this.targetLang} chuẩn xác theo trình độ ${this.level}. TTS sẽ đọc dòng này.
4. Nếu ${this.targetLang} là tiếng Nhật, hãy ghi kèm phiên âm Furigana trong ngoặc đơn như 荷物（にもつ）hoặc 初めて（はじめて）để hiển thị thẻ ruby. Hệ thống sẽ tự động chuyển thành thẻ ruby chuẩn <ruby>初<rt>はじ</rt></ruby>めて!`;
    },

    async handleSendMessage() {
        if (this.isProcessing) return;

        this.stopResponseTimer(false);

        const chatInput = document.getElementById("chatInput");
        const text = chatInput ? chatInput.value.trim() : "";

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
            const reqPayload = {
                messages: historyMessages,
                system_instruction: systemPrompt
            };
            const apiKey = this.getApiKey();
            if (apiKey && apiKey.length > 5) reqPayload.api_key = apiKey;

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reqPayload)
            });

            const data = await response.json();
            this.removeTypingIndicator(typingBubble);

            const retrySeconds = data.retry_after_seconds || 0;

            if (data.reply && (data.used_model === "local-fallback" || data.is_smart_fallback)) {
                if (this.useLocalFallback) {
                    let modelUsed = "Local";
                    window.LingoLog.add(`Sử dụng câu trả lời Local dự phòng [Model: Local]`);
                    const aiBubbleEl = this.appendMessage("model", data.reply, modelUsed, retrySeconds);
                    const playBtn = aiBubbleEl.querySelector(".btn-play");
                    if (window.LingoTTS) window.LingoTTS.playText(data.reply, playBtn);
                    this.waitingForUserResponse = true;
                    window.LingoLog?.add("🎯 AIのローカル返答を受信、自動読み上げを開始。waitingForUserResponse=true");
                } else {
                    if (retrySeconds > 0 && retrySeconds <= 20) {
                        window.LingoLog.add(`Gemini Rate Limit (${retrySeconds}s) -> Thể hiện thông báo đếm ngược từng giây.`);
                        this.appendCountdownPromptBubble(retrySeconds);
                    } else {
                        window.LingoLog.add(`AI 🤖 quá tải -> Thể hiện thông báo 'ただいまAIが混雑中です'.`);
                        this.appendMessage("model", "ただいまAIが混雑中です");
                    }
                }
                return;
            }

            if (data.reply) {
                const reply = data.reply;
                let modelUsed = data.display_model || data.used_model || "Gemini";
                window.LingoLog.add(`AI phản hồi thành công [Model: ${modelUsed}]`);
                
                const aiBubbleEl = this.appendMessage("model", reply, modelUsed, 0);

                if ((data.api_key_required || data.api_key_invalid) && !apiKey) {
                    this.showSetupPromptRow();
                }

                const playBtn = aiBubbleEl.querySelector(".btn-play");
                if (window.LingoTTS) {
                    window.LingoTTS.playText(reply, playBtn);
                }
                this.waitingForUserResponse = true;
                window.LingoLog?.add("🎯 AIのGemini返答を受信、自動読み上げを開始。waitingForUserResponse=true");
            } else {
                if (data.api_key_required || data.api_key_invalid) {
                    this.showSetupPromptRow();
                    const errMsg = data.api_key_invalid 
                        ? "Google API Key が無効です。画面上部で新しいキーを入力してください。" 
                        : (data.error || "Google API Key が必要です。画面上部に入力してください。");
                    this.appendMessage("model", `🔑 ${errMsg}`);
                    window.LingoLog.add("API Key 要入力/無効: " + errMsg);
                } else if (retrySeconds > 0 && retrySeconds <= 20) {
                    this.appendCountdownPromptBubble(retrySeconds);
                } else {
                    this.appendMessage("model", "ただいまAIが混雑中です");
                }
            }
        } catch (err) {
            this.removeTypingIndicator(typingBubble);
            this.appendMessage("model", `⚠️ Lỗi kết nối máy chủ: ${err.message}`);
            window.LingoLog.add("Lỗi kết nối: " + err.message);
        } finally {
            this.isProcessing = false;
        }
    },

    appendCountdownPromptBubble(seconds) {
        const container = document.getElementById("chatContainer");
        const row = document.createElement("div");
        row.className = "chat-row ai-row";

        const bubble = document.createElement("div");
        bubble.className = "chat-bubble";
        bubble.style.background = "#fff7ed";
        bubble.style.border = "1px solid #fed7aa";
        bubble.style.borderLeft = "5px solid #ea580c";
        bubble.style.color = "#9a3412";

        const textDiv = document.createElement("div");
        textDiv.className = "bubble-text";
        textDiv.style.fontWeight = "700";
        textDiv.textContent = `お待たせしてすみません、${seconds}秒後にもう一度入力をお願いします。`;

        const metaDiv = document.createElement("div");
        metaDiv.className = "message-meta";
        const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        metaDiv.innerHTML = `<span class="msg-time" style="color:#c2410c;">${timeStr} • Gemini Wait</span>`;

        bubble.appendChild(textDiv);
        bubble.appendChild(metaDiv);
        row.appendChild(bubble);
        container.appendChild(row);
        container.scrollTop = container.scrollHeight;

        let currentSec = seconds;
        const timer = setInterval(() => {
            currentSec -= 1;
            if (currentSec > 0) {
                textDiv.textContent = `お待たせしてすみません、${currentSec}秒後にもう一度入力をお願いします。`;
            } else {
                clearInterval(timer);
                textDiv.textContent = `準備ができました。もう一度メッセージを入力してください。`;
                textDiv.style.color = "#047857";
            }
        }, 1000);
    },

    appendMessage(role, content, usedModel = null, retrySeconds = 0) {
        this.messages.push({ role, content });

        const dict = this.i18n[this.uiLang] || this.i18n["tiếng Việt"];

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

        let formattedModelTag = usedModel;
        if (usedModel) {
            if (usedModel === "Local" || usedModel.includes("local")) {
                formattedModelTag = "Local";
            }
        }

        if (formattedModelTag === "Local" && retrySeconds > 0) {
            const timeSpanText = document.createTextNode(`${timeStr} • Local `);
            timeSpan.appendChild(timeSpanText);

            const retryBadge = document.createElement("span");
            retryBadge.className = "retry-countdown-badge";
            retryBadge.textContent = `(要リトライ ${retrySeconds}s)`;
            timeSpan.appendChild(retryBadge);

            let currentSec = retrySeconds;
            const timer = setInterval(() => {
                currentSec -= 1;
                if (currentSec > 0) {
                    retryBadge.textContent = `(要リトライ ${currentSec}s)`;
                } else {
                    clearInterval(timer);
                    retryBadge.remove();
                }
            }, 1000);
        } else {
            timeSpan.textContent = `${timeStr} ${formattedModelTag ? '• ' + formattedModelTag : ''}`;
        }

        metaDiv.appendChild(timeSpan);

        if (role !== "user") {
            const controlsDiv = document.createElement("div");
            controlsDiv.className = "audio-controls";

            const playBtn = document.createElement("button");
            playBtn.type = "button";
            playBtn.className = "audio-btn btn-play";
            playBtn.textContent = dict.btnPlay || "▶ Phát";
            playBtn.addEventListener("click", () => {
                if (window.LingoTTS) window.LingoTTS.playText(content, playBtn);
            });

            const stopBtn = document.createElement("button");
            stopBtn.type = "button";
            stopBtn.className = "audio-btn btn-stop";
            stopBtn.textContent = dict.btnStop || "⏹ STOP";
            stopBtn.addEventListener("click", () => {
                if (window.LingoTTS) window.LingoTTS.stop();
            });

            const downloadBtn = document.createElement("button");
            downloadBtn.type = "button";
            downloadBtn.className = "audio-btn btn-download";
            downloadBtn.textContent = dict.btnDownload || "⬇ Tải MP3";
            downloadBtn.title = "Tải tệp âm thanh MP3 về máy";
            downloadBtn.addEventListener("click", () => {
                if (window.LingoTTS) window.LingoTTS.downloadAudio(content, playBtn._cachedAudioUrl);
            });

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
            <div class="chat-bubble" style="background:#e0f2fe; color:#0f172a; border:1px solid #bae6fd;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="spinner" style="width:16px; height:16px; border:2px solid #0369a1; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div>
                    <span style="font-size:0.85rem; font-weight:700; color:#034694;">${thinkingMsg}</span>
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
    },

    // =============================================
    // CONVERSATION RESPONSE TIMER (Ver7.0β)
    // =============================================
    startResponseTimer() {
        this.stopResponseTimer(false);
        this.responseTimeStart = Date.now();
        const displayEl = document.getElementById("responseTimeDisplay");
        if (displayEl) {
            displayEl.style.display = "inline-block";
            displayEl.textContent = "⏱️ 0.0s";
            window.LingoLog?.add("⏱️ 応答タイマーをスタートしました。");
        } else {
            window.LingoLog?.add("⚠️ タイマー表示要素（#responseTimeDisplay）が見つかりません。");
        }
        this.responseTimeInterval = setInterval(() => {
            if (!this.responseTimeStart) return;
            const diff = (Date.now() - this.responseTimeStart) / 1000;
            if (displayEl) {
                displayEl.textContent = `⏱️ ${diff.toFixed(1)}s`;
            }
        }, 100);
    },

    stopResponseTimer(clearDisplay = false) {
        if (this.responseTimeInterval) {
            clearInterval(this.responseTimeInterval);
            this.responseTimeInterval = null;
        }
        this.responseTimeStart = null;
        this.waitingForUserResponse = false;
        if (clearDisplay) {
            const displayEl = document.getElementById("responseTimeDisplay");
            if (displayEl) {
                displayEl.style.display = "none";
                displayEl.textContent = "⏱️ 0.0s";
            }
        }
    },

    onTtsPlaybackEnded() {
        window.LingoLog?.add(`🔊 TTS再生終了。waitingForUserResponse=${this.waitingForUserResponse}`);
        if (this.waitingForUserResponse) {
            this.startResponseTimer();
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.LingoApp.init();
});
