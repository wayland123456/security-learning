/* ============================================
   安全e课堂 · Supabase 配置文件
   ============================================

   使用前请修改下面的 URL 和 ANON_KEY 为你自己的 Supabase 项目密钥。

   获取步骤：
   1. 访问 https://supabase.com 注册并创建新项目
   2. 进入项目 Settings → API
   3. 复制 "Project URL" 和 "anon public" key 填入下方
   4. 在 SQL Editor 中执行 sql/schema.sql 创建表结构
   ============================================ */

const SUPABASE_URL = 'https://rfwpwpfhbgfuydsfzibp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K52rr3BWo7P3av_R3bAILA_WA9JGkv7';

// 初始化 Supabase 客户端（用 db 命名避免和 window.supabase SDK 冲突）
let db;
try {
    if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
        db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('[Supabase] 初始化成功');
    } else {
        console.error('[Supabase] SDK 未加载！请检查 index.html 中是否引入 supabase-js CDN');
    }
} catch (e) {
    console.error('[Supabase] 初始化失败：', e);
}
