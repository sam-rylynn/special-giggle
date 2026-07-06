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
const CITY_LON = {
  北京:116.41, 上海:121.47, 广州:113.26, 深圳:114.06, 贵阳:106.71, 成都:104.07,
  重庆:106.55, 杭州:120.16, 武汉:114.31, 西安:108.94, 南京:118.80, 天津:117.20,
  长沙:112.94, 郑州:113.63, 沈阳:123.43, 哈尔滨:126.63, 长春:125.32, 昆明:102.71,
  兰州:103.83, 西宁:101.78, 银川:106.23, 乌鲁木齐:87.62, 拉萨:91.11, 南宁:108.32,
  海口:110.33, 福州:119.30, 厦门:118.09, 合肥:117.23, 南昌:115.86, 济南:117.12,
  青岛:120.38, 石家庄:114.51, 太原:112.55, 呼和浩特:111.75, 苏州:120.59, 宁波:121.55,
  无锡:120.31, 大连:121.61, 东莞:113.75, 佛山:113.12, 珠海:113.58, 香港:114.17,
  澳门:113.55, 台北:121.51
};
const CITY_LAT = {
  北京:39.90, 上海:31.23, 广州:23.13, 深圳:22.54, 贵阳:26.65, 成都:30.57,
  重庆:29.56, 杭州:30.27, 武汉:30.59, 西安:34.34, 南京:32.06, 天津:39.13,
  长沙:28.23, 郑州:34.75, 沈阳:41.80, 哈尔滨:45.80, 长春:43.90, 昆明:25.04,
  兰州:36.06, 西宁:36.62, 银川:38.49, 乌鲁木齐:43.83, 拉萨:29.65, 南宁:22.82,
  海口:20.04, 福州:26.07, 厦门:24.48, 合肥:31.82, 南昌:28.68, 济南:36.65,
  青岛:36.07, 石家庄:38.04, 太原:37.87, 呼和浩特:40.84, 苏州:31.30, 宁波:29.87,
  无锡:31.49, 大连:38.91, 东莞:23.02, 佛山:23.02, 珠海:22.27, 香港:22.32,
  澳门:22.20, 台北:25.03
};

function computeChart(input){
  const { y, m, d, city } = input;
  const hasTime = typeof input.hh === 'number';
  const hh = hasTime ? input.hh : 12, mm = hasTime ? (input.mm || 0) : 0;
  const meta = { engine: 'bazi-engine v1.1.0-alpha', tz: 'UTC+8(北京时间)', notes: [], warnings: [] };

  /* 真太阳时 */
  let lon = 120, lonSource = 'default(120°E 标准时)';
  const cityKey = city && Object.keys(CITY_LON).find(k => String(city).includes(k));
  if (cityKey){ lon = CITY_LON[cityKey]; lonSource = 'city:' + cityKey; }
  else if (city) meta.warnings.push('城市「' + city + '」暂未收录,已按东八区标准时推算,真太阳时可能有数分钟偏差');
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
  const lat = cityKey ? CITY_LAT[cityKey] : null;
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
