export function isMissingDocument(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; errCode?: unknown; errMsg?: unknown; message?: unknown };
  const missingCodes = new Set(['NOT_FOUND', 'DOCUMENT_NOT_FOUND', 'DATABASE_DOCUMENT_NOT_FOUND']);
  const codes = [value.code, value.errCode]
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().toUpperCase());
  if (codes.some(code => missingCodes.has(code))) return true;
  const messages = [value.message, value.errMsg]
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().toLowerCase());
  return messages.some(message => message === 'not found'
    || /^document\.get:fail document with _id \S+ does not exist$/.test(message));
}
