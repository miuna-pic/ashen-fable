// 立绘表。和 DOM 无关，测试也读它。
// 每个角色的表情；第一个是默认。文件在 public/art/vn/<角色>_<表情>.webp。
export const SPRITES = {
  a: ['neutral', 'shock', 'sad', 'resolve'], b: ['cold', 'smile', 'sorrow'], cat: ['grin', 'sly'], queen: ['rage', 'smirk'],
  shadow: ['still', 'crack'], rook: ['still'], soldier: ['still'], hollow: ['still'], wk: ['cheer', 'sad'],
  cinder: ['wist', 'stern'], match: ['soft', 'fear'], egg: ['smug', 'alarm'],
};
export const BODY = { b2: 'b' };            // 声音暗下去的她，还是她的身体
export const sprite = (who, mood) => { const k = BODY[who] || who, m = SPRITES[k]; return m ? `./art/vn/${k}_${m.includes(mood) ? mood : m[0]}.webp` : null; };
