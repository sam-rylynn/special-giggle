(function (global) {
  'use strict';

  const STORAGE_KEY = 'zx_report_share_unlock_v1';
  const MAX_RECORDS = 12;

  function clean(value) {
    return String(value == null ? '' : value).trim().normalize('NFKC');
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function canonicalInput(input) {
    const source = input && typeof input === 'object' ? input : {};
    const directDate = clean(source.d);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(directDate)
      ? directDate
      : [source.y, source.m, source.d].every(value => Number.isFinite(Number(value)))
        ? `${Number(source.y)}-${pad(Number(source.m))}-${pad(Number(source.d))}`
        : '';
    const directTime = clean(source.t);
    const hasHour = source.hh !== undefined && source.hh !== null && source.hh !== '';
    const time = /^\d{2}:\d{2}$/.test(directTime)
      ? directTime
      : hasHour
        ? `${pad(Number(source.hh))}:${pad(Number(source.mm || 0))}`
        : '';
    const city = clean(source.c !== undefined ? source.c : source.city).toLowerCase();
    const gender = clean(source.g !== undefined ? source.g : source.gender).toLowerCase();
    return [date, time, city, gender].join('|');
  }

  function hash(value, seed) {
    let output = seed >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      output ^= value.charCodeAt(index);
      output = Math.imul(output, 16777619) >>> 0;
    }
    return output.toString(16).padStart(8, '0');
  }

  function inputId(input) {
    const canonical = canonicalInput(input);
    if (!canonical || !canonical.split('|')[0]) return '';
    return `${hash(canonical, 2166136261)}${hash(canonical.split('').reverse().join(''), 2246822519)}`;
  }

  function readRecords() {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(record => record && typeof record.id === 'string') : [];
    } catch (_) {
      return [];
    }
  }

  function isUnlocked(input) {
    const id = inputId(input);
    return !!id && readRecords().some(record => record.id === id);
  }

  function unlock(input, method) {
    const id = inputId(input);
    if (!id) return false;
    const record = {
      id,
      method: clean(method) || 'share',
      unlockedAt: new Date().toISOString()
    };
    const records = [record, ...readRecords().filter(item => item.id !== id)].slice(0, MAX_RECORDS);
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch (_) {
      return false;
    }
  }

  global.ZxReportShareUnlock = Object.freeze({
    storageKey: STORAGE_KEY,
    canonicalInput,
    inputId,
    isUnlocked,
    unlock
  });
})(typeof window !== 'undefined' ? window : globalThis);
