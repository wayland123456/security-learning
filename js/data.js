/* ========================================
 * 安全e课堂 · 数据中心
 * 包含：学习资源、闯关题库、盲盒题目、情境模拟
 * ======================================== */

// === 学习资源数据 ===
const LEARN_DATA = [
  {
    id: 'password',
    icon: '🔑',
    title: '密码安全',
    color: '#2563eb',
    subtitle: '你的密码真的安全吗？',
    summary: '密码是保护账户的第一道防线。了解密码破解原理，学会设置强密码。',
    scenes: [
      {
        type: 'crack',
        title: '密码破解演示',
        content: '黑客使用字典攻击和暴力破解，弱密码只需几秒就能被攻破。',
        duration: 8000
      },
      {
        type: 'strength',
        title: '密码强度对比',
        content: '对比不同强度密码的安全性，了解什么才是好密码。',
        duration: 6000
      },
      {
        type: 'tips',
        title: '密码安全建议',
        content: '掌握密码管理的最佳实践。',
        duration: 5000
      }
    ],
    knowledge: [
      { title: '弱密码的特征', content: '少于8位、纯数字、常见单词、键盘连续字符（如123456、qwerty、password）都是极弱密码，几秒内即可被破解。' },
      { title: '强密码的标准', content: '至少12位，包含大小写字母、数字和特殊符号，不包含个人信息，不同账户使用不同密码。' },
      { title: '密码管理建议', content: '使用密码管理器（如Bitwarden）管理密码；开启两步验证（2FA）；定期更换重要账户密码；绝不共用密码。' },
      { title: '常见破解手段', content: '字典攻击（用常见密码列表）、暴力破解（穷举所有组合）、撞库攻击（用泄露数据尝试其他网站）、钓鱼攻击（骗取密码）。' }
    ]
  },
  {
    id: 'phishing',
    icon: '🎣',
    title: '钓鱼识别',
    color: '#ea580c',
    subtitle: '别被钩住了还不知道',
    summary: '钓鱼攻击是最常见的社会工程学手段。学会识别钓鱼邮件、短信和网站。',
    scenes: [
      {
        type: 'email',
        title: '钓鱼邮件拆解',
        content: '一封典型钓鱼邮件，逐条标注危险信号。',
        duration: 8000
      },
      {
        type: 'tips',
        title: '钓鱼特征清单',
        content: '掌握钓鱼信息的8大特征。',
        duration: 5000
      }
    ],
    knowledge: [
      { title: '发件人地址伪装', content: '钓鱼邮件常使用与真实地址相似的域名，如 service@bank-secure.com（真实应为 bank.com），注意仔细核对。' },
      { title: '紧迫感话术', content: '"您的账户将在24小时内冻结！""立即验证否则封号！"——制造恐慌让你来不及思考，这是钓鱼的典型套路。' },
      { title: '可疑链接', content: '将鼠标悬停在链接上查看真实地址。短链接、IP地址、拼写错误的域名都是危险信号。' },
      { title: '信息索取', content: '正规机构永远不会通过邮件索要密码、验证码、完整银行卡号等敏感信息。' }
    ]
  },
  {
    id: 'privacy',
    icon: '👤',
    title: '个人信息保护',
    color: '#059669',
    subtitle: '你的信息正在裸奔？',
    summary: '在数字时代，个人信息就是资产。了解信息泄露的途径和防护方法。',
    scenes: [
      {
        type: 'flow',
        title: '信息泄露路径',
        content: '看看你的个人信息是如何被收集和泄露的。',
        duration: 8000
      },
      {
        type: 'tips',
        title: '隐私保护建议',
        content: '掌握个人信息保护的关键措施。',
        duration: 5000
      }
    ],
    knowledge: [
      { title: '最小化原则', content: '在任何平台注册和填写信息时，只提供必要信息。能不填的不填，能用化名的不用真名。' },
      { title: '社交媒体隐私', content: '检查社交平台的隐私设置：关闭位置共享、限制陌生人可见范围、不晒含敏感信息的照片（如车票、登机牌、身份证）。' },
      { title: 'App权限管理', content: '定期检查App权限：一个手电筒App不需要通讯录和位置权限。关闭不必要的权限，卸载不用的App。' },
      { title: '公共WiFi风险', content: '公共WiFi可能被监听。不在公共WiFi下进行网银操作、登录重要账户。必要时使用VPN加密通信。' }
    ]
  },
  {
    id: 'malware',
    icon: '💻',
    title: '恶意软件防范',
    color: '#dc2626',
    subtitle: '病毒、木马、勒索软件',
    summary: '了解各类恶意软件的工作原理和防范措施，保护设备安全。',
    scenes: [
      {
        type: 'tips',
        title: '恶意软件家族',
        content: '认识病毒、木马、勒索软件、间谍软件的区别。',
        duration: 6000
      },
      {
        type: 'tips',
        title: '防范措施',
        content: '如何有效防范恶意软件感染。',
        duration: 5000
      }
    ],
    knowledge: [
      { title: '病毒', content: '自我复制的恶意代码，依附在合法文件上，感染后可损坏文件、占用资源。通过U盘、下载文件、邮件附件传播。' },
      { title: '木马', content: '伪装成正常软件的恶意程序，不会自我复制但会开后门让攻击者远程控制你的电脑。来源不明的破解软件是重灾区。' },
      { title: '勒索软件', content: '加密你的文件并勒索赎金。WannaCry、GandCrab等曾造成全球性灾难。防御关键：定期备份、及时更新系统补丁。' },
      { title: '防范要点', content: '安装杀毒软件并保持更新；不下载来历不明的软件；不打开可疑邮件附件；及时安装系统更新；定期备份重要数据（3-2-1原则）。' }
    ]
  },
  {
    id: 'social',
    icon: '🎭',
    title: '社交工程防范',
    color: '#7c3aed',
    subtitle: '最危险的黑客不用电脑',
    summary: '攻击者利用人性弱点（信任、恐惧、好奇、贪婪）来获取信息或权限。',
    scenes: [
      {
        type: 'tips',
        title: '社交工程套路',
        content: '了解攻击者如何利用心理学进行攻击。',
        duration: 6000
      },
      {
        type: 'tips',
        title: '如何防范',
        content: '建立防社交工程的意识和习惯。',
        duration: 5000
      }
    ],
    knowledge: [
      { title: '冒充权威', content: '攻击者冒充IT部门、领导、公检法等权威身份，利用服从心理要求你提供密码、转账或执行操作。' },
      { title: '制造紧急', content: '"你的账户异常，5分钟内不处理就冻结！"紧急感让你跳过理性判断。遇到任何紧急要求，先冷静核实。' },
      { title: '利用信任', content: '攻击者可能先通过社交网络了解你的人际关系，然后冒充同事、朋友联系你。对任何涉及敏感操作的请求，通过其他渠道二次确认。' },
      { title: '诱饵策略', content: '"免费领取iPhone""点击查看你的年终奖"——利用贪婪和好奇心理。天上不会掉馅饼，免费的往往最贵。' }
    ]
  },
  {
    id: 'mobile',
    icon: '📱',
    title: '移动安全',
    color: '#0891b2',
    subtitle: '手机比电脑更危险',
    summary: '手机存储了大量个人数据，了解移动端特有的安全风险。',
    scenes: [
      {
        type: 'tips',
        title: '移动安全风险',
        content: '认识手机面临的安全威胁。',
        duration: 6000
      },
      {
        type: 'tips',
        title: '手机防护指南',
        content: '保护手机安全的关键措施。',
        duration: 5000
      }
    ],
    knowledge: [
      { title: 'App安全', content: '只从官方应用商店下载App；关注App要求的权限是否合理；定期清理不用的App；注意App更新日志中的隐私条款变更。' },
      { title: '公共充电风险', content: '公共USB充电桩可能被植入恶意芯片，通过数据线窃取手机数据或植入恶意软件。使用自己的充电头或数据阻断器。' },
      { title: '短信验证码', content: '验证码是最常见的二次认证手段。任何索要验证码的行为都是诈骗！不在任何非官方页面输入验证码。' },
      { title: '系统安全', content: '及时更新手机系统；开启查找手机功能；设置锁屏密码/生物识别；不越狱/iOS不越狱；安装安全补丁。' }
    ]
  }
];

// === 答题闯关题库（6关×5题=30题）===
const QUIZ_DATA = [
  {
    id: 1,
    icon: '🔑',
    title: '密码安全基础',
    desc: '了解密码安全的基本知识',
    questions: [
      {
        type: 'single',
        question: '以下哪个密码最安全？',
        options: ['123456789', 'zhangsan2010', 'T9#kM$pL2xQ!', 'password123'],
        answer: 2,
        explain: '"T9#kM$pL2xQ!"长度超过12位，包含大小写字母、数字和特殊符号，且不是常见单词或个人信息，符合强密码标准。',
        knowledge: '强密码标准'
      },
      {
        type: 'judge',
        question: '为了方便记忆，所有账户使用同一个密码是可以的。',
        options: ['正确', '错误'],
        answer: 1,
        explain: '一码通用是极危险的做法。一旦某个网站数据泄露，攻击者会用撞库攻击尝试你的其他账户。应使用密码管理器为每个账户设置独立密码。',
        knowledge: '撞库攻击'
      },
      {
        type: 'single',
        question: '什么是"字典攻击"？',
        options: ['逐个尝试所有可能的字符组合', '使用常见密码列表进行尝试', '通过偷看获取密码', '破解密码管理器'],
        answer: 1,
        explain: '字典攻击使用预先整理的常见密码列表（如"123456""password""qwerty"等）逐一尝试。因为很多人使用常见密码，这种攻击效率很高。',
        knowledge: '密码破解'
      },
      {
        type: 'multi',
        question: '以下哪些是弱密码的特征？（多选）',
        options: ['少于8位', '包含特殊符号', '纯数字', '使用生日或姓名'],
        answer: [0, 2, 3],
        explain: '弱密码的特征包括：长度短、纯数字、使用个人信息（生日、姓名）、常见单词。包含特殊符号反而是强密码的特征。',
        knowledge: '弱密码识别'
      },
      {
        type: 'scenario',
        scene: '你收到一条短信："您的XX银行账户异常，请点击链接 http://bank-verify.xyz 立即验证，否则24小时后冻结账户。"',
        question: '你应该怎么做？',
        options: ['立即点击链接验证', '转发给朋友帮忙看看', '拨打银行官方客服电话核实', '回复短信询问详情'],
        answer: 2,
        explain: '这是典型的钓鱼短信：域名可疑（bank-verify.xyz）、制造紧迫感（24小时冻结）。正确做法是通过官方渠道（银行APP、官方客服电话）核实，不点击短信中的链接。',
        knowledge: '钓鱼识别'
      }
    ]
  },
  {
    id: 2,
    icon: '🎣',
    title: '钓鱼攻击识别',
    desc: '识别各种钓鱼手段',
    questions: [
      {
        type: 'single',
        question: '钓鱼邮件最常利用的心理是？',
        options: ['好奇和贪婪', '紧迫感和恐惧', '同情心', '竞争心理'],
        answer: 1,
        explain: '钓鱼邮件常制造紧迫感（"24小时内冻结"）和恐惧（"账户异常"），让人来不及理性思考就点击链接或提供信息。',
        knowledge: '社会工程学'
      },
      {
        type: 'scenario',
        scene: '你收到一封邮件，发件人显示"招商银行 service@cmbchina-secure.com"，内容是"您的信用卡需要更新信息，请点击下方链接操作"。链接指向 http://cmb-update.net/login',
        question: '这封邮件最可能的性质是？',
        options: ['正常的银行通知', '钓鱼邮件', '广告邮件', '系统自动邮件'],
        answer: 1,
        explain: '这是钓鱼邮件：①发件人域名 cmbchina-secure.com 不是招商银行官方域名（官方为 cmbchina.com）；②链接域名 cmb-update.net 与银行无关；③正规银行不会通过邮件链接要求更新信息。',
        knowledge: '钓鱼邮件识别'
      },
      {
        type: 'judge',
        question: '只要邮件里显示的发件人名字是认识的人，就一定是他本人发的。',
        options: ['正确', '错误'],
        answer: 1,
        explain: '发件人显示名称可以随意伪造。判断真伪要看邮件地址而非显示名称。即使地址看似正确，也要对可疑内容保持警惕，通过其他渠道确认。',
        knowledge: '邮件伪造'
      },
      {
        type: 'multi',
        question: '以下哪些是钓鱼网站的常见特征？（多选）',
        options: ['网址拼写有细微错误', '网站有HTTPS锁标志', '页面要求输入完整银行卡号和密码', '设计粗糙有错别字'],
        answer: [0, 2, 3],
        explain: '钓鱼网站常见特征：域名拼写近似但有细微差别（如 g00gle.com）、要求输入敏感信息（银行卡号+密码+验证码）、页面质量差。注意：HTTPS不能完全保证安全，钓鱼网站也可以有证书。',
        knowledge: '钓鱼网站识别'
      },
      {
        type: 'single',
        question: '收到可疑邮件中最安全的做法是？',
        options: ['点击链接看看再说', '回复邮件询问', '不点击任何链接，通过官方渠道核实', '将邮件转发给同事'],
        answer: 2,
        explain: '面对可疑邮件，最安全的是不点击任何链接、不下载附件、不回复，通过官方APP、官方网站或官方电话等可信渠道进行核实。',
        knowledge: '邮件安全处置'
      }
    ]
  },
  {
    id: 3,
    icon: '👤',
    title: '个人信息保护',
    desc: '保护你的数字隐私',
    questions: [
      {
        type: 'single',
        question: '在公共WiFi环境下，以下哪种操作最不安全？',
        options: ['浏览新闻网站', '进行网上银行转账', '看在线视频', '查阅电子邮件'],
        answer: 1,
        explain: '公共WiFi可能被监听或中间人攻击。在公共WiFi下进行网银操作最危险，因为可能暴露账户密码和交易信息。如必须使用，应通过VPN加密连接。',
        knowledge: '公共WiFi安全'
      },
      {
        type: 'judge',
        question: '在社交媒体上晒登机牌的照片（已遮挡姓名）是安全的。',
        options: ['正确', '错误'],
        answer: 1,
        explain: '即使遮挡了姓名，登机牌上的条形码/二维码也包含姓名、航班号、乘客编号等完整信息，可用专业工具扫描读取。不建议在社交媒体晒登机牌、车票等含条码的证件。',
        knowledge: '社交媒体隐私'
      },
      {
        type: 'multi',
        question: '保护个人信息，以下哪些做法是正确的？（多选）',
        options: ['不同平台使用不同密码', '开启两步验证', '在所有平台都填写真实姓名和生日', '定期检查App权限'],
        answer: [0, 1, 3],
        explain: '不同平台使用不同密码可防止撞库；两步验证增加安全层；定期检查App权限可防止过度收集。在非必要平台填写真实姓名和生日是不安全的，应遵循最小化原则。',
        knowledge: '隐私保护措施'
      },
      {
        type: 'scenario',
        scene: '一个手电筒App要求获取你的通讯录、位置、相机和麦克风权限。',
        question: '你应该怎么做？',
        options: ['全部允许，否则可能无法使用', '拒绝所有不相关权限，只允许必要的', '允许通讯录但不允许其他', '先允许再在设置里关掉'],
        answer: 1,
        explain: '手电筒App只需要相机权限（用闪光灯），通讯录、位置、麦克风都与功能无关。应拒绝不相关权限。如果App因拒绝而无法使用，说明它可能在过度收集数据，建议换用其他App。',
        knowledge: 'App权限管理'
      },
      {
        type: 'single',
        question: '"最小化原则"在个人信息保护中是指？',
        options: ['用最少的密码', '只提供必要的信息，能不填的不填', '用最少的App', '减少上网时间'],
        answer: 1,
        explain: '最小化原则指在任何场景下只提供完成目的所必需的最少信息。注册账户时只填必填项，不主动提供额外信息，减少个人数据暴露。',
        knowledge: '信息最小化原则'
      }
    ]
  },
  {
    id: 4,
    icon: '💻',
    title: '恶意软件防范',
    desc: '识别和防范各类恶意软件',
    questions: [
      {
        type: 'single',
        question: '勒索软件（Ransomware）的主要危害是？',
        options: ['删除系统文件', '加密用户文件并勒索赎金', '窃取浏览器密码', '弹窗广告'],
        answer: 1,
        explain: '勒索软件会加密用户的文件，然后要求支付赎金（通常是加密货币）才提供解密密钥。WannaCry勒索软件在2017年影响了全球150多个国家。防御关键：定期备份。',
        knowledge: '勒索软件'
      },
      {
        type: 'judge',
        question: '安装了杀毒软件就一定不会中毒。',
        options: ['正确', '错误'],
        answer: 1,
        explain: '杀毒软件基于特征库检测已知威胁，但无法100%防范新型/未知的恶意软件（零日攻击）。需要配合良好的上网习惯、及时更新系统、不打开可疑文件等多层防护。',
        knowledge: '安全防护'
      },
      {
        type: 'multi',
        question: '以下哪些是感染恶意软件的常见途径？（多选）',
        options: ['下载来历不明的软件', '打开邮件中的可疑附件', '从官方应用商店下载App', '访问被植入恶意代码的网页'],
        answer: [0, 1, 3],
        explain: '恶意软件常见感染途径：下载不明软件、打开邮件附件、访问恶意网页（ drive-by下载）。官方应用商店经过审核，相对安全（但也不是100%）。',
        knowledge: '恶意软件传播'
      },
      {
        type: 'scenario',
        scene: '你在网上找到一个"免费"的Photoshop破解版，下载安装后，电脑开始弹出广告，浏览器主页被篡改，文件也被加密了。',
        question: '你很可能中了什么？',
        options: ['广告软件+勒索软件', '只是广告软件，不严重', '系统bug', '浏览器故障'],
        answer: 0,
        explain: '破解软件是恶意软件的重灾区。弹广告说明装了广告软件，文件被加密说明中了勒索软件。应立即断网、进入安全模式、用杀毒软件扫描、尝试从备份恢复文件。切勿支付赎金。',
        knowledge: '恶意软件防范'
      },
      {
        type: 'single',
        question: '数据备份的"3-2-1原则"是指？',
        options: ['3份备份、2种介质、1份异地', '3个硬盘、2个系统、1个密码', '3天备份、2份副本、1个U盘', '3种格式、2个位置、1个密码'],
        answer: 0,
        explain: '3-2-1原则：保留至少3份数据副本，存储在至少2种不同介质上，其中至少1份存放在异地（如云端）。这样即使遭遇勒索软件、硬盘损坏、火灾等也能恢复数据。',
        knowledge: '数据备份'
      }
    ]
  },
  {
    id: 5,
    icon: '🎭',
    title: '社交工程防范',
    desc: '识破利用人性的攻击',
    questions: [
      {
        type: 'single',
        question: '社交工程攻击的核心是利用什么？',
        options: ['技术漏洞', '人性弱点', '系统后门', '网络协议缺陷'],
        answer: 1,
        explain: '社交工程不依赖技术漏洞，而是利用人性弱点——信任、恐惧、好奇、贪婪、服从权威等心理，诱使目标主动泄露信息或执行操作。',
        knowledge: '社交工程原理'
      },
      {
        type: 'scenario',
        scene: '你接到一个电话，对方自称是公司IT部门，说检测到你的电脑中病毒了，需要你配合操作——先告诉他你的开机密码，然后远程协助清除病毒。',
        question: '你应该怎么做？',
        options: ['配合对方操作，避免影响工作', '先问清对方工号再配合', '挂断电话，自行联系IT部门核实', '告诉对方密码让他远程处理'],
        answer: 2,
        explain: '这是典型的冒充IT部门的社交工程攻击。正规IT人员不会索要密码（密码应只有本人知道）。正确做法：挂断电话，通过公司内部通讯录找到IT部门电话，主动致电核实。',
        knowledge: '冒充权威'
      },
      {
        type: 'judge',
        question: '如果来电显示是公司总机号码，就一定是公司内部打来的。',
        options: ['正确', '错误'],
        answer: 1,
        explain: '来电显示可以被伪造（Caller ID Spoofing）。攻击者可以将来电号码伪装成任何号码，包括公司总机、银行客服、公安机关等。不能仅凭来电显示判断对方身份。',
        knowledge: '来电伪造'
      },
      {
        type: 'multi',
        question: '以下哪些属于社交工程攻击手段？（多选）',
        options: ['尾随进入有门禁的办公区域', '在社交网络收集目标信息', '安装防火墙', '丢弃含敏感信息的文件'],
        answer: [0, 1, 3],
        explain: '尾随（piggybacking）是物理社交工程；利用社交网络收集信息是网络社交工程；丢弃含敏感信息的文件（垃圾箱潜水）也是信息收集手段。安装防火墙是安全防护措施，不是攻击。',
        knowledge: '社交工程手段'
      },
      {
        type: 'single',
        question: '防范社交工程最有效的措施是？',
        options: ['安装更多安全软件', '提高安全意识，建立核实习惯', '不上网', '换用苹果电脑'],
        answer: 1,
        explain: '社交工程攻击的是人而非技术，技术手段无法完全防御。最有效的措施是提高安全意识：对任何涉及敏感信息的请求保持警惕，通过独立渠道核实身份，建立"先验证后执行"的习惯。',
        knowledge: '安全意识'
      }
    ]
  },
  {
    id: 6,
    icon: '📱',
    title: '移动安全与综合实战',
    desc: '手机安全和综合安全知识',
    questions: [
      {
        type: 'single',
        question: '关于手机短信验证码，以下说法正确的是？',
        options: ['可以告诉自称客服的人', '验证码只自己知道，任何索要行为都是诈骗', '可以截图发给别人看', '家人要可以给'],
        answer: 1,
        explain: '短信验证码是二次认证的重要手段，任何索要验证码的行为都是诈骗——无论是"客服""警察"还是"银行工作人员"。验证码只输入在官方APP或网站中，绝不通过任何方式告知他人。',
        knowledge: '验证码安全'
      },
      {
        type: 'scenario',
        scene: '你在商场找到公共USB充电接口，手机快没电了，但没有带充电头，只有一根数据线。',
        question: '最安全的做法是？',
        options: ['直接用公共USB充电', '不充，等回家再充', '用数据线充电但开启飞行模式', '找一个有插座的地方用自己的充电头'],
        answer: 3,
        explain: '公共USB接口可能被植入恶意设备（"果汁劫持"），通过数据线窃取数据或植入恶意软件。最安全的是使用自己的充电头接交流电插座。如果只有数据线，可使用"数据阻断器"（仅充电不传数据的转接头）。',
        knowledge: '公共充电安全'
      },
      {
        type: 'judge',
        question: '手机Root（安卓）或越狱（iOS）后可以获得更多功能，是安全的。',
        options: ['正确', '错误'],
        answer: 1,
        explain: 'Root/越狱会破坏手机的安全沙箱机制，使恶意软件获得系统级权限，极大增加安全风险。同时会导致无法接收官方安全更新、失去保修。不建议普通用户Root/越狱。',
        knowledge: '系统安全'
      },
      {
        type: 'multi',
        question: '保护手机安全的措施包括哪些？（多选）',
        options: ['设置锁屏密码或生物识别', '及时安装系统更新', '从非官方渠道下载免费App', '开启查找手机功能'],
        answer: [0, 1, 3],
        explain: '锁屏密码、系统更新、查找手机功能都是重要的手机安全措施。从非官方渠道下载App风险极高，可能下载到恶意软件，应只从官方应用商店下载。',
        knowledge: '手机安全措施'
      },
      {
        type: 'scenario',
        scene: '综合场景：你收到"快递公司"短信说包裹派送失败，需要点击链接 http://kuaidi-track.cn 重新填写地址。同时你确实有一个包裹在途中。',
        question: '最安全的做法是？',
        options: ['点击链接填写地址', '拨打短信中的客服电话', '打开购物APP查看物流信息', '回复短信询问'],
        answer: 2,
        explain: '即使你确实有包裹，也不能点击短信中的链接——这是"精准钓鱼"，利用你有包裹在途的事实降低警惕。正确做法：打开购物APP（淘宝/京东等）查看物流状态，或拨打快递公司官方客服电话（从官网查询号码）。',
        knowledge: '综合安全意识'
      }
    ]
  }
];

// === 盲盒挑战题目（9个）===
const BLINDBOX_DATA = [
  {
    rarity: 'common',
    rarityName: '普通',
    icon: '📦',
    question: '以下密码哪个最弱？',
    options: ['Tr5@kL9m', '123456', 'Sunshine2024', 'qazWSX123'],
    answer: 1,
    explain: '"123456"是最常见弱密码之一，1秒内即可被破解。',
    points: 10
  },
  {
    rarity: 'common',
    rarityName: '普通',
    icon: '📦',
    question: '收到中奖邮件应该？',
    options: ['填写信息领奖', '点击链接查看', '删除并举报', '转发给朋友'],
    answer: 2,
    explain: '没有参加过的中奖100%是诈骗，应直接删除并举报。',
    points: 10
  },
  {
    rarity: 'rare',
    rarityName: '稀有',
    icon: '🎁',
    question: '什么是"撞库攻击"？',
    options: ['用泄露的账户密码尝试其他网站', '撞坏数据库服务器', '同时登录多个账户', '用暴力手段破解'],
    answer: 0,
    explain: '撞库攻击：用某网站泄露的账户密码组合，去尝试登录其他网站，利用用户一码通用的习惯。',
    points: 20
  },
  {
    rarity: 'rare',
    rarityName: '稀有',
    icon: '🎁',
    question: 'HTTPS网站一定安全吗？',
    options: ['是的，绝对安全', '不一定，钓鱼网站也可能有HTTPS', 'HTTPS没用', '只有银行网站需要HTTPS'],
    answer: 1,
    explain: 'HTTPS只保证传输加密，不保证网站本身可信。钓鱼网站也可以申请SSL证书。还需核对域名是否正确。',
    points: 20
  },
  {
    rarity: 'rare',
    rarityName: '稀有',
    icon: '🎁',
    question: '以下哪个不是强密码的特征？',
    options: ['至少12位长度', '包含大小写字母和数字', '使用生日信息', '包含特殊符号'],
    answer: 2,
    explain: '使用生日是弱密码特征，因为生日是可被获取的个人信息，容易被字典攻击命中。',
    points: 20
  },
  {
    rarity: 'epic',
    rarityName: '史诗',
    icon: '💎',
    question: '你发现U盘在公共电脑上用过后，自己电脑也中毒了。这属于什么传播方式？',
    options: ['网络攻击', '移动存储介质传播', '邮件传播', 'WiFi传播'],
    answer: 1,
    explain: 'U盘等移动存储介质是恶意软件传播的重要途径。病毒可通过U盘的autorun功能或伪装文件传播。应在使用后杀毒。',
    points: 30
  },
  {
    rarity: 'epic',
    rarityName: '史诗',
    icon: '💎',
    question: '"你的电脑有问题，我来帮你远程修复"——陌生人这么说时，他的目的可能是？',
    options: ['真的帮你修电脑', '远程控制你的电脑窃取信息', '测试你的电脑性能', '帮你更新系统'],
    answer: 1,
    explain: '这是典型的技术支持诈骗（Tech Support Scam）。目的：远程控制电脑→安装恶意软件/窃取文件/获取密码。正确做法：挂断并拉黑。',
    points: 30
  },
  {
    rarity: 'legendary',
    rarityName: '传说',
    icon: '👑',
    question: '【综合题】以下场景中存在几处安全风险？同事用公共WiFi登录网银，密码是生日，手机未更新系统，收到"银行"短信点击了链接。',
    options: ['1处', '2处', '3处', '4处'],
    answer: 3,
    explain: '4处风险：①公共WiFi登录网银→可能被监听；②密码用生日→弱密码；③未更新系统→存在已知漏洞；④点击短信链接→钓鱼风险。',
    points: 50
  },
  {
    rarity: 'legendary',
    rarityName: '传说',
    icon: '👑',
    question: '【综合题】关于"零信任"安全理念，以下理解正确的是？',
    options: ['不信任任何人，持续验证', '不安装任何安全软件', '不连接任何网络', '不使用任何密码'],
    answer: 0,
    explain: '零信任（Zero Trust）是一种安全理念："永不信任，始终验证"。不因用户在网络内部就默认信任，每次访问都需要验证身份和权限。',
    points: 50
  }
];

// === 情境模拟场景 ===
const SCENARIO_DATA = [
  {
    id: 'email',
    icon: '📧',
    title: '可疑邮件危机',
    desc: '周一早上，你收到一封"银行"邮件……',
    difficulty: 'medium',
    initialSafety: 100,
    nodes: [
      {
        id: 'start',
        narrative: '周一早上，你打开邮箱，发现一封来自"招商银行"的邮件：<span class="highlight">"您的信用卡存在安全风险，请立即点击下方链接验证身份，否则24小时后冻结账户。"</span> 链接地址是 http://cmb-verify.xyz/check',
        choices: [
          { text: '立即点击链接验证', next: 'phished', safety: -50 },
          { text: '仔细检查邮件发件人地址', next: 'check_sender', safety: 0 },
          { text: '直接删除邮件', next: 'deleted', safety: -10 }
        ]
      },
      {
        id: 'check_sender',
        narrative: '你仔细查看了发件人地址：<span class="highlight">service@cmbchina-secure.com</span>。招商银行的官方域名是 cmbchina.com，这个域名明显不同。',
        choices: [
          { text: '确认是钓鱼邮件，删除并举报', next: 'smart', safety: 0 },
          { text: '虽然域名不同，但还是点链接看看', next: 'phished', safety: -50 },
          { text: '回复邮件询问是否真实', next: 'reply', safety: -30 }
        ]
      },
      {
        id: 'phished',
        narrative: '你点击了链接，页面看起来和银行官网一模一样。它要求你输入卡号、密码、身份证号和手机验证码。<span class="highlight">你输入了这些信息……</span>',
        choices: [
          { text: '意识到不对劲，立即拨打银行客服', next: 'damage_control', safety: -20 },
          { text: '输入完毕，关闭页面', next: 'disaster', safety: -50 }
        ]
      },
      {
        id: 'reply',
        narrative: '你回复了邮件。不久后，对方回复说"这是真实通知，请点击链接验证"。同时你发现收件箱里类似的邮件越来越多……',
        choices: [
          { text: '意识到被盯上了，删除并举报', next: 'smart', safety: -10 },
          { text: '点击对方提供的链接', next: 'phished', safety: -50 }
        ]
      },
      {
        id: 'deleted',
        narrative: '你直接删除了邮件。但你不确定这是否真的是钓鱼邮件，万一账户真的有风险呢？',
        choices: [
          { text: '打开银行官方APP查看账户状态', next: 'smart', safety: 10 },
          { text: '不管了，删了就删了', next: 'neutral', safety: 0 }
        ]
      },
      {
        id: 'damage_control',
        narrative: '你及时拨打了银行官方客服电话（95555），客服确认账户有异常登录尝试，帮你冻结了账户并更换了卡号。幸好处理及时！',
        choices: [
          { text: '完成', next: 'end_good', safety: 0 }
        ]
      },
      {
        id: 'disaster',
        narrative: '几天后，你发现银行卡被盗刷了8000元。你输入的信息被攻击者用于转账和消费。',
        choices: [
          { text: '完成', next: 'end_bad', safety: 0 }
        ]
      },
      {
        id: 'smart',
        narrative: '你做出了正确的判断！通过官方渠道核实是处理可疑信息的最佳方式。你删除了钓鱼邮件，也可以向反诈中心举报。',
        choices: [
          { text: '完成', next: 'end_perfect', safety: 0 }
        ]
      },
      {
        id: 'neutral',
        narrative: '虽然这次没有上当，但没有通过官方渠道核实，如果邮件是真的就错过了重要通知。养成"通过官方渠道核实"的习惯更安全。',
        choices: [
          { text: '完成', next: 'end_ok', safety: 0 }
        ]
      },
      {
        id: 'end_perfect',
        ending: 'perfect',
        title: '🎉 完美应对！',
        message: '你展现了出色的安全意识——不轻信、不点击、通过官方渠道核实。这就是应对可疑信息的黄金法则！'
      },
      {
        id: 'end_good',
        ending: 'good',
        title: '👍 亡羊补牢',
        message: '虽然一开始判断有误，但你及时止损，避免了更大损失。记住：发现可疑操作后，第一时间联系官方客服。'
      },
      {
        id: 'end_ok',
        ending: 'ok',
        title: '😐 侥幸过关',
        message: '这次运气好没有被骗，但靠运气不是长久之计。养成通过官方渠道核实的习惯，才能每次都安全。'
      },
      {
        id: 'end_bad',
        ending: 'bad',
        title: '😰 教训惨痛',
        message: '这次经历说明：在不确定的页面输入敏感信息极其危险。记住——银行永远不会通过邮件链接索要密码和验证码！'
      }
    ]
  },
  {
    id: 'wifi',
    icon: '📶',
    title: '咖啡厅WiFi陷阱',
    desc: '你在咖啡厅想连免费WiFi……',
    difficulty: 'easy',
    initialSafety: 100,
    nodes: [
      {
        id: 'start',
        narrative: '你在咖啡厅想用电脑上网，发现有一个免费WiFi叫 <span class="highlight">"Free_Cafe_WiFi"</span>，没有密码。',
        choices: [
          { text: '直接连接，开始上网', next: 'connected', safety: -20 },
          { text: '先问店员WiFi名称是什么', next: 'verify', safety: 10 },
          { text: '用手机开热点', next: 'hotspot', safety: 5 }
        ]
      },
      {
        id: 'connected',
        narrative: '连接后你发现网络有点慢。这时你想查看一下邮件和做一笔转账。',
        choices: [
          { text: '正常查看邮件和转账', next: 'danger', safety: -50 },
          { text: '只看邮件不转账', next: 'medium_risk', safety: -20 },
          { text: '断开WiFi用手机流量', next: 'smart', safety: 0 }
        ]
      },
      {
        id: 'verify',
        narrative: '店员告诉你WiFi名称是 <span class="highlight">"CafeGuest_5G"</span>，需要向店员索取密码。之前那个"Free_Cafe_WiFi"可能是伪造的热点！',
        choices: [
          { text: '使用正确的WiFi并输入密码', next: 'safe', safety: 0 },
          { text: '还是用没有密码的"Free_Cafe_WiFi"', next: 'danger', safety: -40 }
        ]
      },
      {
        id: 'hotspot',
        narrative: '你用手机开了热点，数据走的是手机流量，更加安全。但手机流量快用完了。',
        choices: [
          { text: '继续用热点', next: 'safe', safety: 0 },
          { text: '问店员正确的WiFi名称和密码', next: 'safe', safety: 0 }
        ]
      },
      {
        id: 'danger',
        narrative: '你不知道的是，"Free_Cafe_WiFi"是攻击者搭建的伪热点，你的所有流量都被监听。银行账户密码已被截获。',
        choices: [
          { text: '完成', next: 'end_bad', safety: 0 }
        ]
      },
      {
        id: 'medium_risk',
        narrative: '你只看了邮件没有转账，但邮件中的登录密码可能已被中间人截获。建议回家后修改邮箱密码。',
        choices: [
          { text: '完成', next: 'end_medium', safety: 0 }
        ]
      },
      {
        id: 'smart',
        narrative: '你果断断开了可疑WiFi，改用手机流量。虽然花了一些流量费，但数据安全无价。',
        choices: [
          { text: '完成', next: 'end_good', safety: 0 }
        ]
      },
      {
        id: 'safe',
        narrative: '你使用了正确的WiFi或安全的热点连接，数据传输安全。愉快地完成了上网。',
        choices: [
          { text: '完成', next: 'end_perfect', safety: 0 }
        ]
      },
      {
        id: 'end_perfect',
        ending: 'perfect',
        title: '🎉 安全上网！',
        message: '你做到了正确识别和选择安全的网络连接方式。公共WiFi先核实、用流量更安全——这是好习惯！'
      },
      {
        id: 'end_good',
        ending: 'good',
        title: '👍 机智应对',
        message: '发现风险后果断切换到安全网络，避免了信息泄露。保持这种警觉性！'
      },
      {
        id: 'end_medium',
        ending: 'ok',
        title: '⚠️ 有惊无险',
        message: '虽然没做转账等敏感操作，但邮箱密码可能已泄露。建议尽快修改密码，以后在公共WiFi下使用VPN。'
      },
      {
        id: 'end_bad',
        ending: 'bad',
        title: '😰 遭到攻击',
        message: '伪造WiFi是常见的攻击手段。攻击者可以监听所有未加密流量。记住：公共WiFi不转账、不登录重要账户，用前先核实名称。'
      }
    ]
  },
  {
    id: 'app',
    icon: '📱',
    title: 'App权限抉择',
    desc: '下载了一个新App，权限怎么管？',
    difficulty: 'medium',
    initialSafety: 100,
    nodes: [
      {
        id: 'start',
        narrative: '你在网上看到一个"免费听音乐"的App，应用商店搜不到，需要从官网下载APK安装包。安装时，App请求以下权限：<span class="highlight">通讯录、位置、相机、麦克风、短信、存储、电话</span>。',
        choices: [
          { text: '全部允许', next: 'all_allow', safety: -50 },
          { text: '逐个查看并选择性允许', next: 'selective', safety: 10 },
          { text: '不安装，换用正规音乐App', next: 'abort', safety: 20 }
        ]
      },
      {
        id: 'all_allow',
        narrative: 'App安装成功，但你发现通讯录被上传、收到短信被读取、位置持续追踪……你的隐私数据正在被收集。',
        choices: [
          { text: '立即卸载并修改相关密码', next: 'damage', safety: -20 },
          { text: '不管了，免费听歌就行', next: 'disaster', safety: -50 }
        ]
      },
      {
        id: 'selective',
        narrative: '你仔细分析了权限：<span class="highlight">听音乐只需要存储权限（缓存歌曲）</span>。通讯录、位置、相机、麦克风、短信、电话都与听音乐无关。',
        choices: [
          { text: '只允许存储权限', next: 'minimal', safety: 0 },
          { text: '允许存储和位置', next: 'still_risky', safety: -20 }
        ]
      },
      {
        id: 'abort',
        narrative: '你决定不安装来路不明的App，换用了正规音乐平台（如QQ音乐、网易云音乐）。虽然有些歌曲需要付费，但安全有保障。',
        choices: [
          { text: '完成', next: 'end_perfect', safety: 0 }
        ]
      },
      {
        id: 'minimal',
        narrative: 'App运行正常，可以听歌。但你注意到App请求了"设备管理员"权限，这会让App获得系统级控制权。',
        choices: [
          { text: '拒绝设备管理员权限', next: 'smart', safety: 0 },
          { text: '允许，可能有用', next: 'device_admin', safety: -40 }
        ]
      },
      {
        id: 'still_risky',
        narrative: '位置权限让App可以追踪你的行踪。加上这个App来自非官方渠道，你不确定它是否安全。',
        choices: [
          { text: '撤回位置权限', next: 'minimal', safety: 0 },
          { text: '保持现状', next: 'end_medium', safety: 0 }
        ]
      },
      {
        id: 'device_admin',
        narrative: 'App获得设备管理员权限后，无法正常卸载，还锁定了你的屏幕要求付费才能解锁。你中了"锁机勒索"！',
        choices: [
          { text: '重启进入安全模式卸载', next: 'damage', safety: -20 },
          { text: '付钱解锁', next: 'disaster', safety: -50 }
        ]
      },
      {
        id: 'smart',
        narrative: '你拒绝了不合理的权限请求，App依然可以正常听音乐。你还在系统设置中关闭了App的后台运行权限。',
        choices: [
          { text: '完成', next: 'end_good', safety: 0 }
        ]
      },
      {
        id: 'damage',
        narrative: '你卸载了恶意App并修改了密码，但通讯录信息已被上传。提醒亲友注意防范诈骗。',
        choices: [
          { text: '完成', next: 'end_ok', safety: 0 }
        ]
      },
      {
        id: 'disaster',
        narrative: '你的隐私持续被窃取，银行短信验证码被拦截，账户被盗刷。',
        choices: [
          { text: '完成', next: 'end_bad', safety: 0 }
        ]
      },
      {
        id: 'end_perfect',
        ending: 'perfect',
        title: '🎉 最佳选择！',
        message: '不安装来路不明的App是最安全的做法。免费往往暗藏代价——隐私泄露的风险远超几首免费歌曲的价值。'
      },
      {
        id: 'end_good',
        ending: 'good',
        title: '👍 权限管理达人',
        message: '你展现了出色的权限管理意识：只给必要的权限、拒绝不合理请求、关注后台行为。这是保护手机安全的关键技能。'
      },
      {
        id: 'end_ok',
        ending: 'ok',
        title: '⚠️ 及时补救',
        message: '虽然通讯录被泄露，但你及时卸载和提醒亲友是正确做法。以后只从官方渠道下载App，不给非必要权限。'
      },
      {
        id: 'end_medium',
        ending: 'ok',
        title: '⚠️ 存在隐患',
        message: '非官方App加上位置权限，存在隐私泄露风险。建议卸载非官方App，换用正规平台。'
      },
      {
        id: 'end_bad',
        ending: 'bad',
        title: '😰 严重损失',
        message: '来路不明的App是恶意软件的主要载体。记住：只从官方应用商店下载、权限最小化、不授予设备管理员权限给不明App。'
      }
    ]
  },
  {
    id: 'social',
    icon: '🎭',
    title: '冒充领导转账',
    desc: '"领导"发来消息让你转账……',
    difficulty: 'hard',
    initialSafety: 100,
    nodes: [
      {
        id: 'start',
        narrative: '下午2点，你收到一条微信好友申请，头像是你们部门张主任，备注写着"我是张主任，换号了，通过一下"。',
        choices: [
          { text: '通过申请', next: 'added', safety: -10 },
          { text: '先核实再决定', next: 'verify', safety: 10 },
          { text: '忽略申请', next: 'ignored', safety: 5 }
        ]
      },
      {
        id: 'added',
        narrative: '通过后，"张主任"很热情地聊了几句工作，然后说：<span class="highlight">"我在开会不方便，你帮我转一笔钱给客户，一会还你。先转5万。"</span>并发来一个银行账号。',
        choices: [
          { text: '领导安排的，马上转', next: 'scammed', safety: -60 },
          { text: '觉得不对，打电话给张主任核实', next: 'verify_call', safety: 10 },
          { text: '请对方发语音确认身份', next: 'voice', safety: -10 }
        ]
      },
      {
        id: 'verify',
        narrative: '你没有直接通过，而是在公司通讯录中找到张主任的旧微信，发消息问"您换微信号了吗？"',
        choices: [
          { text: '张主任回复"没有换号"', next: 'confirmed_fake', safety: 0 },
          { text: '旧微信没回复，先通过新的', next: 'added', safety: -10 }
        ]
      },
      {
        id: 'ignored',
        narrative: '你忽略了申请。过了几天，又收到类似的申请，这次头像是另一个同事。',
        choices: [
          { text: '这次通过', next: 'added', safety: -10 },
          { text: '依然不理，提醒同事可能有骗子', next: 'alert', safety: 10 }
        ]
      },
      {
        id: 'voice',
        narrative: '对方很快发来一段语音，声音确实像张主任。但你不知道的是——<span class="highlight">AI语音克隆技术只需几秒语音样本就能模仿任何人说话</span>。',
        choices: [
          { text: '听到声音就放心了，转账', next: 'scammed', safety: -60 },
          { text: '还是打电话当面确认', next: 'verify_call', safety: 10 }
        ]
      },
      {
        id: 'verify_call',
        narrative: '你拨打了张主任的工作电话（从公司通讯录查的号码），张主任说："什么转账？我没换微信号啊！"',
        choices: [
          { text: '确认是骗子，拉黑并报警', next: 'smart', safety: 0 },
          { text: '也许主任在开玩笑', next: 'still_doubt', safety: -30 }
        ]
      },
      {
        id: 'confirmed_fake',
        narrative: '张主任确认没有换号！这个申请是骗子冒充的。你截图保存证据，举报了该微信号。',
        choices: [
          { text: '完成', next: 'end_good', safety: 0 }
        ]
      },
      {
        id: 'alert',
        narrative: '你在部门群里提醒大家注意有人冒充同事行骗。同事们都表示也收到了类似申请，感谢你的提醒。',
        choices: [
          { text: '完成', next: 'end_perfect', safety: 0 }
        ]
      },
      {
        id: 'smart',
        narrative: '你成功识破了骗局！你拉黑了骗子，向微信举报，并告知同事们注意防范。',
        choices: [
          { text: '完成', next: 'end_good', safety: 0 }
        ]
      },
      {
        id: 'still_doubt',
        narrative: '你又转了5万到对方账号。几分钟后张主任本人来到你工位问你为什么给他打电话，你才知道被骗了。',
        choices: [
          { text: '立即报警并联系银行', next: 'damage', safety: -20 },
          { text: '不敢声张', next: 'disaster', safety: -50 }
        ]
      },
      {
        id: 'scammed',
        narrative: '你转了5万元。几小时后，"张主任"又说要再转3万。你开始觉得不对劲……',
        choices: [
          { text: '打电话给真张主任确认', next: 'too_late', safety: 0 },
          { text: '继续转3万', next: 'disaster', safety: -40 }
        ]
      },
      {
        id: 'too_late',
        narrative: '电话里张主任说没有让你转账。你立即报警，但5万元已被转走取现，追回困难。',
        choices: [
          { text: '完成', next: 'end_bad', safety: 0 }
        ]
      },
      {
        id: 'damage',
        narrative: '你报警并联系银行尝试冻结对方账户，但资金已被转移。警方立案调查。',
        choices: [
          { text: '完成', next: 'end_bad', safety: 0 }
        ]
      },
      {
        id: 'disaster',
        narrative: '你总共被骗8万元，且因为不敢声张错过了最佳报案时间，资金难以追回。',
        choices: [
          { text: '完成', next: 'end_worst', safety: 0 }
        ]
      },
      {
        id: 'end_perfect',
        ending: 'perfect',
        title: '🎉 团队守护者！',
        message: '你不仅自己没被骗，还提醒了同事，防止更多人上当。这就是"见诈预警"的优良品质！冒充领导转账是高发诈骗类型，务必通过电话等独立渠道核实。'
      },
      {
        id: 'end_good',
        ending: 'good',
        title: '👍 警惕性满分',
        message: '你通过电话核实成功识破了骗局。记住：涉及转账的请求，无论对方是谁，都必须通过独立渠道（电话、当面）确认。'
      },
      {
        id: 'end_bad',
        ending: 'bad',
        title: '😰 代价沉重',
        message: '冒充领导转账是常见诈骗套路。AI时代，连语音和视频都能伪造。唯一可靠的方法：通过已知的联系方式亲自确认。'
      },
      {
        id: 'end_worst',
        ending: 'bad',
        title: '😰 教训惨痛',
        message: '被骗后应第一时间报警，越早报案越有可能追回资金。沉默只会让骗子继续作恶。记住：被骗不是你的错，及时报警才是正确做法。'
      }
    ]
  }
];
