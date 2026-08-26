#!/usr/bin/env python3
"""生成 NSIS 安装器的品牌位图（深空底 + 极光带），仅依赖标准库。

- installer-header.bmp  150x57   安装页头部右侧
- installer-sidebar.bmp 164x314  欢迎/完成页左侧大图
NSIS MUI2 要求 24 位 BMP；尺寸必须精确，否则会被拉伸变形。
"""

import struct

HEADER = (150, 57)
SIDEBAR = (164, 314)

# 深空背景：顶部 #0D1018 → 底部略深
BG_TOP = (13, 16, 24)
BG_BOTTOM = (8, 10, 16)
# 极光渐变两端（tokens.css 同源）：#5EEAD4 → #818CF8
AURORA_FROM = (94, 234, 212)
AURORA_TO = (129, 140, 248)


def lerp(a, b, t):
    return a + (b - a) * t


def clamp255(v):
    return int(max(0.0, min(255.0, v)))


def pixel(x, y, w, h):
    """返回 (B, G, R)。内部全程 RGB，仅输出时转 BMP 的 BGR 序。"""
    ty = y / (h - 1)
    r = lerp(BG_TOP[0], BG_BOTTOM[0], ty)
    g = lerp(BG_TOP[1], BG_BOTTOM[1], ty)
    b = lerp(BG_TOP[2], BG_BOTTOM[2], ty)

    # 极光带：色相全程跟随 d（左下青 → 右上靖），双层高斯模拟帷幕
    d = (x / w + (1 - y / h)) / 2
    dist2 = (d - 0.5) ** 2
    band = pow(2.718281828, -dist2 / (2 * 0.20**2))
    band += pow(2.718281828, -((d - 0.74) ** 2) / (2 * 0.06**2)) * 0.5
    s = min(1.0, band) * 0.8

    ar = lerp(AURORA_FROM[0], AURORA_TO[0], d)
    ag = lerp(AURORA_FROM[1], AURORA_TO[1], d)
    ab = lerp(AURORA_FROM[2], AURORA_TO[2], d)

    r += (ar - r) * s
    g += (ag - g) * s
    b += (ab - b) * s

    # 细噪点抗条带（确定性伪随机，构建可重现）
    n = ((x * 374761393 + y * 668265263) & 0xFFFF) / 0xFFFF - 0.5
    r += n * 3
    g += n * 3
    b += n * 3

    return (clamp255(b), clamp255(g), clamp255(r))


def write_bmp(path, size):
    w, h = size
    row_size = (w * 3 + 3) // 4 * 4  # 4 字节对齐
    data = bytearray()
    for y in range(h - 1, -1, -1):  # BMP 自底向上
        for x in range(w):
            data += bytes(pixel(x, y, w, h))
    padding = b"\x00" * (row_size - w * 3)
    if padding:
        rows = []
        for i in range(h):
            start = i * w * 3
            rows.append(data[start : start + w * 3] + padding)
        data = b"".join(rows)

    header = struct.pack(
        "<2sIHHIIiiHHIIiiII",
        b"BM",
        54 + len(data),
        0,
        0,
        54,
        40,
        w,
        h,
        1,
        24,
        0,
        len(data),
        2835,
        2835,
        0,
        0,
    )
    with open(path, "wb") as f:
        f.write(header + data)
    print(f"{path}: {w}x{h}, {len(header)+len(data)} bytes")


if __name__ == "__main__":
    write_bmp("src-tauri/images/installer-header.bmp", HEADER)
    write_bmp("src-tauri/images/installer-sidebar.bmp", SIDEBAR)
