(function attachZXStoryPlanner(global) {
  'use strict';

  var ELEMENT_KEY = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };
  var ELEMENT_ORDER = ['木', '火', '土', '金', '水'];
  var SCENE_ORDER = ['identity', 'energy', 'tension', 'mirror', 'phase', 'takeaway'];
  var LUMINARY_KEY = { 太阳: 'sun', 月亮: 'moon', 上升: 'asc' };
  var KEY_TO_LUMINARY = { sun: '太阳', moon: '月亮', asc: '上升' };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return value == null ? '' : String(value);
  }

  function trimBody(value, max) {
    var chars = Array.from(text(value).replace(/\s+/g, ' ').trim());
    return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : chars.join('');
  }

  function fill(template, values) {
    return text(template).replace(/\{\{([A-Z0-9_]+)\}\}/g, function replaceToken(_all, key) {
      return values[key] == null ? '' : String(values[key]);
    });
  }

  function source(label) {
    return text(label);
  }

  function strengthKey(label, copy) {
    return copy.selectorMaps.strengthLabelToKey[label] || '';
  }

  function elementLabel(value, copy) {
    if (!value) return '';
    if (typeof value === 'string') {
      if (ELEMENT_KEY[value]) return value;
      var fromKey = Object.keys(copy.selectorMaps.elementLabelToKey)
        .find(function findByKey(label) { return copy.selectorMaps.elementLabelToKey[label] === value; });
      return fromKey || '';
    }
    if (typeof value === 'object') return elementLabel(value.label || value.name || value.key, copy);
    return '';
  }

  function modeFromCrossKey(key, copy) {
    return copy.cross.relationKeyToMode[key] || '';
  }

  function readCross(chart, explainer) {
    var readings = explainer && typeof explainer.astroReadings === 'function'
      ? explainer.astroReadings(chart) || []
      : [];
    return readings.map(function normalize(reading) {
      return {
        label: reading.label,
        key: LUMINARY_KEY[reading.label],
        relationKey: reading.key,
        sign: reading.sign,
      };
    }).filter(function valid(reading) {
      return reading.key && reading.relationKey;
    });
  }

  function pickTension(chart, readings, copy) {
    var byKey = {};
    readings.forEach(function each(reading) { byKey[reading.key] = reading; });
    var order;
    if (!byKey.moon && !byKey.asc) order = ['sun'];
    else if (!byKey.moon) order = ['sun'];
    else if (!byKey.asc) order = ['moon', 'sun'];
    else order = ['moon', 'asc', 'sun'];

    var contrast = order.map(function toReading(key) { return byKey[key]; })
      .find(function isContrast(reading) { return reading && modeFromCrossKey(reading.relationKey, copy) === 'contrast'; });
    var selected = contrast || order.map(function toReading(key) { return byKey[key]; }).find(Boolean);
    if (!selected && byKey.sun) selected = byKey.sun;

    if (!selected) return null;
    var mode = modeFromCrossKey(selected.relationKey, copy);
    if (!mode) return null;
    var block = copy.cross.byLuminary[selected.key] && copy.cross.byLuminary[selected.key][mode];
    if (!block) return null;
    return {
      key: selected.key,
      mode: mode,
      headline: block.headline,
      body: block.body,
      sourceIds: ['日主·' + chartDayMaster(chart), '星盘辅证·' + KEY_TO_LUMINARY[selected.key] + selected.sign],
    };
  }

  function chartDayMaster(chart) {
    return chart.dayMaster.stem + chart.dayMaster.element;
  }

  function mirrorMode(readings) {
    var modes = {};
    readings.forEach(function each(reading) { modes[reading.key] = reading.mode; });
    if (!modes.moon && !modes.asc) return 'sun_only';
    if (!modes.moon) return 'asc_only';
    if (!modes.asc) return 'moon_only';
    if (modes.moon === 'verification' && modes.asc === 'verification') return 'aligned';
    if (modes.moon === 'contrast' && modes.asc === 'contrast') return 'dual_contrast';
    return 'contrast';
  }

  function visualFor(sceneId, chart, strength, elementKey) {
    var element = chart.dayMaster.element;
    var motion = {
      identity: 'focus',
      energy: 'pulse',
      tension: 'cross',
      mirror: 'orbit',
      phase: 'shift',
      takeaway: 'settle',
    }[sceneId] || 'settle';
    return { element: element, stem: chart.dayMaster.stem, strength: strength, motion: motion, energy: elementKey || ELEMENT_KEY[element] };
  }

  function scene(copy, sceneId, values, sourceIds, visual, shareSafe) {
    var sceneCopy = copy.scenes[sceneId];
    return {
      sceneId: sceneId,
      sourceIds: sourceIds.filter(Boolean),
      eyebrow: sceneCopy.eyebrow,
      headline: fill(sceneCopy.headlineTemplate, values),
      body: trimBody(fill(sceneCopy.bodyTemplate, values), sceneCopy.maxBodyCharacters || copy.constraints.sceneBodyMaxCharacters || 64),
      visual: visual,
      shareSafe: Boolean(shareSafe),
    };
  }

  function plan(input) {
    var chart = input && input.chart;
    var copy = input && input.copy;
    var explainer = input && input.explainer;
    if (!chart || !copy || !chart.dayMaster || !chart.fiveElements) return null;
    if (!chart.dayMaster.stem || !chart.dayMaster.element) return null;

    var strengthLabel = chart.fiveElements.dayMasterStrength && chart.fiveElements.dayMasterStrength.label;
    var sKey = strengthKey(strengthLabel, copy);
    if (!sKey || !copy.stems[chart.dayMaster.stem] || !copy.strengths[sKey]) return null;

    var highElement = elementLabel(input.energyHigh, copy);
    var lowElement = elementLabel(input.energyLow, copy);
    if (!highElement || !lowElement || highElement === lowElement) return null;
    var highKey = ELEMENT_KEY[highElement];
    var lowKey = ELEMENT_KEY[lowElement];
    if (!copy.elements[highKey] || !copy.elements[lowKey]) return null;

    var dmSource = source('日主·' + chartDayMaster(chart));
    var strengthSource = source('强弱·' + strengthLabel);
    var values = {
      STEM_KEY: chart.dayMaster.stem,
      STEM_IDENTITY_TITLE: copy.stems[chart.dayMaster.stem].identityTitle,
      STEM_AXIS: copy.stems[chart.dayMaster.stem].axis,
      STRENGTH_KEY: sKey,
      STRENGTH_LABEL: copy.strengths[sKey].label,
      STRENGTH_POSTURE: copy.strengths[sKey].posture,
      HIGH_ELEMENT_KEY: highKey,
      HIGH_ELEMENT_LABEL: copy.elements[highKey].label,
      ELEMENT_HIGH_LINE: copy.elements[highKey].high,
      LOW_ELEMENT_KEY: lowKey,
      LOW_ELEMENT_LABEL: copy.elements[lowKey].label,
      ELEMENT_LOW_LINE: copy.elements[lowKey].low,
    };

    var crossReadings = readCross(chart, explainer);
    var tension = pickTension(chart, crossReadings, copy);
    var hasMoon = crossReadings.some(function hasMoonReading(reading) { return reading.key === 'moon'; });
    var hasAsc = crossReadings.some(function hasAscReading(reading) { return reading.key === 'asc'; });
    if (tension && !hasMoon && !hasAsc) {
      var missingMoonAndAsc = copy.cross.safeFallbacks.missingMoonAndAsc;
      tension.headline = missingMoonAndAsc.headline;
      tension.body = missingMoonAndAsc.body;
    }
    if (!tension) return null;
    values.TENSION_LUMINARY_KEY = tension.key;
    values.TENSION_MODE = tension.mode;
    values.TENSION_HEADLINE = tension.headline;
    values.TENSION_BODY = tension.body;

    var mirrorReadings = crossReadings.map(function withMode(reading) {
      return { key: reading.key, mode: modeFromCrossKey(reading.relationKey, copy), sign: reading.sign };
    });
    var mMode = mirrorMode(mirrorReadings);
    var mirror = copy.mirror.modes[mMode] || copy.mirror.modes.sun_only;
    values.MIRROR_MODE = mMode;
    values.MIRROR_HEADLINE = mirror.headline;
    values.MIRROR_BODY = mirror.body;
    var mirrorSources = [dmSource];
    mirrorReadings.forEach(function addMirrorSource(reading) {
      if ((mMode === 'moon_only' && reading.key !== 'moon') || (mMode === 'asc_only' && reading.key !== 'asc')) return;
      if ((mMode === 'aligned' || mMode === 'contrast' || mMode === 'dual_contrast') && !/^(moon|asc)$/.test(reading.key)) return;
      if (mMode === 'sun_only' && reading.key !== 'sun') return;
      mirrorSources.push('星盘辅证·' + KEY_TO_LUMINARY[reading.key] + reading.sign);
    });

    var candidateDaYun = input.currentDaYunStep || null;
    var curDaYun = candidateDaYun && copy.phase.byTenGod[candidateDaYun.god] ? candidateDaYun : null;
    var phaseBlock = curDaYun ? copy.phase.byTenGod[curDaYun.god] : copy.phase.missing;
    values.CURRENT_DAYUN_GOD = curDaYun ? curDaYun.god : 'missing';
    values.PHASE_HEADLINE = phaseBlock.headline;
    values.PHASE_BODY = phaseBlock.body;

    values.TAKEAWAY_BODY = copy.takeaway.byStrength[sKey].body;

    var scenes = [
      scene(copy, 'identity', values, [dmSource, strengthSource], visualFor('identity', chart, sKey), true),
      scene(copy, 'energy', values, ['五行分布', strengthSource], visualFor('energy', chart, sKey, highKey), false),
      scene(copy, 'tension', values, tension.sourceIds, visualFor('tension', chart, sKey), true),
      scene(copy, 'mirror', values, mirrorSources, visualFor('mirror', chart, sKey), false),
      scene(copy, 'phase', values, curDaYun ? ['当前大运·' + curDaYun.stem + curDaYun.branch + '(' + curDaYun.god + ')'] : [dmSource, strengthSource], visualFor('phase', chart, sKey), false),
      scene(copy, 'takeaway', values, [dmSource, strengthSource], visualFor('takeaway', chart, sKey), true),
    ];

    if (scenes.map(function id(s) { return s.sceneId; }).join('|') !== SCENE_ORDER.join('|')) return null;

    var seed = [
      chart.dayMaster.stem,
      strengthLabel,
      highElement,
      lowElement,
      tension.key,
      tension.mode,
      mMode,
      curDaYun ? curDaYun.stem + curDaYun.branch + curDaYun.god : 'phase_missing',
    ].join('|');

    return {
      version: 'story-v1',
      contentVersion: copy.contentVersion,
      seed: seed,
      scenes: scenes,
      shareClip: {
        identity: values.STEM_IDENTITY_TITLE,
        strength: values.STRENGTH_LABEL,
        tension: values.TENSION_BODY,
        actionAdvice: values.TAKEAWAY_BODY,
        brand: copy.brand,
      },
    };
  }

  var api = { plan: plan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ZXStoryPlanner = api;
})(typeof window !== 'undefined' ? window : globalThis);
