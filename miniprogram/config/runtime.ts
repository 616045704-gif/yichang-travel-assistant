declare const __CLOUD_ENV__: string;
declare const __BUILD_MODE__: string;

export const runtime = {
  cloudEnv: typeof __CLOUD_ENV__ === 'undefined' ? '' : __CLOUD_ENV__,
  mode: typeof __BUILD_MODE__ === 'undefined' ? 'development' : __BUILD_MODE__,
};

// Fixed city view; this is never the user's position.
export const YICHANG_CENTER = { latitude: 30.6919, longitude: 111.2865 };
