"""生成安全e课堂 PWA 图标
绘制：蓝色渐变圆角背景 + 白色盾牌 + 'e' 字母
输出: img/icons/icon-192.png, img/icons/icon-512.png, img/icons/apple-touch-icon.png
"""
from PIL import Image, ImageDraw, ImageFont
import math
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'img', 'icons')

def make_gradient_bg(size, color_top, color_bottom):
    """生成竖向渐变背景"""
    img = Image.new('RGB', (size, size), color_top)
    pixels = img.load()
    for y in range(size):
        ratio = y / max(size - 1, 1)
        r = int(color_top[0] + (color_bottom[0] - color_top[0]) * ratio)
        g = int(color_top[1] + (color_bottom[1] - color_top[1]) * ratio)
        b = int(color_top[2] + (color_bottom[2] - color_top[2]) * ratio)
        for x in range(size):
            pixels[x, y] = (r, g, b)
    return img

def draw_rounded_rect(img, radius, color):
    """给整图加圆角"""
    size = img.size[0]
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=255)
    bg = Image.new('RGB', (size, size), color)
    bg.paste(img, (0, 0), mask)
    return bg

def draw_shield(draw, cx, cy, w, h, fill, outline=None):
    """绘制盾牌形状
    盾牌由顶部弧线 + 两侧斜线 + 底部尖角组成
    """
    # 盾牌路径点
    top_y = cy - h / 2
    bot_y = cy + h / 2
    half_w = w / 2
    # 顶部两个点
    p_tl = (cx - half_w, top_y + h * 0.05)
    p_tr = (cx + half_w, top_y + h * 0.05)
    # 顶部弧线控制点
    p_top = (cx, top_y - h * 0.02)
    # 中部两侧（最宽处）
    p_ml = (cx - half_w * 1.05, top_y + h * 0.35)
    p_mr = (cx + half_w * 1.05, top_y + h * 0.35)
    # 底部收口
    p_bl = (cx - half_w * 0.45, cy + h * 0.30)
    p_br = (cx + half_w * 0.45, cy + h * 0.30)
    p_bot = (cx, bot_y)

    # 用多段贝塞尔近似
    points = []
    # 顶部弧（左上 -> 顶 -> 右上）
    steps = 24
    for i in range(steps + 1):
        t = i / steps
        # 二次贝塞尔
        x = (1-t)**2 * p_tl[0] + 2*(1-t)*t * p_top[0] + t**2 * p_tr[0]
        y = (1-t)**2 * p_tl[1] + 2*(1-t)*t * p_top[1] + t**2 * p_tr[1]
        points.append((x, y))
    # 右侧：p_tr -> p_mr -> p_br -> p_bot
    seg1 = [p_tr, p_mr, p_br, p_bot]
    for i in range(len(seg1) - 1):
        a, b = seg1[i], seg1[i+1]
        for j in range(12):
            t = j / 12
            x = a[0] + (b[0] - a[0]) * t
            y = a[1] + (b[1] - a[1]) * t
            points.append((x, y))
    # 左侧：p_bot -> p_bl -> p_ml -> p_tl
    seg2 = [p_bot, p_bl, p_ml, p_tl]
    for i in range(len(seg2) - 1):
        a, b = seg2[i], seg2[i+1]
        for j in range(12):
            t = j / 12
            x = a[0] + (b[0] - a[0]) * t
            y = a[1] + (b[1] - a[1]) * t
            points.append((x, y))

    draw.polygon(points, fill=fill, outline=outline, width=3)

def find_font(size):
    """寻找可用字体"""
    candidates = [
        'C:/Windows/Fonts/segoeuib.ttf',
        'C:/Windows/Fonts/seguibl.ttf',
        'C:/Windows/Fonts/arialbd.ttf',
        'C:/Windows/Fonts/msyhbd.ttc',
        'C:/Windows/Fonts/simhei.ttf',
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

def generate_icon(size, out_path):
    # 蓝色渐变背景 #1e40af -> #2563eb -> #3b82f6
    bg = make_gradient_bg(size, (30, 64, 175), (59, 130, 246))
    # 圆角
    radius = int(size * 0.18)
    bg = draw_rounded_rect(bg, radius, (255, 255, 255))
    draw = ImageDraw.Draw(bg, 'RGBA')

    # 绘制白色盾牌
    shield_w = size * 0.62
    shield_h = size * 0.72
    cx, cy = size / 2, size / 2 + size * 0.02
    draw_shield(draw, cx, cy, shield_w, shield_h, (255, 255, 255, 255))

    # 在盾牌上绘制蓝色 'e'
    font_size = int(size * 0.42)
    font = find_font(font_size)
    text = 'e'
    # 计算文字居中
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = cx - tw / 2 - bbox[0]
    ty = cy - th / 2 - bbox[1] + size * 0.01
    draw.text((tx, ty), text, fill=(37, 99, 235, 255), font=font)

    # 保存
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bg.save(out_path, 'PNG')
    print(f'已生成: {out_path} ({size}x{size})')

if __name__ == '__main__':
    generate_icon(192, os.path.join(OUT_DIR, 'icon-192.png'))
    generate_icon(512, os.path.join(OUT_DIR, 'icon-512.png'))
    # apple-touch-icon 用 192
    generate_icon(180, os.path.join(OUT_DIR, 'apple-touch-icon.png'))
    print('全部图标生成完成！')
