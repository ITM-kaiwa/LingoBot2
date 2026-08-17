window.LingoAuth = {
    currentUser: null,

    init() {
        this.generateClassList();
        
        // Check if user is already logged in
        if (window.supabaseClient) {
            window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
                if (session && session.user) {
                    this.currentUser = session.user;
                    this.hideAuthModal();
                    window.LingoLog?.add("Đăng nhập thành công với phiên trước đó.");
                }
            });

            // Listen for auth state changes
            window.supabaseClient.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    this.currentUser = session.user;
                    this.hideAuthModal();
                } else if (event === 'SIGNED_OUT') {
                    this.currentUser = null;
                    this.showAuthModal();
                }
            });
        }
    },

    generateClassList() {
        const datalist = document.getElementById("classList");
        if (!datalist) return;
        
        let optionsHtml = '';
        for (let i = 1; i <= 15; i++) {
            optionsHtml += `<option value="26M${i.toString().padStart(2, '0')}"></option>`;
        }
        for (let i = 1; i <= 15; i++) {
            optionsHtml += `<option value="27M${i.toString().padStart(2, '0')}"></option>`;
        }
        datalist.innerHTML = optionsHtml;
    },

    showAuthModal() {
        const modal = document.getElementById("authModal");
        if (modal) modal.style.display = "flex";
    },

    hideAuthModal() {
        const modal = document.getElementById("authModal");
        if (modal) modal.style.display = "none";
    },

    switchAuthTab(tab) {
        const loginForm = document.getElementById("loginForm");
        const registerForm = document.getElementById("registerForm");
        const tabLogin = document.getElementById("tabLogin");
        const tabRegister = document.getElementById("tabRegister");

        if (tab === 'login') {
            loginForm.style.display = "block";
            registerForm.style.display = "none";
            tabLogin.className = "modal-btn btn-pill-orange";
            tabRegister.className = "modal-btn btn-pill-grey";
        } else {
            loginForm.style.display = "none";
            registerForm.style.display = "block";
            tabLogin.className = "modal-btn btn-pill-grey";
            tabRegister.className = "modal-btn btn-pill-orange";
        }
    },

    async handleLogin() {
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value.trim();

        if (!email || !password) {
            alert("Vui lòng nhập đầy đủ Email và Mật khẩu.");
            return;
        }

        try {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            
            window.LingoLog?.add("Đăng nhập thành công.");
        } catch (error) {
            console.error("Login Error:", error);
            alert("Đăng nhập thất bại: " + error.message);
        }
    },

    async handleRegister() {
        const name = document.getElementById("regName").value.trim();
        const gender = document.getElementById("regGender").value;
        const className = document.getElementById("regClass").value.trim();
        const email = document.getElementById("regEmail").value.trim();
        const password = document.getElementById("regPassword").value.trim();

        if (!name || !gender || !className || !email || !password) {
            alert("Vui lòng nhập đầy đủ thông tin đăng ký.");
            return;
        }

        try {
            // Sign up the user
            const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });

            if (authError) throw authError;

            // Wait for user record to exist, then insert into profiles
            const user = authData.user;
            if (user) {
                const { error: profileError } = await window.supabaseClient
                    .from('profiles')
                    .insert([
                        {
                            id: user.id,
                            name: name,
                            gender: gender,
                            class_name: className,
                            email: email
                        }
                    ]);

                if (profileError) {
                    console.error("Profile Insert Error:", profileError);
                    alert("Đăng ký thành công nhưng không thể tạo hồ sơ (Profile error). Vui lòng báo cho quản trị viên.");
                } else {
                    alert("Đăng ký thành công! Vui lòng đăng nhập.");
                    this.switchAuthTab('login');
                }
            } else {
                alert("Đăng ký thành công, vui lòng kiểm tra email để xác nhận.");
            }

        } catch (error) {
            console.error("Register Error:", error);
            if (error.message && error.message.toLowerCase().includes("rate limit")) {
                alert("Đăng ký thất bại: Hệ thống đang bị giới hạn số lượng đăng ký. Vui lòng thử lại sau vài phút hoặc báo cho giáo viên (Admin: Tắt Confirm Email hoặc tăng Rate Limit trên Supabase).");
            } else {
                alert("Đăng ký thất bại: " + error.message);
            }
        }
    },

    // ---------------------------------------------------------
    // ADMIN / HISTORY MANAGEMENT
    // ---------------------------------------------------------
    
    promptAdminPassword() {
        const modal = document.getElementById("adminPasswordModal");
        if (modal) {
            document.getElementById("adminPasswordInput").value = "";
            modal.classList.remove("hidden");
        }
    },

    verifyAdminPassword() {
        const input = document.getElementById("adminPasswordInput").value;
        if (input === "Render645@") {
            document.getElementById("adminPasswordModal").classList.add("hidden");
            const menuModal = document.getElementById("adminMenuModal");
            if (menuModal) menuModal.classList.remove("hidden");
        } else {
            alert("Mật khẩu không chính xác! (Incorrect password)");
        }
    },

    openHistoryModal() {
        document.getElementById("adminMenuModal").classList.add("hidden");
        const modal = document.getElementById("historyModal");
        if (modal) {
            document.getElementById("historySearchInput").value = "";
            modal.classList.remove("hidden");
            document.getElementById("historyDetailContainer").classList.add("hidden");
            this.fetchLearningHistory();
        }
    },

    async fetchLearningHistory() {
        const tbody = document.getElementById("historyTableBody");
        if (!tbody) return;
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding: 15px;'>Đang tải dữ liệu...</td></tr>";

        try {
            // Join learning_history with profiles table
            const { data, error } = await window.supabaseClient
                .from('learning_history')
                .select(`
                    id,
                    session_type,
                    theme,
                    dialogue_content,
                    created_at,
                    profiles (
                        name,
                        class_name
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding: 15px;'>Không có dữ liệu lịch sử.</td></tr>";
                return;
            }

            this.currentHistoryData = data; // store for filtering/download/print
            this.renderHistoryTable(data);

        } catch (error) {
            console.error("Fetch History Error:", error);
            tbody.innerHTML = `<tr><td colspan='6' style='text-align:center; padding: 15px; color: red;'>Lỗi khi tải dữ liệu: ${error.message}</td></tr>`;
        }
    },

    renderHistoryTable(dataToRender) {
        const tbody = document.getElementById("historyTableBody");
        if (!tbody) return;

        this.displayedHistoryData = dataToRender; // store for viewHistoryDetail indexing
        
        if (!dataToRender || dataToRender.length === 0) {
            tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding: 15px;'>Không có dữ liệu (No data matches).</td></tr>";
            return;
        }

        let html = "";
        dataToRender.forEach((row, index) => {
            const date = new Date(row.created_at).toLocaleString('vi-VN');
            const studentName = row.profiles?.name || "Unknown";
            const className = row.profiles?.class_name || "N/A";
            
            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; cursor: pointer;" onclick="window.LingoAuth.viewHistoryDetail(${index})" title="Nhấn để xem chi tiết">
                    <td style="padding: 8px;">${date}</td>
                    <td style="padding: 8px; font-weight: bold;">${studentName}</td>
                    <td style="padding: 8px;">${className}</td>
                    <td style="padding: 8px;"><span style="background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${row.session_type}</span></td>
                    <td style="padding: 8px;">${row.theme || "-"}</td>
                    <td style="padding: 8px; color: #ea580c; text-decoration: underline; font-size: 0.8rem;">Xem</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    },

    filterHistory() {
        const query = (document.getElementById("historySearchInput").value || "").toLowerCase();
        if (!this.currentHistoryData) return;
        
        const filteredData = this.currentHistoryData.filter(row => {
            const date = new Date(row.created_at).toLocaleString('vi-VN').toLowerCase();
            const studentName = (row.profiles?.name || "").toLowerCase();
            const className = (row.profiles?.class_name || "").toLowerCase();
            const sessionType = (row.session_type || "").toLowerCase();
            const theme = (row.theme || "").toLowerCase();
            
            let contentStr = "";
            if (row.dialogue_content) {
                if (typeof row.dialogue_content === 'string') {
                    contentStr = row.dialogue_content.toLowerCase();
                } else if (Array.isArray(row.dialogue_content)) {
                    contentStr = row.dialogue_content.map(m => (m.content || m.text || "")).join(" ").toLowerCase();
                } else {
                    contentStr = JSON.stringify(row.dialogue_content).toLowerCase();
                }
            }
            
            return date.includes(query) || 
                   studentName.includes(query) || 
                   className.includes(query) || 
                   sessionType.includes(query) || 
                   theme.includes(query) || 
                   contentStr.includes(query);
        });
        
        this.renderHistoryTable(filteredData);
    },

    viewHistoryDetail(index) {
        if (!this.displayedHistoryData || !this.displayedHistoryData[index]) return;
        const row = this.displayedHistoryData[index];
        
        document.getElementById("historyDetailContainer").classList.remove("hidden");
        const date = new Date(row.created_at).toLocaleString('vi-VN');
        const studentName = row.profiles?.name || "Unknown";
        
        document.getElementById("historyDetailTitle").innerText = `Chi tiết hội thoại - ${studentName} (${date})`;
        
        let contentDisplay = "No content available.";
        if (row.dialogue_content) {
            if (typeof row.dialogue_content === 'string') {
                contentDisplay = row.dialogue_content;
            } else if (Array.isArray(row.dialogue_content)) {
                // If stored as array of message objects
                contentDisplay = row.dialogue_content.map(msg => {
                    const role = msg.role === 'user' ? "User (Học viên)" : "AI (Giáo viên)";
                    return `[${role}]: ${msg.content || msg.text || ""}`;
                }).join("\n\n");
            } else {
                contentDisplay = JSON.stringify(row.dialogue_content, null, 2);
            }
        }
        
        document.getElementById("historyDetailContent").innerText = contentDisplay;
        
        // Scroll to detail
        setTimeout(() => {
            const container = document.getElementById("historyDetailContainer");
            if (container) container.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
    },

    downloadHistoryTxt() {
        if (!this.currentHistoryData || this.currentHistoryData.length === 0) {
            alert("Không có dữ liệu để tải.");
            return;
        }

        let txtContent = "=== LINGO BOT 2 - LEARNING HISTORY ===\n\n";
        
        this.currentHistoryData.forEach(row => {
            const date = new Date(row.created_at).toLocaleString('vi-VN');
            const studentName = row.profiles?.name || "Unknown";
            const className = row.profiles?.class_name || "N/A";
            
            txtContent += `-------------------------------------------------\n`;
            txtContent += `Date: ${date}\n`;
            txtContent += `Student: ${studentName} (Class: ${className})\n`;
            txtContent += `Mode: ${row.session_type}\n`;
            txtContent += `Theme: ${row.theme || "-"}\n`;
            txtContent += `\n[Dialogue Content]:\n`;
            
            if (typeof row.dialogue_content === 'string') {
                txtContent += row.dialogue_content + "\n";
            } else if (Array.isArray(row.dialogue_content)) {
                const diag = row.dialogue_content.map(msg => `[${msg.role}]: ${msg.content || msg.text || ""}`).join("\n");
                txtContent += diag + "\n";
            } else {
                txtContent += JSON.stringify(row.dialogue_content, null, 2) + "\n";
            }
        });

        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LingoBot_History_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    printHistory() {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Vui lòng cho phép popup để in.");
            return;
        }

        let html = `
        <html>
        <head>
            <title>Lịch sử học tập LingoBot</title>
            <style>
                body { font-family: 'Arial', sans-serif; padding: 20px; line-height: 1.6; }
                h1 { text-align: center; }
                .record { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
                .meta { margin-bottom: 15px; background: #f8f9fa; padding: 10px; }
                .content { white-space: pre-wrap; font-size: 14px; }
            </style>
        </head>
        <body>
            <h1>Lịch sử học tập (LingoBot2)</h1>
        `;

        if (!this.currentHistoryData || this.currentHistoryData.length === 0) {
            html += "<p>Không có dữ liệu.</p>";
        } else {
            this.currentHistoryData.forEach(row => {
                const date = new Date(row.created_at).toLocaleString('vi-VN');
                const studentName = row.profiles?.name || "Unknown";
                const className = row.profiles?.class_name || "N/A";
                
                let diag = "";
                if (typeof row.dialogue_content === 'string') {
                    diag = row.dialogue_content;
                } else if (Array.isArray(row.dialogue_content)) {
                    diag = row.dialogue_content.map(msg => `<strong>[${msg.role}]</strong>: ${msg.content || msg.text || ""}`).join("<br/>");
                }
                
                html += `
                <div class="record">
                    <div class="meta">
                        <strong>Ngày:</strong> ${date} | 
                        <strong>Học viên:</strong> ${studentName} (${className}) | 
                        <strong>Chế độ:</strong> ${row.session_type} | 
                        <strong>Chủ đề:</strong> ${row.theme || "-"}
                    </div>
                    <div class="content">${diag}</div>
                </div>
                `;
            });
        }

        html += `
        </body>
        </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }
};

// Initialize auth module on load
document.addEventListener("DOMContentLoaded", () => {
    // Wait slightly to ensure supabaseClient is loaded
    setTimeout(() => {
        window.LingoAuth.init();
    }, 100);
});
