export type LocationFailure = 'denied' | 'unavailable';
export type CurrentLocation = { latitude: number; longitude: number };

function wasDenied(error: unknown): boolean {
  if (error instanceof Error) return error.message === 'denied' || /auth deny|authorize:fail/i.test(error.message);
  if (!error || typeof error !== 'object') return false;
  const value = error as { errMsg?: unknown; message?: unknown };
  return [value.errMsg, value.message].some(message => typeof message === 'string' && /auth deny|authorize:fail/i.test(message));
}

function getSettings(): Promise<WechatMiniprogram.GetSettingSuccessCallbackResult> {
  return new Promise((resolve, reject) => wx.getSetting({ success: resolve, fail: reject }));
}
function authorizeLocation(): Promise<void> {
  return new Promise((resolve, reject) => wx.authorize({ scope: 'scope.userLocation', success: () => resolve(), fail: reject }));
}
function getLocation(): Promise<CurrentLocation> {
  return new Promise((resolve, reject) => wx.getLocation({ type: 'gcj02', success: ({ latitude, longitude }) => resolve({ latitude, longitude }), fail: reject }));
}

/** This is only called from the user's nearby action; it never stores a coordinate. */
export async function requestCurrentLocation(): Promise<CurrentLocation> {
  try {
    const setting = await getSettings();
    if (setting.authSetting['scope.userLocation'] === false) throw new Error('denied');
    if (setting.authSetting['scope.userLocation'] !== true) await authorizeLocation();
    return await getLocation();
  } catch (error) { throw new Error(wasDenied(error) ? 'denied' : 'unavailable'); }
}

export async function openLocationSettings(): Promise<boolean> {
  try {
    const result = await new Promise<WechatMiniprogram.OpenSettingSuccessCallbackResult>((resolve, reject) => wx.openSetting({ success: resolve, fail: reject }));
    return result.authSetting['scope.userLocation'] === true;
  } catch { return false; }
}
