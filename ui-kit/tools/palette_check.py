#!/usr/bin/env python3
# 计算各候选色在浅底/深底下的 WCAG 对比度，并给出色块上的最佳文字色。
# 用法：python palette_check.py
import math

WHITE = (255, 255, 255)
DARK  = (43, 43, 43)      # UI Kit 深色 surface (#2b2b2b)
BLACKTEXT = (31, 31, 31)  # 近黑文字 (#1f1f1f)

def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def lum(rgb):
    r, g, b = [lin(x) for x in rgb]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def hx(s):
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))

def best_text(rgb):
    cw = contrast(rgb, WHITE)
    cb = contrast(rgb, BLACKTEXT)
    if cw >= cb:
        return ('#FFFFFF 白字', round(cw, 2))
    return ('#1F1F1F 黑字', round(cb, 2))

schemes = {
    'A 政务高对比': {
        'blue':   '#0072B2',
        'teal':   '#2B9C93',
        'purple': '#6A2063',
        'orange': '#E5682A',
    },
    'B Okabe-Ito 色盲安全': {
        'orange':        '#E69F00',
        'skyblue':       '#56B4E9',
        'bluishgreen':   '#009E73',
        'yellow':        '#F0E442',
        'blue':          '#0072B2',
        'vermilion':     '#D55E00',
        'reddishpurple': '#CC79A7',
    },
    'C 现代明快': {
        'indigo':  '#4F46E5',
        'emerald': '#10B981',
        'amber':   '#F59E0B',
        'rose':    '#F43F5E',
    },
    'D 柔和商务': {
        'slateblue': '#5B7DB1',
        'sage':      '#6F9E7E',
        'sand':      '#C2A35A',
        'mauve':     '#9B7BA8',
    },
    'E 语义状态色': {
        'success': '#0E700E',
        'warning': '#BC4B09',
        'error':   '#C42B1C',
        'info':    '#0F6CBD',
    },
}

variants = {
    'A 深底变体': {
        'blue_dark':   '#56B4E9',
        'purple_dark': '#B07CC6',
        'orange_dark': '#F0A35E',
        'teal_dark':   '#2B9C93',
    },
    'C 浅底变体': {
        'emerald_light': '#059669',
        'amber_light':   '#B45309',
        'rose_light':    '#E11D48',
        'indigo_light':  '#4F46E5',
    },
    'C 深底变体': {
        'emerald_dark': '#34D399',
        'amber_dark':   '#FBBF24',
        'rose_dark':    '#FB7185',
        'indigo_dark':  '#818CF8',
    },
}
for name, cols in {**variants}.items():
    print('\n==== %s（变体，验证是否达标）====' % name)
    print('%-16s %-9s %8s %8s %12s' % ('color', 'hex', '浅底对比', '深底对比', '色块最佳文字'))
    for label, h in cols.items():
        rgb = hx(h)
        cw = round(contrast(rgb, WHITE), 2)
        cd = round(contrast(rgb, DARK), 2)
        bt = best_text(rgb)
        flag = ''
        if cw < 3: flag += ' [浅底<3:1!]'
        if cd < 3: flag += ' [深底<3:1!]'
        print('%-16s %-9s %8s %8s %-14s%s' % (label, h, cw, cd, bt[0], flag))

for name, cols in schemes.items():
    print('\n==== %s ====' % name)
    print('%-14s %-9s %8s %8s %12s' % ('color', 'hex', '浅底对比', '深底对比', '色块最佳文字'))
    for label, h in cols.items():
        rgb = hx(h)
        cw = round(contrast(rgb, WHITE), 2)
        cd = round(contrast(rgb, DARK), 2)
        bt = best_text(rgb)
        flag = ''
        if cw < 3: flag += ' [浅底<3:1!]'
        if cd < 3: flag += ' [深底<3:1!]'
        print('%-14s %-9s %8s %8s %-14s%s' % (label, h, cw, cd, bt[0], flag + ' ' + str(bt[1])))
