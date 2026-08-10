/* ========================================
 * 安全e课堂 · 主应用逻辑
 * 模块：App(路由) | Learn(学习) | Quiz(闯关) | BlindBox(盲盒) | Scenario(情境)
 * ======================================== */

// === 进度存储（接入云端同步） ===
// 写入时若用户已登录，自动同步到 Supabase；未登录时仅写本地
const Storage = {
  get: (key, def) => { try { return JSON.parse(localStorage.getItem('sec_' + key)) ?? def; } catch { return def; } },
  set: (key, val) => {
    try { localStorage.setItem('sec_' + key, JSON.stringify(val)); } catch {}
    // 游客模式不触发云端同步
    if (typeof Auth !== 'undefined' && Auth.currentUsername && !Auth.isGuest) {
      Auth.saveProgress({
        quizScores: Storage.get('quizScores', {}),
        blindboxHighScore: Storage.get('blindboxHighScore', 0),
        scenarioCompleted: Storage.get('scenarioCompleted', []),
        learnedTopics: Storage.get('learnedTopics', [])
      });
    }
  }
};

// === 主应用：路由 ===
const App = {
  go(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.navbar-menu button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    window.scrollTo(0, 0);
    if (page === 'learn') Learn.render();
    if (page === 'quiz') Quiz.render();
    if (page === 'blindbox') BlindBox.render();
    if (page === 'scenario') Scenario.render();
  },
  toast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' toast-' + type : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  },
  // 刷新导航栏进度显示（登录后调用）
  updateProgress() {
    const scores = Storage.get('quizScores', {});
    const completed = Object.keys(scores).length;
    const totalLevels = (typeof QUIZ_DATA !== 'undefined') ? QUIZ_DATA.length : 6;
    const el = document.getElementById('navProgress');
    if (el) el.textContent = `${completed}/${totalLevels} 关`;
  }
};

// ========================================
// 模块一：学习中心
// ========================================
const Learn = {
  currentTopic: 0,
  currentScene: 0,
  animTimer: null,

  render() {
    this.renderTabs();
    this.renderTopic(this.currentTopic);
  },

  renderTabs() {
    const container = document.getElementById('learn-tabs');
    container.innerHTML = LEARN_DATA.map((t, i) =>
      `<button class="learn-tab ${i === this.currentTopic ? 'active' : ''}" onclick="Learn.selectTopic(${i})">${t.icon} ${t.title}</button>`
    ).join('');
  },

  selectTopic(i) {
    this.currentTopic = i;
    this.currentScene = 0;
    clearTimeout(this.animTimer);
    // 记录已学主题到本地 + 云端
    const learned = Storage.get('learnedTopics', []);
    if (!learned.includes(i)) {
      learned.push(i);
      Storage.set('learnedTopics', learned);
    }
    this.renderTabs();
    this.renderTopic(i);
  },

  renderTopic(i) {
    const topic = LEARN_DATA[i];
    const container = document.getElementById('learn-content');

    let html = `
      <div class="animation-stage">
        <div class="animation-header">
          <h2>${topic.icon} ${topic.title} — ${topic.subtitle}</h2>
          <div class="animation-controls">
            <button onclick="Learn.prevScene()" title="上一个">‹</button>
            <button onclick="Learn.togglePlay()" title="播放/暂停" id="play-btn">▶</button>
            <button onclick="Learn.nextScene()" title="下一个">›</button>
          </div>
        </div>
        <div class="animation-canvas" id="anim-canvas"></div>
        <div class="anim-progress">
          <div class="anim-progress-bar" id="anim-progress-bar" style="width:0%"></div>
        </div>
      </div>
      <div class="knowledge-cards">
    `;

    topic.knowledge.forEach(k => {
      html += `
        <div class="knowledge-card" style="border-left-color:${topic.color}">
          <div class="kc-title">${k.title}</div>
          <div class="kc-content">${k.content}</div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;

    this.renderScene();
  },

  renderScene() {
    const topic = LEARN_DATA[this.currentTopic];
    const scene = topic.scenes[this.currentScene];
    const canvas = document.getElementById('anim-canvas');
    if (!canvas) return;

    // 更新进度条
    const progress = ((this.currentScene + 1) / topic.scenes.length) * 100;
    document.getElementById('anim-progress-bar').style.width = progress + '%';

    // 根据场景类型渲染不同动画
    switch (scene.type) {
      case 'crack': this.renderCrackAnim(canvas, scene); break;
      case 'strength': this.renderStrengthAnim(canvas, scene); break;
      case 'email': this.renderEmailAnim(canvas, scene); break;
      case 'flow': this.renderFlowAnim(canvas, scene); break;
      case 'tips': this.renderTipsAnim(canvas, scene, topic); break;
      default: canvas.innerHTML = `<p style="text-align:center;padding:60px;color:#999">${scene.content}</p>`;
    }

    // 自动播放下一个场景
    clearTimeout(this.animTimer);
    this.animTimer = setTimeout(() => this.nextScene(), scene.duration || 6000);
  },

  // 密码破解动画
  renderCrackAnim(canvas, scene) {
    const weakPasswords = ['123456', 'password', 'qwerty', 'abc123', 'admin'];
    const pwd = weakPasswords[Math.floor(Math.random() * weakPasswords.length)];
    let display = '';
    let cracked = false;

    canvas.innerHTML = `
      <div class="crack-animation">
        <h3 style="margin-bottom:8px;">🔓 密码破解演示</h3>
        <p style="color:#666;font-size:14px;margin-bottom:16px;">黑客正在用字典攻击破解密码……</p>
        <div class="crack-display cracking" id="crack-display">******</div>
        <div id="crack-status" style="font-size:14px;color:#f59e0b;font-weight:600;">正在破解中...</div>
        <div id="crack-time" style="font-size:13px;color:#999;margin-top:8px;">耗时: 0.0秒</div>
      </div>
    `;

    let idx = 0;
    let time = 0;
    const interval = setInterval(() => {
      time += 0.1;
      if (idx < pwd.length) {
        display += pwd[idx];
        document.getElementById('crack-display').textContent = display + '*'.repeat(pwd.length - idx - 1);
        document.getElementById('crack-time').textContent = `耗时: ${time.toFixed(1)}秒`;
        idx++;
      } else {
        clearInterval(interval);
        const el = document.getElementById('crack-display');
        el.classList.remove('cracking');
        el.classList.add('cracked');
        el.textContent = pwd;
        document.getElementById('crack-status').textContent = `❌ 密码已破解！仅用 ${time.toFixed(1)} 秒`;
        document.getElementById('crack-status').style.color = '#ef4444';
      }
    }, 200);
  },

  // 密码强度对比动画
  renderStrengthAnim(canvas, scene) {
    const samples = [
      { pwd: '123456', strength: 5, label: '极弱', color: '#ef4444', time: '瞬间破解' },
      { pwd: 'zhang2010', strength: 30, label: '弱', color: '#f59e0b', time: '约2分钟' },
      { pwd: 'Zhang@2024', strength: 60, label: '中等', color: '#eab308', time: '约3天' },
      { pwd: 'T9#kM$pL2xQ!', strength: 95, label: '极强', color: '#10b981', time: '数百年' }
    ];

    canvas.innerHTML = `
      <div class="crack-animation">
        <h3 style="margin-bottom:16px;">📊 密码强度对比</h3>
        ${samples.map((s, i) => `
          <div style="margin-bottom:16px;text-align:left;opacity:0;animation:fadeIn 0.5s ease ${i * 0.3}s forwards;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <code style="font-family:monospace;font-size:14px;background:#f1f5f9;padding:2px 8px;border-radius:4px;">${s.pwd}</code>
              <span style="font-size:13px;font-weight:600;color:${s.color};">${s.label}</span>
            </div>
            <div class="strength-bar-bg">
              <div class="strength-bar-fill" style="width:0%;background:${s.color};" id="bar-${i}"></div>
            </div>
            <div style="font-size:12px;color:#999;margin-top:4px;">⏱ ${s.time}</div>
          </div>
        `).join('')}
      </div>
    `;

    samples.forEach((s, i) => {
      setTimeout(() => {
        const bar = document.getElementById('bar-' + i);
        if (bar) bar.style.width = s.strength + '%';
      }, i * 300 + 200);
    });
  },

  // 钓鱼邮件拆解动画
  renderEmailAnim(canvas, scene) {
    canvas.innerHTML = `
      <div>
        <h3 style="text-align:center;margin-bottom:16px;">📧 钓鱼邮件拆解</h3>
        <div class="phish-email-mock" style="opacity:0;animation:fadeIn 0.5s ease 0.2s forwards;">
          <div class="email-header">
            <div class="email-from">发件人: <span class="phish-highlight">service@bank-secure.com</span><span class="phish-tag">伪装域名</span></div>
            <div class="email-from" style="margin-top:4px;">主题: <span class="phish-highlight">【紧急】您的账户存在安全风险！</span><span class="phish-tag">制造紧迫感</span></div>
          </div>
          <div style="line-height:1.8;">
            <p>尊敬的客户：</p>
            <p style="margin:8px 0;">我们检测到您的账户存在异常登录，<span class="phish-highlight">请在24小时内点击下方链接验证身份</span><span class="phish-tag">限时威胁</span>，否则账户将被永久冻结。</p>
            <p style="margin:8px 0;"><span class="phish-highlight">👉 http://bank-verify.xyz/check</span><span class="phish-tag">可疑链接</span></p>
            <p style="margin:8px 0;">请输入您的<span class="phish-highlight">银行卡号、密码和验证码</span><span class="phish-tag">索取敏感信息</span>完成验证。</p>
            <p style="margin:8px 0;">如有疑问，请联系<span class="phish-highlight">客服微信：bank_service001</span><span class="phish-tag">非官方渠道</span></p>
          </div>
        </div>
        <div style="text-align:center;margin-top:16px;font-size:13px;color:#666;opacity:0;animation:fadeIn 0.5s ease 1s forwards;">
          ⚠️ 红色高亮处均为钓鱼邮件的危险信号，共发现 <strong style="color:#ef4444;">5处</strong>
        </div>
      </div>
    `;
  },

  // 信息泄露路径动画
  renderFlowAnim(canvas, scene) {
    canvas.innerHTML = `
      <div style="text-align:center;">
        <h3 style="margin-bottom:20px;">🔍 信息去哪了？</h3>
        <svg viewBox="0 0 400 280" style="max-width:100%;height:auto;">
          <!-- 中心：用户 -->
          <circle cx="200" cy="140" r="35" fill="#2563eb" opacity="0.9"/>
          <text x="200" y="135" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">你的</text>
          <text x="200" y="150" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">信息</text>

          <!-- 泄露路径 -->
          <g opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="0.3s" fill="freeze"/>
            <line x1="165" y1="125" x2="80" y2="50" stroke="#ef4444" stroke-width="2" stroke-dasharray="5,3"/>
            <rect x="20" y="25" width="120" height="40" rx="8" fill="#fee2e2" stroke="#ef4444"/>
            <text x="80" y="42" text-anchor="middle" font-size="11" fill="#991b1b" font-weight="bold">社交媒体</text>
            <text x="80" y="56" text-anchor="middle" font-size="10" fill="#991b1b">姓名/生日/照片</text>
          </g>

          <g opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="0.8s" fill="freeze"/>
            <line x1="235" y1="125" x2="320" y2="50" stroke="#f59e0b" stroke-width="2" stroke-dasharray="5,3"/>
            <rect x="260" y="25" width="120" height="40" rx="8" fill="#fef3c7" stroke="#f59e0b"/>
            <text x="320" y="42" text-anchor="middle" font-size="11" fill="#92400e" font-weight="bold">App权限</text>
            <text x="320" y="56" text-anchor="middle" font-size="10" fill="#92400e">通讯录/位置</text>
          </g>

          <g opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="1.3s" fill="freeze"/>
            <line x1="165" y1="155" x2="80" y2="230" stroke="#06b6d4" stroke-width="2" stroke-dasharray="5,3"/>
            <rect x="20" y="210" width="120" height="40" rx="8" fill="#cffafe" stroke="#06b6d4"/>
            <text x="80" y="227" text-anchor="middle" font-size="11" fill="#0e7490" font-weight="bold">公共WiFi</text>
            <text x="80" y="241" text-anchor="middle" font-size="10" fill="#0e7490">浏览记录/密码</text>
          </g>

          <g opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="1.8s" fill="freeze"/>
            <line x1="235" y1="155" x2="320" y2="230" stroke="#7c3aed" stroke-width="2" stroke-dasharray="5,3"/>
            <rect x="260" y="210" width="120" height="40" rx="8" fill="#ede9fe" stroke="#7c3aed"/>
            <text x="320" y="227" text-anchor="middle" font-size="11" fill="#5b21b6" font-weight="bold">数据泄露</text>
            <text x="320" y="241" text-anchor="middle" font-size="10" fill="#5b21b6">账户/密码泄露</text>
          </g>

          <!-- 动画粒子 -->
          <circle r="3" fill="#ef4444">
            <animateMotion dur="2s" repeatCount="indefinite" path="M165,125 L80,50"/>
            <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle r="3" fill="#f59e0b">
            <animateMotion dur="2s" repeatCount="indefinite" begin="0.5s" path="M235,125 L320,50"/>
            <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" begin="0.5s"/>
          </circle>
        </svg>
        <p style="font-size:13px;color:#666;margin-top:8px;">你的信息正通过多个渠道被收集和泄露</p>
      </div>
    `;
  },

  // 知识要点动画
  renderTipsAnim(canvas, scene, topic) {
    const tipsMap = {
      'password': [
        { icon: '✅', title: '强密码标准', text: '≥12位，含大小写字母+数字+特殊符号' },
        { icon: '❌', title: '弱密码特征', text: '纯数字、常见词、个人信息、短密码' },
        { icon: '🔐', title: '两步验证', text: '开启2FA，即使密码泄露也能防护' },
        { icon: '🗝️', title: '密码管理器', text: '用工具管理不同账户的独立密码' }
      ],
      'phishing': [
        { icon: '🔍', title: '核查域名', text: '仔细比对发件人邮箱和链接地址' },
        { icon: '⏰', title: '警惕紧迫感', text: '"24小时内冻结"多为钓鱼话术' },
        { icon: '🚫', title: '不点链接', text: '不点击邮件中的可疑链接' },
        { icon: '📞', title: '官方核实', text: '通过官方渠道独立核实' }
      ],
      'privacy': [
        { icon: '📏', title: '最小化原则', text: '只提供必要信息，能不填不填' },
        { icon: '🔒', title: '社交隐私', text: '检查社交平台隐私设置' },
        { icon: '📱', title: '权限管理', text: '定期清理App不必要的权限' },
        { icon: '📶', title: '公共WiFi', text: '不在公共WiFi下操作敏感业务' }
      ],
      'malware': [
        { icon: '🛡️', title: '安装杀毒', text: '安装并更新杀毒软件' },
        { icon: '📥', title: '正规下载', text: '只从官方渠道下载软件' },
        { icon: '🔄', title: '及时更新', text: '安装系统安全补丁' },
        { icon: '💾', title: '数据备份', text: '遵循3-2-1备份原则' }
      ],
      'social': [
        { icon: '👤', title: '核实身份', text: '通过独立渠道验证对方身份' },
        { icon: '😰', title: '保持冷静', text: '不被紧迫感话术影响判断' },
        { icon: '🤐', title: '不泄露信息', text: '不向不明身份者提供敏感信息' },
        { icon: '🤝', title: '二次确认', text: '涉及转账等操作务必确认' }
      ],
      'mobile': [
        { icon: '📲', title: '官方商店', text: '只从官方应用商店下载App' },
        { icon: '🔋', title: '充电安全', text: '不用公共USB，用自己的充电头' },
        { icon: '🔑', title: '验证码保护', text: '验证码绝不告诉任何人' },
        { icon: '🔄', title: '系统更新', text: '及时安装手机系统更新' }
      ]
    };

    const tips = tipsMap[topic.id] || [];

    canvas.innerHTML = `
      <div style="text-align:center;">
        <h3 style="margin-bottom:20px;">${topic.icon} ${scene.title}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:left;">
          ${tips.map((t, i) => `
            <div style="background:#f8fafc;border-radius:8px;padding:16px;border-left:3px solid ${topic.color};opacity:0;transform:translateY(10px);animation:fadeIn 0.5s ease ${i * 0.2}s forwards;">
              <div style="font-size:24px;margin-bottom:4px;">${t.icon}</div>
              <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${t.title}</div>
              <div style="font-size:13px;color:#64748b;line-height:1.5;">${t.text}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  nextScene() {
    const topic = LEARN_DATA[this.currentTopic];
    this.currentScene = (this.currentScene + 1) % topic.scenes.length;
    this.renderScene();
  },

  prevScene() {
    const topic = LEARN_DATA[this.currentTopic];
    this.currentScene = (this.currentScene - 1 + topic.scenes.length) % topic.scenes.length;
    clearTimeout(this.animTimer);
    this.renderScene();
  },

  togglePlay() {
    const btn = document.getElementById('play-btn');
    if (this.animTimer) {
      clearTimeout(this.animTimer);
      this.animTimer = null;
      btn.textContent = '▶';
    } else {
      this.nextScene();
      btn.textContent = '⏸';
    }
  }
};

// ========================================
// 模块二：闯关挑战
// ========================================
const Quiz = {
  state: {
    currentLevel: 0,
    currentQuestion: 0,
    score: 0,
    selectedOptions: [],
    answered: false,
    levelScores: Storage.get('quizScores', {}),
    mode: 'map' // 'map' | 'playing' | 'result' | 'total'
  },

  render() {
    if (this.state.mode === 'map') this.renderMap();
    else if (this.state.mode === 'playing') this.renderQuestion();
    else if (this.state.mode === 'result') this.renderLevelResult();
    else if (this.state.mode === 'total') this.renderTotalResult();
  },

  renderMap() {
    const container = document.getElementById('quiz-container');
    const scores = this.state.levelScores;

    let totalStars = 0;
    let completedLevels = 0;

    container.innerHTML = `
      <div style="text-align:center;margin-bottom:24px;">
        <p style="color:#64748b;font-size:15px;">通过前一关解锁下一关 · 每关5题 · 按正确率获得1-3星</p>
      </div>
      <div class="level-map">
        ${QUIZ_DATA.map((level, i) => {
          const score = scores[i];
          const isUnlocked = i === 0 || scores[i - 1] !== undefined;
          const stars = score ? this.calcStars(score.correct) : 0;
          totalStars += stars;
          if (score) completedLevels++;

          return `
            <div class="level-card ${!isUnlocked ? 'locked' : ''} ${score ? 'completed' : ''}"
                 onclick="${isUnlocked ? `Quiz.startLevel(${i})` : ''}">
              <div class="level-num">第 ${i + 1} 关</div>
              <div class="level-icon">${level.icon}</div>
              <div class="level-title">${level.title}</div>
              <div class="level-desc">${level.desc}</div>
              <div class="level-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
              ${!isUnlocked ? '<div class="lock-overlay">🔒</div>' : ''}
            </div>
          `;
        }).join('')}
      </div>
      ${completedLevels === QUIZ_DATA.length ? `
        <div style="text-align:center;margin-top:32px;">
          <button class="btn btn-primary btn-large" onclick="Quiz.showTotalResult()">🏆 查看总成绩</button>
        </div>
      ` : ''}
    `;
  },

  startLevel(i) {
    this.state.currentLevel = i;
    this.state.currentQuestion = 0;
    this.state.score = 0;
    this.state.selectedOptions = [];
    this.state.answered = false;
    this.state.mode = 'playing';
    this.state.levelStartTime = Date.now();   // 记录开始时间，用于计算答题时长上报
    this.render();
  },

  renderQuestion() {
    const level = QUIZ_DATA[this.state.currentLevel];
    const q = level.questions[this.state.currentQuestion];
    const container = document.getElementById('quiz-container');
    const progress = ((this.state.currentQuestion) / level.questions.length) * 100;

    const typeNames = { single: '单选题', multi: '多选题', judge: '判断题', scenario: '场景分析题' };
    const typeClasses = { single: 'single', multi: 'multi', judge: 'judge', scenario: 'scenario' };

    container.innerHTML = `
      <div class="quiz-active">
        <div class="quiz-progress-info">
          <span class="q-num">${level.icon} ${level.title} · 第 ${this.state.currentQuestion + 1}/${level.questions.length} 题</span>
          <span class="q-score">当前得分: ${this.state.score}</span>
        </div>
        <div class="quiz-progress-bar">
          <div class="quiz-progress-fill" style="width:${progress}%"></div>
        </div>

        <div class="question-card">
          <span class="question-type ${typeClasses[q.type]}">${typeNames[q.type]}</span>
          ${q.scene ? `<div class="question-scene">📋 ${q.scene}</div>` : ''}
          <div class="question-text">${q.question}</div>
          ${q.type === 'multi' ? '<div style="font-size:13px;color:#94a3b8;margin-bottom:16px;">💡 提示：本题有多个正确答案</div>' : ''}

          <div class="option-list" id="option-list">
            ${q.options.map((opt, i) => `
              <div class="option-item" onclick="Quiz.selectOption(${i})" data-idx="${i}">
                <div class="option-key">${String.fromCharCode(65 + i)}</div>
                <div>${opt}</div>
              </div>
            `).join('')}
          </div>

          <div id="feedback-area"></div>
          <div class="quiz-actions" id="action-area"></div>
        </div>
      </div>
    `;
  },

  selectOption(i) {
    if (this.state.answered) return;
    const q = QUIZ_DATA[this.state.currentLevel].questions[this.state.currentQuestion];

    if (q.type === 'multi') {
      // 多选切换
      const idx = this.state.selectedOptions.indexOf(i);
      if (idx > -1) this.state.selectedOptions.splice(idx, 1);
      else this.state.selectedOptions.push(i);

      document.querySelectorAll('.option-item').forEach(el => {
        el.classList.toggle('selected', this.state.selectedOptions.includes(parseInt(el.dataset.idx)));
      });
    } else {
      // 单选/判断
      this.state.selectedOptions = [i];
      document.querySelectorAll('.option-item').forEach(el => {
        el.classList.toggle('selected', parseInt(el.dataset.idx) === i);
      });
    }

    // 显示确认按钮
    if (!document.getElementById('confirm-btn')) {
      document.getElementById('action-area').innerHTML = `
        <button class="btn btn-primary" id="confirm-btn" onclick="Quiz.confirmAnswer()">确认答案</button>
      `;
    }
  },

  confirmAnswer() {
    if (this.state.selectedOptions.length === 0) {
      App.toast('请选择一个答案');
      return;
    }

    this.state.answered = true;
    const q = QUIZ_DATA[this.state.currentLevel].questions[this.state.currentQuestion];
    const correctAns = Array.isArray(q.answer) ? q.answer : [q.answer];
    const selected = [...this.state.selectedOptions].sort((a, b) => a - b);
    const isCorrect = correctAns.length === selected.length && correctAns.every(a => selected.includes(a));

    if (isCorrect) this.state.score++;

    // 标记选项
    document.querySelectorAll('.option-item').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      el.classList.add('disabled');
      el.onclick = null;
      if (correctAns.includes(idx)) el.classList.add('correct');
      else if (selected.includes(idx)) el.classList.add('wrong');
    });

    // 显示反馈
    document.getElementById('feedback-area').innerHTML = `
      <div class="quiz-feedback ${isCorrect ? 'correct' : 'wrong'}">
        <h4>${isCorrect ? '✅ 回答正确！' : '❌ 回答错误'}</h4>
        <p>${q.explain}</p>
        <span class="knowledge-tag">📌 知识点: ${q.knowledge}</span>
      </div>
    `;

    // 显示下一题按钮
    const isLast = this.state.currentQuestion >= QUIZ_DATA[this.state.currentLevel].questions.length - 1;
    document.getElementById('action-area').innerHTML = `
      <button class="btn ${isLast ? 'btn-success' : 'btn-primary'}" onclick="Quiz.nextQuestion()">
        ${isLast ? '完成本关 →' : '下一题 →'}
      </button>
    `;
  },

  nextQuestion() {
    this.state.currentQuestion++;
    this.state.selectedOptions = [];
    this.state.answered = false;

    if (this.state.currentQuestion >= QUIZ_DATA[this.state.currentLevel].questions.length) {
      // 关卡结束
      const level = QUIZ_DATA[this.state.currentLevel];
      const finalCorrect = this.state.score;
      const finalTotal = level.questions.length;
      this.state.levelScores[this.state.currentLevel] = {
        correct: finalCorrect,
        total: finalTotal
      };
      Storage.set('quizScores', this.state.levelScores);

      // 上报本次答题明细到云端（供教师后台查看），游客模式跳过
      if (typeof Auth !== 'undefined' && Auth.currentUsername && !Auth.isGuest) {
        const stars = this.calcStars(finalCorrect);
        const duration = Math.floor((Date.now() - (this.state.levelStartTime || Date.now())) / 1000);
        Auth.reportQuizRecord(this.state.currentLevel, level.title || ('第'+(this.state.currentLevel+1)+'关'), finalCorrect, finalTotal, stars, duration);
      }

      this.state.mode = 'result';
    }

    this.render();
  },

  renderLevelResult() {
    const level = QUIZ_DATA[this.state.currentLevel];
    const score = this.state.score;
    const total = level.questions.length;
    const stars = this.calcStars(score);
    const passed = stars > 0;

    const medals = ['🥉', '🥈', '🥇'];
    const titles = ['及格过关', '表现良好', '优秀通关'];
    const messages = [
      '勉强过关！建议重新挑战，巩固知识点。',
      '不错的表现！还有提升空间哦。',
      '太棒了！你已熟练掌握本关知识！'
    ];

    document.getElementById('quiz-container').innerHTML = `
      <div style="text-align:center;padding:40px 0;">
        <div style="font-size:72px;margin-bottom:16px;">${passed ? medals[stars - 1] : '😵'}</div>
        <h2 style="font-size:28px;font-weight:800;margin-bottom:8px;">${passed ? titles[stars - 1] : '未通过'}</h2>
        <p style="color:#64748b;margin-bottom:16px;">${level.icon} ${level.title}</p>
        <div style="font-size:48px;font-weight:800;color:${passed ? '#10b981' : '#ef4444'};">${score}/${total}</div>
        <div style="font-size:32px;letter-spacing:4px;margin:16px 0;">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <p style="color:#64748b;font-size:15px;max-width:400px;margin:0 auto 24px;">${passed ? messages[stars - 1] : '答对不到3题，需要重新挑战哦！'}</p>
        <div style="display:flex;gap:12px;justify-content:center;">
          ${passed && this.state.currentLevel < QUIZ_DATA.length - 1 ?
            `<button class="btn btn-primary btn-large" onclick="Quiz.startLevel(${this.state.currentLevel + 1})">下一关 →</button>` : ''}
          <button class="btn btn-secondary btn-large" onclick="Quiz.retryLevel()">重新挑战</button>
          <button class="btn btn-secondary btn-large" onclick="Quiz.backToMap()">返回关卡</button>
        </div>
      </div>
    `;
  },

  calcStars(correct) {
    if (correct >= 5) return 3;
    if (correct >= 4) return 2;
    if (correct >= 3) return 1;
    return 0;
  },

  retryLevel() {
    this.startLevel(this.state.currentLevel);
  },

  backToMap() {
    this.state.mode = 'map';
    this.render();
  },

  showTotalResult() {
    this.state.mode = 'total';
    this.render();
  },

  renderTotalResult() {
    let totalStars = 0;
    let totalCorrect = 0;
    let totalQuestions = 0;

    QUIZ_DATA.forEach((level, i) => {
      const score = this.state.levelScores[i];
      if (score) {
        totalStars += this.calcStars(score.correct);
        totalCorrect += score.correct;
        totalQuestions += score.total;
      }
    });

    const maxStars = QUIZ_DATA.length * 3;
    const percent = Math.round((totalCorrect / totalQuestions) * 100);
    const medal = totalStars === maxStars ? '🏆' : (totalStars >= maxStars * 0.7 ? '🥇' : '🥈');

    document.getElementById('quiz-container').innerHTML = `
      <div class="result-page">
        <div class="big-medal">${medal}</div>
        <h1>全部通关！</h1>
        <p style="color:#64748b;">恭喜你完成了所有关卡</p>
        <div class="total-stars">${'⭐'.repeat(totalStars)}${'☆'.repeat(maxStars - totalStars)}</div>
        <div style="font-size:14px;color:#64748b;">总星数: ${totalStars}/${maxStars} · 正确率: ${percent}%</div>

        <div class="level-results">
          ${QUIZ_DATA.map((level, i) => {
            const score = this.state.levelScores[i];
            const stars = score ? this.calcStars(score.correct) : 0;
            return `
              <div class="level-result-item">
                <div class="lr-title">${level.icon} ${level.title}</div>
                <div class="lr-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
                <div style="font-size:12px;color:#94a3b8;">${score ? score.correct + '/' + score.total : '未完成'}</div>
              </div>
            `;
          }).join('')}
        </div>

        <button class="btn btn-secondary btn-large" onclick="Quiz.backToMap()">返回关卡地图</button>
      </div>
    `;
  }
};

// ========================================
// 模块三：盲盒挑战
// ========================================
const BlindBox = {
  state: {
    boxes: [],  // {opened, correct, question, answer}
    currentBox: -1,
    totalScore: 0,
    openedCount: 0,
    timer: null,
    timeLeft: 15,
    answered: false,
    selectedOption: -1,
    gameStarted: false
  },

  render() {
    if (!this.state.gameStarted) {
      this.renderIntro();
    } else {
      this.renderGame();
    }
  },

  renderIntro() {
    document.getElementById('blindbox-container').innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:72px;margin-bottom:16px;">🎁</div>
        <h2 style="font-size:28px;font-weight:800;margin-bottom:12px;">盲盒挑战规则</h2>
        <div style="max-width:500px;margin:0 auto 32px;text-align:left;background:#fff;border-radius:12px;padding:24px;box-shadow:var(--shadow);">
          <p style="margin-bottom:12px;">📦 共有 <strong>9个盲盒</strong>，每个藏着一道网络安全题目</p>
          <p style="margin-bottom:12px;">⏱ 每道题 <strong>限时15秒</strong>，超时视为答错</p>
          <p style="margin-bottom:12px;">💎 盲盒有4种稀有度，分数不同：</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;">
            <span style="background:#94a3b8;color:#fff;padding:4px 12px;border-radius:12px;font-size:13px;">普通 10分</span>
            <span style="background:#06b6d4;color:#fff;padding:4px 12px;border-radius:12px;font-size:13px;">稀有 20分</span>
            <span style="background:#f59e0b;color:#fff;padding:4px 12px;border-radius:12px;font-size:13px;">史诗 30分</span>
            <span style="background:#ef4444;color:#fff;padding:4px 12px;border-radius:12px;font-size:13px;">传说 50分</span>
          </div>
          <p>🏆 全部开完后按总分获得评级</p>
        </div>
        <button class="btn btn-primary btn-large" onclick="BlindBox.startGame()">开始挑战 🎮</button>
      </div>
    `;
  },

  startGame() {
    // 打乱题目顺序
    this.state.boxes = BLINDBOX_DATA.map((q, i) => ({
      question: q,
      opened: false,
      correct: false
    }));
    // 随机打乱
    for (let i = this.state.boxes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.state.boxes[i], this.state.boxes[j]] = [this.state.boxes[j], this.state.boxes[i]];
    }
    this.state.totalScore = 0;
    this.state.openedCount = 0;
    this.state.gameStarted = true;
    this.render();
  },

  renderGame() {
    if (this.state.openedCount === 9) {
      this.renderResult();
      return;
    }

    const rarityColors = { common: 'rarity-common', rare: 'rarity-rare', epic: 'rarity-epic', legendary: 'rarity-legendary' };
    const rarityNames = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };

    document.getElementById('blindbox-container').innerHTML = `
      <div class="blindbox-info">
        <div class="info-item">
          <div class="label">已开盲盒</div>
          <div class="value">${this.state.openedCount}/9</div>
        </div>
        <div class="info-item">
          <div class="label">当前积分</div>
          <div class="value">${this.state.totalScore}</div>
        </div>
        <div class="info-item">
          <div class="label">剩余盲盒</div>
          <div class="value">${9 - this.state.openedCount}</div>
        </div>
      </div>

      <div class="blindbox-grid">
        ${this.state.boxes.map((box, i) => {
          if (!box.opened) {
            return `<div class="blindbox-item unopened" onclick="BlindBox.openBox(${i})">
              <div class="box-icon">🎁</div>
              <div class="box-label">盲盒 ${i + 1}</div>
            </div>`;
          } else {
            const q = box.question;
            return `<div class="blindbox-item opened ${box.correct ? 'correct' : 'wrong'}">
              <div class="rarity-badge ${rarityColors[q.rarity]}">${rarityNames[q.rarity]}</div>
              <div class="box-icon">${box.correct ? '✅' : '❌'}</div>
              <div class="box-label">${box.correct ? '+' + q.points : '+0'}</div>
            </div>`;
          }
        }).join('')}
      </div>
    `;
  },

  openBox(i) {
    if (this.state.boxes[i].opened) return;

    this.state.currentBox = i;
    this.state.answered = false;
    this.state.selectedOption = -1;
    this.state.timeLeft = 15;

    const box = this.state.boxes[i];
    const q = box.question;
    const rarityColors = { common: '#94a3b8', rare: '#06b6d4', epic: '#f59e0b', legendary: '#ef4444' };

    document.getElementById('modal-content').className = 'blindbox-modal';
    document.getElementById('modal-content').innerHTML = `
      <div class="bb-rarity" style="background:${rarityColors[q.rarity]}">${q.rarityName} · ${q.points}分</div>
      <div class="bb-icon">${q.icon}</div>
      <div class="bb-question">${q.question}</div>
      <div class="bb-timer" id="bb-timer">⏱ 15秒</div>
      <div class="bb-options" id="bb-options">
        ${q.options.map((opt, j) => `
          <div class="option-item" onclick="BlindBox.selectAnswer(${j})" data-idx="${j}">
            <div class="option-key">${String.fromCharCode(65 + j)}</div>
            <div>${opt}</div>
          </div>
        `).join('')}
      </div>
      <div id="bb-feedback"></div>
    `;
    document.getElementById('modal-overlay').classList.add('show');

    // 开始计时
    this.state.timer = setInterval(() => {
      this.state.timeLeft--;
      const timerEl = document.getElementById('bb-timer');
      if (timerEl) {
        timerEl.textContent = `⏱ ${this.state.timeLeft}秒`;
        if (this.state.timeLeft <= 5) timerEl.style.color = '#ef4444';
      }
      if (this.state.timeLeft <= 0) {
        this.timeOut();
      }
    }, 1000);
  },

  selectAnswer(j) {
    if (this.state.answered) return;
    this.state.answered = true;
    this.state.selectedOption = j;
    clearInterval(this.state.timer);

    const box = this.state.boxes[this.state.currentBox];
    const q = box.question;
    const isCorrect = j === q.answer;

    box.opened = true;
    box.correct = isCorrect;
    if (isCorrect) this.state.totalScore += q.points;
    this.state.openedCount++;

    // 标记选项
    document.querySelectorAll('#bb-options .option-item').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      el.classList.add('disabled');
      el.onclick = null;
      if (idx === q.answer) el.classList.add('correct');
      else if (idx === j) el.classList.add('wrong');
    });

    document.getElementById('bb-feedback').innerHTML = `
      <div class="bb-result">
        <div class="bb-pts" style="color:${isCorrect ? '#10b981' : '#ef4444'};">
          ${isCorrect ? '✅ +' + q.points + ' 分！' : '❌ +0 分'}
        </div>
        <div class="bb-explain">${q.explain}</div>
      </div>
    `;

    setTimeout(() => {
      document.getElementById('modal-overlay').classList.remove('show');
      this.render();
    }, 3000);
  },

  timeOut() {
    if (this.state.answered) return;
    this.state.answered = true;
    clearInterval(this.state.timer);

    const box = this.state.boxes[this.state.currentBox];
    const q = box.question;
    box.opened = true;
    box.correct = false;
    this.state.openedCount++;

    document.querySelectorAll('#bb-options .option-item').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      el.classList.add('disabled');
      el.onclick = null;
      if (idx === q.answer) el.classList.add('correct');
    });

    document.getElementById('bb-timer').textContent = '⏱ 时间到！';
    document.getElementById('bb-feedback').innerHTML = `
      <div class="bb-result">
        <div class="bb-pts" style="color:#ef4444;">⏰ 超时！+0 分</div>
        <div class="bb-explain">正确答案: ${q.options[q.answer]}<br>${q.explain}</div>
      </div>
    `;

    setTimeout(() => {
      document.getElementById('modal-overlay').classList.remove('show');
      this.render();
    }, 3000);
  },

  renderResult() {
    const score = this.state.totalScore;
    const maxScore = BLINDBOX_DATA.reduce((s, q) => s + q.points, 0);
    const correctCount = this.state.boxes.filter(b => b.correct).length;

    let medal, title, msg;
    if (score >= 200) { medal = '🏆'; title = '盲盒大师！'; msg = '太厉害了！你几乎答对了所有题目！'; }
    else if (score >= 150) { medal = '🥇'; title = '安全达人'; msg = '表现出色，继续加油！'; }
    else if (score >= 100) { medal = '🥈'; title = '安全学徒'; msg = '不错的成绩，还有提升空间。'; }
    else { medal = '🥉'; title = '初学者'; msg = '继续学习，下次一定更好！'; }

    document.getElementById('blindbox-container').innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:72px;margin-bottom:16px;">${medal}</div>
        <h2 style="font-size:28px;font-weight:800;margin-bottom:8px;">${title}</h2>
        <div style="font-size:48px;font-weight:800;color:#9333ea;margin:16px 0;">${score}<span style="font-size:20px;color:#94a3b8;"> / ${maxScore}</span></div>
        <p style="color:#64748b;margin-bottom:8px;">答对 ${correctCount}/9 题</p>
        <p style="color:#64748b;margin-bottom:32px;">${msg}</p>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:500px;margin:0 auto 32px;">
          ${this.state.boxes.map(box => {
            const q = box.question;
            const rarityColors = { common: 'rarity-common', rare: 'rarity-rare', epic: 'rarity-epic', legendary: 'rarity-legendary' };
            return `<div class="blindbox-item opened ${box.correct ? 'correct' : 'wrong'}" style="aspect-ratio:auto;padding:12px;">
              <div class="rarity-badge ${rarityColors[q.rarity]}">${q.rarityName}</div>
              <div class="box-icon" style="font-size:20px;">${box.correct ? '✅' : '❌'}</div>
              <div class="box-label">${box.correct ? '+' + q.points : '+0'}</div>
            </div>`;
          }).join('')}
        </div>

        <button class="btn btn-primary btn-large" onclick="BlindBox.reset()">🔄 再玩一次</button>
      </div>
    `;

    // 保存盲盒最高分到本地 + 云端（教师后台可见）
    const prev = Storage.get('blindboxHighScore', 0);
    if (score > prev) {
      Storage.set('blindboxHighScore', score);
    }
  },

  reset() {
    this.state.gameStarted = false;
    this.render();
  }
};

// ========================================
// 模块四：情境模拟
// ========================================
const Scenario = {
  state: {
    currentScenario: -1,
    currentNode: 'start',
    safety: 100,
    visited: [],
    mode: 'list' // 'list' | 'playing' | 'result'
  },

  render() {
    if (this.state.mode === 'list') this.renderList();
    else if (this.state.mode === 'playing') this.renderGame();
  },

  renderList() {
    const diffNames = { easy: '简单', medium: '中等', hard: '困难' };
    const diffClasses = { easy: 'diff-easy', medium: 'diff-medium', hard: 'diff-hard' };

    document.getElementById('scenario-container').innerHTML = `
      <div style="text-align:center;margin-bottom:24px;">
        <p style="color:#64748b;font-size:15px;">选择一个场景开始体验 · 你的每个选择都会影响结局</p>
      </div>
      <div class="scenario-cards">
        ${SCENARIO_DATA.map((s, i) => `
          <div class="scenario-card" onclick="Scenario.start(${i})">
            <div class="sc-icon">${s.icon}</div>
            <div class="sc-title">${s.title}</div>
            <div class="sc-desc">${s.desc}</div>
            <div class="sc-difficulty">
              <span class="${diffClasses[s.difficulty]}">${diffNames[s.difficulty]}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  start(i) {
    this.state.currentScenario = i;
    this.state.currentNode = 'start';
    this.state.safety = SCENARIO_DATA[i].initialSafety;
    this.state.visited = [];
    this.state.mode = 'playing';
    this.render();
  },

  renderGame() {
    const scenario = SCENARIO_DATA[this.state.currentScenario];
    const node = scenario.nodes.find(n => n.id === this.state.currentNode);

    if (node.ending) {
      this.renderEnding(node);
      return;
    }

    const safetyPercent = Math.max(0, this.state.safety);
    const safetyColor = safetyPercent > 60 ? '#10b981' : (safetyPercent > 30 ? '#f59e0b' : '#ef4444');

    document.getElementById('scenario-container').innerHTML = `
      <div class="scenario-game">
        <div class="scenario-game-header">
          <h2>${scenario.icon} ${scenario.title}</h2>
          <div class="scenario-safety">
            <span>安全值</span>
            <div class="safety-bar">
              <div class="safety-bar-fill" style="width:${safetyPercent}%;background:${safetyColor};"></div>
            </div>
            <span style="color:${safetyColor};">${safetyPercent}</span>
          </div>
        </div>
        <div class="scenario-body">
          <div class="scenario-narrative">${node.narrative}</div>
          <div class="scenario-choices">
            ${node.choices.map((c, i) => `
              <div class="scenario-choice" onclick="Scenario.choose('${c.next}', ${c.safety})">
                <div class="choice-icon">${i + 1}</div>
                <div>${c.text}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  choose(nextId, safetyChange) {
    this.state.safety += safetyChange;
    this.state.currentNode = nextId;
    this.render();
  },

  renderEnding(node) {
    const scenario = SCENARIO_DATA[this.state.currentScenario];
    const safetyPercent = Math.max(0, this.state.safety);
    const endings = {
      perfect: { icon: '🎉', color: '#10b981' },
      good: { icon: '👍', color: '#059669' },
      ok: { icon: '😐', color: '#f59e0b' },
      bad: { icon: '😰', color: '#ef4444' }
    };
    const e = endings[node.ending] || endings.ok;

    document.getElementById('scenario-container').innerHTML = `
      <div class="scenario-game">
        <div class="scenario-game-header">
          <h2>${scenario.icon} ${scenario.title}</h2>
          <div class="scenario-safety">
            <span>最终安全值</span>
            <div class="safety-bar">
              <div class="safety-bar-fill" style="width:${safetyPercent}%;background:${e.color};"></div>
            </div>
            <span style="color:${e.color};">${safetyPercent}</span>
          </div>
        </div>
        <div class="scenario-result">
          <div class="result-icon">${node.title.split(' ')[0]}</div>
          <h3 style="color:${e.color};">${node.title}</h3>
          <p>${node.message}</p>
          <div class="result-stats">
            <div class="result-stat">
              <div class="num" style="color:${e.color};">${safetyPercent}</div>
              <div class="label">安全值</div>
            </div>
            <div class="result-stat">
              <div class="num">${scenario.nodes.filter(n => n.choices).length}</div>
              <div class="label">决策点</div>
            </div>
          </div>
          <div style="display:flex;gap:12px;justify-content:center;">
            <button class="btn btn-primary" onclick="Scenario.start(${this.state.currentScenario})">🔄 重新体验</button>
            <button class="btn btn-secondary" onclick="Scenario.backToList()">返回场景列表</button>
          </div>
        </div>
      </div>
    `;

    // 保存情境完成到本地 + 云端（教师后台可见）
    const completed = Storage.get('scenarioCompleted', []);
    const idx = this.state.currentScenario;
    if (idx >= 0 && !completed.includes(idx)) {
      completed.push(idx);
      Storage.set('scenarioCompleted', completed);
    }
  },

  backToList() {
    this.state.mode = 'list';
    this.render();
  }
};

// === 关闭弹窗 ===
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') {
    // 盲盒答题中不允许关闭
    if (BlindBox.state.timer && !BlindBox.state.answered) return;
    e.target.classList.remove('show');
  }
});

// === 初始化 ===
window.addEventListener('DOMContentLoaded', () => {
  // 首页已默认显示
});
