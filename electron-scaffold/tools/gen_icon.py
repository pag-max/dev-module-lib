#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 Electron 应用图标（纯标准库，不装 Pillow）
输出：assets/icon.png（512×512）+ assets/icon.ico（16~256 多尺寸）
用法：
    python tools/gen_icon.py
    python tools/gen_icon.py --c1 "#1e3a8a" --c2 "#3b82f6"     # 换配色
图形：圆角渐变底 + 白色窗口轮廓（顶栏三个圆点），16px 下仍可辨识。
"""
import argparse
import os
import struct
import zlib

SS = 4  # 超采样倍数，抗锯齿


def lerp(a, b, t):
    return a + (b - a) * t


def hex2rgb(s):
    s = s.lstrip('#')
    if len(s) == 3:
        s = ''.join(c * 2 for c in s)
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def rrect_sdf(x, y, cx, cy, hw, hh, r):
    """圆角矩形有符号距离场：<0 在内"""
    dx = abs(x - cx) - (hw - r)
    dy = abs(y - cy) - (hh - r)
    ax, ay = max(dx, 0.0), max(dy, 0.0)
    return (ax * ax + ay * ay) ** 0.5 + min(max(dx, dy), 0.0) - r


def render(size, c1, c2):
    """返回 RGBA 字节串，size×size"""
    W = size * SS
    c1 = hex2rgb(c1)
    c2 = hex2rgb(c2)
    buf = bytearray(W * W * 4)

    # 画布内几何（按 W 归一化）
    body_hw, body_hh, body_r = 0.375 * W, 0.375 * W, 0.22 * W     # 背景圆角方块
    win_cx, win_cy = 0.5 * W, 0.5 * W
    win_hw, win_hh, win_r = 0.245 * W, 0.195 * W, 0.045 * W       # 窗口外框
    stroke = 0.042 * W
    bar_y = win_cy - win_hh + 0.075 * W                            # 顶栏分隔线
    dot_r = 0.017 * W
    dots = [win_cx - 0.155 * W, win_cx - 0.105 * W, win_cx - 0.055 * W]

    for py in range(W):
        for px in range(W):
            x, y = px + 0.5, py + 0.5
            if rrect_sdf(x, y, win_cx, win_cy, body_hw, body_hh, body_r) > 0:
                continue                                            # 圆角外透明
            t = (x / W + y / W) / 2.0                               # 对角渐变
            r = int(lerp(c1[0], c2[0], t))
            g = int(lerp(c1[1], c2[1], t))
            b = int(lerp(c1[2], c2[2], t))
            a = 255

            d_out = rrect_sdf(x, y, win_cx, win_cy, win_hw, win_hh, win_r)
            in_frame = d_out < 0 and d_out > -stroke            # 外框
            in_bar = (d_out < 0 and y < bar_y and y > bar_y - stroke * 0.75)
            in_dot = any((x - dx) ** 2 + (y - win_cy + win_hh - 0.075 * W * 0.5) ** 2 < dot_r ** 2 for dx in dots)
            if in_frame or in_bar or in_dot:
                r = g = b = 255

            o = (py * W + px) * 4
            buf[o:o + 4] = bytes((r, g, b, a))

    # 盒式降采样 → 抗锯齿
    out = bytearray(size * size * 4)
    n = SS * SS
    for oy in range(size):
        for ox in range(size):
            rs = gs = bs = as_ = 0
            for dy in range(SS):
                base = ((oy * SS + dy) * W + ox * SS) * 4
                for dx in range(SS):
                    p = base + dx * 4
                    rs += buf[p]; gs += buf[p + 1]; bs += buf[p + 2]; as_ += buf[p + 3]
            o = (oy * size + ox) * 4
            out[o:o + 4] = bytes((rs // n, gs // n, bs // n, as_ // n))
    return bytes(out)


def png_bytes(size, rgba):
    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)
        raw += rgba[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data +
                struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) +
            chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))


def ico_bytes(pngs):
    """PNG-in-ICO（Vista+ 全部支持，体积小）"""
    n = len(pngs)
    head = struct.pack('<HHH', 0, 1, n)
    offset = 6 + 16 * n
    entries = b''
    for size, data in pngs:
        entries += struct.pack('<BBBBHHII', 0 if size >= 256 else size,
                               0 if size >= 256 else size, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    return head + entries + b''.join(d for _, d in pngs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--c1', default='#1e3a8a', help='渐变起始色')
    ap.add_argument('--c2', default='#3b82f6', help='渐变结束色')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets'))
    a = ap.parse_args()

    os.makedirs(a.out, exist_ok=True)
    pngs = []
    for size in (16, 24, 32, 48, 64, 128, 256):
        pngs.append((size, png_bytes(size, render(size, a.c1, a.c2))))
    big = png_bytes(512, render(512, a.c1, a.c2))

    with open(os.path.join(a.out, 'icon.png'), 'wb') as f:
        f.write(big)
    with open(os.path.join(a.out, 'icon.ico'), 'wb') as f:
        f.write(ico_bytes(pngs))

    print('已生成：')
    print('  ' + os.path.join(a.out, 'icon.png') + '  (512×512, %d bytes)' % len(big))
    print('  ' + os.path.join(a.out, 'icon.ico') + '  (7 尺寸, %d bytes)' % len(ico_bytes(pngs)))


if __name__ == '__main__':
    main()
