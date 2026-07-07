/* =============================================================================
 * 知星 V1 · 四柱排盘引擎(确定性内核)
 * 铁律 1:计算归程序,解释归 AI —— 本文件只产出可复算的盘面事实,零断语。
 *
 * 精度声明(写进 meta,报告层必须如实展示):
 * - 节气:太阳视黄经天文近似(Meeus 低精度),时刻误差约 ±15 分钟;
 *   出生时刻距立春/月节 < 2 小时 → boundary 告警,提示需权威万年历精校。
 * - 真太阳时:经度差 + 均时差(误差 < 1 分钟);城市未收录 → 按 120°E 并标注。
 * - 输入时间按东八区(北京时间)解释。
 * - 晚子时(23:00–23:59)按次日日柱起时柱(与 V0 dayPillar 规则一致,派别注明)。
 * - 日主强弱为简化计分模型 v1(得令/得地/得势加权),供解释层引用,非断语。
 * - 西盘三要素(回归黄道):太阳黄经同引擎复用;月亮黄经 Meeus 主项截断(±0.3°,
 *   足以定星座,近宫界另行标注);上升点由恒星时+城市经纬度解出。与八字同刻同源。
 *
 * 同构:Node(单测/后端)与浏览器(demo)均可运行。零依赖。
 * ========================================================================== */
'use strict';

const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const STEM_ELEM = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const STEM_YANG = { 甲:1,乙:0,丙:1,丁:0,戊:1,己:0,庚:1,辛:0,壬:1,癸:0 };
const BRANCH_ELEM = { 子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水' };
/* 地支藏干(本气/中气/余气),取通行版本 */
const HIDDEN = {
  子:['癸'], 丑:['己','癸','辛'], 寅:['甲','丙','戊'], 卯:['乙'],
  辰:['戊','乙','癸'], 巳:['丙','庚','戊'], 午:['丁','己'], 未:['己','丁','乙'],
  申:['庚','壬','戊'], 酉:['辛'], 戌:['戊','辛','丁'], 亥:['壬','甲']
};
const HIDDEN_W = [1, 0.6, 0.3];          // 本气/中气/余气 权重
const GEN = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' };   // 我生
const KE  = { 木:'土', 土:'水', 水:'火', 火:'金', 金:'木' };   // 我克

/* ---------------- 天文:儒略日 / 太阳视黄经 / 均时差 ---------------- */
function toJD(utcMs){ return utcMs / 86400000 + 2440587.5; }
function sunGeom(jd){
  const T = (jd - 2451545.0) / 36525;
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M  = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mr = M * Math.PI / 180;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
          + 0.000289 * Math.sin(3 * Mr);
  const trueLon = L0 + C;
  const omega = (125.04 - 1934.136 * T) * Math.PI / 180;
  const appLon = norm360(trueLon - 0.00569 - 0.00478 * Math.sin(omega));
  return { T, L0, appLon };
}
function norm360(d){ d %= 360; return d < 0 ? d + 360 : d; }
function wrap180(d){ d = norm360(d); return d > 180 ? d - 360 : d; }
/* 太阳视黄经(deg),输入 UTC 毫秒 */
function sunLon(utcMs){ return sunGeom(toJD(utcMs)).appLon; }
/* 求太阳黄经到达 targetDeg 的 UTC 时刻(在 guessMs 附近牛顿迭代) */
function solarTermTime(targetDeg, guessMs){
  let t = guessMs;
  for (let i = 0; i < 6; i++){
    const diff = wrap180(sunLon(t) - targetDeg);        // deg
    t -= diff / 0.98565 * 86400000;                      // 太阳日行 ≈0.98565°
    if (Math.abs(diff) < 1e-5) break;
  }
  return t;
}
/* 均时差(分钟):真太阳时 - 平太阳时 */
function equationOfTime(utcMs){
  const { T, L0, appLon } = sunGeom(toJD(utcMs));
  const eps = (23.43929 - 0.01300 * T) * Math.PI / 180;
  const lam = appLon * Math.PI / 180;
  let ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * 180 / Math.PI;
  return wrap180(L0 - 0.0057183 - norm360(ra)) * 4;      // deg→min
}

/* ---------------- 西盘:太阳/月亮/上升(回归黄道) ---------------- */
const SIGNS = ['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座'];
const signOf = lon => SIGNS[Math.floor(norm360(lon) / 30)];
const D2R = Math.PI / 180;

/* 月亮地心视黄经(Meeus 主项截断,精度约 ±0.3°,足以定星座) */
function moonLon(utcMs){
  const T = (toJD(utcMs) - 2451545.0) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D  = (297.8501921 + 445267.1114034 * T - 0.0018819 * T * T) * D2R;
  const M  = (357.5291092 + 35999.0502909 * T - 0.0001536 * T * T) * D2R;
  const Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T * T) * D2R;
  const F  = (93.2720950 + 483202.0175233 * T - 0.0036539 * T * T) * D2R;
  const s = Math.sin;
  return norm360(Lp
    + 6.288774 * s(Mp)         + 1.274027 * s(2*D - Mp)     + 0.658314 * s(2*D)
    + 0.213618 * s(2*Mp)       - 0.185116 * s(M)            - 0.114332 * s(2*F)
    + 0.058793 * s(2*D - 2*Mp) + 0.057066 * s(2*D - M - Mp) + 0.053322 * s(2*D + Mp)
    + 0.045758 * s(2*D - M)    - 0.040923 * s(M - Mp)       - 0.034720 * s(D)
    - 0.030383 * s(M + Mp)     + 0.015327 * s(2*D - 2*F)    - 0.012528 * s(Mp + 2*F)
    + 0.010980 * s(Mp - 2*F));
}

/* 上升点黄经:恒星时 + 纬度解黄道升点
 * 锚点自检(解析可证):LST=90° → 180°(天秤 0°);LST=270° → 0°(白羊 0°) */
function ascendantLon(utcMs, latDeg, lonEastDeg){
  const jd = toJD(utcMs), T = (jd - 2451545.0) / 36525;
  const gmst = norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0));
  const lst = (gmst + lonEastDeg) * D2R;
  const eps = (23.4392911 - 0.0130042 * T) * D2R;
  const y = Math.cos(lst);
  const x = -(Math.sin(lst) * Math.cos(eps) + Math.tan(latDeg * D2R) * Math.sin(eps));
  return norm360(Math.atan2(y, x) / D2R);
}

/* ---------------- 节气(十二节定月 + 立春定年) ---------------- */
/* 近似日期(月,日):作为牛顿迭代初猜 */
const JIE = [ // 十二"节"(定月边界):黄经 315°起 寅月
  { name:'立春', lon:315, m:2,  d:4 },  { name:'惊蛰', lon:345, m:3,  d:6 },
  { name:'清明', lon:15,  m:4,  d:5 },  { name:'立夏', lon:45,  m:5,  d:6 },
  { name:'芒种', lon:75,  m:6,  d:6 },  { name:'小暑', lon:105, m:7,  d:7 },
  { name:'立秋', lon:135, m:8,  d:8 },  { name:'白露', lon:165, m:9,  d:8 },
  { name:'寒露', lon:195, m:10, d:8 },  { name:'立冬', lon:225, m:11, d:7 },
  { name:'大雪', lon:255, m:12, d:7 },  { name:'小寒', lon:285, m:1,  d:6 }
];
/* 某公历年 y 的某节气 UTC 时刻 */
function jieTime(y, jie){
  const guess = Date.UTC(y, jie.m - 1, jie.d, 4, 0, 0);  // 初猜当天 12:00 北京时
  return solarTermTime(jie.lon, guess);
}

/* ---------------- 干支基础 ---------------- */
/* 日柱:2000-01-01 = 戊午(序 54),23 点后进次日 —— 与 V0 一致 */
function dayPillarIndex(y, m, d, hour){
  let diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2000, 0, 1)) / 86400000);
  if (typeof hour === 'number' && hour >= 23) diff += 1;
  return ((54 + diff) % 60 + 60) % 60;
}
const P = i => ({ stem: STEMS[i % 10], branch: BRANCHES[i % 12] });

/* ---------------- 十神 ---------------- */
function tenGod(dayStem, otherStem){
  if (otherStem === undefined || otherStem === null) return null;
  const de = STEM_ELEM[dayStem], oe = STEM_ELEM[otherStem];
  const same = STEM_YANG[dayStem] === STEM_YANG[otherStem];
  if (oe === de)      return same ? '比肩' : '劫财';
  if (GEN[de] === oe) return same ? '食神' : '伤官';
  if (KE[de] === oe)  return same ? '偏财' : '正财';
  if (KE[oe] === de)  return same ? '七杀' : '正官';
  if (GEN[oe] === de) return same ? '偏印' : '正印';
  return null;
}

/* ---------------- 主入口 ----------------
 * input: { y, m, d, hh, mm, city }  (北京时间;hh/mm 可省略 → 不排时柱)
 * ------------------------------------- */
/* 地级市经纬度库(357 城,来源 China_City_Geolocation_List,MIT;补宁波)*/
const CITY = {
  南充:[106.08,30.78], 漳州:[117.65,24.52], 清远:[113.03,23.7], 黄南:[102.02,35.52],
  莆田:[119.0,25.43], 佛山:[113.12,23.02], 大理:[100.23,25.6], 塔城:[82.98,46.75],
  鹰潭:[117.07,28.27], 三亚:[109.5,18.25], 海口:[110.32,20.03], 连江:[119.53,26.2],
  鹤岗:[130.27,47.33], 鸡西:[130.97,45.3], 宜宾:[104.55,28.7], 安阳:[114.38,36.1],
  通辽:[122.27,43.62], 呼和浩特:[111.73,40.83], 黑河:[127.48,50.25], 榆林:[109.73,38.28],
  茂名:[110.92,21.67], 嘉义:[120.43,23.48], 厦门:[118.08,24.48], 宿州:[116.98,33.63],
  阿坝:[101.7,32.9], 南宁:[108.37,22.82], 文山:[104.25,23.37], 海北:[100.9,36.97],
  揭阳:[116.37,23.55], 伊春:[128.9,47.73], 三门峡:[111.2,34.78], 柳州:[109.42,24.33],
  东莞:[113.75,23.05], 三明:[117.62,26.27], 周口:[114.65,33.62], 安庆:[117.05,30.53],
  德宏:[98.58,24.43], 上饶:[117.92,28.43], 安康:[109.02,32.68], 玉溪:[102.55,24.35],
  武汉:[114.3,30.6], 池州:[117.48,30.67], 开封:[114.3,34.8], 内江:[105.05,29.58],
  临沂:[118.35,35.05], 淮南:[117.0,32.63], 朝阳:[120.47,41.58], 随州:[113.37,31.72],
  定西:[104.62,35.58], 临沧:[100.08,23.88], 吐鲁番:[89.17,42.95], 金昌:[102.18,38.5],
  彰化:[120.53,24.08], 六安:[116.5,31.77], 遵义:[106.92,27.73], 泰安:[117.08,36.2],
  南通:[120.88,31.98], 淮北:[116.8,33.95], 凉山:[102.27,27.9], 西双版纳:[100.8,22.02],
  松原:[124.82,45.13], 景德镇:[117.17,29.27], 贵阳:[106.63,26.65], 贵港:[109.6,23.1],
  常州:[119.95,31.78], 吕梁:[111.13,37.52], 澎湖:[119.58,23.58], 荆州:[112.23,30.33],
  扬州:[119.4,32.4], 恩施:[109.47,30.3], 林芝:[94.37,29.68], 四平:[124.35,43.17],
  攀枝花:[101.72,26.58], 澳门:[113.33,22.13], 赣州:[114.93,25.83], 威海:[122.12,37.52],
  荆门:[112.2,31.03], 淮安:[119.02,33.62], 玉林:[110.17,22.63], 衡阳:[112.57,26.9],
  桂林:[110.28,25.28], 红河:[103.4,23.37], 杭州:[120.15,30.28], 临汾:[111.52,36.08],
  青岛:[120.38,36.07], 包头:[109.83,40.65], 广元:[105.83,32.43], 平顶山:[113.18,33.77],
  台州:[121.43,28.68], 甘孜:[101.97,30.05], 甘南:[123.5,47.92], 龙岩:[117.03,25.1],
  庆阳:[107.63,35.73], 保山:[99.17,25.12], 中山:[121.63,38.92], 海南自治州:[102.38,35.9],
  新余:[114.92,27.82], 平凉:[106.67,35.55], 湖州:[120.08,30.9], 湘潭:[112.95,27.78],
  漯河:[114.02,33.58], 乐山:[103.77,29.57], 乌鲁木齐:[87.6,43.8], 乌海:[106.82,39.67],
  重庆:[106.55,29.57], 香港:[114.08,22.2], 焦作:[113.25,35.22], 十堰:[110.78,32.65],
  石嘴山:[106.38,39.02], 宿迁:[118.28,33.97], 合肥:[117.25,31.83], 黄冈:[114.87,30.45],
  孝感:[113.92,30.93], 果洛:[100.23,34.48], 成都:[104.07,30.67], 台东:[121.15,22.75],
  海西:[97.37,37.37], 金门:[118.32,24.43], 保定:[115.47,38.87], 温州:[120.7,28.0],
  延安:[109.48,36.6], 晋城:[112.83,35.5], 邵阳:[111.47,27.25], 鹤壁:[114.28,35.75],
  博尔塔拉:[82.07,44.9], 承德:[117.93,40.97], 日照:[119.52,35.42], 晋中:[112.75,37.68],
  怀化:[110.0,27.57], 潮州:[116.62,23.67], 烟台:[121.43,37.45], 常德:[111.68,29.05],
  亳州:[115.78,33.85], 许昌:[113.83,34.0], 昌吉:[87.3,44.02], 福州:[119.3,26.08],
  抚顺:[123.9,41.88], 济南:[116.98,36.67], 广安:[106.63,30.47], 山南:[91.77,29.23],
  楚雄:[101.55,25.03], 石家庄:[114.52,38.05], 张家界:[110.47,29.13], 吉安:[114.9,27.05],
  肇庆:[112.47,23.05], 信阳:[114.07,32.13], 太原:[112.55,37.87], 辽源:[125.13,42.88],
  齐齐哈尔:[123.95,47.33], 双鸭山:[131.15,46.63], 苏州:[120.58,31.3], 新乡:[113.8,35.2],
  永州:[111.62,26.43], 衢州:[118.87,28.93], 汕头:[116.68,23.35], 聊城:[115.98,36.45],
  和田:[79.92,37.12], 日喀则:[88.88,29.27], 娄底:[112.0,27.73], 黔西南:[105.56,25.41],
  洛阳:[112.45,34.62], 防城港:[108.35,21.7], 咸宁:[114.32,29.85], 盘锦:[122.07,41.12],
  葫芦岛:[120.83,40.72], 钦州:[108.62,21.95], 镇江:[119.45,32.2], 江门:[113.08,22.58],
  酒泉:[98.52,39.75], 南昌:[115.85,28.68], 辽阳:[123.07,41.22], 南投:[120.67,23.92],
  衡水:[115.68,37.73], 宣城:[118.75,30.95], 桃园:[121.3,24.97], 济宁:[116.58,35.42],
  基隆:[121.73,25.13], 固原:[106.28,36.0], 台中:[120.67,24.15], 郴州:[113.02,25.78],
  伊犁:[81.32,43.92], 黔南:[107.52,26.27], 本溪:[123.77,41.3], 锦州:[121.13,41.1],
  大庆:[125.03,46.58], 屏东:[120.48,22.67], 大兴安岭:[124.12,50.42], 商丘:[115.65,34.45],
  高雄:[120.37,22.63], 绍兴:[120.47,30.08], 花莲:[121.6,23.98], 六盘水:[104.83,26.6],
  克孜勒苏柯尔克孜:[76.2,39.76], 湘西:[109.73,28.32], 绥化:[126.98,46.63], 吴忠:[106.2,37.98],
  金华:[119.65,29.08], 无锡:[120.3,31.57], 雅安:[103.0,29.98], 台南:[120.32,23.32],
  临夏:[103.0,35.5], 邢台:[114.48,37.07], 廊坊:[116.7,39.52], 昆明:[102.72,25.05],
  深圳:[114.05,22.55], 邯郸:[114.48,36.62], 运城:[110.98,35.02], 黄石:[115.03,30.2],
  襄樊:[112.15,32.02], 台北:[121.47,25.02], 苗栗:[120.8,24.53], 通化:[125.93,41.73],
  云林:[120.53,23.72], 上海:[121.47,31.23], 潍坊:[119.15,36.7], 贺州:[111.55,24.42],
  普洱:[100.73,23.43], 白城:[122.83,45.62], 资阳:[112.32,28.6], 曲靖:[103.8,25.5],
  长治:[113.03,36.05], 兴安:[124.12,50.42], 湛江:[110.35,21.27], 哈尔滨:[126.53,45.8],
  呼伦贝尔:[119.77,49.22], 渭南:[109.5,34.5], 鞍山:[122.98,41.1], 长沙:[112.93,28.23],
  中卫:[105.18,37.52], 泸州:[105.43,28.87], 陇南:[104.92,33.4], 菏泽:[115.58,35.26],
  德阳:[104.38,31.13], 广州:[113.27,23.13], 阜阳:[115.82,32.9], 岳阳:[113.12,29.15],
  大连:[121.62,38.92], 丹东:[124.38,40.13], 萍乡:[113.85,27.63], 兰州:[103.82,36.07],
  梅州:[116.12,24.28], 嘉峪关:[98.27,39.8], 沈阳:[123.43,41.8], 绵阳:[104.73,31.47],
  海东:[102.12,36.5], 阿勒泰:[88.13,47.85], 遂宁:[105.57,30.52], 泉州:[118.67,24.88],
  河源:[114.7,23.73], 营口:[122.23,40.67], 连云港:[119.22,34.6], 那曲:[92.07,31.48],
  宜昌:[111.28,30.7], 七台河:[130.95,45.78], 滁州:[118.32,32.3], 朔州:[112.43,39.33],
  张家口:[114.88,40.82], 铜陵:[117.78,30.95], 怒江:[98.85,25.85], 牡丹江:[129.6,44.58],
  益阳:[112.32,28.6], 北海:[109.12,21.48], 宜春:[114.38,27.8], 新北:[119.97,31.83],
  天水:[105.72,34.58], 阳泉:[113.57,37.85], 咸阳:[108.7,34.33], 自贡:[104.78,29.35],
  云浮:[112.03,22.92], 安顺:[105.95,26.25], 崇左:[107.37,22.4], 丽江:[100.23,26.88],
  北京:[116.4,39.9], 拉萨:[91.13,29.65], 阿里:[80.1,32.5], 西安:[108.93,34.27],
  宝鸡:[107.13,34.37], 西宁:[101.78,36.62], 丽水:[119.92,28.45], 喀什:[75.98,39.47],
  驻马店:[114.02,32.98], 玉树:[97.02,33.0], 铜川:[108.93,34.9], 莱芜:[117.67,36.22],
  来宾:[109.23,23.73], 巴音郭楞:[86.15,41.77], 昭通:[103.72,27.33], 达州:[107.5,31.22],
  濮阳:[115.03,35.77], 芜湖:[118.57,31.15], 汕尾:[115.37,22.78], 阳江:[111.98,21.87],
  九江:[115.88,29.62], 抚州:[116.35,28.0], 铁岭:[123.83,42.3], 枣庄:[117.32,34.82],
  武威:[102.63,37.93], 德州:[116.3,37.45], 大同:[124.82,46.03], 银川:[106.28,38.47],
  毕节:[105.28,27.3], 株洲:[113.13,27.72], 珠海:[113.57,22.27], 延边:[129.5,42.88],
  吉林市:[126.55,43.83], 阜新:[121.75,42.07], 忻州:[112.73,38.42], 乌兰察布:[113.12,40.98],
  巴中:[106.77,31.85], 张掖:[100.45,38.93], 佳木斯:[130.37,46.82], 泰州:[119.92,32.45],
  韶关:[113.6,24.82], 淄博:[118.05,36.82], 天津:[117.2,39.12], 鄂尔多斯:[109.8,39.62],
  马鞍山:[118.5,31.7], 南平:[118.17,26.65], 河池:[108.07,24.7], 黄山:[118.33,29.72],
  唐山:[118.2,39.63], 白山:[126.42,41.93], 蚌埠:[117.38,32.92], 商洛:[109.93,33.87],
  鄂州:[114.88,30.4], 滨州:[117.97,37.38], 徐州:[117.18,34.27], 阿克苏:[80.27,41.17],
  巢湖:[117.87,31.6], 东营:[118.67,37.43], 黔东南:[107.97,26.58], 梧州:[111.27,23.48],
  巴彦淖尔:[107.42,40.75], 惠州:[114.42,23.12], 新竹:[120.95,24.82], 百色:[106.62,23.9],
  阿拉善盟:[105.67,38.83], 长春:[125.32,43.9], 哈密:[93.52,42.83], 眉山:[103.83,30.05],
  嘉兴:[120.75,30.75], 克拉玛依:[84.87,45.6], 汉中:[107.02,33.07], 迪庆:[99.7,27.83],
  盐城:[120.15,33.35], 白银:[104.18,36.55], 锡林郭勒:[116.07,43.95], 秦皇岛:[119.6,39.93],
  昌都:[97.18,31.13], 赤峰:[118.92,42.27], 宜兰:[121.75,24.77], 沧州:[116.83,38.3],
  南京:[118.78,32.07], 舟山:[122.2,30.0], 郑州:[113.62,34.75], 宁德:[119.52,26.67],
  宁波:[121.55,29.87]
};

/* 省/自治区 → 省会(县级市/省名输入的兜底,好过默认 120°E) */
const PROV_FALLBACK = { 河北:'石家庄', 山西:'太原', 辽宁:'沈阳', 吉林:'长春', 黑龙江:'哈尔滨', 江苏:'南京', 浙江:'杭州', 安徽:'合肥', 福建:'福州', 江西:'南昌', 山东:'济南', 河南:'郑州', 湖北:'武汉', 湖南:'长沙', 广东:'广州', 海南:'海口', 四川:'成都', 贵州:'贵阳', 云南:'昆明', 陕西:'西安', 甘肃:'兰州', 青海:'西宁', 台湾:'台北', 内蒙古:'呼和浩特', 内蒙:'呼和浩特', 广西:'南宁', 西藏:'拉萨', 宁夏:'银川', 新疆:'乌鲁木齐' };
/* 子串匹配:长名优先(避免短名误命中);模块级预排一次 */
const CITY_KEYS = Object.keys(CITY).sort((a,b)=>b.length-a.length);
const PROV_KEYS = Object.keys(PROV_FALLBACK).sort((a,b)=>b.length-a.length);
/* 解析城市 → {key,lng,lat,src}:'city'=精确命中地级市 / 'prov'=退省会 / null=未收录 */
function resolveCity(city){
  if (!city) return null;
  const s = String(city);
  let key = CITY_KEYS.find(k => s.includes(k));
  if (key) return { key, lng: CITY[key][0], lat: CITY[key][1], src: 'city' };
  const prov = PROV_KEYS.find(p => s.includes(p));
  if (prov){ key = PROV_FALLBACK[prov]; return { key, lng: CITY[key][0], lat: CITY[key][1], src: 'prov', prov }; }
  return null;
}

function computeChart(input){
  const { y, m, d, city } = input;
  const hasTime = typeof input.hh === 'number';
  const hh = hasTime ? input.hh : 12, mm = hasTime ? (input.mm || 0) : 0;
  const meta = { engine: 'bazi-engine v1.1.0-alpha', tz: 'UTC+8(北京时间)', notes: [], warnings: [] };

  /* 真太阳时 */
  let lon = 120, lonSource = 'default(120°E 标准时)';
  const cityHit = resolveCity(city);
  const cityKey = cityHit ? cityHit.key : null;
  if (cityHit){
    lon = cityHit.lng;
    lonSource = cityHit.src === 'prov' ? ('prov:' + cityHit.prov + '→' + cityHit.key) : ('city:' + cityHit.key);
    if (cityHit.src === 'prov') meta.notes.push('城市「' + city + '」按' + cityHit.prov + '省会(' + cityHit.key + ')经纬度近似');
  } else if (city) meta.warnings.push('城市「' + city + '」暂未收录,已按东八区标准时推算,真太阳时可能有数分钟偏差');
  const stdUtc = Date.UTC(y, m - 1, d, hh - 8, mm);
  const eot = hasTime ? equationOfTime(stdUtc) : 0;
  const tstOffsetMin = hasTime ? (lon - 120) * 4 + eot : 0;
  const tstUtc = stdUtc + tstOffsetMin * 60000;
  const tst = new Date(tstUtc + 8 * 3600000);            // 真太阳时(北京时区表出)
  const tstH = tst.getUTCHours() + tst.getUTCMinutes() / 60;
  const tY = tst.getUTCFullYear(), tM = tst.getUTCMonth() + 1, tD = tst.getUTCDate();

  /* 年柱:立春分界(1984 立春后 = 甲子年) */
  const liChun = jieTime(hasTime ? tY : y, JIE[0]);
  const birthUtc = hasTime ? tstUtc : Date.UTC(y, m - 1, d, 4);  // 无时辰按当日正午近似
  const yearForPillar = (hasTime ? tY : y) - (birthUtc < liChun ? 1 : 0);
  const yearIdx = ((yearForPillar - 1984) % 60 + 60) % 60;
  const yearP = P(yearIdx);

  /* 月柱:十二节分月(立春→寅月),五虎遁 */
  const by = hasTime ? tY : y;
  let monthIdx = -1, lastJieMs = -Infinity, nextJieMs = Infinity, lastJieName = '';
  const terms = [];
  for (let yy = by - 1; yy <= by + 1; yy++)
    for (const j of JIE) terms.push({ ms: jieTime(yy, j), j });
  terms.sort((a, b) => a.ms - b.ms);
  for (let i = 0; i < terms.length; i++){
    if (terms[i].ms <= birthUtc && (i + 1 === terms.length || terms[i + 1].ms > birthUtc)){
      lastJieMs = terms[i].ms; lastJieName = terms[i].j.name;
      nextJieMs = i + 1 < terms.length ? terms[i + 1].ms : Infinity;
      monthIdx = JIE.findIndex(x => x.name === terms[i].j.name);   // 0=立春(寅月)
      break;
    }
  }
  const monthBranchIdx = (2 + monthIdx) % 12;                      // 寅=2
  const WUHU = { 甲:2, 己:2, 乙:4, 庚:4, 丙:6, 辛:6, 丁:8, 壬:8, 戊:0, 癸:0 }; // 正月天干序(丙=2…甲=0)
  const monthStemIdx = (WUHU[yearP.stem] + monthIdx) % 10;
  const monthP = { stem: STEMS[monthStemIdx], branch: BRANCHES[monthBranchIdx] };

  /* 日柱(真太阳时的日期 + 晚子时进位) */
  const dayIdx = dayPillarIndex(tY, tM, tD, hasTime ? tstH : undefined);
  const dayP = P(dayIdx);

  /* 时柱:五鼠遁(甲己→甲子起) */
  let hourP = null;
  if (hasTime){
    const hb = Math.floor(((tstH + 1) % 24) / 2);                  // 23–1 点 = 子(0)
    const WUSHU = { 甲:0, 己:0, 乙:2, 庚:2, 丙:4, 辛:4, 丁:6, 壬:6, 戊:8, 癸:8 };
    hourP = { stem: STEMS[(WUSHU[dayP.stem] + hb) % 10], branch: BRANCHES[hb] };
  } else meta.notes.push('未提供出生时间:不排时柱,五行计分不含时柱');

  /* 边界告警 */
  const boundaries = [];
  const H2 = 2 * 3600000;
  if (Math.abs(birthUtc - liChun) < 24 * 3600000)
    boundaries.push({ type: '立春(年界)', withinHours: +((birthUtc - liChun) / 3600000).toFixed(1) });
  if (birthUtc - lastJieMs < H2 || nextJieMs - birthUtc < H2)
    boundaries.push({ type: '月节(月界)', jie: lastJieName });
  if (hasTime && Math.abs(tstH % 2 - 1) < 0.06)   /* 时辰界在奇数整点(23,1,3…),±3.6 分钟内告警 */
    boundaries.push({ type: '时辰交界' });
  if (boundaries.length)
    meta.warnings.push('出生时刻接近排盘边界(节气时刻近似 ±15 分钟),正式报告需权威万年历精校');

  /* 西盘三要素:与八字同刻同源计算(北京时间→UTC,回归黄道) */
  const lat = cityHit ? cityHit.lat : null;
  const sunL = sunLon(stdUtc), moonL = moonLon(stdUtc);
  const astro = {
    sun:  { lon: +sunL.toFixed(2),  sign: signOf(sunL) },
    moon: { lon: +moonL.toFixed(2), sign: signOf(moonL), approx: !hasTime },
    asc: null, notes: []
  };
  if (!hasTime){
    astro.notes.push('未提供出生时间:月亮星座按当日正午近似(月亮每日约移动 13°),上升星座无法计算');
    if (Math.min(moonL % 30, 30 - moonL % 30) < 7) astro.moon.nearEdge = true;
  } else if (lat == null){
    astro.notes.push('城市未收录经纬度,上升星座暂缺');
  } else {
    const ascL = ascendantLon(stdUtc, lat, lon);
    astro.asc = { lon: +ascL.toFixed(2), sign: signOf(ascL) };
  }

  /* 十神 + 五行 */
  const pillars = { year: yearP, month: monthP, day: dayP, hour: hourP };
  const dayStem = dayP.stem;
  const tenGods = {};
  for (const k of ['year', 'month', 'hour']){
    if (!pillars[k]) continue;
    tenGods[k] = { stem: tenGod(dayStem, pillars[k].stem), branchMain: tenGod(dayStem, HIDDEN[pillars[k].branch][0]) };
  }
  tenGods.day = { stem: '日主', branchMain: tenGod(dayStem, HIDDEN[dayP.branch][0]) };

  const counts = { 木:0, 火:0, 土:0, 金:0, 水:0 };
  const activePillars = Object.values(pillars).filter(Boolean);
  for (const p of activePillars){
    counts[STEM_ELEM[p.stem]] += 1;
    HIDDEN[p.branch].forEach((hs, i) => counts[STEM_ELEM[hs]] += HIDDEN_W[i]);
  }
  for (const k in counts) counts[k] = +counts[k].toFixed(2);

  /* 日主强弱(简化计分 v1):得令 40% + 得地 30% + 得势 30% */
  const de = STEM_ELEM[dayStem];
  const mElem = BRANCH_ELEM[monthP.branch];
  let seasonScore, seasonName;
  if (mElem === de){ seasonScore = 1; seasonName = '旺(得令)'; }
  else if (GEN[mElem] === de){ seasonScore = 0.7; seasonName = '相(月令生我)'; }
  else if (GEN[de] === mElem){ seasonScore = 0.4; seasonName = '休(我生月令)'; }
  else if (KE[de] === mElem){ seasonScore = 0.3; seasonName = '囚(我克月令)'; }
  else { seasonScore = 0.2; seasonName = '死(月令克我)'; }
  let rootScore = 0, rootN = 0;
  for (const p of activePillars)
    HIDDEN[p.branch].forEach((hs, i) => { if (STEM_ELEM[hs] === de){ rootScore += HIDDEN_W[i]; rootN++; } });
  rootScore = Math.min(1, rootScore / 2);
  let mateN = 0;
  for (const k of ['year', 'month', 'hour'])
    if (pillars[k] && ['比肩','劫财','偏印','正印'].includes(tenGods[k].stem)) mateN++;
  const mateScore = Math.min(1, mateN / 2);
  const score = +(0.4 * seasonScore + 0.3 * rootScore + 0.3 * mateScore).toFixed(2);
  const label = score > 0.55 ? '偏强' : score < 0.45 ? '偏弱' : '中和';

  /* ---------------- 大运(阳男阴女顺排,起运=到节气天数÷3) ---------------- */
  let daYun = null;
  const gender = input.gender;
  if (hasTime && (gender === '男' || gender === '女')){
    const gzIndex = (stem, branch) => {                 // 干支→六十甲子序 0..59
      const s = STEMS.indexOf(stem), b = BRANCHES.indexOf(branch);
      for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i;
      return 0;
    };
    const yangYear = STEM_YANG[yearP.stem];
    const forward = (yangYear && gender === '男') || (!yangYear && gender === '女');
    let prevJie = -Infinity, nextJie = Infinity;         // 出生前后最近的"节"
    for (const tm of terms){
      if (tm.ms <= birthUtc && tm.ms > prevJie) prevJie = tm.ms;
      if (tm.ms > birthUtc && tm.ms < nextJie) nextJie = tm.ms;
    }
    const diffDays = (forward ? (nextJie - birthUtc) : (birthUtc - prevJie)) / 86400000;
    const startAgeF = diffDays / 3;                       // 3 天折 1 岁
    const startY = Math.floor(startAgeF);
    const startM = Math.round((startAgeF - startY) * 12);
    const mIdx = gzIndex(monthP.stem, monthP.branch);
    const steps = [];
    for (let k = 1; k <= 8; k++){
      const idx = ((mIdx + (forward ? k : -k)) % 60 + 60) % 60;
      const st = STEMS[idx % 10], br = BRANCHES[idx % 12];
      const ageFrom = startY + (k - 1) * 10;
      steps.push({ stem: st, branch: br, god: tenGod(dayStem, st) || '—',
        ageFrom, ageTo: ageFrom + 9, yearFrom: y + ageFrom, yearTo: y + ageFrom + 9 });
    }
    daYun = { forward, gender,
      startAge: +startAgeF.toFixed(1),
      startText: startY + '岁' + (startM ? startM + '个月' : '') + '起运',
      steps };
  }

  return {
    input: { ...input },
    solar: hasTime ? {
      trueSolarTime: tst.toISOString().slice(0, 16).replace('T', ' ') + '(UTC+8 表出)',
      offsetMin: +tstOffsetMin.toFixed(1), eqTimeMin: +eot.toFixed(1), lonUsed: lon, lonSource,
      city: cityKey || null
    } : { note: '未提供时间,未做真太阳时换算' },
    astro,
    pillars,
    dayMaster: { stem: dayStem, element: de, yinyang: STEM_YANG[dayStem] ? '阳' : '阴' },
    tenGods,
    hiddenStems: Object.fromEntries(activePillars.map(p => [p.branch, HIDDEN[p.branch]])),
    fiveElements: {
      counts,
      dayMasterStrength: {
        score, label,
        basis: [ '月令·' + monthP.branch + ':' + seasonName,
                 '通根 ' + rootN + ' 处',
                 '天干印比 ' + mateN + ' 个' ],
        model: '简化计分 v1(得令40%+得地30%+得势30%),供解释层引用,非断语'
      }
    },
    daYun,
    boundaries, meta
  };
}

/* 导出(Node + 浏览器) */
const BaziEngine = { computeChart, sunLon, moonLon, ascendantLon, jieTime, equationOfTime, tenGod, STEMS, BRANCHES, HIDDEN, JIE, SIGNS };
if (typeof module !== 'undefined' && module.exports) module.exports = BaziEngine;
if (typeof window !== 'undefined') window.BaziEngine = BaziEngine;
