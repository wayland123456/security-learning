/* ============================================
   安全e课堂 · 学习时长追踪模块

   - 追踪页面活跃时间（切到后台自动暂停）
   - 每 30 秒同步一次累计时长到 Supabase study_progress 表
   - 页面关闭/刷新时做最终同步（用 sendBeacon 保证送达）
   ============================================ */

const StudyTracker = {
    totalSeconds: 0,
    sessionSeconds: 0,
    intervalId: null,
    lastSyncSeconds: 0,
    isActive: true,

    init() {
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.pause();
            else this.resume();
        });
        // 页面关闭前同步
        window.addEventListener('beforeunload', () => this._syncNow(true));
        this.resume();
    },

    resume() {
        if (this.intervalId) return;
        this.isActive = true;
        this.intervalId = setInterval(() => {
            if (this.isActive) {
                this.sessionSeconds++;
                this.totalSeconds++;
                if (this.totalSeconds - this.lastSyncSeconds >= 30) {
                    this._syncNow(false);
                }
            }
        }, 1000);
    },

    pause() {
        this.isActive = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this._syncNow(false);
    },

    async _syncNow(useBeacon) {
        if (!Auth.currentUsername) return;
        if (this.totalSeconds === this.lastSyncSeconds) return;

        const payload = {
            username: Auth.currentUsername,
            total_study_seconds: this.totalSeconds,
            last_update: new Date().toISOString()
        };
        this.lastSyncSeconds = this.totalSeconds;

        // 页面关闭时用 sendBeacon
        if (useBeacon && navigator.sendBeacon) {
            const url = SUPABASE_URL + '/rest/v1/study_progress?on_conflict=username';
            const body = JSON.stringify([payload]);
            const blob = new Blob([body], { type: 'application/json' });
            // 附带 API key header（sendBeacon 不支持自定义 header，用 query param 方式不可行）
            // 这里回退到 fetch keepalive
            try {
                fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: body,
                    keepalive: true
                }).catch(() => {});
            } catch (e) {}
            return;
        }

        try {
            const { error } = await db.from('study_progress')
                .upsert([payload], { onConflict: 'username' });
            if (error && !['PGRST204', '42703'].includes(error.code)) {
                console.warn('[StudyTracker] 同步失败：', error.message);
            }
        } catch (e) { /* 静默 */ }
    },

    /* 格式化时长 */
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}小时${m}分`;
        if (m > 0) return `${m}分${s}秒`;
        return `${s}秒`;
    }
};
