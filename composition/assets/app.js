/* ====================================================================
 * 高考英语作文智能批阅 · 教师端 · 业务脚本
 * --------------------------------------------------------------------
 * 两种题型，各自独立评分标准（五档制）：
 *   applied      应用文写作  15 分（13-15 / 10-12 / 7-9 / 4-6 / 0-3）
 *   continuation 读后续写    25 分（21-25 / 16-20 / 11-15 / 6-10 / 0-5）
 * 模式：mock（演示）/ live（通义直连）/ edge（Supabase 函数，部署推荐）
 * ==================================================================== */

const $ = (id) => document.getElementById(id);

/* ====================================================================
 * 全局状态
 * ==================================================================== */
const state = {
  step: 0,  // 0 = 落地页（入口选择） / 1-3 = 批改流程
  essayType: 'applied',  // applied = 应用文 15 分 / continuation = 读后续写 25 分
  images: { question: [], essay: [] },   // [{ id, dataUrl, name }]
  ocr: { question: '', essay: '', confirmed: false },
  edits: { question: '', essay: '' },
  score: null,            // { total, maxScore, tier, dimensions, deductions, ... }
  meta: { school: '', student: '', title: '', createdAt: null },
  config: {
    dashKey: '',                                       // 本地直连备用（留空则不出现在前端）
    ocrModel: 'qwen-vl-ocr',
    scoreModel: 'qwen-plus',                           // 默认 qwen3-plus（DashScope 模型名 qwen-plus）
    cozeUrl: 'https://www.coze.cn/store/agent/7681303617945075747?bot_id=true',
    edgeUrl: 'https://gqlwspxcyhjtzhikcexj.supabase.co/functions/v1',
    edgeAnonKey: 'sb_publishable_PqN5m9yOrWZzBazFjO7Y_w_pfIMO1PI', // 英语网站项目 publishable key（公开可放前端）
    edgeVerified: false,                               // 启动时 ping 函数验通
    mode: 'edge'                                       // 默认走 Supabase 代理（Key 只在服务器）；后端不可用时自动回落 mock
  },
  auth: { user: null, token: '', exp: 0, guest: false, student: false },  // student = 学生自助（凭班级口令）
  studentPass: ''   // 学生班级口令（存 localStorage，仅用于放行）
};

/* ====================================================================
 * 教师登录（2026-11-11 安全改造）
 * --------------------------------------------------------------------
 * 校验全部在服务端（Supabase Edge Function `login`）：账号密码对了才签发
 * 一枚 8 小时有效的 JWT，其它函数只认这枚令牌。
 *
 * 为什么必须这样：publishable key 天生要公开在网页里，谁按 F12 都能看到。
 * 旧版把它当"通行证"，等于把接口白送给所有人 —— 拿到源码就能刷模型 token。
 * 现在前端代码里没有任何能换到调用权的东西：签名密钥只在 Supabase Secrets，
 * 前端伪造不了、也猜不出。
 *
 * 令牌存 localStorage（8 小时过期），关闭页面不丢；公用电脑用完请点「退出」。
 * ==================================================================== */
const AUTH_KEY = 'composition_platform_session_v1';
const STUDENT_PASS_KEY = 'composition_student_pass_v1';
/* 免登录：平台自带的班级口令。口令只用于放行批改请求，
   DashScope 的 Key 始终只在 Supabase Secrets 里，前端不出现。 */
const CLASS_PASS = 'jiangxia2026';
const CONFIG_KEY = 'composition_platform_config_v1';

/* 设置持久化：Key / 模式 / 模型选择存本机，刷新后不用重填。
   注意：这是「本机自用」的定位，Key 在浏览器里可被 F12 看到；
   要对外发布必须走 Edge 模式，Key 放 Supabase Secrets。 */
function loadConfig() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null'); } catch (e) { o = null; }
  if (!o) return;
  if (o.dashKey) state.config.dashKey = o.dashKey;
  if (o.ocrModel) state.config.ocrModel = o.ocrModel;
  if (o.scoreModel) state.config.scoreModel = o.scoreModel;
  if (o.edgeUrl) state.config.edgeUrl = o.edgeUrl;
  if (o.edgeAnonKey) state.config.edgeAnonKey = o.edgeAnonKey;
  if (o.cozeUrl) state.config.cozeUrl = o.cozeUrl;
  if (o.mode) state.config.mode = o.mode;
  // 防呆：模式需要的凭据缺失就回落 Mock，免得一打开就报错
  if (state.config.mode === 'live' && !state.config.dashKey) state.config.mode = 'mock';
  if (state.config.mode === 'edge' && (!state.config.edgeUrl || !state.config.edgeAnonKey)) state.config.mode = 'mock';
}

function saveConfig() {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      dashKey: state.config.dashKey || '',
      ocrModel: state.config.ocrModel,
      scoreModel: state.config.scoreModel,
      edgeUrl: state.config.edgeUrl || '',
      edgeAnonKey: state.config.edgeAnonKey || '',
      cozeUrl: state.config.cozeUrl || '',
      mode: state.config.mode
    }));
  } catch (e) {}
}
let pendingStep = 0;   // 登录成功后要去的步骤

/* 读取本地会话（过期自动失效） */
function readAuth() {
  try {
    const o = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
    if (!o || !o.token || !o.account || !o.exp) return null;
    if (o.exp * 1000 <= Date.now()) { localStorage.removeItem(AUTH_KEY); return null; }
    return o;
  } catch (e) { return null; }
}

function writeAuth(session) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

/* 顶栏显示 / 隐藏教师身份 */
function syncAuthUI() {
  const u = state.auth.user;
  const chip = $('teacherChip');
  const out = $('btnLogout');
  const chg = $('btnChangePwd');
  if (chip) {
    chip.hidden = !u;
    const nameEl = $('teacherName');
    if (nameEl && u) nameEl.textContent = u.name;
  }
  if (out) out.hidden = !u;
  if (chg) chg.hidden = !u;
}

function openLogin(step) {
  pendingStep = step || 1;
  $('loginAccount').value = '';
  $('loginPassword').value = '';
  $('loginError').hidden = true;
  $('loginModal').hidden = false;
  setTimeout(() => { try { $('loginAccount').focus(); } catch (e) {} }, 60);
}

function closeLogin() {
  $('loginModal').hidden = true;
}

function showLoginError(msg) {
  const err = $('loginError');
  err.textContent = msg;
  err.hidden = false;
}

/* 登录：请求服务端校验，拿回令牌 */
async function doLogin() {
  const account = $('loginAccount').value.trim();
  const pwd = $('loginPassword').value;
  const btn = $('btnDoLogin');

  if (!account || !pwd) {
    showLoginError('请输入账号和密码');
    return;
  }

  const oldText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '验证中…'; }
  try {
    const resp = await fetchWithRetry(edgeBase() + '/login', {
      method: 'POST',
      headers: {
        'apikey': state.config.edgeAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ account: account, password: pwd })
    });
    const json = await resp.json().catch(() => ({}));

    if (!resp.ok || !json.token) {
      if (resp.status === 429 || resp.status === 401 || resp.status === 400) {
        showLoginError(json.error || '账号或密码不正确');
      } else {
        showLoginError('登录服务暂时不可用（' + resp.status + '）：' +
          (json.error || '请稍后重试，或联系管理员检查 Supabase 是否被暂停'));
      }
      $('loginPassword').value = '';
      try { $('loginPassword').focus(); } catch (e) {}
      return;
    }

    const session = {
      account: json.account,
      name: json.name,
      token: json.token,
      exp: json.exp
    };
    state.auth.user = { account: session.account, name: session.name };
    state.auth.token = session.token;
    state.auth.exp = session.exp;
    state.auth.guest = false;
    writeAuth(session);
    syncAuthUI();
    $('loginError').hidden = true;
    closeLogin();
    flashToast('✅ 欢迎回来，' + session.name + '老师');
    goStep(pendingStep || 1);
  } catch (e) {
    showLoginError('网络连不上服务器，已自动重试 3 次。请等 10 秒左右再点一次——连续猛点反而更容易被拦截；或换个网络（Wi-Fi 和流量互换）。');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = oldText || '登 录'; }
  }
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  state.auth.user = null;
  state.auth.token = '';
  state.auth.exp = 0;
  state.auth.guest = false;
  syncAuthUI();
  goStep(0);
  flashToast('已退出登录');
}

/* 令牌失效统一处理：清掉本地会话，弹出登录框 */
function handleExpired(message) {
  // 免登录模式：只提示，不弹登录框
  if (state.auth.student && state.studentPass) {
    flashToast('⚠️ ' + (message || '批改服务暂时不可用，请联系老师'));
    return;
  }
  localStorage.removeItem(AUTH_KEY);
  state.auth.user = null;
  state.auth.token = '';
  state.auth.exp = 0;
  syncAuthUI();
  flashToast('⚠️ ' + (message || '登录已过期，请重新登录'));
  openLogin(state.step >= 1 ? state.step : 1);
}

/* ====================================================================
 * 修改密码（登录后可用）
 * 身份由令牌决定，前端不传账号，改不了别人的密码。
 * ==================================================================== */
function openChangePwd() {
  $('cpOld').value = '';
  $('cpNew1').value = '';
  $('cpNew2').value = '';
  $('cpError').hidden = true;
  $('changePwdModal').hidden = false;
  setTimeout(() => { try { $('cpOld').focus(); } catch (e) {} }, 60);
}

function closeChangePwd() {
  $('changePwdModal').hidden = true;
}

function showCpError(msg) {
  const el = $('cpError');
  el.textContent = msg;
  el.hidden = false;
}

async function doChangePassword() {
  const oldPwd = $('cpOld').value;
  const new1 = $('cpNew1').value;
  const new2 = $('cpNew2').value;
  const btn = $('btnDoCp');

  if (!oldPwd || !new1 || !new2) { showCpError('请把三个输入框都填完'); return; }
  if (new1.length < 8) { showCpError('新密码至少 8 位'); return; }
  if (!/[A-Za-z]/.test(new1) || !/[0-9]/.test(new1)) { showCpError('新密码要同时包含字母和数字'); return; }
  if (new1 !== new2) { showCpError('两次输入的新密码不一致'); return; }
  if (new1 === oldPwd) { showCpError('新密码不能和当前密码一样'); return; }

  const oldText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '提交中…'; }
  try {
    const resp = await fetch(edgeBase() + '/change-password', {
      method: 'POST',
      headers: edgeAuth(),
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: new1 })
    });
    const json = await resp.json().catch(() => ({}));

    if (resp.ok && json.ok) {
      // 服务端返回了新令牌，直接替换本地会话，免得马上被踢
      if (json.token) {
        const session = {
          account: state.auth.user.account,
          name: state.auth.user.name,
          token: json.token,
          exp: json.exp
        };
        state.auth.token = json.token;
        state.auth.exp = json.exp;
        writeAuth(session);
      }
      closeChangePwd();
      flashToast('✅ 密码已修改，下次登录请用新密码');
      return;
    }

    const msg = json.error || ('修改失败 HTTP ' + resp.status);
    if (resp.status === 401 && msg.indexOf('当前密码') >= 0) {
      showCpError('当前密码不正确');
    } else if (resp.status === 401 || resp.status === 403) {
      closeChangePwd();
      handleExpired(msg);
    } else {
      showCpError(msg);
    }
  } catch (e) {
    showCpError('无法连接服务：' + (e.message || e));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = oldText || '确认修改'; }
  }
}

/* 带自动重试的请求：国内到 supabase 的链路时通时断，
   Failed to fetch / Load failed 这类网络错误先重试，别直接甩给老师看。
   注意：只重试网络异常，4xx/5xx 是服务器明确答复，不重试。 */
async function fetchWithRetry(url, options, attempts = 3, delays = [1200, 3000]) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, options);
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delays[i] || 1600));
      }
    }
  }
  throw lastErr || new Error('network error');
}

/* ====================================================================
 * 步骤导航
 * ==================================================================== */
function goStep(n) {
  // 除落地页外都要求已登录；guest 仅允许看分享报告（第 3 步）
  // 免登录：不再拦人。若口令失效，后端会返回 401，由 handleExpired 提示。
  if (n >= 1 && state.studentPass) state.auth.student = true;
  state.step = n;
  // 落地页时隐藏步骤指示器
  $('steps').classList.toggle('hidden-on-landing', n === 0);
  document.querySelectorAll('.step').forEach((s) => {
    const idx = +s.dataset.step;
    s.classList.toggle('active', idx === n);
    s.classList.toggle('done', idx < n && idx > 0);
  });
  document.querySelectorAll('.step-panel').forEach((p) => {
    p.classList.toggle('active', p.id === `panel-${n}`);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ====================================================================
 * 图片上传：拖拽 + 点击
 * ==================================================================== */
function setupDropzone(type) {
  const dz = $(`dropzone${type === 'question' ? 'Question' : 'Essay'}`);
  const input = $(`file${type === 'question' ? 'Question' : 'Essay'}`);
  const thumbs = $(`thumbs${type === 'question' ? 'Question' : 'Essay'}`);
  const counter = $(`${type}Count`);

  const addFiles = (files) => {
    Array.from(files).forEach((file, i) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const id = `${type}-${Date.now()}-${i}`;
        state.images[type].push({ id, dataUrl: e.target.result, name: file.name });
        renderThumbs(type);
        refreshGoStep2();
      };
      reader.readAsDataURL(file);
    });
  };

  dz.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  });

  ['dragenter', 'dragover'].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragover'); })
  );
  dz.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
}

function renderThumbs(type) {
  const thumbs = $(`thumbs${type === 'question' ? 'Question' : 'Essay'}`);
  const counter = $(`${type}Count`);
  const arr = state.images[type];
  counter.textContent = `${arr.length} 张`;
  thumbs.innerHTML = arr.map((img, i) => `
    <div class="thumb">
      <img src="${img.dataUrl}" alt="">
      <span class="idx">#${i + 1}</span>
      <button class="remove" data-id="${img.id}" data-type="${type}">✕</button>
    </div>
  `).join('');
  thumbs.querySelectorAll('.remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const t = btn.dataset.type;
      state.images[t] = state.images[t].filter((x) => x.id !== id);
      renderThumbs(t);
      refreshGoStep2();
    });
  });
}

function refreshGoStep2() {
  // 只要有作文图片即可进入下一步
  $('btnGoStep2').disabled = state.images.essay.length === 0;
}

/* ====================================================================
 * 载入示例数据（演示用）— 按当前题型给对应的英语范文
 * ==================================================================== */
const DEMO_DATA = {
  applied: {
    title: '演讲稿 · AI-assisted learning benefits me most in ______',
    question: `第一节（满分 15 分）

外教 Edward 要求同学们在课前演讲活动中，分享自己认为使用 AI 辅助学习受益最大的一门学科，并说明理由。请你以 "AI-assisted learning benefits me most in ______" 为题写一篇演讲稿。

注意：
(1) 写作词数应为 80 左右；
(2) 请按如下格式在答题卡的相应位置作答。

AI-assisted learning benefits me most in ______`,
    essay: `AI-assisted learning benefits me most in math

Good morning, everyone! Today I'd like to share how AI helps me with math. Math used to be my weakest subject, and I often got stuck for hours. Now, whenever I am stuck, I turn to an AI tutor. It never gives me the answer directly. Instead, it asks me questions and leads me step by step until I work it out myself. Thanks to it, I have learned how to think, not just how to calculate. AI is truly a helpful learning partner. Thank you!`
  },
  continuation: {
    title: '读后续写 · 雨中寻回走失的小狗',
    question: `阅读下面材料，根据其内容和所给段落开头语续写两段，使之构成一篇完整的短文。

It was a cold afternoon in late autumn. When I got home from school, the door was open and Mocha, our three-year-old dog, was nowhere to be found. My mother was standing in the yard, her face pale. "He slipped out when I was carrying the groceries in," she said, her voice shaking. "I've looked everywhere."

Mocha had been with us since I was nine. He waited for me at the bus stop every single day. Without him, the house felt like an empty shell. I grabbed my coat and rushed out, my mother calling after me to take an umbrella. Dark clouds were gathering over the roofs.

Paragraph 1: I searched every corner of the neighbourhood, calling his name again and again.
Paragraph 2: When I finally pushed open the door, wet and exhausted, I heard a familiar sound.

注意：1. 所续写短文的词数应为 150 左右；2. 至少使用 5 个短文中标有下划线的关键词语（本材料已简化）；3. 续写部分分为两段，每段的开头语已为你写好。`,
    essay: `I searched every corner of the neighbourhood, calling his name again and again. The rain began to fall, first a few drops, then a heavy curtain of water. My shoes were soaked and my voice had gone hoarse. I asked an old man walking his dog, I looked under every parked car, I even checked the drain by the corner shop. Nothing. With every empty street, my heart sank a little lower. I began to tell myself that he was gone forever, that someone had taken him away. Just as I turned to go home, I heard a faint whimper from behind a pile of cardboard boxes near the bakery. I rushed over and pulled the boxes apart. There he was, trembling and muddy, his left front paw hurt.

When I finally pushed open the door, wet and exhausted, I heard a familiar sound. Mocha gave a weak bark and tried to stand up, wagging his tail although his whole body was shaking. My mother burst into tears and wrapped him in a warm towel. That night, sitting on the floor beside his basket, I watched him sleep and understood something I had never really felt before: a home is not made of walls, but of the ones who wait for you inside them. From then on, I always closed the door carefully — and Mocha never had to look for his way back again.`
  }
};

function loadDemo() {
  const type = state.essayType || 'applied';
  const demo = DEMO_DATA[type];
  state.images.question = [];
  state.images.essay = [];
  renderThumbs('question');
  renderThumbs('essay');
  $('essayTitle').value = demo.title;
  $('studentName').value = '';

  state.ocr.question = demo.question;
  state.ocr.essay = demo.essay;

  alert(`已载入${type === 'applied' ? '应用文' : '读后续写'}示例：${demo.title}。\n点击「下一步」可跳过 OCR 直接进入编辑评分。`);
  state.ocr.confirmed = true;
  $('ocrQuestion').value = state.ocr.question;
  $('ocrEssay').value = state.ocr.essay;
  refreshGoStep2();
  goStep(2);
}

/* ====================================================================
 * 通义千问 DashScope HTTP 调用（纯 HTTPS，国内直连，无需 WebSocket）
 * ====================================================================
 * 识别：qwen-vl-ocr（手写识别），评分：qwen-max / qwen-plus。
 * 走阿里云百炼兼容 OpenAI 格式 REST 接口。
 * -------------------------------------------------------------------- */
const DASH_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

// 鉴权头：DashScope 用 Bearer token，与讯飞三件套完全不同
function dashAuth() {
  const key = state.config.dashKey;
  if (!key) throw new Error('请先在【设置】里填入通义千问 API Key（sk- 开头）');
  return { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };
}

/* ====================================================================
 * Supabase Edge Function 代理调用（部署后默认走这条）
 * 不暴露 DashScope Key，前端只带 anon key（公开 key，无风险）
 * ==================================================================== */
function edgeBase() {
  const url = (state.config.edgeUrl || '').replace(/\/+$/, '');
  if (!url) throw new Error('请先在【设置】里填写 Supabase Function 地址，例如 https://xxxx.supabase.co/functions/v1');
  return url;
}
function edgeAuth() {
  const k = state.config.edgeAnonKey;
  if (!k) throw new Error('请先在【设置】里填写 Supabase publishable key（sb_publishable_ 开头）');
  const headers = { 'apikey': k, 'Content-Type': 'application/json' };
  // apikey 只用于让网关放行，真正的通行证是登录后拿到的教师令牌
  if (state.auth.token) headers['Authorization'] = 'Bearer ' + state.auth.token;
  // 学生自助：没登录就用班级口令通过后端 verifyTeacherOrStudent
  else if (state.studentPass) headers['x-student-pass'] = state.studentPass;
  return headers;
}

async function edgeOcr(dataUrl) {
  const resp = await fetchWithRetry(edgeBase() + '/ocr-en', {
    method: 'POST',
    headers: edgeAuth(),
    body: JSON.stringify({ image: dataUrl })
  });
  const json = await resp.json().catch(() => ({}));
  if (resp.status === 401 || resp.status === 403) {
    handleExpired(json.error);
    throw new Error(json.error || '登录已过期，请重新登录');
  }
  if (!resp.ok) throw new Error('Edge OCR ' + resp.status + '：' + (json.error || JSON.stringify(json).slice(0, 200)));
  if (!json.text) throw new Error('OCR 未识别出文字：' + JSON.stringify(json).slice(0, 200));
  return json.text;
}

/* 把后端 / 模型返回统一成前端渲染用的结构 */
function normalizeScore(json, type) {
  const t = (json.type || type || 'applied') === 'continuation' ? 'continuation' : 'applied';
  const em = ESSAY_META[t];
  const normIssues = (json.issues || []).map((it) => {
    if (typeof it === 'string') return { title: '问题', body: it, gain: '' };
    return { title: it.title || '问题', body: it.body || '', gain: it.gain || '' };
  });
  const normSuggestions = (json.suggestions || []).map((s) => {
    if (typeof s === 'string') return { title: '建议', body: s, aiFix: '' };
    return { title: s.title || '建议', body: s.body || String(s), aiFix: s.aiFix || '' };
  });
  return {
    type: t,
    maxScore: Number(json.maxScore) || em.max,
    total: Number(json.total) || 0,
    tier: json.tier || '未评定',
    tierIndex: Number(json.tierIndex) || 0,
    tierReason: json.tierReason || json.summary || '',
    dimensions: json.dimensions || json.dimension_scores || [],
    deductions: json.deductions || [],
    summary: json.summary || '',
    highlights: json.highlights || [],
    polishExamples: json.polish_examples || json.polishExamples || [],
    gainPlan: json.gain_plan || json.gainPlan || [],
    issues: normIssues,
    suggestions: normSuggestions
  };
}

async function edgeScore(title, content, question, type) {
  const resp = await fetchWithRetry(edgeBase() + '/score-en', {
    method: 'POST',
    headers: edgeAuth(),
    body: JSON.stringify({ title, content, question, essayType: type })
  });
  const json = await resp.json().catch(() => ({}));
  if (resp.status === 401 || resp.status === 403) {
    handleExpired(json.error);
    throw new Error(json.error || '登录已过期，请重新登录');
  }
  if (!resp.ok) throw new Error('Edge Score ' + resp.status + '：' + (json.error || JSON.stringify(json).slice(0, 200)));

  return normalizeScore(json, type);
}

async function edgeTest() {
  // 用 OCR 函数发一张 1x1 透明 PNG，看返回
  const tinyPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const resp = await fetchWithRetry(edgeBase() + '/ocr-en', {
    method: 'POST',
    headers: edgeAuth(),
    body: JSON.stringify({ image: tinyPng })
  });
  const text = await resp.text();
  return resp.ok
    ? '✅ Edge Function 连接成功（HTTP ' + resp.status + '）'
    : '❌ Edge Function 异常（HTTP ' + resp.status + '）：' + text.slice(0, 200);
}

// 单图识别：qwen-vl-ocr 直接读图回文字
async function dashOcr(dataUrl) {
  const model = state.config.ocrModel || 'qwen-vl-ocr';
  const body = {
    model: model,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: '请识别这张图片中的全部文字（含手写中文），保持原文顺序和段落换行。图片如果是作文就输出作文正文，如果是试题就输出题目。只输出文字本身，不要任何解释或前缀。' }
      ]
    }],
    max_tokens: 3000
  };
  const resp = await fetch(DASH_URL, {
    method: 'POST', headers: dashAuth(), body: JSON.stringify(body)
  });
  const json = await resp.json();
  if (json.error) throw new Error('OCR 接口错误：' + (json.error.message || JSON.stringify(json.error)));
  const text = (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '';
  return String(text).trim();
}

// 评分：qwen-plus（DashScope 模型名 qwen-plus）按对应题型五档标准出 JSON
async function dashScore(title, content, question, type) {
  const model = state.config.scoreModel || 'qwen-plus';
  const prompt = buildPrompt(type, title, content, question);
  const body = {
    model: model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 4096
  };
  const resp = await fetch(DASH_URL, {
    method: 'POST', headers: dashAuth(), body: JSON.stringify(body)
  });
  const json = await resp.json();
  if (json.error) throw new Error('评分接口错误：' + (json.error.message || JSON.stringify(json.error)));
  let text = (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '';
  text = String(text).replace(/```json|```/g, '').trim();
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('评分 JSON 解析失败，原文: ' + text.slice(0, 300));
  return normalizeScore(JSON.parse(text.slice(start, end + 1)), type);
}

// 一键自检：验证 Key 是否有效（用 qwen-turbo 最快）
async function dashTest() {
  const body = {
    model: 'qwen-turbo',
    messages: [{ role: 'user', content: '只回复两个字：正常' }],
    max_tokens: 10
  };
  const resp = await fetch(DASH_URL, {
    method: 'POST', headers: dashAuth(), body: JSON.stringify(body)
  });
  const json = await resp.json();
  if (json.error) throw new Error('Key 无效：' + (json.error.message || JSON.stringify(json.error)));
  const t = (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '';
  return '✅ 通义千问连接成功，模型返回：' + String(t).trim();
}

/* ====================================================================
 * OCR 识别：mock / live（直连 DashScope）/ edge（Supabase Function 代理）
 * ==================================================================== */
async function ocrRecognize(type) {
  const imgs = state.images[type];
  if (imgs.length === 0) return '';

  const mode = state.config.mode;

  if (mode === 'mock') {
    await new Promise((r) => setTimeout(r, 1500));
    if (type === 'essay') return state.ocr.essay || '';
    if (type === 'question') return state.ocr.question || '';
    return '';
  }

  if (mode === 'edge') {
    let allText = '';
    for (const img of imgs) {
      allText += (await edgeOcr(img.dataUrl)) + '\n';
    }
    return allText.trim();
  }

  if (mode === 'live') {
    // 真实通义千问 OCR：每张图独立调用，结果拼接
    let allText = '';
    for (const img of imgs) {
      allText += (await dashOcr(img.dataUrl)) + '\n';
    }
    return allText.trim();
  }

  return '';
}

/* ====================================================================
 * 评分标准（两套，各自独立，五档制硬边界）
 * --------------------------------------------------------------------
 * 应用文：15 分 · 五档 13-15 / 10-12 / 7-9 / 4-6 / 0-3
 * 读后续写：25 分 · 五档 21-25 / 16-20 / 11-15 / 6-10 / 0-5
 * ==================================================================== */

const RUBRIC_APPLIED = `【高考英语应用文写作 15 分 · 五档评分标准】

【第五档 13–15 分】完全完成试题规定的任务
· 覆盖全部内容要点，并有适当的细节扩展
· 词汇和语法结构多样、准确，仅有个别不影响理解的小错
· 格式规范（书信有称呼与落款，通知有标题与署名），语域得体
· 行文连贯，衔接手段自然，完全达到交际目的

【第四档 10–12 分】较好完成试题规定的任务
· 覆盖主要要点，个别次要要点缺失
· 词汇语法基本准确，少量错误但不影响理解
· 格式基本正确，连贯性较好

【第三档 7–9 分】基本完成试题规定的任务
· 遗漏部分要点，或要点表述不清
· 词汇语法错误较多，但基本能表达意思
· 格式有缺漏，连贯性一般

【第二档 4–6 分】未恰当完成试题规定的任务
· 只覆盖少数要点，或要点严重偏离
· 语言错误多，影响理解
· 格式错误明显，缺乏连贯

【第一档 0–3 分】未完成试题规定的任务
· 跑题、抄袭题干、只写零散词句、或基本无法理解
· 空白卷 0 分

【硬性扣分规则（必须执行，并在 deductions 中逐条列出）】
1. 词数：少于 60 词或多于 100 词 → 扣 2 分（本题 80 左右，70–100 都在安全区）
2. 书写：影响交际的降一个整档（是整档，不是扣一两分）
3. 拼写与标点：按对交际的影响程度扣分；英美拼写均可，同篇不要混用
4. 语言错误密度：主谓不一致、时态错乱、固定搭配错误、高频词拼写错误，累计每 3 处 → 降一档

【四项采分点 + 语言连贯（合计满分 15）】
· ① 学科 2 分：标题填了学科、开头点明是哪一门；标题空着或通篇不说学科 → 0 分
· ② 做法 4 分：要有一次具体经历——哪次、什么场景、AI 具体做了什么；通篇只写 useful / better / helpful → 最多 1 分
· ③ 受益 4 分：原来怎样 → 现在怎样，要写出可验证的变化；只说「很有帮助」→ 最多 2 分
· ④ 收束 2 分：称呼 + 致谢 + 一句留得住的话；写完就停笔、没有演讲意识 → 0–1 分
· ⑤ 语言连贯 3 分：一处以上复杂句式、连接词得当、无影响理解的错误
（本题是 AI 演讲稿。若换用书信、通知等题目，「学科」按「事由 / 身份」理解，「做法」按「具体安排」理解，「受益」按「目的达成」理解，五个维度名称和分值不变）`;

const RUBRIC_CONTINUATION = `【高考英语读后续写 25 分 · 五档评分标准】

【第五档 21–25 分】与原文高度衔接，情节与语言俱佳
· 情节与原文逻辑严密衔接，人物性格、时空线索一致，有合理起伏与冲突解决
· 词汇语法丰富准确，句式多样（含非谓语、定语从句、倒装、强调等高级结构）
· 有具体的动作、心理、环境细节描写，画面感强
· 两段之间过渡自然，结尾有情感升华或主题收束
· 两段合计约 150 词

【第四档 16–20 分】衔接较好，情节合理
· 情节与原文基本一致，逻辑通顺，但起伏不足或细节较少
· 语言表达较准确，有一定句式变化，少量错误
· 有细节但不够生动，结尾有一定收束

【第三档 11–15 分】基本衔接，情节尚可
· 情节能与原文勉强衔接，存在小的逻辑跳跃
· 词汇语法错误较多，句式单一
· 细节描写薄弱，结尾平淡或无升华

【第二档 6–10 分】衔接差，情节平淡
· 情节与原文脱节，或平铺直叙无起伏
· 语言错误多，影响理解
· 几乎没有细节描写

【第一档 0–5 分】与原文脱节或无法理解
· 跑题、抄袭原文、只写零散词句、或基本无法理解
· 空白卷 0 分

【硬性扣分规则（必须执行，并在 deductions 中逐条列出）】
1. 情节断层 / 人物性格崩塌（人设与原文矛盾）/ 明显逻辑矛盾 → 直接降 2 档
2. 只写一段，或两段严重失衡（一段明显过短）→ 扣 5–8 分
3. 未接续所给段落开头语、或大段照抄原文 → 降档处理
3. 词数：两段合计不足 100 词 → 直接降一档；150 词左右为佳，超出不扣分
5. 时态混乱（叙事主体时态不一致，过去时与现在时随意切换）→ 降一档

【冲满分三条件（给 21 分以上必须逐条说明是否满足）】
① 高级句式：非谓语动词、定语从句、倒装、强调句、独立主格等至少 3 处
② 细节描写：动作 / 心理 / 环境描写具体可感
③ 结尾升华：结尾有情感或主题的升华，且不生硬

【维度拆分（合计满分 25）】
· 情节逻辑 8 分：与原文衔接、情节合理性、有无断层与矛盾
· 语言表达 8 分：词汇准确丰富、句式多样与高级结构使用
· 衔接连贯 5 分：两段之间与段内的过渡、指代与连接
· 结尾升华 4 分：结尾是否收束主题、有情感深度`;

/* 统一输出 JSON 结构（两套共用，只按题型替换满分、维度名与高档线） */
const SCHEMA_BLOCK = `【输出 JSON 格式】（只输出一个 JSON 对象，禁止任何前后缀解释或 Markdown 代码块）
{
  "type": "$TYPE",
  "maxScore": $MAX,
  "tier": "<档位全称，如：第五档（13-15分）>",
  "tierIndex": <5 到 1 的整数>,
  "total": <总分 0-$MAX，已含硬性扣分>,
  "tierReason": "<100-200 字。先说明判为这一档的依据（对照五档描述的哪几条），再说明为什么不是上一档、为什么不是下一档。总分高于 $HIGHLINE 时必须逐条说明为何够高档>",
  "dimensions": [
    $DIMENSIONS
  ],
  "deductions": [
    {"item": "<扣分项，如：缺④收束（没有致谢）>", "points": <负数，如 -2>}
  ],
  "summary": "<一句话核心评价，30-60 字，给学生看的>",
  "highlights": ["<亮点1>", "<亮点2>", "<亮点3>"],
  "polish_examples": [
    {
      "original": "<学生原文原句，必须能在原文中找到>",
      "issue": "<这句的具体毛病，10-25 字>",
      "polished": "<升格示范：英语原句 + 中文说明，换上就能用>",
      "technique": "<改写手法，如：非谓语作状语 / 定语从句 / 倒装 / 细节描写>",
      "gain": "<换上可多得几分，如 +1~2 分>"
    }
  ],
  "gain_plan": [
    {"step": 1, "task": "<具体修改动作>", "expected": "<预期提分，如 +2~3 分>", "difficulty": "简单/中等/困难"}
  ],
  "issues": [
    {"title": "<问题小标题>", "body": "<问题描述，含原文例证>", "gain": "<修好可多得几分>"}
  ],
  "suggestions": ["<可操作短建议1>", "<建议2>", "<建议3>"]
}`;

const DIMS_APPLIED = `{"name":"学科","score":0,"max":2,"reason":"<标题是否填了学科、开头是否点明哪一门>"},
    {"name":"做法","score":0,"max":4,"reason":"<有没有一次具体经历：哪次、什么场景、AI 具体做了什么>"},
    {"name":"受益","score":0,"max":4,"reason":"<原来怎样→现在怎样，变化是否可验证>"},
    {"name":"收束","score":0,"max":2,"reason":"<称呼、致谢、收尾金句与演讲意识>"},
    {"name":"语言连贯","score":0,"max":3,"reason":"<复杂句式有无、连接词是否得当、有无影响理解的错误>"}`;

const DIMS_CONTINUATION = `{"name":"情节逻辑","score":0,"max":8,"reason":"<与原文衔接、情节合理性>"},
    {"name":"语言表达","score":0,"max":8,"reason":"<词汇与句式，指出高级结构有无>"},
    {"name":"衔接连贯","score":0,"max":5,"reason":"<两段过渡与段内衔接>"},
    {"name":"结尾升华","score":0,"max":4,"reason":"<结尾是否收束主题>"}`;

/* 题型元数据：满分 / 名称 / 字数要求 */
const ESSAY_META = {
  applied: { name: '应用文写作', max: 15, high: 13, words: '约 80 词', dims: DIMS_APPLIED },
  continuation: { name: '读后续写', max: 25, high: 20, words: '约 150 词', dims: DIMS_CONTINUATION }
};

/* 由题型拼出完整评分 prompt */
function buildPrompt(type, title, content, question) {
  const t = type === 'continuation' ? 'continuation' : 'applied';
  const m = ESSAY_META[t];
  const rubric = t === 'applied' ? RUBRIC_APPLIED : RUBRIC_CONTINUATION;
  const schema = SCHEMA_BLOCK
    .replace(/\$TYPE/g, t)
    .replace(/\$MAX/g, String(m.max))
    .replace(/\$HIGHLINE/g, String(m.high))
    .replace('$DIMENSIONS', m.dims);

  const role = t === 'applied'
    ? '你是一位资深高考英语阅卷老师，常年参与应用文写作阅卷（15 分制）。'
    : '你是一位资深高考英语阅卷老师，常年参与读后续写阅卷（25 分制）。';

  return `${role}请严格按下面的【评分标准】给学生的这篇作文打分。

${rubric}

【给分纪律（比标准本身更重要，必须遵守）】
1. 先把学生原文完整读一遍（含拼写、标点、分段），再动笔评分，不许边看边猜。
2. 五档是硬边界：只能给档内的分数，档内最多 ±1 分浮动，绝对不许跨档给分。
   例如应用文判第四档（10-12），就只能给 10/11/12 分，不能给 13 分。
3. 拿不准档次时，一律往下压一档 —— 给低了可以解释，给高了改不回来。
4. 总分必须等于 dimensions 各项之和，再叠加 deductions 里的扣分；算不通就重算。
5. 总分高于 ${m.high} 分时，tierReason 必须逐条说明为什么够高档，否则退回下一档。
6. 引用原文必须真实存在，不许编造学生没写过的句子。
7. 升格示范要给「换上就能用」的英语原句，不许写"可考虑使用更高级的词汇"这类空话。

${schema}

【作文题目 / 要求】
${question || title || '（未提供，按通用标准评）'}

【学生作文原文】
${content}`;
}

/* ====================================================================
 * 评分：mock / live / edge
 * ==================================================================== */
async function scoreEssay(title, content, question, type) {
  const mode = state.config.mode;
  const t = (type || state.essayType || 'applied') === 'continuation' ? 'continuation' : 'applied';

  if (mode === 'mock') {
    await new Promise((r) => setTimeout(r, 1500));
    return MOCK_SCORES[t];
  }

  if (mode === 'edge') {
    return await edgeScore(title, content, question, t);
  }

  if (mode === 'live') {
    return await dashScore(title, content, question, t);
  }

  return MOCK_SCORES[t];
}

/* 演示数据：两种题型各一套，结构与真实返回完全一致 */
const MOCK_SCORES = {
  applied: {
    type: 'applied',
    maxScore: 15,
    tier: '第五档（13-15分）',
    tierIndex: 5,
    total: 13,
    tierReason: '四项采分点全部落地：标题与首句双重点明学科（math），做法写出了「卡住→问 AI→它反问→我自己解出来」的完整过程，受益落到了「学会思考而不只是会算」这一层，收尾有称呼、致谢与一句留得住的话，语言连贯，故判第五档。为什么不是第四档：本文不只是罗列 AI 好用，而是有可复述的过程与可验证的变化，符合第五档「覆盖全部要点、表达清楚合理」的要求。为什么不到 14–15 分：做法仍是「每当我卡住」的常态描述，缺一次具体到「哪次作业、哪道题」的经历；高级结构只有 whenever 与 until 两处从句，未达到第五档所要求的「较多复杂高级语法」。',
    dimensions: [
      { name: '学科', score: 2, max: 2, reason: '标题直接填了 math，首句 "how AI helps me with math" 再点一次，学科信息两处明确，满分。' },
      { name: '做法', score: 3, max: 4, reason: '写出了完整过程：stuck → turn to an AI tutor → it asks me questions → leads me step by step → I work it out myself，具体且可信。扣 1 分的原因：以 "whenever I am stuck" 起头是常态描述，缺一次「哪次、什么场景」的具体经历。' },
      { name: '受益', score: 4, max: 4, reason: '"Math used to be my weakest subject, and I often got stuck for hours" 交代原来；"I have learned how to think, not just how to calculate" 交代现在，前后变化清晰且落在思维方式上，超出「提分」这一层，满分。' },
      { name: '收束', score: 2, max: 2, reason: 'Good morning, everyone 有称呼，Today I would like to share 有演讲引入，Thank you! 有致谢，中间 "AI is truly a helpful learning partner" 是一句能被记住的话，演讲意识完整。' },
      { name: '语言连贯', score: 2, max: 3, reason: '连接手段自然（Now / Instead / Thanks to it），有 whenever 与 until 两处从句，无影响理解的错误。扣 1 分：全文以简单句为主，无非谓语、定语从句、倒装等高级结构，句式层次偏平。' }
    ],
    deductions: [],
    summary: '采分点齐全的一篇演讲稿：学科点得明，做法有过程，受益写出了思维方式的变化，只在「具体到哪一次」和高级句式上还差一口气。',
    highlights: [
      '标题与首句双重点明学科，学科分拿满',
      '受益写到「学会思考而不只是会算」，比只说提分高一档',
      '有称呼、有致谢，演讲意识完整'
    ],
    polishExamples: [
      {
        original: 'Math used to be my weakest subject, and I often got stuck for hours.',
        issue: '「原来」交代得偏平，缺画面感',
        polished: 'Math used to be the subject I dreaded most, and a single problem could trap me at my desk for hours. （the subject I dreaded most 定语从句替代 weakest，trap me at my desk 给具体场景，为后文「变化」做反差）',
        technique: '定语从句 + 具体化动词',
        gain: '+1 分'
      },
      {
        original: 'It never gives me the answer directly. Instead, it asks me questions and leads me step by step until I work it out myself.',
        issue: '两个短句可合并，句式偏碎',
        polished: 'Instead of handing me the answer, it fires questions at me, nudging me forward one step at a time until the solution clicks. （Instead of 介词短语 + 分词状语 nudging，把两个短句并成一句，节奏更紧）',
        technique: '介词短语 + 现在分词作状语',
        gain: '+1~2 分'
      },
      {
        original: 'AI is truly a helpful learning partner.',
        issue: '收尾句是泛词堆砌，留不住',
        polished: 'AI is not a crutch that carries me, but a partner that teaches me to stand on my own. （not...but 对举 + 两个定语从句，把「受益」再抬一层）',
        technique: 'not...but 对举 + 定语从句',
        gain: '+1 分'
      }
    ],
    gainPlan: [
      { step: 1, task: '把「做法」补成一次具体经历：哪次作业、哪道题、AI 当时反问了你什么', expected: '+1 分', difficulty: '中等' },
      { step: 2, task: '把结尾句换成 not...but 对举句，替掉 helpful learning partner', expected: '+1 分', difficulty: '简单' },
      { step: 3, task: '至少加一处非谓语作状语或定语从句，把简单句合并', expected: '+1 分', difficulty: '中等' },
      { step: 4, task: '受益部分补一个可验证的细节（如月考从多少分到多少分、能独立做完哪类题）', expected: '+0.5~1 分', difficulty: '中等' }
    ],
    issues: [
      { title: '「做法」停在常态，缺一次具体经历', body: '"whenever I am stuck, I turn to an AI tutor" 说的是习惯，不是经历。阅卷老师看不到「哪一次、什么题、AI 具体怎么问」，做法分只能给到 3 分。', gain: '+1 分' },
      { title: '「受益」的可验证性还可以再落一层', body: '"learned how to think" 已经比多数同学高，但仍停在自我评价，没有分数、题型或具体能力作证据。', gain: '+0.5~1 分' },
      { title: '句式层次偏平', body: '全文 8 句中有 5 句是简单句，只有 whenever 与 until 两处从句，没有非谓语或倒装，语言连贯分被压在 2 分。', gain: '+1 分' }
    ],
    suggestions: [
      '「做法」栏位一定要写「一次」：哪次作业、哪道题、AI 具体做了什么',
      '「受益」栏位写变化：原来卡多久、现在能自己走到哪一步',
      '收尾别用 helpful / useful / good 这类泛词，换一句能被记住的话',
      '时间够就把两个短句合成一个带分词或从句的长句，一篇有两处就够'
    ]
  },
  continuation: {
    type: 'continuation',
    maxScore: 25,
    tier: '第四档（16-20分）',
    tierIndex: 4,
    total: 18,
    tierReason: '两段均严格接续所给开头语，情节与原文（狗走失、雨天寻找）衔接自然，人物情绪线索完整，符合第四档「衔接较好、情节合理」的描述。语言上有 trembling and muddy、burst into tears 等较生动的表达，但高级句式偏少，仅有一处定语从句与一处让步状语从句，未达到第五档要求的「句式多样、细节充分」。结尾"a home is not made of walls"有升华意识，但略突兀。故给 18 分，不进第五档，也不下压至第三档。',
    dimensions: [
      { name: '情节逻辑', score: 6, max: 8, reason: '寻狗—失望—听到叫声—找到受伤的狗，逻辑链完整；但第一段转折稍快，从"turn to go home"到听见声音之间缺少过渡。' },
      { name: '语言表达', score: 6, max: 8, reason: '有 a heavy curtain of water、voice had gone hoarse、trembling and muddy 等好表达；高级结构仅 2 处，非谓语与倒装使用不足。' },
      { name: '衔接连贯', score: 4, max: 5, reason: '两段之间用 When I finally pushed open the door 自然承接，段内用 Just as / From then on 衔接，整体顺畅。' },
      { name: '结尾升华', score: 2, max: 4, reason: '结尾点出"家不是墙，而是等你回来的人"，有升华意识，但与"狗"的关系稍显跳脱，可更贴合。' }
    ],
    deductions: [],
    summary: '情节完整、情绪线清晰的一篇续写，描写有一定画面感，但高级句式与细节密度不足，离高分档还差一口气。',
    highlights: ['情节与原文衔接紧密', '环境描写有画面感（a heavy curtain of water）', '结尾有主题升华意识'],
    polishExamples: [
      {
        original: 'The rain began to fall, first a few drops, then a heavy curtain of water.',
        issue: '比喻不错，但可再加感官细节',
        polished: 'The rain came down, first a few hesitant drops, then a heavy curtain of water that drummed on the rooftops and soaked through my coat within seconds. （加 hesitant 拟人 + that 定语从句 + 动作细节）',
        technique: '拟人 + 定语从句 + 感官细节',
        gain: '+1 分'
      },
      {
        original: 'Just as I turned to go home, I heard a faint whimper from behind a pile of cardboard boxes near the bakery.',
        issue: '转折前缺少情绪铺垫，显得突然',
        polished: 'Just as I turned to go home, my hope almost gone, a faint whimper cut through the rain from behind a pile of cardboard boxes near the bakery. （插入独立主格 my hope almost gone，并让声音"cut through the rain"）',
        technique: '独立主格 + 动词化表达',
        gain: '+1~2 分'
      },
      {
        original: 'That night, sitting on the floor beside his basket, I watched him sleep and understood something I had never really felt before.',
        issue: '结尾升华略抽象，与狗的联系不够紧',
        polished: 'That night, sitting on the cold floor beside his basket, I watched his chest rise and fall and finally understood: home is not the walls we live in, but the small, warm weight that waits for us at the door. （用 rise and fall 细节 + 冒号引出升华，落到"重量"这一具体意象）',
        technique: '细节动作 + 冒号升华 + 具体意象',
        gain: '+2 分'
      }
    ],
    gainPlan: [
      { step: 1, task: '在第一段"失望"处补一句心理描写（如 my hope almost gone）', expected: '+1~2 分', difficulty: '简单' },
      { step: 2, task: '把 2 处简单句改成非谓语或定语从句开头', expected: '+1~2 分', difficulty: '中等' },
      { step: 3, task: '结尾把抽象的"家"落到具体意象（气味、重量、声音）', expected: '+1~2 分', difficulty: '中等' },
      { step: 4, task: '补充一处环境描写呼应开头的雨天（雨停、屋檐滴水）', expected: '+1 分', difficulty: '简单' }
    ],
    issues: [
      { title: '高级句式偏少', body: '全文可识别的非谓语仅 "trembling and muddy" 一处，无倒装、无独立主格，句式以主谓宾为主，卡住了语言分。', gain: '+2 分' },
      { title: '转折处情绪跳跃', body: '"I began to tell myself that he was gone forever" 到 "Just as I turned" 之间缺少情绪过渡，读者会觉得找得太轻松。', gain: '+1 分' },
      { title: '结尾升华与情节贴合度不够', body: '结尾落在"家不是墙"，但前文重心是"寻找"，升华方向可以更快回到"他等我/我等他"的双向守护。', gain: '+1~2 分' }
    ],
    suggestions: [
      '续写前先给两段各写一句"情绪坐标"：这一段主角的情绪从 A 到 B',
      '每段至少嵌入一个非谓语开头（Walking along..., Exhausted and soaked...）',
      '结尾升华要用前文出现过的具体物象，不要凭空讲道理'
    ]
  }
};


/* ====================================================================
 * 报告渲染
 * ==================================================================== */
function renderReport(score, meta, essayText, essayTitle) {
  const root = $('reportCard');
  const type = score.type || state.essayType || 'applied';
  const em = ESSAY_META[type] || ESSAY_META.applied;
  const maxScore = Number(score.maxScore) || em.max;
  const total = Number(score.total) || 0;

  // ============== 维度细评 ==============
  const dims = score.dimensions || score.dimensionScores || [];
  const dimHtml = dims.length
    ? `
      <div class="report-section">
        <h4>🎯 维度细评（${type === 'applied' ? '四项采分点 12 分 + 语言连贯 3 分' : '情节 / 语言 / 衔接 / 升华'}，合计满分 ${maxScore}）</h4>
        <div class="dim-grid">
          ${dims.map((d) => {
            const mx = Number(d.max || 0) || 1;
            const pct = Math.max(0, Math.min(100, Math.round((Number(d.score || 0) / mx) * 100)));
            const isLow = pct < 60;
            return `
              <div class="dim-row ${isLow ? 'dim-low' : ''}">
                <div class="dim-name">${escapeHtml(d.name)}</div>
                <div class="dim-bar"><div class="dim-fill" style="width:${pct}%"></div></div>
                <div class="dim-pts">${d.score}<span class="dim-max">/${d.max}</span></div>
              </div>
              ${d.reason ? `<div class="dim-reason">${escapeHtml(d.reason)}</div>` : ''}
            `;
          }).join('')}
        </div>
      </div>
    `
    : '';

  // ============== 扣分明细 ==============
  const deds = score.deductions || [];
  const totalDeduct = deds.reduce((s, d) => s + Number(d.points || 0), 0);
  const dedHtml = deds.length
    ? `
      <div class="report-section">
        <h4>➖ 扣分明细（合计 ${totalDeduct} 分）</h4>
        <div class="deduct-list">
          ${deds.map((d) => `
            <div class="deduct-row">
              <span class="deduct-item">${escapeHtml(d.item)}</span>
              <span class="deduct-pts">${Number(d.points) || 0}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `
    : `
      <div class="report-section">
        <h4>➖ 扣分明细</h4>
        <p class="hint">无硬性扣分项。</p>
      </div>
    `;

  // ============== 升格示范 ==============
  const polish = score.polishExamples || score.polish_examples || [];
  const polishHtml = polish.length
    ? `
      <div class="report-section">
        <h4>✍ 原文升格示范（照着换就行）</h4>
        <p class="hint" style="margin-bottom:14px;">从原文挑出最值得改的句子。<b style="color:var(--accent);">${polish.length}</b> 处范例，改完预计提分 <b style="color:var(--accent);">+${polish.reduce((s, p) => s + (Number(String(p.gain || '').match(/\d+/)?.[0]) || 0), 0)} 分</b>。</p>
        <div class="polish-list">
          ${polish.map((p, idx) => `
            <div class="polish-card">
              <div class="polish-head">
                <span class="polish-num">改写 ${idx + 1}</span>
                ${p.gain ? `<span class="polish-gain">💰 ${escapeHtml(p.gain)}</span>` : ''}
              </div>
              <div class="polish-original">
                <span class="po-label">原文</span>
                <div class="po-text">${escapeHtml(p.original)}</div>
              </div>
              <div class="polish-issue">
                ⚠ <b>问题</b>：${escapeHtml(p.issue || '—')}
              </div>
              <div class="polish-fixed">
                <span class="po-label po-label-fix">升格</span>
                <div class="po-text po-text-fix">${escapeHtml(p.polished)}</div>
              </div>
              ${p.technique ? `<div class="polish-tech">🔧 <b>改写手法</b>：${escapeHtml(p.technique)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `
    : '';

  // ============== 提分路径 ==============
  const plan = score.gainPlan || score.gain_plan || [];
  const planHtml = plan.length
    ? `
      <div class="report-section">
        <h4>🚀 提分路径（按性价比从高到低）</h4>
        <p class="hint">挑 1-2 个简单的先改，能立刻见效。</p>
        <div class="gain-plan">
          ${plan.map((g) => `
            <div class="gain-step">
              <div class="gain-step-num">STEP ${g.step}</div>
              <div class="gain-step-body">
                <div class="gain-task">${escapeHtml(g.task)}</div>
                <div class="gain-meta">
                  ${g.expected ? `<span class="gain-expected">📈 ${escapeHtml(g.expected)}</span>` : ''}
                  ${g.difficulty ? `<span class="gain-difficulty gain-difficulty-${escapeHtml(g.difficulty)}">难度：${escapeHtml(g.difficulty)}</span>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
    : '';

  // ============== 问题诊断 ==============
  const issues = score.issues || [];
  const issuesHtml = issues.length
    ? `
      <div class="report-section">
        <h4>🔍 主要问题诊断</h4>
        <div class="suggestion-list">
          ${issues.map((it) => `
            <div class="suggestion-item">
              <div class="si-head">
                <div class="si-title">⚠ ${escapeHtml(it.title || '问题')}</div>
                ${it.gain ? `<span class="si-tag">${escapeHtml(it.gain)}</span>` : ''}
              </div>
              <div class="si-body">${escapeHtml(it.body || (typeof it === 'string' ? it : ''))}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `
    : '';

  // ============== 一句话评价 + 亮点 ==============
  const summaryHtml = (score.summary || (score.highlights && score.highlights.length))
    ? `
      <div class="report-section">
        <h4>📌 一句话评价与亮点</h4>
        ${score.summary ? `<div class="summary-quote">${escapeHtml(score.summary)}</div>` : ''}
        ${score.highlights && score.highlights.length ? `
          <div class="highlights">
            ${score.highlights.map((h) => `<span class="highlight-tag">✨ ${escapeHtml(h)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `
    : '';

  root.innerHTML = `
    <div class="report-head">
      <h3>${escapeHtml(em.name)}批改报告<span class="type-badge">${escapeHtml(em.name)} · ${maxScore} 分</span></h3>
      <div class="report-meta">
        <span>🏫 学校：<b>${escapeHtml(meta.school || '—')}</b></span>
        <span>👤 学生：<b>${escapeHtml(meta.student || '—')}</b></span>
        ${meta.teacher ? `<span>🧑‍🏫 批改教师：<b>${escapeHtml(meta.teacher)}</b></span>` : ''}
        <span>📅 批改时间：<b>${formatDate(meta.createdAt)}</b></span>
      </div>
    </div>

    <div class="score-overview">
      <div class="score-big">
        <div class="total">${total}<small>/${maxScore}</small></div>
        <div class="tier">${escapeHtml(score.tier || '未评定')}</div>
      </div>
      <div class="score-breakdown">
        <div class="score-row basic">
          <div>
            <div class="name">档位判定依据</div>
            <div class="reason">${escapeHtml(score.tierReason || '—')}</div>
          </div>
        </div>
      </div>
    </div>

    ${summaryHtml}
    ${dimHtml}
    ${dedHtml}
    ${polishHtml}
    ${planHtml}
    ${issuesHtml}

    <div class="report-section">
      <h4>📝 题目 / 要求</h4>
      <div class="essay-text">${escapeHtml($('ocrQuestion').value.trim() || essayTitle || meta.title || '未提供')}</div>
    </div>

    <div class="report-section">
      <h4>📄 修正识别误差后的作文原文</h4>
      <div class="essay-text">${escapeHtml(essayText)}</div>
    </div>

    <div class="report-section" style="text-align:center;font-size:12px;color:var(--text-3);background:#fafbfd;">
      📊 报告生成时间：${formatDate(new Date())} · 评分标准：高考英语${escapeHtml(em.name)}五档评分标准 · 驱动：${driverLabel()}
    </div>
  `;
  root.hidden = false;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d) {
  if (!d) return '—';
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

// 驱动说明：按当前运行模式显示真实后端，避免误导
function driverLabel() {
  if (state.config.mode === 'mock') return 'Mock 模拟（未接大模型）';
  if (state.config.mode === 'live') return '通义千问直连';
  if (state.config.mode === 'edge') return '通义千问（Edge 代理）';
  return '通义千问';
}

/* ====================================================================
 * Word 报告生成（docx-js）
 * ==================================================================== */
async function downloadWord() {
  if (!state.score) {
    alert('请先完成评分');
    return;
  }
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = window.docx;
  const score = state.score;
  const meta = state.meta;
  const essayText = $('ocrEssay').value.trim();
  const questionText = $('ocrQuestion').value.trim();
  const essayTitle = $('essayTitle').value.trim() || meta.title || '未命名';
  const type = score.type || state.essayType || 'applied';
  const em = ESSAY_META[type] || ESSAY_META.applied;
  const maxScore = Number(score.maxScore) || em.max;

  const children = [];

  // 标题
  children.push(new Paragraph({
    text: `高考英语${em.name}批改报告`,
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 }
  }));

  // 元数据
  const metaInfo = [
    `学校：${meta.school || '—'}`,
    `学生：${meta.student || '—'}`,
    meta.teacher ? `批改教师：${meta.teacher}` : '',
    `批改时间：${formatDate(meta.createdAt)}`
  ].filter(Boolean).join('    ');
  children.push(new Paragraph({
    children: [new TextRun({ text: metaInfo, size: 20, color: '666666' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    border: { bottom: { color: '1E3A8A', size: 6, style: BorderStyle.SINGLE, space: 4 } }
  }));

  // 总分
  children.push(new Paragraph({
    children: [
      new TextRun({ text: '得分：', size: 32 }),
      new TextRun({ text: `${score.total}`, size: 48, bold: true, color: 'F59E0B' }),
      new TextRun({ text: ` / ${maxScore}`, size: 32, color: '999999' }),
      new TextRun({ text: `    ${score.tier || ''}`, size: 24, color: 'F59E0B' })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 }
  }));

  // 一、档位判定依据
  children.push(new Paragraph({ text: '一、档位判定依据', heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }));
  children.push(new Paragraph({
    children: [new TextRun({ text: score.tierReason || '—', size: 22 })],
    spacing: { after: 200 }
  }));

  // 二、维度细评
  children.push(new Paragraph({ text: '二、维度细评', heading: HeadingLevel.HEADING_2, spacing: { after: 100, before: 200 } }));
  (score.dimensions || score.dimensionScores || []).forEach((d) => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${d.name}：`, bold: true, size: 24 }),
        new TextRun({ text: `${d.score} / ${d.max}`, bold: true, color: '1E3A8A', size: 24 })
      ],
      spacing: { before: 100, after: 60 }
    }));
    if (d.reason) {
      children.push(new Paragraph({
        children: [new TextRun({ text: d.reason, size: 22 })],
        spacing: { after: 100 }, indent: { left: 200 }
      }));
    }
  });

  // 三、扣分明细
  const deds = score.deductions || [];
  children.push(new Paragraph({ text: '三、扣分明细', heading: HeadingLevel.HEADING_2, spacing: { after: 100, before: 200 } }));
  if (deds.length) {
    deds.forEach((d, i) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. ${d.item}  `, size: 22 }),
          new TextRun({ text: `${d.points} 分`, bold: true, color: 'DC2626', size: 22 })
        ],
        spacing: { after: 80 }, indent: { left: 200 }
      }));
    });
  } else {
    children.push(new Paragraph({
      children: [new TextRun({ text: '无硬性扣分项。', size: 22, color: '999999' })],
      spacing: { after: 100 }
    }));
  }

  // 四、原文升格示范
  const polish = score.polishExamples || score.polish_examples || [];
  children.push(new Paragraph({ text: '四、原文升格示范', heading: HeadingLevel.HEADING_2, spacing: { after: 100, before: 200 } }));
  if (polish.length) {
    polish.forEach((p, i) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `改写 ${i + 1}`, bold: true, color: '1E3A8A', size: 24 }),
          p.gain ? new TextRun({ text: `    💰 ${p.gain}`, color: 'F59E0B', bold: true, size: 22 }) : new TextRun('')
        ],
        spacing: { before: 150, after: 80 }
      }));
      children.push(new Paragraph({
        children: [
          new TextRun({ text: '【原文】', bold: true, color: 'DC2626', size: 20 }),
          new TextRun({ text: p.original, size: 22 })
        ],
        spacing: { after: 60 }, indent: { left: 200 }
      }));
      if (p.issue) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: '【问题】', bold: true, color: 'F59E0B', size: 20 }),
            new TextRun({ text: p.issue, size: 22 })
          ],
          spacing: { after: 60 }, indent: { left: 200 }
        }));
      }
      children.push(new Paragraph({
        children: [
          new TextRun({ text: '【升格】', bold: true, color: '10B981', size: 20 }),
          new TextRun({ text: p.polished, size: 22 })
        ],
        spacing: { after: 60 }, indent: { left: 200 }
      }));
      if (p.technique) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: '【改写手法】', bold: true, color: '1E3A8A', size: 20 }),
            new TextRun({ text: p.technique, size: 22 })
          ],
          spacing: { after: 200 }, indent: { left: 200 }
        }));
      }
    });
  } else {
    children.push(new Paragraph({
      children: [new TextRun({ text: '（无）', size: 22, color: '999999' })],
      spacing: { after: 100 }
    }));
  }

  // 五、提分路径
  const plan = score.gainPlan || score.gain_plan || [];
  children.push(new Paragraph({ text: '五、提分路径（按性价比从高到低）', heading: HeadingLevel.HEADING_2, spacing: { after: 100, before: 200 } }));
  plan.forEach((g) => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `STEP ${g.step}  `, bold: true, color: 'F59E0B', size: 24 }),
        new TextRun({ text: g.task, size: 22, bold: true })
      ],
      spacing: { before: 100, after: 60 }
    }));
    const parts = [];
    if (g.expected) parts.push('📈 ' + g.expected);
    if (g.difficulty) parts.push('难度：' + g.difficulty);
    if (parts.length) {
      children.push(new Paragraph({
        children: [new TextRun({ text: parts.join('    '), size: 20, color: '10B981' })],
        spacing: { after: 150 }, indent: { left: 200 }
      }));
    }
  });

  // 六、主要问题诊断
  children.push(new Paragraph({ text: '六、主要问题诊断', heading: HeadingLevel.HEADING_2, spacing: { after: 100, before: 200 } }));
  (score.issues || []).forEach((it, i) => {
    const title = typeof it === 'string' ? `问题 ${i + 1}` : (it.title || `问题 ${i + 1}`);
    const body = typeof it === 'string' ? it : (it.body || '');
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${i + 1}. ${title}`, bold: true, size: 24 }),
        (it && it.gain) ? new TextRun({ text: `    ${it.gain}`, color: 'F59E0B', size: 22 }) : new TextRun('')
      ],
      spacing: { before: 100, after: 60 }
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: body, size: 22 })],
      spacing: { after: 150 }, indent: { left: 200 }
    }));
  });

  // 七、题目 / 要求
  children.push(new Paragraph({ text: '七、题目 / 要求', heading: HeadingLevel.HEADING_2, spacing: { after: 100, before: 200 } }));
  (questionText || essayTitle).split(/\n+/).forEach((para) => {
    if (!para.trim()) return;
    children.push(new Paragraph({
      children: [new TextRun({ text: para.trim(), size: 22 })],
      spacing: { after: 100 }
    }));
  });

  // 八、作文原文
  children.push(new Paragraph({ text: '八、修正识别误差后的作文原文', heading: HeadingLevel.HEADING_2, spacing: { after: 100, before: 200 } }));
  essayText.split(/\n+/).forEach((para) => {
    if (!para.trim()) return;
    children.push(new Paragraph({
      children: [new TextRun({ text: para.trim(), size: 22 })],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120, line: 360 }
    }));
  });

  // 页脚
  children.push(new Paragraph({
    children: [new TextRun({ text: '—— 报告生成时间：' + formatDate(new Date()) + ' · 评分标准：高考英语' + em.name + '五档评分标准 · 驱动：' + driverLabel() + ' ——', size: 18, color: '999999' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 }
  }));

  const doc = new Document({
    creator: '高考英语作文智能批阅',
    title: `${meta.student || '学生'}_${em.name}批改报告`,
    sections: [{
      properties: { page: { margin: { top: 1000, right: 1200, bottom: 1000, left: 1200 } } },
      children
    }]
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${meta.student || '学生'}_${em.name}_${score.total}分_${formatDate(new Date()).split(' ')[0]}.docx`;
  saveAs(blob, filename);
}

/* ====================================================================
 * 报告分享（把报告数据 gzip 打包进链接，同事手机点开即可查看）
 * ==================================================================== */
function u8ToBase64(u8) {
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}
function base64ToU8(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function toB64Url(b64) { return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function fromB64Url(s) {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return b64;
}

// 生成可分享链接：把报告数据存到 Supabase，链接只带 8 位短 ID（不再受字数限制）
async function shareReport() {
  if (!state.score) { flashToast('⚠️ 请先完成批改再分享'); return; }
  const essayText = ($('ocrEssay') && $('ocrEssay').value.trim()) || (state.edits && state.edits.essay) || '';
  const title = ($('essayTitle') && $('essayTitle').value.trim()) || (state.meta && state.meta.title) || '';
  const question = ($('ocrQuestion') && $('ocrQuestion').value.trim()) || '';
  const payload = {
    v: 1,
    score: state.score,
    meta: state.meta,
    essayText: essayText,
    essayTitle: title,
    question: question
  };

  const btn = $('btnShareReport');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 生成链接中…'; }
  try {
    // 存报告到 Supabase Edge Function，返回短 ID
    const resp = await fetchWithRetry(edgeBase() + '/report', {
      method: 'POST',
      headers: edgeAuth(),
      body: JSON.stringify({ data: payload })
    });
    const json = await resp.json().catch(() => ({}));
    if (resp.status === 401 || resp.status === 403) {
      handleExpired(json.error);
      throw new Error(json.error || '登录已过期，请重新登录');
    }
    if (!resp.ok || !json.id) {
      throw new Error(json.error || ('存储失败 HTTP ' + resp.status));
    }
    const link = location.origin + location.pathname + '?r=' + json.id;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(link);
      flashToast('✅ 报告链接已复制（' + link.length + ' 字符），发给同事即可查看');
    } else {
      prompt('复制以下链接发给同事：', link);
    }
  } catch (e) {
    console.error('分享失败', e);
    flashToast('⚠️ 分享失败：' + (e.message || e) + '（若反复失败，请确认已部署 report 函数）');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 分享报告'; }
  }
}

// 从链接加载分享的报告并渲染
// 兼容两种链接：短 ID（走 Supabase 查询）和旧版 base64 长链接（本地解析）
async function loadSharedReport() {
  const m = location.search.match(/[?&]r=([^&]+)/);
  if (!m) return false;
  const raw = decodeURIComponent(m[1]);
  let data;

  // 短 ID（6~16 位字母数字）→ 走 Supabase
  if (/^[A-Za-z0-9]{6,16}$/.test(raw)) {
    try {
      const resp = await fetch(edgeBase() + '/report?id=' + encodeURIComponent(raw), {
        method: 'GET',
        headers: { apikey: (state.config.edgeAnonKey || '') }
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.data) {
        throw new Error(json.error || ('读取失败 HTTP ' + resp.status));
      }
      data = json.data;
    } catch (e) {
      console.error('读取分享报告失败', e);
      flashToast('⚠️ 报告读取失败：' + (e.message || e) + '（报告可能已失效）');
      return false;
    }
  } else {
    // 旧版 base64 长链接（向后兼容）
    try {
      const u8 = base64ToU8(fromB64Url(raw));
      let jsonStr;
      if (window.pako && window.pako.inflate) {
        jsonStr = window.pako.inflate(u8, { to: 'string' });
      } else {
        jsonStr = new TextDecoder().decode(u8);
      }
      data = JSON.parse(jsonStr);
    } catch (e) {
      console.error('分享报告解析失败', e);
      flashToast('⚠️ 报告链接无效或已损坏');
      return false;
    }
  }

  if (!data || !data.score || !data.essayText) return false;

  const meta = data.meta || {};
  state.score = data.score;
  state.meta = meta;
  state.edits = state.edits || {};
  state.edits.essay = data.essayText || '';
  state.edits.question = data.question || '';
  state.auth.guest = true;   // 看分享报告不需要教师登录

  // 回填表单，方便继续「下载 Word / 保存历史」
  if ($('schoolName')) $('schoolName').value = meta.school || '';
  if ($('studentName')) $('studentName').value = meta.student || '';
  if ($('essayTitle')) $('essayTitle').value = data.essayTitle || meta.title || '';
  if ($('ocrQuestion')) $('ocrQuestion').value = data.question || '';
  if ($('ocrEssay')) $('ocrEssay').value = data.essayText || '';
  if (typeof updateCharCount === 'function') updateCharCount();

  const title = data.essayTitle || meta.title || '';
  renderReport(data.score, meta, data.essayText, title);
  if ($('reportLoading')) $('reportLoading').hidden = true;
  goStep(3);
  flashToast('✅ 已打开分享的报告');
  return true;
}

/* ====================================================================
 * 历史记录（localStorage）
 * ==================================================================== */
const HISTORY_KEY = 'composition_platform_history_v1';

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch (e) { return []; }
}

function saveHistoryList(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function addToHistory(record) {
  const list = loadHistory();
  list.unshift(record);
  saveHistoryList(list.slice(0, 50));
  renderHistory();
}

function deleteFromHistory(id) {
  const list = loadHistory().filter((x) => x.id !== id);
  saveHistoryList(list);
  renderHistory();
}

function renderHistory() {
  const list = loadHistory();
  const root = $('historyList');
  if (list.length === 0) {
    root.innerHTML = '<div class="history-empty">暂无记录</div>';
    return;
  }
  root.innerHTML = list.map((r) => {
    const rt = (r.score && r.score.type) === 'continuation' ? 'continuation' : 'applied';
    const rm = ESSAY_META[rt];
    const rmax = (r.score && Number(r.score.maxScore)) || rm.max;
    return `
    <div class="history-item" data-id="${r.id}">
      <div class="hi-top">
        <span class="hi-name">${escapeHtml((r.meta && r.meta.student) || r.student || '未命名')}</span>
        <span class="hi-score">${Number((r.score && r.score.total) || r.total || 0)}/${rmax} 分</span>
      </div>
      <div class="hi-meta">
        <span>${escapeHtml(rm.name)}</span>
        <span>${formatDate((r.meta && r.meta.createdAt) || r.createdAt).slice(5, 16)}</span>
      </div>
      <div class="hi-meta">
        <span>${escapeHtml((r.meta && r.meta.school) || r.school || '—')}</span>
      </div>
      ${r.meta && r.meta.teacher ? `<div class="hi-teacher">🧑‍🏫 ${escapeHtml(r.meta.teacher)}</div>` : ''}
      <div class="hi-actions">
        <button data-act="view">查看</button>
        <button data-act="del">删除</button>
      </div>
    </div>
  `;
  }).join('');

  root.querySelectorAll('.history-item').forEach((item) => {
    const id = item.dataset.id;
    item.querySelector('[data-act="view"]').addEventListener('click', () => {
      const r = loadHistory().find((x) => x.id === id);
      if (!r) return;
      state.meta = r.meta;
      state.score = r.score;
      $('schoolName').value = r.meta.school || '';
      $('studentName').value = r.meta.student || '';
      $('essayTitle').value = r.meta.title || '';
      $('ocrQuestion').value = r.question || '';
      $('ocrEssay').value = r.essay || '';
      updateCharCount();
      renderReport(r.score, r.meta, r.essay, r.meta.title);
      goStep(3);
    });
    item.querySelector('[data-act="del"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('确认删除这条历史记录？')) deleteFromHistory(id);
    });
  });
}

/* ====================================================================
 * 字数统计（英语按词数）
 * ==================================================================== */
function updateCharCount() {
  const txt = $('ocrEssay').value.trim();
  const words = txt ? txt.split(/\s+/).filter(Boolean).length : 0;
  $('charCount').textContent = words;
}

/* ====================================================================
 * 题型切换（应用文 15 / 读后续写 25）
 * ==================================================================== */
function setEssayType(type) {
  state.essayType = type === 'continuation' ? 'continuation' : 'applied';
  updateTypeUI();
}

function updateTypeUI() {
  const t = state.essayType === 'continuation' ? 'continuation' : 'applied';
  document.querySelectorAll('#typeSwitch .type-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.type === t);
  });
  const hint = $('typeHint');
  if (hint) {
    hint.textContent = t === 'applied'
      ? '书信 / 通知 / 邮件等，约 80 词，五档 13-15 / 10-12 / 7-9 / 4-6 / 0-3'
      : '两段续写共约 150 词，五档 21-25 / 16-20 / 11-15 / 6-10 / 0-5';
  }
  const s3 = $('step3Hint');
  if (s3) {
    s3.textContent = t === 'applied'
      ? '应用文 15 分制 · 五档评分（13-15 / 10-12 / 7-9 / 4-6 / 0-3），含语言错误降档与词数限制规则。'
      : '读后续写 25 分制 · 五档评分（21-25 / 16-20 / 11-15 / 6-10 / 0-5），含情节断层降档、两段失衡扣分规则。';
  }
}

/* ====================================================================
 * 设置弹窗
 * ==================================================================== */
function modeLabel(mode) {
  return {
    mock: '⚙ Mock 模拟模式',
    live: '✓ 通义千问直连',
    edge: '✓ Edge 代理'
  }[mode] || mode;
}

/* 顶栏模式徽标：启动时也要刷一次，否则会一直显示 HTML 里写死的「Mock 模式」 */
function refreshApiBadge() {
  const el = $('apiStatus');
  if (!el) return;
  el.textContent = modeLabel(state.config.mode);
  el.style.background = state.config.mode === 'mock' ? '' : 'rgba(16, 185, 129, .18)';
  el.style.color = state.config.mode === 'mock' ? '' : '#10b981';
}

function openSettings() {
  $('cfgDashKey').value = state.config.dashKey || '';
  $('cfgOcrModel').value = state.config.ocrModel;
  $('cfgScoreModel').value = state.config.scoreModel;
  $('cfgCozeUrl').value = state.config.cozeUrl || '';
  $('cfgEdgeUrl').value = state.config.edgeUrl || '';
  $('cfgEdgeKey').value = state.config.edgeAnonKey || '';
  $('cfgMode').value = state.config.mode;
  $('settingsModal').hidden = false;
}
function closeSettings() {
  $('settingsModal').hidden = true;
}

/* ====================================================================
 * 学生端 Coze 入口
 * ==================================================================== */
function openCozePortal() {
  const url = state.config.cozeUrl;
  if (!url) {
    flashToast('⚠️ 暂未配置学生入口链接，请在设置中填入');
    openSettings();
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}


/* ====================================================================
 * 启动
 * ==================================================================== */

// 全局调试入口：浏览器 F12 → Console 直接调用
window.cp = {
  config: () => state.config,
  test: () => dashTest(),
  testEdge: () => edgeTest(),
  ocr: (dataUrl) => state.config.mode === 'edge' ? edgeOcr(dataUrl) : dashOcr(dataUrl),
  score: (title, content) => state.config.mode === 'edge' ? edgeScore(title, content, '') : dashScore(title, content),
  // 切换模式（控制台一行）
  setMode: (m) => { if (['mock','live','edge'].includes(m)) { state.config.mode = m; $('apiStatus').textContent = m; return 'mode=' + m; } }
};

window.addEventListener('DOMContentLoaded', () => {
  // 免登录：默认就带班级口令，老师和学生都不用登录
  try { state.studentPass = localStorage.getItem(STUDENT_PASS_KEY) || CLASS_PASS; }
  catch (e) { state.studentPass = CLASS_PASS; }
  state.auth.student = !!state.studentPass;
  // 清掉历史遗留的教师会话，避免顶栏再显示某某老师
  try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
  // 恢复上次保存的设置（Key / 模式 / 模型）
  loadConfig();

  syncAuthUI();
  refreshApiBadge();
  $('btnDoLogin').addEventListener('click', doLogin);

  // 不上传图片，直接粘贴文本进第二步（测试 Key / 电子稿批改都用得上）
  const btnPasteText = $('btnPasteText');
  if (btnPasteText) {
    btnPasteText.addEventListener('click', () => {
      state.ocr.confirmed = true;
      goStep(2);
      setTimeout(() => {
        const box = $('ocrEssay');
        if (box) { try { box.focus(); } catch (e) {} }
      }, 220);
      flashToast('把作文原文粘到下方「作文正文」框里，题目可选填');
    });
  }

  // 设置里「测试 Key 是否可用」：用输入框里刚粘贴的 Key 直接测，不必先保存
  const btnTestDash = $('btnTestDash');
  if (btnTestDash) {
    btnTestDash.addEventListener('click', async () => {
      const out = $('dashTestResult');
      const key = ($('cfgDashKey').value || '').trim();
      if (!key) {
        if (out) { out.textContent = '⚠ 请先粘贴 sk- 开头的 Key'; out.className = 'cfg-test-result err'; }
        return;
      }
      state.config.dashKey = key;
      btnTestDash.disabled = true;
      btnTestDash.textContent = '测试中…';
      if (out) { out.textContent = ''; out.className = 'cfg-test-result'; }
      try {
        const msg = await dashTest();
        if (out) { out.textContent = msg; out.className = 'cfg-test-result ok'; }
      } catch (e) {
        if (out) { out.textContent = '❌ ' + e.message; out.className = 'cfg-test-result err'; }
      } finally {
        btnTestDash.disabled = false;
        btnTestDash.textContent = '🔍 测试 Key 是否可用';
      }
    });
  }

  // 没有教师账号的学生：用班级口令进入（口令在 Supabase Secrets 的 STUDENT_PASS）
  const btnUsePass = $('btnUsePass');
  if (btnUsePass) {
    btnUsePass.addEventListener('click', () => {
      const sp = (prompt('请输入老师发给你的班级口令：\n\n（口令由老师在 Supabase 的 STUDENT_PASS 里配置；配错了会提示“未登录”。）') || '').trim();
      if (!sp) return;
      state.studentPass = sp;
      state.auth.student = true;
      try { localStorage.setItem(STUDENT_PASS_KEY, sp); } catch (e) {}
      closeLogin();
      goStep(pendingStep || 1);
      flashToast('✅ 已用班级口令进入');
    });
  }
  $('btnCancelLogin').addEventListener('click', closeLogin);
  $('btnCloseLogin').addEventListener('click', closeLogin);
  $('btnLogout').addEventListener('click', logout);
  $('btnChangePwd').addEventListener('click', openChangePwd);
  $('btnCancelCp').addEventListener('click', closeChangePwd);
  $('btnCloseCp').addEventListener('click', closeChangePwd);
  $('btnDoCp').addEventListener('click', doChangePassword);
  ['cpOld', 'cpNew1', 'cpNew2'].forEach((id) => {
    $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') doChangePassword(); });
  });
  [$('loginAccount'), $('loginPassword')].forEach((el) => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  });

  // 1. 步骤指示器可点击（落地页时不响应）
  document.querySelectorAll('.step').forEach((s) => {
    s.addEventListener('click', () => {
      const idx = +s.dataset.step;
      if (state.step === 0) return;  // 落地页时不能跳
      if (idx <= state.step || s.classList.contains('done')) goStep(idx);
    });
  });

  // 2. 上传区
  setupDropzone('question');
  setupDropzone('essay');

  // 3. 第一步按钮
  $('btnLoadDemo').addEventListener('click', loadDemo);
  $('btnGoStep2').addEventListener('click', async () => {
    $('btnGoStep2').disabled = true;
    $('btnGoStep2').textContent = '🔄 OCR 识别中...';
    try {
      // 如果已有 OCR 结果（载入示例的情况），跳过识别
      if (state.ocr.essay && state.ocr.confirmed) {
        $('ocrEssay').value = state.ocr.essay;
        $('ocrQuestion').value = state.ocr.question;
      } else {
        // 真实识别
        const [qText, eText] = await Promise.all([
          state.images.question.length ? ocrRecognize('question') : Promise.resolve(''),
          ocrRecognize('essay')
        ]);
        $('ocrQuestion').value = qText;
        $('ocrEssay').value = eText;
        state.ocr.question = qText;
        state.ocr.essay = eText;
      }

      // 渲染左侧原图
      const strip = $('imgStrip');
      const allImgs = [...state.images.question, ...state.images.essay];
      strip.innerHTML = allImgs.map((img, i) => `<img src="${img.dataUrl}" alt="原图 ${i + 1}">`).join('');

      updateCharCount();
      goStep(2);
    } catch (e) {
      alert('OCR 识别失败：' + e.message);
    } finally {
      $('btnGoStep2').disabled = false;
      $('btnGoStep2').textContent = '下一步：识别文字 →';
    }
  });

  // 4. 第二步交互
  $('ocrEssay').addEventListener('input', () => {
    updateCharCount();
    $('fixStatus').textContent = '是';
    $('ocrEssayMeta').textContent = '✓ 已修正';
    $('ocrEssayMeta').classList.add('confirmed');
  });
  $('btnBack1').addEventListener('click', () => goStep(1));
  $('btnReOcr').addEventListener('click', async () => {
    if (!confirm('重新识别将覆盖当前编辑文本，确定吗？')) return;
    $('btnReOcr').disabled = true;
    $('btnReOcr').textContent = '🔄 识别中...';
    try {
      const [qText, eText] = await Promise.all([
        state.images.question.length ? ocrRecognize('question') : Promise.resolve(''),
        ocrRecognize('essay')
      ]);
      $('ocrQuestion').value = qText;
      $('ocrEssay').value = eText;
      $('fixStatus').textContent = '否';
      $('ocrEssayMeta').textContent = 'AI 识别 · 待确认';
      $('ocrEssayMeta').classList.remove('confirmed');
      updateCharCount();
    } catch (e) {
      alert('识别失败：' + e.message);
    } finally {
      $('btnReOcr').disabled = false;
      $('btnReOcr').textContent = '🔄 重新识别';
    }
  });
  $('btnGoStep3').addEventListener('click', async () => {
    const essayText = $('ocrEssay').value.trim();
    const wordNum = essayText.split(/\s+/).filter(Boolean).length;
    if (wordNum < 15) {
      alert('作文正文过短（不足 15 词，当前约 ' + wordNum + ' 词），请检查识别结果或换成文本粘贴。');
      return;
    }
    state.edits.essay = essayText;
    state.edits.question = $('ocrQuestion').value.trim();
    state.meta = {
      school: $('schoolName').value.trim(),
      student: $('studentName').value.trim(),
      title: $('essayTitle').value.trim(),
      teacher: state.auth.user ? state.auth.user.name : '',
      createdAt: new Date()
    };

    goStep(3);
    $('reportCard').hidden = true;
    $('reportLoading').hidden = false;
    $('btnGoStep3').disabled = true;

    try {
      const question = state.edits.question || state.meta.title || '';
      const score = await scoreEssay(state.meta.title || question, essayText, question, state.essayType);
      state.score = score;
      const essayTitle = state.meta.title || extractTitle(essayText) || question;
      state.meta.title = essayTitle;
      renderReport(score, state.meta, essayText, essayTitle);
    } catch (e) {
      alert('评分失败：' + e.message);
      goStep(2);
    } finally {
      $('reportLoading').hidden = true;
      $('btnGoStep3').disabled = false;
    }
  });

  // 5. 第三步按钮
  $('btnBack2').addEventListener('click', () => goStep(2));
  $('btnDownloadWord').addEventListener('click', () => downloadWord().catch((e) => alert('生成失败：' + e.message)));
  $('btnSaveHistory').addEventListener('click', () => {
    if (!state.score) return;
    const record = {
      id: 'r_' + Date.now(),
      meta: { ...state.meta, createdAt: new Date() },
      score: state.score,
      question: state.edits.question,
      essay: state.edits.essay
    };
    addToHistory(record);
    flashToast('✅ 已保存到历史记录');
  });
  $('btnNew').addEventListener('click', () => {
    if (state.score && !confirm('开始新批改？当前页面数据将清空（已保存的不影响）。')) return;
    state.images = { question: [], essay: [] };
    state.ocr = { question: '', essay: '', confirmed: false };
    state.edits = { question: '', essay: '' };
    state.score = null;
    state.meta = { school: '', student: '', title: '', createdAt: null };
    renderThumbs('question');
    renderThumbs('essay');
    $('ocrQuestion').value = '';
    $('ocrEssay').value = '';
    $('charCount').textContent = '0';
    $('fixStatus').textContent = '否';
    $('essayTitle').value = '';
    refreshGoStep2();
    goStep(0);  // 新批改 → 回到落地页选身份
  });

  // 6.1 落地页入口
  $('btnHome').addEventListener('click', (e) => { e.preventDefault(); goStep(0); });
  // 学生入口改成 <a target="_blank">，由浏览器自然处理新窗口跳转，避开 mobile window.open 拦截
  // 落地页题型入口：点哪个就按哪套标准走
  const enterWithType = (type) => {
    setEssayType(type);
    if (!state.auth.user && state.studentPass) state.auth.student = true;
    goStep(1);
  };
  const btnApplied = $('btnPortalApplied');
  if (btnApplied) btnApplied.addEventListener('click', () => enterWithType('applied'));
  const btnCont = $('btnPortalContinuation');
  if (btnCont) btnCont.addEventListener('click', () => enterWithType('continuation'));

  // 6. 设置弹窗
  $('btnSettings').addEventListener('click', openSettings);
  $('btnCloseSettings').addEventListener('click', closeSettings);
  $('btnCancelSettings').addEventListener('click', closeSettings);
  $('btnSaveSettings').addEventListener('click', () => {
    state.config.dashKey = $('cfgDashKey').value.trim();
    state.config.ocrModel = $('cfgOcrModel').value;
    state.config.scoreModel = $('cfgScoreModel').value;
    state.config.cozeUrl = $('cfgCozeUrl').value.trim() || state.config.cozeUrl;
    state.config.edgeUrl = $('cfgEdgeUrl').value.trim();
    state.config.edgeAnonKey = $('cfgEdgeKey').value.trim();
    const wantMode = $('cfgMode').value;
    // 防呆：选了 live/edge 但没填对应 key 时给提示再回退
    if (wantMode === 'live' && !state.config.dashKey) {
      alert('选择了「通义直连」但没填 DashScope Key，已改回 Mock。');
      state.config.mode = 'mock';
    } else if (wantMode === 'edge' && (!state.config.edgeUrl || !state.config.edgeAnonKey)) {
      alert('选择了「Edge 代理」但没填 Supabase 地址/anon key，已改回 Mock。');
      state.config.mode = 'mock';
    } else {
      state.config.mode = wantMode;
    }
    $('cfgMode').value = state.config.mode;
      saveConfig();
    closeSettings();
    refreshApiBadge();
    flashToast('✅ 设置已保存，当前模式：' + modeLabel(state.config.mode));
  });

  // 报告页「分享给学生」按钮（可选，HTML 里没有就跳过）
  const shareStudentBtn = $('btnShareStudent');
  if (shareStudentBtn) {
    shareStudentBtn.addEventListener('click', async () => {
      const url = state.config.cozeUrl;
      if (!url) {
        flashToast('⚠️ 暂未配置外部学生端链接，学生入口已支持站内自助批改');
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        flashToast('✅ 链接已复制到剪贴板，发给学生吧');
      } catch (e) {
        prompt('复制以下链接发给学生：', url);
      }
    });
  }

  // 题型切换
  const typeSwitch = $('typeSwitch');
  if (typeSwitch) {
    typeSwitch.querySelectorAll('.type-btn').forEach((b) => {
      b.addEventListener('click', () => setEssayType(b.dataset.type));
    });
  }
  updateTypeUI();

  // 初始化学生端链接
  $('btnClearHistory').addEventListener('click', () => {
    if (confirm('确认清空全部历史记录？此操作不可恢复。')) {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
    }
  });

  // 7. 启动渲染
  $('btnShareReport').addEventListener('click', shareReport);
  // 若带分享链接 ?r= 则直接渲染报告；否则显示默认落地页
  loadSharedReport().then((ok) => {
    if (!ok) {
      renderHistory();
      refreshGoStep2();
      goStep(0);  // 默认显示落地页
    }
  });
});

function extractTitle(text) {
  const m = text.match(/《([^》]+)》/);
  return m ? m[1] : '';
}

function flashToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;top:80px;right:24px;background:#1e3a8a;color:#fff;padding:10px 18px;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:300;font-size:13px;animation:slideIn .3s ease;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
