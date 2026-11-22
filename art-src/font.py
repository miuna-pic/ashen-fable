# Subsets Noto Serif SC (variable, OFL) to the glyphs the game uses.
# usage: python3 art-src/font.py /path/to/NotoSerifSC[wght].ttf
import sys, glob, subprocess
chars = set()
for f in glob.glob('src/*') + ['index.html']:
    chars |= set(open(f, encoding='utf-8').read())
chars |= set('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-·—：，。、「」（）×→')
text = ''.join(sorted(c for c in chars if ord(c) > 32))
subprocess.check_call(['pyftsubset', sys.argv[1], '--text=' + text, '--flavor=woff2', '--output-file=public/noto-serif-sc.woff2', '--layout-features=*'])
print(len(text), 'glyphs')
