(function (global) {
  'use strict';

  const STORAGE_KEY = 'zx_report_share_unlock_v2';
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
      return Array.isArray(parsed) ? parsed.filter(record =>
        record && typeof record.id === 'string' &&
        record.method === 'native_share' &&
        typeof record.unlockedAt === 'string'
      ) : [];
    } catch (_) {
      return [];
    }
  }

  function securePilotRef() {
    if (!global.crypto || typeof global.crypto.getRandomValues !== 'function') {
      throw shareError('NotSupportedError', 'secure randomness is unavailable');
    }
    const bytes = new Uint8Array(32);
    global.crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  }

  function isUnlocked(input) {
    const id = inputId(input);
    return !!id && readRecords().some(record => record.id === id);
  }

  function pilotReceipt(input) {
    const id = inputId(input);
    const record = id && readRecords().find(item => item.id === id);
    if (!record || !/^[a-f0-9]{64}$/.test(String(record.pilotRef || ''))) return null;
    return Object.freeze({
      chartRef: record.pilotRef,
      method: 'native_share',
      unlockedAt: record.unlockedAt
    });
  }

  function shareError(name, message) {
    if (typeof global.DOMException === 'function') return new global.DOMException(message, name);
    const error = new Error(message);
    error.name = name;
    return error;
  }

  function canNativeShare(shareData) {
    const navigator = global.navigator;
    if (!navigator || typeof navigator.share !== 'function') return false;
    const files = shareData && Array.isArray(shareData.files) ? shareData.files : [];
    if (!files.length) return true;
    return typeof navigator.canShare === 'function' && navigator.canShare({ files });
  }

  function writeNativeShare(input) {
    const id = inputId(input);
    if (!id) return false;
    const existingRecords = readRecords();
    const existing = existingRecords.find(item => item.id === id);
    const record = {
      id,
      method: 'native_share',
      unlockedAt: new Date().toISOString(),
      pilotRef: existing && /^[a-f0-9]{64}$/.test(String(existing.pilotRef || ''))
        ? existing.pilotRef
        : securePilotRef()
    };
    const records = [record, ...existingRecords.filter(item => item.id !== id)].slice(0, MAX_RECORDS);
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch (_) {
      return false;
    }
  }

  async function shareAndUnlock(input, shareData) {
    if (!inputId(input)) throw shareError('DataError', 'missing chart input');
    if (!canNativeShare(shareData)) throw shareError('NotSupportedError', 'native sharing is unavailable');
    await global.navigator.share(shareData || {});
    if (!writeNativeShare(input)) throw shareError('QuotaExceededError', 'share unlock storage unavailable');
    return Object.freeze({ method:'native_share', unlocked:true, pilotEligible:true });
  }

  global.ZxReportShareUnlock = Object.freeze({
    storageKey: STORAGE_KEY,
    canNativeShare,
    isUnlocked,
    pilotReceipt,
    shareAndUnlock
  });
})(typeof window !== 'undefined' ? window : globalThis);
