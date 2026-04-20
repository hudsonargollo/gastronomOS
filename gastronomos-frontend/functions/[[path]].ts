export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Handle API requests - proxy to backend
  if (url.pathname.startsWith('/api/')) {
    const backendUrl = `https://gastronomos.hudsonargollo2.workers.dev${url.pathname}${url.search}`;
    return fetch(backendUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' ? request.body : undefined,
    });
  }
  
  // For all other requests, serve from static files
  return context.next();
}
