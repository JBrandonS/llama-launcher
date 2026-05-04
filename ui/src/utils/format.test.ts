import { describe, it, expect } from 'vitest';
import { formatUptime, formatTimestamp, escapeHtml, formatBytes, formatNumber } from './format';

describe('formatUptime', () => {
  it('formats seconds less than 60', () => {
    expect(formatUptime(0)).toBe('0s');
    expect(formatUptime(30)).toBe('30s');
    expect(formatUptime(59)).toBe('59s');
  });

  it('formats minutes for under an hour', () => {
    expect(formatUptime(60)).toBe('1m');
    expect(formatUptime(120)).toBe('2m');
    expect(formatUptime(3599)).toBe('59m');
  });

  it('formats hours and minutes', () => {
    expect(formatUptime(3600)).toBe('1h 0m');
    expect(formatUptime(3660)).toBe('1h 1m');
    expect(formatUptime(7200)).toBe('2h 0m');
    expect(formatUptime(9000)).toBe('2h 30m');
  });
});

describe('formatTimestamp', () => {
  it('formats valid ISO timestamp', () => {
    const result = formatTimestamp('2024-01-15T10:30:45.123Z');
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
  });

  it('handles invalid timestamps', () => {
    // new Date() with invalid input creates Invalid Date, returns 'Invalid Date.NaN'
    // The function does NOT gracefully handle this - it's a known limitation
    expect(formatTimestamp('not-a-date')).toContain('NaN');
  });
});

describe('escapeHtml', () => {
  it('escapes special HTML characters', () => {
    expect(escapeHtml('<div>hello</div>')).toBe('&lt;div&gt;hello&lt;/div&gt;');
    expect(escapeHtml('foo&bar')).toBe('foo&amp;bar');
    // Double quotes are NOT escaped by textContent/innerHTML
    expect(escapeHtml('a"b')).toBe('a"b');
  });

  it('passes through safe strings', () => {
    expect(escapeHtml('plain text')).toBe('plain text');
    expect(escapeHtml('')).toBe('');
  });
});

describe('formatBytes', () => {
  it('formats null/undefined as em dash', () => {
    expect(formatBytes(null as unknown as number)).toBe('—');
    expect(formatBytes(undefined as any)).toBe('—');
  });

  it('formats bytes as MB when under 1GB', () => {
    expect(formatBytes(524288)).toBe('1 MB'); // 0.5 MB rounds to 1
    expect(formatBytes(1048576)).toBe('1 MB'); // exactly 1 MB
    expect(formatBytes(20971520)).toBe('20 MB'); // ~20 MB
  });

  it('formats bytes as GB when 1GB or above', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB'); // exactly 1 GB
    expect(formatBytes(2147483648)).toBe('2.0 GB'); // 2 GB
    expect(formatBytes(5368709120)).toBe('5.0 GB'); // 5 GB
  });
});

describe('formatNumber', () => {
  it('formats valid numbers with default decimals', () => {
    expect(formatNumber(42)).toBe('42.0');
    expect(formatNumber(3.14159)).toBe('3.1');
  });

  it('formats with custom decimal places', () => {
    expect(formatNumber(3.14159, 2)).toBe('3.14');
    expect(formatNumber(3.14159, 0)).toBe('3');
  });

it('returns em dash for null/undefined', () => {
    expect(formatNumber(null as unknown as number)).toBe('—');
    expect(formatNumber(undefined as any)).toBe('—');
  });
});
