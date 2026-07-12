/**
 * 生成指南词库：角色类型、风格词库（4 组）、情绪词库（5 组）、排列方式。
 * 权威来源：docs/01-Requirements/2026-07-11-sticker-studio-prd.md §8.2-8.4/§8.5，全量收录，不做删减。
 * 这是数据而非 UI 文案，因此不走 i18n，直接携带 zh/en 字段。
 */

export interface WordEntry {
  id: string
  zh: string
  en: string
}

export interface WordGroup {
  id: string
  zh: string
  en: string
  items: WordEntry[]
}

/** PRD §8.2 角色类型示例，10 条（含自定义形象）。 */
export const CHARACTER_TYPES: WordEntry[] = [
  { id: 'chibiGirl', zh: 'Q 版小女孩', en: 'chibi girl' },
  { id: 'chibiBoy', zh: 'Q 版小男孩', en: 'chibi boy' },
  { id: 'rabbit', zh: '小兔子', en: 'little rabbit' },
  { id: 'cat', zh: '小猫', en: 'little cat' },
  { id: 'bear', zh: '小熊', en: 'little bear' },
  { id: 'ghost', zh: '小幽灵', en: 'little ghost' },
  { id: 'cloud', zh: '小云朵', en: 'little cloud' },
  { id: 'mochi', zh: '糯米团子', en: 'mochi dumpling' },
  { id: 'waterdrop', zh: '水滴角色', en: 'water-drop character' },
  { id: 'custom', zh: '自定义形象', en: 'custom character' },
]

/** PRD §8.3 风格词库，4 组全量收录。 */
export const STYLE_GROUPS: WordGroup[] = [
  {
    id: 'soft',
    zh: '柔和风格',
    en: 'Soft styles',
    items: [
      { id: 'lightWatercolor', zh: '轻水彩', en: 'light watercolor' },
      { id: 'handDrawnWatercolor', zh: '水彩手绘', en: 'hand-drawn watercolor' },
      { id: 'coloredPencil', zh: '彩铅', en: 'colored pencil' },
      { id: 'crayon', zh: '蜡笔', en: 'crayon' },
      { id: 'pastel', zh: '粉彩', en: 'pastel' },
      { id: 'softPaperTexture', zh: '柔和纸张质感', en: 'soft paper texture' },
      { id: 'lowSaturationPalette', zh: '低饱和配色', en: 'low-saturation palette' },
      { id: 'healing', zh: '治愈系', en: 'healing, soothing style' },
      { id: 'gentlePictureBook', zh: '温柔童书插画', en: 'gentle picture-book illustration' },
    ],
  },
  {
    id: 'simple',
    zh: '简洁风格',
    en: 'Simple / clean styles',
    items: [
      { id: 'simpleLineDrawing', zh: '简笔画', en: 'simple line drawing' },
      { id: 'minimalistLineArt', zh: '极简线条', en: 'minimalist line art' },
      { id: 'flatIllustration', zh: '扁平插画', en: 'flat illustration' },
      { id: 'monochromeLineArt', zh: '单色线稿', en: 'monochrome line art' },
      { id: 'softVectorIllustration', zh: '柔和矢量插画', en: 'soft vector illustration' },
      { id: 'thickOutlineSticker', zh: '粗轮廓贴纸', en: 'thick-outline sticker' },
      { id: 'iconStyleCharacter', zh: '图标式角色', en: 'icon-style character' },
    ],
  },
  {
    id: 'cute',
    zh: '可爱风格',
    en: 'Cute styles',
    items: [
      { id: 'chibi', zh: 'Q 版', en: 'chibi' },
      { id: 'softAndAdorable', zh: '软萌', en: 'soft and adorable' },
      { id: 'roundedProportions', zh: '圆润比例', en: 'rounded proportions' },
      { id: 'bigHeadSmallBody', zh: '大头小身体', en: 'big head, small body' },
      { id: 'slightlyExaggeratedExpressions', zh: '轻微夸张表情', en: 'slightly exaggerated expressions' },
      { id: 'japaneseCuteIllustration', zh: '日系可爱插画', en: 'Japanese-style cute illustration' },
      { id: 'cartoonStickerStyle', zh: '卡通贴纸风', en: 'cartoon sticker style' },
    ],
  },
  {
    id: 'other',
    zh: '其他风格',
    en: 'Other styles',
    items: [
      { id: 'pixelArt', zh: '像素画', en: 'pixel art' },
      { id: 'clayStyle', zh: '黏土风', en: 'clay style' },
      { id: 'feltDollStyle', zh: '毛毡玩偶风', en: 'felt doll style' },
      { id: 'paperCutStyle', zh: '剪纸风', en: 'paper-cut style' },
      { id: 'paperCarvingStyle', zh: '纸雕风', en: 'paper-carving style' },
      { id: 'journalStyle', zh: '手账风', en: 'journal / scrapbook style' },
      { id: 'childrensPictureBookStyle', zh: '儿童绘本风', en: "children's picture-book style" },
    ],
  },
]

/** PRD §8.4 情绪词库，5 组全量收录（每组一条不落）。 */
export const MOOD_GROUPS: WordGroup[] = [
  {
    id: 'happy',
    zh: '开心与积极',
    en: 'Happy & positive',
    items: [
      { id: 'happy', zh: '开心', en: 'happy' },
      { id: 'superHappy', zh: '超开心', en: 'super happy' },
      { id: 'mildlyHappy', zh: '小开心', en: 'a little happy' },
      { id: 'yay', zh: '好耶', en: 'yay' },
      { id: 'heheh', zh: '嘿嘿', en: 'heh-heh' },
      { id: 'notBadToday', zh: '今天还不错', en: "today's not bad" },
      { id: 'feelingWarm', zh: '暖暖的', en: 'feeling warm' },
      { id: 'feelingHealed', zh: '被治愈了', en: 'feeling healed' },
      { id: 'feelingComforted', zh: '有被安慰到', en: 'feeling comforted' },
      { id: 'atEase', zh: '安心', en: 'at ease' },
      { id: 'content', zh: '满足', en: 'content' },
      { id: 'proud', zh: '骄傲', en: 'proud' },
      { id: 'lookingForwardToIt', zh: '期待', en: 'looking forward to it' },
      { id: 'touched', zh: '感动', en: 'touched, moved' },
      { id: 'fullOfEnergy', zh: '充满元气', en: 'full of energy' },
      { id: 'doubleTheHappiness', zh: '快乐加倍', en: 'double the happiness' },
    ],
  },
  {
    id: 'sad',
    zh: '委屈与难过',
    en: 'Wronged & sad',
    items: [
      { id: 'feelingWronged', zh: '委屈', en: 'feeling wronged' },
      { id: 'extremelyWronged', zh: '超级委屈', en: 'extremely wronged' },
      { id: 'wantToCry', zh: '想哭', en: 'want to cry' },
      { id: 'aboutToCry', zh: '快哭了', en: 'about to cry' },
      { id: 'tearyEyed', zh: '眼泪汪汪', en: 'teary-eyed' },
      { id: 'soSad', zh: '好难过', en: 'so sad' },
      { id: 'heartFeelsSour', zh: '心里酸酸的', en: 'heart feels sour' },
      { id: 'heartFeelsHeavy', zh: '心里堵堵的', en: 'heart feels heavy' },
      { id: 'feelingDown', zh: '失落', en: 'feeling down' },
      { id: 'hopesLetDown', zh: '白期待了', en: 'hopes let down for nothing' },
      { id: 'feelingIgnored', zh: '被忽视了', en: 'feeling ignored' },
      { id: 'nobodyUnderstandsMe', zh: '没人懂我', en: 'nobody understands me' },
      { id: 'heartTurnedCold', zh: '心凉了', en: 'heart turned cold' },
      { id: 'emotionallyOverwhelmed', zh: '破防了', en: 'emotionally overwhelmed' },
      { id: 'imNotOkay', zh: '我不好了', en: "I'm not okay" },
      { id: 'hugMe', zh: '抱抱我', en: 'hug me' },
    ],
  },
  {
    id: 'angry',
    zh: '生气与无语',
    en: 'Angry & speechless',
    items: [
      { id: 'angry', zh: '生气了', en: 'angry' },
      { id: 'superMad', zh: '超气', en: 'super mad' },
      { id: 'puffedUpWithAnger', zh: '气鼓鼓', en: 'puffed up with anger' },
      { id: 'laughingOutOfAnger', zh: '被气笑了', en: 'laughing out of anger' },
      { id: 'speechless', zh: '无语', en: 'speechless' },
      { id: 'utterlySpeechless', zh: '大无语', en: 'utterly speechless' },
      { id: 'thatsAbsurd', zh: '真离谱', en: "that's absurd" },
      { id: 'soAnnoyed', zh: '好烦啊', en: 'so annoyed' },
      { id: 'soFedUp', zh: '烦死了', en: 'so fed up' },
      { id: 'stifled', zh: '憋屈', en: 'stifled, frustrated' },
      { id: 'displeased', zh: '不爽', en: 'displeased' },
      { id: 'dontMessWithMe', zh: '别惹我', en: "don't mess with me" },
      { id: 'furious', zh: '火大', en: 'furious' },
      { id: 'cantTakeItAnymore', zh: '忍不了了', en: "can't take it anymore" },
      { id: 'illRememberThis', zh: '我记住了', en: "I'll remember this" },
      { id: 'thanksALotSarcastic', zh: '真的谢了', en: 'thanks a lot (sarcastic)' },
    ],
  },
  {
    id: 'lowEnergy',
    zh: '放空与低能量',
    en: 'Spacing out & low energy',
    items: [
      { id: 'zoningOut', zh: '放空中', en: 'zoning out' },
      { id: 'daydreaming', zh: '发呆', en: 'daydreaming' },
      { id: 'frozenInPlace', zh: '呆住', en: 'frozen in place' },
      { id: 'mindBlank', zh: '脑子空空', en: 'mind blank' },
      { id: 'outOfBattery', zh: '没电了', en: 'out of battery' },
      { id: 'lowBattery', zh: '电量不足', en: 'low battery' },
      { id: 'tired', zh: '累了', en: 'tired' },
      { id: 'emotionallyExhausted', zh: '心累', en: 'emotionally exhausted' },
      { id: 'givingUpForToday', zh: '今天摆烂', en: 'giving up for today' },
      { id: 'dontWantToDoAnything', zh: '什么都不想做', en: "don't want to do anything" },
      { id: 'dontWantToTalk', zh: '不想说话', en: "don't want to talk" },
      { id: 'tooLazyToExplain', zh: '懒得解释', en: 'too lazy to explain' },
      { id: 'needSomeQuiet', zh: '需要静静', en: 'need some quiet' },
      { id: 'hardToExplain', zh: '一言难尽', en: 'hard to explain in a word' },
      { id: 'aBitAnxious', zh: '有点焦虑', en: 'a bit anxious' },
      { id: 'needAMoment', zh: '我需要缓缓', en: 'I need a moment' },
    ],
  },
  {
    id: 'recovery',
    zh: '释怀与恢复',
    en: 'Letting go & recovery',
    items: [
      { id: 'cameToTermsWithIt', zh: '想开了', en: 'came to terms with it' },
      { id: 'bouncedBack', zh: '缓过来了', en: 'bounced back' },
      { id: 'suddenlyLetGo', zh: '突然释怀了', en: 'suddenly let go' },
      { id: 'itsOkayNow', zh: '没事了', en: "it's okay now" },
      { id: 'itllBeOkay', zh: '会好的', en: "it'll be okay" },
      { id: 'takeItSlow', zh: '慢慢来', en: 'take it slow' },
      { id: 'letItGo', zh: '放下了', en: 'let it go' },
      { id: 'iAcceptIt', zh: '我接受了', en: 'I accept it' },
      { id: 'startingOver', zh: '重新开始', en: 'starting over' },
      { id: 'recovering', zh: '恢复中', en: 'recovering' },
    ],
  },
]

/** PRD §8.5/§8.7 排列方式：单张单表情 + 4 种规则拼图。 */
export interface ArrangementOption {
  id: 'single' | '2x2' | '2x4' | '3x3' | '4x4'
  zh: string
  en: string
  rows?: number
  cols?: number
}

export const ARRANGEMENTS: ArrangementOption[] = [
  { id: 'single', zh: '单张单表情', en: 'Single sticker' },
  { id: '2x2', zh: '2×2', en: '2×2', rows: 2, cols: 2 },
  { id: '2x4', zh: '2×4', en: '2×4', rows: 2, cols: 4 },
  { id: '3x3', zh: '3×3', en: '3×3', rows: 3, cols: 3 },
  { id: '4x4', zh: '4×4', en: '4×4', rows: 4, cols: 4 },
]
