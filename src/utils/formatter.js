/**
 * Universal Number Formatter Utility for Idelon RPG Engine.
 * Abbreviates large numbers using standard metric/gaming notation (K, M, B, T, Q, S).
 */
export function formatNumber(num) {
  if (num === null || num === undefined || (typeof num === 'number' && !Number.isFinite(num))) return '0';

  let n = typeof num === 'number' ? num : parseFloat(num);
  if (!Number.isFinite(n)) return '0';

  const abs = Math.abs(n);
  if (abs < 1000) {
    return Number.isInteger(n) ? n.toString() : Number(n.toFixed(2)).toString();
  }

  const suffixes = [
    { value: 1e18, symbol: 'S' },
    { value: 1e15, symbol: 'Q' },
    { value: 1e12, symbol: 'T' },
    { value: 1e9,  symbol: 'B' },
    { value: 1e6,  symbol: 'M' },
    { value: 1e3,  symbol: 'K' }
  ];

  for (const { value, symbol } of suffixes) {
    if (abs >= value) {
      const formatted = (n / value).toFixed(1).replace(/\.0$/, '');
      return `${formatted}${symbol}`;
    }
  }

  return n.toString();
}
