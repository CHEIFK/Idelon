/**
 * Basic engine logger utility.
 */
export const logger = {
  info: (msg, ...meta) => console.log(`[INFO] ${msg}`, ...meta),
  warn: (msg, ...meta) => console.warn(`[WARN] ${msg}`, ...meta),
  error: (msg, ...meta) => console.error(`[ERROR] ${msg}`, ...meta),
  debug: (msg, ...meta) => console.debug(`[DEBUG] ${msg}`, ...meta)
};
