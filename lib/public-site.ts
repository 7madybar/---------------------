// These values are public build settings, never credentials.
const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN || '';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const publicApi = (path: string) => `${apiOrigin}/api/${path}`;
export const homeUrl = basePath ? `${basePath}/` : '/';
export const teamUrl = basePath ? `${basePath}/team/` : '/admin';
export const canonicalHomeUrl = 'https://7madybar.github.io/---------------------/';
export const isEmbedded = () => typeof window !== 'undefined' && window.top !== window.self;
export const assetUrl = (path: string) => basePath ? `${basePath}/public${path}` : path;

