#!/usr/bin/env python3
"""
把系统里的 Noto Sans CJK 抽出简体那一面并做子集,给 next/og 渲染卡片用。

为什么要这一步:
  1. Satori(next/og 底层)只吃单面的 TTF/OTF,吃不了 .ttc 字体集合;
  2. 完整的 CJK 一面有 4000 万字形、十几 MB,两个字重塞进 serverless 函数
     会明显拖慢冷启动;
  3. 但又不能随便砍——这个系统生成的是任意中文文案,砍掉的字会渲染成豆腐块。

折中:留 GB2312 全量(6763 字,覆盖现代简体中文的日常用字)+ 常用标点 +
拉丁字母数字 + 全角符号。实测每个字重约 3-4MB,两个字重加起来在可接受范围内。

用法:python3 scripts/build-fonts.py
产物:public/fonts/NotoSansSC-{Regular,Bold}.subset.ttf
"""
import os
import sys
from fontTools.ttLib import TTCollection
from fontTools.subset import Subsetter, Options

SRC = '/usr/share/fonts/opentype/noto/NotoSansCJK-{weight}.ttc'
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts')
FACE_NAME = 'Noto Sans CJK SC'


def gb2312_chars():
    """GB2312 的全部汉字。用编码表反推,比维护一张字表可靠"""
    chars = set()
    for hi in range(0xB0, 0xF8):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError:
                pass
    # GB2312 的一二级汉字之外,还有符号区(A1-A9),标点和全角字母都在那儿
    for hi in range(0xA1, 0xAA):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError:
                pass
    return chars


def extra_chars():
    """GB2312 里没有但版式上一定会用到的"""
    s = set()
    # 基本拉丁 + 常用符号
    for i in range(0x20, 0x7F):
        s.add(chr(i))
    # 直角引号「」『』、破折号、省略号、货币、箭头、项目符号
    s.update('「」『』〈〉《》【】—…·•‧°％＄￥€£→←↑↓✓✕±×÷≈≤≥№')
    # 中文常用标点(部分已在 A1 区,补齐保险)
    s.update('，。、；:？！""''（）《》〔〕')
    return s


def build(weight: str, face_name: str, out_name: str, unicodes):
    path = SRC.format(weight=weight)
    if not os.path.exists(path):
        sys.exit(f'找不到字体:{path}')

    ttc = TTCollection(path, lazy=True)
    font = None
    for f in ttc.fonts:
        # 认族名(name ID 1)而不是全名(ID 4)。Bold 的全名是「Noto Sans CJK SC Bold」,
        # 按全名精确匹配会找不到;族名两个字重都是「Noto Sans CJK SC」,
        # 而等宽那一族叫「Noto Sans Mono CJK SC」,精确相等就能把它排除掉。
        family = (f['name'].getDebugName(1) or '').strip()
        if family == face_name:
            font = f
            break
    if font is None:
        sys.exit(f'{path} 里没有 {face_name}')

    opts = Options()
    # 版式里没有用到连字和旧式数字,砍掉能省不少
    opts.layout_features = ['kern', 'liga', 'locl', 'ccmp', 'vert']
    opts.name_IDs = ['*']
    opts.name_legacy = True
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.drop_tables += ['DSIG']

    sub = Subsetter(options=opts)
    sub.populate(unicodes=unicodes)
    sub.subset(font)

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, out_name)
    font.flavor = None
    font.save(out)
    size = os.path.getsize(out) / 1024 / 1024
    print(f'  {out_name:34s} {size:5.2f} MB  字形 {len(font.getGlyphOrder())}')


def main():
    chars = gb2312_chars() | extra_chars()
    unicodes = sorted(ord(c) for c in chars if len(c) == 1)
    print(f'子集字符数 {len(unicodes)}')
    build('Regular', FACE_NAME, 'NotoSansSC-Regular.subset.ttf', unicodes)
    build('Bold', FACE_NAME, 'NotoSansSC-Bold.subset.ttf', unicodes)


if __name__ == '__main__':
    main()
