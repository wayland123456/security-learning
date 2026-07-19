-- ============================================
-- 安全e课堂 · 数据库表结构
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================

-- 1. 学生表（含教师账号，用 role 区分）
create table if not exists public.students (
    username        text primary key,                       -- 用户名（学生: 学号/自定义, 教师: teacher 等）
    password_hash   text not null,                          -- 密码（明文存储，教学用途；生产环境建议用 Supabase Auth）
    display_name    text not null default '',               -- 真实姓名
    class_name      text default '',                        -- 班级（如: 高三1班）
    role            text not null default 'student' check (role in ('student','teacher')),
    created_at      timestamptz not null default now(),
    constraint username_format check (username ~ '^[a-zA-Z0-9_]+$')
);

-- 开启行级安全（RLS）
alter table public.students enable row level security;

-- 教学场景：允许匿名读写（前端通过 anon key 访问）
-- 注意：这是教学用途的简化配置，生产环境应细化权限策略
create policy "public read students"   on public.students for select using (true);
create policy "public insert students" on public.students for insert with check (true);
create policy "public update students" on public.students for update using (true);
create policy "public delete students" on public.students for delete using (true);


-- 2. 学习进度表（每个学生一条记录，用 upsert 同步）
create table if not exists public.study_progress (
    username              text primary key references public.students(username) on delete cascade,
    quiz_scores           jsonb default '{}'::jsonb,        -- 闯关成绩 { "0": {"correct":5,"total":5}, ... }
    blindbox_high_score   int default 0,                    -- 盲盒最高分
    scenario_completed    jsonb default '[]'::jsonb,       -- 已完成的情境索引 [0,1,2]
    learned_topics        jsonb default '[]'::jsonb,        -- 已学习的主题索引
    total_study_seconds   int default 0,                   -- 累计学习时长（秒）
    quiz_total_correct    int default 0,                   -- 闯关累计答对数
    quiz_total_questions  int default 0,                    -- 闯关累计答题数
    last_login            timestamptz,                      -- 最后登录时间
    last_update           timestamptz default now()        -- 最后更新时间
);

alter table public.study_progress enable row level security;
create policy "public read progress"   on public.study_progress for select using (true);
create policy "public insert progress" on public.study_progress for insert with check (true);
create policy "public update progress" on public.study_progress for update using (true);
create policy "public delete progress" on public.study_progress for delete using (true);


-- 3. 答题明细记录表（每次完成一关记录一条，供教师查看明细）
create table if not exists public.quiz_records (
    id            bigserial primary key,
    username      text not null references public.students(username) on delete cascade,
    level_index   int not null,                             -- 关卡索引 0-5
    level_title   text,                                    -- 关卡名称
    correct       int not null,                            -- 答对数
    total         int not null,                             -- 总题数
    stars         int default 0,                            -- 星星数 0-3
    duration_sec  int default 0,                           -- 答题用时（秒）
    completed_at  timestamptz not null default now()        -- 完成时间
);

alter table public.quiz_records enable row level security;
create policy "public read records"   on public.quiz_records for select using (true);
create policy "public insert records" on public.quiz_records for insert with check (true);
create policy "public delete records" on public.quiz_records for delete using (true);

-- 索引：按用户名查询
create index if not exists idx_quiz_records_username on public.quiz_records(username);
create index if not exists idx_quiz_records_completed on public.quiz_records(completed_at desc);


-- ============================================
-- 初始化教师账号（请修改密码！）
-- 默认账号: teacher  密码: teacher123
-- ============================================
insert into public.students (username, password_hash, display_name, class_name, role)
values ('teacher', 'teacher123', '教师管理员', '', 'teacher')
on conflict (username) do nothing;

-- 为教师创建一条进度占位（可选）
insert into public.study_progress (username)
values ('teacher')
on conflict (username) do nothing;
