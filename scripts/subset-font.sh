#!/usr/bin/env bash
# 把 Noto Serif SC（可变字重）裁成只含游戏用字的 woff2。需要 fonttools + brotli。
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-/tmp/NotoSerifSC.ttf}"
[ -f "$SRC" ] || curl -sL -o "$SRC" 'https://github.com/google/fonts/raw/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf'
cat index.html src/*.js > /tmp/ember-text.txt
python3 -m fontTools.subset "$SRC" --text-file=/tmp/ember-text.txt --unicodes='U+0020-007E,U+2190-2199,U+25CB,U+25CF,U+266A,U+2212' \
  --flavor=woff2 --output-file=public/noto-serif-sc.woff2 --layout-features='*'
ls -la public/noto-serif-sc.woff2
