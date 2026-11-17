/* ============================================
   安全e课堂 · 认证 & 进度同步模块

   架构（参考英语学习网站设计）：
   - localStorage 作为本地缓存（同步读写，兼容现有 Storage 模块）
   - Supabase 作为云端数据库（异步同步）
   - 登录时从 Supabase 加载到 localStorage
   - 保存进度时同时写 localStorage + Supabase

   数据库表：students / study_progress / quiz_records
   ============================================ */

const Auth = {
    currentUser: null,      // { username, display_name, class_name, role }
    currentUsername: null,
    isGuest: false,         // 游客模式：无需注册即可浏览，不记录进度

    /* ---------- 初始化（页面加载时调用，不阻塞首屏） ---------- */
    async init() {
        const saved = localStorage.getItem('sec_currentUser');
        if (!saved) return false;          // 未登录：完全不需要 SDK

        let user;
        try {
            user = JSON.parse(saved);
        } catch (e) {
            localStorage.removeItem('sec_currentUser');
            return false;
        }

        // 游客模式：不碰数据库
        if (user.role === 'guest') {
            this.currentUser = user;
            this.currentUsername = user.username;
            this.isGuest = true;
            this.onLoginSuccess(true);
            return true;
        }

        // 已登录：先用本地缓存立即进入界面，SDK 加载和云端校验放到后台
        this.currentUser = user;
        this.currentUsername = user.username;
        this.isGuest = false;
        this.onLoginSuccess(true);

        this._verifyInBackground(user);    // 不 await，避免阻塞首屏
        return true;
    },

    /* ---------- 后台校验登录态（网络/SDK 失败时保持本地登录，不踢人） ---------- */
    async _verifyInBackground(user) {
        let client;
        try {
            client = await ensureDB();
        } catch (e) {
            console.warn('[Auth] SDK 未就绪，使用本地缓存（离线模式）：', e.message);
            return;
        }

        try {
            const { data, error } = await client
                .from('students')
                .select('username, display_name, class_name, role')
                .eq('username', user.username)
                .single();

            if (data && !error) {
                // 以云端资料为准（可能改过姓名或班级）
                this.currentUser = data;
                this.currentUsername = data.username;
                const el = document.getElementById('navUsername');
                if (el) el.textContent = data.display_name || data.username;
                return;
            }

            // 查无此行 → 账号确实已被删除
            if (error && (error.code === 'PGRST116' || /0 rows|no rows/i.test(error.message || ''))) {
                localStorage.removeItem('sec_currentUser');
                if (typeof App !== 'undefined') App.toast('账号已失效，请重新登录', 'error');
                this.logout();
            }
            // 其他错误（网络/权限）保持本地登录态，不处理
        } catch (e) {
            console.warn('[Auth] 登录态校验跳过：', e.message);
        }
    },

    /* ---------- 登录 ---------- */
    async login(username, password) {
        let client;
        try {
            client = await ensureDB();
        } catch (e) {
            return { success: false, message: '网络较慢，依赖库还没加载完，请再点一次登录' };
        }
        const { data, error } = await client
            .from('students')
            .select('username, display_name, class_name, role, password_hash')
            .eq('username', username.trim())
            .single();

        if (error || !data) {
            return { success: false, message: '用户名不存在，请先注册' };
        }
        if (data.password_hash !== password) {
            return { success: false, message: '密码错误' };
        }

        this.currentUser = {
            username: data.username,
            display_name: data.display_name,
            class_name: data.class_name,
            role: data.role
        };
        this.currentUsername = data.username;
        localStorage.setItem('sec_currentUser', JSON.stringify(this.currentUser));
        this.onLoginSuccess(false);
        this._recordLogin();
        return { success: true, message: `欢迎回来，${data.display_name || username}！` };
    },

    /* ---------- 游客模式：无需注册直接进入 ---------- */
    loginAsGuest() {
        // 如果已登录，先退出
        if (this.currentUser && !this.isGuest) {
            this.logout();
        }

        this.currentUser = {
            username: '__guest__',
            display_name: '游客模式',
            class_name: '',
            role: 'guest'
        };
        this.currentUsername = '__guest__';
        this.isGuest = true;
        localStorage.setItem('sec_currentUser', JSON.stringify(this.currentUser));
        this.onLoginSuccess(false);
    },

    /* ---------- 注册（学生申请登录学习） ---------- */
    async register(username, password, displayName, className) {
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return { success: false, message: '用户名只能包含字母、数字和下划线' };
        }
        if (username.length < 3 || username.length > 20) {
            return { success: false, message: '用户名长度需 3-20 个字符' };
        }
        if (password.length < 4) {
            return { success: false, message: '密码至少 4 位' };
        }
        if (!displayName.trim()) {
            return { success: false, message: '请填写真实姓名' };
        }

        let client;
        try {
            client = await ensureDB();
        } catch (e) {
            return { success: false, message: '网络较慢，依赖库还没加载完，请稍后再试' };
        }

        // 检查用户名是否已存在
        const { data: existing } = await client
            .from('students')
            .select('username')
            .eq('username', username.trim())
            .single();

        if (existing) {
            return { success: false, message: '用户名已存在，请换一个' };
        }

        // 插入新学生
        const { error } = await client
            .from('students')
            .insert([{
                username: username.trim(),
                password_hash: password,
                display_name: displayName.trim(),
                class_name: className,
                role: 'student'
            }]);

        if (error) {
            return { success: false, message: '注册失败：' + error.message };
        }

        // 注册成功后自动登录
        return await this.login(username, password);
    },

    /* ---------- 退出 ---------- */
    logout() {
        // 同步最后一次进度（游客跳过）
        if (!this.isGuest && typeof StudyTracker !== 'undefined') {
            StudyTracker._syncNow(false);
        }
        this.currentUser = null;
        this.currentUsername = null;
        this.isGuest = false;
        localStorage.removeItem('sec_currentUser');
        document.getElementById('page-auth').classList.remove('hidden');
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('navUser').style.display = 'none';
        App.toast('已退出登录', 'info');
    },

    /* ---------- 登录成功后的 UI 处理 ---------- */
    onLoginSuccess(silent) {
        document.getElementById('page-auth').classList.add('hidden');
        document.getElementById('app-container').style.display = '';
        document.getElementById('navUser').style.display = 'flex';

        const user = this.currentUser;
        document.getElementById('navUsername').textContent = user.display_name || user.username;
        document.getElementById('navUserRole').textContent = user.role === 'teacher' ? '教师' : (user.role === 'guest' ? '游客' : '学生');
        document.getElementById('navUserRole').className = 'nav-role ' + user.role;

        // 游客模式：隐藏修改密码/教师后台，显示注册入口
        if (this.isGuest) {
            document.getElementById('menuChangePwd').style.display = 'none';
            document.getElementById('teacherEntry').style.display = 'none';
            document.getElementById('menuLogout').style.display = 'none';
            document.getElementById('menuRegister').style.display = '';
        } else {
            document.getElementById('menuChangePwd').style.display = '';
            document.getElementById('menuLogout').style.display = '';
            document.getElementById('menuRegister').style.display = 'none';
        }

        // 游客模式不加载进度、不启动学习追踪
        if (!this.isGuest) {
            this.loadProgress();
            if (typeof StudyTracker !== 'undefined') {
                StudyTracker.init();
            }
        }

        // 刷新页面
        App.go('home');
        App.updateProgress();

        if (!silent) {
            const msg = this.isGuest
                ? '正在以游客模式浏览（进度不会保存）'
                : `欢迎回来，${user.display_name || user.username}！`;
            App.toast(msg, this.isGuest ? 'info' : 'success');
        }
    },

    /* ---------- 获取本地进度（同步，从 localStorage） ---------- */
    getProgress() {
        if (!this.currentUsername) return null;
        const all = JSON.parse(localStorage.getItem('sec_progress') || '{}');
        return all[this.currentUsername] || {
            quizScores: {},
            blindboxHighScore: 0,
            scenarioCompleted: [],
            learnedTopics: []
        };
    },

    /* ---------- 保存进度（写 localStorage + 异步同步 Supabase） ---------- */
    saveProgress(progress) {
        if (!this.currentUsername || this.isGuest) return;

        // 1. 同步写 localStorage（兼容现有 Storage 模块）
        const all = JSON.parse(localStorage.getItem('sec_progress') || '{}');
        all[this.currentUsername] = progress;
        localStorage.setItem('sec_progress', JSON.stringify(all));

        // 2. 若 SDK 尚未就绪，打脏标记，等就绪后补传，避免被云端旧数据覆盖
        if (!db) {
            localStorage.setItem(this._dirtyKey(), '1');
            ensureDB().catch(() => {});
            return;
        }

        // 3. 异步写 Supabase
        this._syncToCloud(progress);
    },

    /* 本地未同步标记的 key */
    _dirtyKey() {
        return 'sec_progress_dirty_' + this.currentUsername;
    },

    /* ---------- 异步同步进度到云端 ---------- */
    async _syncToCloud(progress) {
        if (!this.currentUsername) return;
        let client;
        try { client = await ensureDB(); } catch (e) { return; }
        try {
            const totalCorrect = Object.values(progress.quizScores || {})
                .reduce((sum, s) => sum + (s.correct || 0), 0);
            const totalQuestions = Object.values(progress.quizScores || {})
                .reduce((sum, s) => sum + (s.total || 0), 0);

            const { error } = await client
                .from('study_progress')
                .upsert([{
                    username: this.currentUsername,
                    quiz_scores: progress.quizScores || {},
                    blindbox_high_score: progress.blindboxHighScore || 0,
                    scenario_completed: progress.scenarioCompleted || [],
                    learned_topics: progress.learnedTopics || [],
                    quiz_total_correct: totalCorrect,
                    quiz_total_questions: totalQuestions,
                    last_update: new Date().toISOString()
                }], { onConflict: 'username' });

            if (error) {
                console.warn('[Supabase] 进度同步失败：', error.message);
            }
        } catch (e) {
            console.warn('[Supabase] 网络错误：', e.message);
        }
    },

    /* ---------- 记录登录时间 ---------- */
    async _recordLogin() {
        if (!this.currentUsername) return;
        let client;
        try { client = await ensureDB(); } catch (e) { return; }
        const now = new Date().toISOString();
        try {
            await client.from('study_progress')
                .upsert([{
                    username: this.currentUsername,
                    last_login: now,
                    last_update: now
                }], { onConflict: 'username' });
        } catch (e) { /* 静默 */ }
    },

    /* ---------- 从云端加载进度到本地 ---------- */
    async loadProgress() {
        if (!this.currentUsername) return;
        let client;
        try { client = await ensureDB(); } catch (e) { return; }

        // 本地有未同步的进度：先补传，避免被云端旧数据覆盖
        if (localStorage.getItem(this._dirtyKey())) {
            const local = this.getProgress();
            if (local) await this._syncToCloud(local);
            localStorage.removeItem(this._dirtyKey());
        }

        try {
            const { data, error } = await client
                .from('study_progress')
                .select('quiz_scores, blindbox_high_score, scenario_completed, learned_topics, total_study_seconds')
                .eq('username', this.currentUsername)
                .single();

            if (data && !error) {
                const progress = {
                    quizScores: data.quiz_scores || {},
                    blindboxHighScore: data.blindbox_high_score || 0,
                    scenarioCompleted: data.scenario_completed || [],
                    learnedTopics: data.learned_topics || []
                };
                // 写入 localStorage
                const all = JSON.parse(localStorage.getItem('sec_progress') || '{}');
                all[this.currentUsername] = progress;
                localStorage.setItem('sec_progress', JSON.stringify(all));

                // 同步到原 Storage 兼容层
                Storage.set('quizScores', progress.quizScores);
                Storage.set('blindboxHighScore', progress.blindboxHighScore);
                Storage.set('scenarioCompleted', progress.scenarioCompleted);
                Storage.set('learnedTopics', progress.learnedTopics);

                // 加载学习时长
                if (typeof StudyTracker !== 'undefined' && data.total_study_seconds != null) {
                    StudyTracker.totalSeconds = data.total_study_seconds;
                    StudyTracker.lastSyncSeconds = data.total_study_seconds;
                }
                App.updateProgress();
                console.log('[Auth] 云端进度已加载');
            }
        } catch (e) {
            console.warn('[Auth] 加载进度失败：', e.message);
        }
    },

    /* ---------- 上报单次答题记录（供教师查看明细） ---------- */
    async reportQuizRecord(levelIndex, levelTitle, correct, total, stars, durationSec) {
        if (!this.currentUsername) return;
        let client;
        try { client = await ensureDB(); } catch (e) { return; }
        try {
            await client.from('quiz_records').insert([{
                username: this.currentUsername,
                level_index: levelIndex,
                level_title: levelTitle,
                correct: correct,
                total: total,
                stars: stars,
                duration_sec: durationSec || 0
            }]);
        } catch (e) {
            console.warn('[Auth] 答题记录上报失败：', e.message);
        }
    },

    /* ---------- 修改密码 ---------- */
    showChangePassword() {
        if (this.isGuest) { App.toast('游客模式不支持修改密码，请先注册', 'info'); return; }
        document.getElementById('changePwdOverlay').classList.remove('hidden');
        ['oldPassword', 'newPassword', 'newPassword2'].forEach(id => document.getElementById(id).value = '');
    },
    closeChangePassword() {
        document.getElementById('changePwdOverlay').classList.add('hidden');
    },
    async handleChangePassword(e) {
        e.preventDefault();
        const oldPwd = document.getElementById('oldPassword').value;
        const newPwd = document.getElementById('newPassword').value;
        const newPwd2 = document.getElementById('newPassword2').value;

        if (newPwd !== newPwd2) { App.toast('两次新密码不一致', 'error'); return; }
        if (newPwd.length < 4) { App.toast('新密码至少 4 位', 'error'); return; }

        let client;
        try { client = await ensureDB(); } catch (err) {
            App.toast('网络较慢，请稍后重试', 'error'); return;
        }
        const { data, error } = await client.from('students')
            .select('password_hash').eq('username', this.currentUsername).single();
        if (error || !data || data.password_hash !== oldPwd) {
            App.toast('当前密码错误', 'error'); return;
        }
        const { error: updateError } = await client.from('students')
            .update({ password_hash: newPwd }).eq('username', this.currentUsername);
        if (updateError) { App.toast('修改失败，请重试', 'error'); }
        else { App.toast('密码修改成功！', 'success'); this.closeChangePassword(); }
    },

    /* ========== HTML 表单交互 ========== */
    switchTab(tab) {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
        document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
        document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
    },

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!username || !password) { App.toast('请输入用户名和密码', 'error'); return; }
        const btn = e.target.querySelector('button[type="submit"]');
        const oldText = btn.textContent;
        btn.disabled = true; btn.textContent = '登录中...';
        try {
            const result = await this.login(username, password);
            if (!result.success) App.toast(result.message, 'error');
        } catch (err) {
            App.toast('登录失败：' + (err.message || '网络错误'), 'error');
        } finally {
            btn.disabled = false; btn.textContent = oldText;
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('regUsername').value.trim();
        const displayName = document.getElementById('regDisplayName').value.trim();
        const className = document.getElementById('regClass').value;
        const password = document.getElementById('regPassword').value;
        const password2 = document.getElementById('regPassword2').value;
        if (password !== password2) { App.toast('两次密码不一致', 'error'); return; }
        const btn = e.target.querySelector('button[type="submit"]');
        const oldText = btn.textContent;
        btn.disabled = true; btn.textContent = '注册中...';
        try {
            const result = await this.register(username, password, displayName, className);
            if (!result.success) App.toast(result.message, 'error');
        } catch (err) {
            App.toast('注册失败：' + (err.message || '网络错误'), 'error');
        } finally {
            btn.disabled = false; btn.textContent = oldText;
        }
    },

    /* ---------- 游客体验入口 ---------- */
    handleLoginAsGuest() {
        this.loginAsGuest();
    },

    /* ---------- 跳转教师后台 ---------- */
    goTeacher() {
        if (this.currentUser && this.currentUser.role === 'teacher') {
            window.location.href = 'teacher.html';
        } else {
            App.toast('仅教师账号可进入管理后台', 'error');
        }
    }
};
