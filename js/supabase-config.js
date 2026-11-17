/* ============================================
   安全e课堂 · Supabase 配置（按需加载版）

   设计要点：
   1. SDK（约 220KB）不再阻塞首屏。index.html 不再用 <script> 同步引入，
      改为第一次真正需要数据库时才动态加载（ensureDB）。
   2. 若页面已用 <script> 同步引入 SDK（如 teacher.html），
      加载本文件时立即创建 db，行为与旧版完全一致。
   3. 所有数据库调用统一走 await ensureDB()，失败时可降级到本地缓存。
   ============================================ */

const SUPABASE_URL = 'https://rfwpwpfhbgfuydsfzibp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K52rr3BWo7P3av_R3bAILA_WA9JGkv7';

// db 实例：可能为 null（SDK 尚未加载）
let db = null;

// 兼容：页面已同步引入 SDK 时，立即创建，保持旧行为
if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[Supabase] 初始化成功（同步引入）');
}

// 动态加载 SDK 的单例 Promise
let _sdkPromise = null;

/**
 * 确保 Supabase 客户端可用。
 * 首次调用会动态下载 js/supabase.js，之后复用同一个 Promise。
 * 失败时 reject，调用方自行决定降级策略。
 */
function ensureDB() {
    if (db) return Promise.resolve(db);
    if (_sdkPromise) return _sdkPromise;

    _sdkPromise = new Promise((resolve, reject) => {
        const done = () => {
            try {
                if (!window.supabase || !window.supabase.createClient) {
                    throw new Error('SDK 已加载但不可用');
                }
                db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('[Supabase] 初始化成功（按需加载）');
                resolve(db);
            } catch (e) {
                _sdkPromise = null;  // 允许下次重试
                reject(e);
            }
        };

        // 可能已被其他途径加载
        if (window.supabase && window.supabase.createClient) return done();

        const s = document.createElement('script');
        s.src = 'js/supabase.js';
        s.async = true;
        s.onload = done;
        s.onerror = () => {
            _sdkPromise = null;  // 允许下次重试
            reject(new Error('Supabase SDK 下载失败'));
        };
        document.head.appendChild(s);
    });

    return _sdkPromise;
}

/**
 * 预加载 SDK，不阻塞首屏。
 * 等页面空闲（或 delayMs 毫秒后）再下载，学生输入账号密码时通常已经就绪。
 */
function preloadSupabase(delayMs) {
    const start = () => {
        // 游客模式用不到数据库，不浪费带宽
        if (typeof Auth !== 'undefined' && Auth.isGuest) return;
        ensureDB().catch(() => {});
    };
    const delay = typeof delayMs === 'number' ? delayMs : 4000;
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => setTimeout(start, delay), { timeout: delay + 2000 });
    } else {
        setTimeout(start, delay);
    }
}
