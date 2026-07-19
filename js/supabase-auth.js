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

    /* ---------- 初始化（页面加载时调用） ---------- */
    async init() {
        const saved = localStorage.getItem('sec_currentUser');
        if (!saved) return false;

        try {
            const user = JSON.parse(saved);
            // 验证用户是否仍存在于 Supabase
            const { data, error } = await db
                .from('students')
                .select('username, display_name, class_name, role')
                .eq('username', user.username)
                .single();

            if (data && !error) {
                this.currentUser = data;
                this.currentUsername = data.username;
                this.onLoginSuccess(true);  // 静默登录
                return true;
            } else {
                // 用户已被删除，清除本地
                localStorage.removeItem('sec_currentUser');
            }
        } catch (e) {
            // 网络错误时，若本地有缓存则继续使用本地（离线模式）
            const user = JSON.parse(saved);
            this.currentUser = user;
            this.currentUsername = user.username;
            this.onLoginSuccess(true);
            return true;
        }
        return false;
    },

    /* ---------- 登录 ---------- */
    async login(username, password) {
        if (typeof db === 'undefined' || !db) {
            return { success: false, message: '系统未就绪，请检查 Supabase 配置' };
        }
        const { data, error } = await db
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

        // 检查用户名是否已存在
        const { data: existing } = await db
            .from('students')
            .select('username')
            .eq('username', username.trim())
            .single();

        if (existing) {
            return { success: false, message: '用户名已存在，请换一个' };
        }

        // 插入新学生
        const { error } = await db
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
        // 同步最后一次进度
        if (typeof StudyTracker !== 'undefined') {
            StudyTracker._syncNow(false);
        }
        this.currentUser = null;
        this.currentUsername = null;
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
        document.getElementById('navUserRole').textContent = user.role === 'teacher' ? '教师' : '学生';
        document.getElementById('navUserRole').className = 'nav-role ' + user.role;

        // 从云端加载进度到本地
        this.loadProgress();
        // 启动学习时长追踪
        if (typeof StudyTracker !== 'undefined') {
            StudyTracker.init();
        }
        // 刷新页面
        App.go('home');
        App.updateProgress();

        if (!silent) {
            App.toast(`欢迎回来，${user.display_name || user.username}！`, 'success');
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
        if (!this.currentUsername) return;

        // 1. 同步写 localStorage（兼容现有 Storage 模块）
        const all = JSON.parse(localStorage.getItem('sec_progress') || '{}');
        all[this.currentUsername] = progress;
        localStorage.setItem('sec_progress', JSON.stringify(all));

        // 2. 异步写 Supabase
        this._syncToCloud(progress);
    },

    /* ---------- 异步同步进度到云端 ---------- */
    async _syncToCloud(progress) {
        if (!this.currentUsername || !db) return;
        try {
            const totalCorrect = Object.values(progress.quizScores || {})
                .reduce((sum, s) => sum + (s.correct || 0), 0);
            const totalQuestions = Object.values(progress.quizScores || {})
                .reduce((sum, s) => sum + (s.total || 0), 0);

            const { error } = await db
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
        if (!this.currentUsername || !db) return;
        const now = new Date().toISOString();
        try {
            await db.from('study_progress')
                .upsert([{
                    username: this.currentUsername,
                    last_login: now,
                    last_update: now
                }], { onConflict: 'username' });
        } catch (e) { /* 静默 */ }
    },

    /* ---------- 从云端加载进度到本地 ---------- */
    async loadProgress() {
        if (!this.currentUsername || !db) return;
        try {
            const { data, error } = await db
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
        if (!this.currentUsername || !db) return;
        try {
            await db.from('quiz_records').insert([{
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

        const { data, error } = await db.from('students')
            .select('password_hash').eq('username', this.currentUsername).single();
        if (error || !data || data.password_hash !== oldPwd) {
            App.toast('当前密码错误', 'error'); return;
        }
        const { error: updateError } = await db.from('students')
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

    /* ---------- 跳转教师后台 ---------- */
    goTeacher() {
        if (this.currentUser && this.currentUser.role === 'teacher') {
            window.location.href = 'teacher.html';
        } else {
            App.toast('仅教师账号可进入管理后台', 'error');
        }
    }
};
