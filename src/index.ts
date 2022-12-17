export interface Env {
  CACHE_BUCKET: R2Bucket;
  IMAGE_HOST?: string;
  CACHE_DURATION?: number;
}

const defaultImageHost = 'imagedelivery.net';
const maxAge = 30 * 24 * 60 * 60; // 30 day default cache time

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleRequest(request, env, ctx);
    } catch (e: any) {
      return new Response(e.message, { status: 500 });
    }
  },
};

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext) {
  const requestUrl = new URL(request.url);
  requestUrl.host = env.IMAGE_HOST ?? defaultImageHost;
  requestUrl.protocol = 'https';
  requestUrl.port = '443';

  const cacheKey = requestUrl.pathname.substring(1);
  const cache = caches.default;

  // Check whether the value is already available in the cache
  // if not, you will need to fetch it from R2, and store it in the cache
  let response = await cache.match(request);
  if (response) return response;
  console.log(`Cache miss for: ${cacheKey}.`);

  // Try to get it from R2
  let image = await (await env.CACHE_BUCKET.get(cacheKey))?.arrayBuffer();
  if (!image) {
    console.log(`R2 miss for: ${cacheKey}.`);

    // Get it from CF Images
    let cfImageRes: Response;
    try {
      cfImageRes = await fetch(requestUrl.toString());
    } catch (e) {
      return new Response(null, { status: 404, statusText: 'Not Found' });
    }
    console.log(`Images fetch response: ${cfImageRes.status}`);
    image = await cfImageRes.arrayBuffer();

    // If we got it, add it to R2 after we finish
    if (image) {
      ctx.waitUntil(env.CACHE_BUCKET.put(cacheKey, image));
    }
  }

  if (!image) throw new Error('wut...');

  // Prep the final response
  const headers = new Headers({
    // Cache it in the browser for your specified time
    'cache-control': `public, max-age=${env.CACHE_DURATION ?? maxAge}`,
    'access-control-allow-origin': '*',
    'content-security-policy': "default-src 'none'; navigate-to 'none'; form-action 'none'",
    'content-type': 'image/jpeg'
  });
  response = new Response(image, { headers });

  // Save the response to the cache for next time
  ctx.waitUntil(cache.put(request, response.clone()));

  return response;
}
