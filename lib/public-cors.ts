export const publicFormPaths = new Set(['/api/challenge', '/api/submit']);
export function allowsPublicForm(request: Request, configuredOrigin?: string) {
  return !!configuredOrigin && request.headers.get('origin') === configuredOrigin &&
    publicFormPaths.has(new URL(request.url).pathname);
}
export function preflight(request: Request, configuredOrigin?: string) {
  const requestedHeaders = (request.headers.get('access-control-request-headers') || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
  if (!allowsPublicForm(request, configuredOrigin) || request.headers.get('access-control-request-method') !== 'POST' || requestedHeaders.some(x => x !== 'content-type')) {
    return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store', Vary: 'Origin' } });
  }
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': configuredOrigin!, 'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin',
  } });
}
