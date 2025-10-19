export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '*';
    const url = new URL(request.url);

    // 统一处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Authorization',
          'Access-Control-Allow-Credentials': 'true',
          'Vary': 'Origin',
        }
      });
    }

    // 解析代理路由
    if (url.pathname === '/api/parse') {
      const src = url.searchParams.get('url');
      if (!src) {
        return new Response(JSON.stringify({ code: 400, msg: 'missing url' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
            'Vary': 'Origin',
          }
        });
      }

      const target = 'https://dy.lushuyan.dpdns.org/video/share/url/parse?url=' + encodeURIComponent(src);
      try {
        const upstream = await fetch(target, {
          headers: {
            // 某些接口可能需要 UA
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
          }
        });

        const res = new Response(upstream.body, {
          status: upstream.status,
          headers: upstream.headers
        });

        // 补充/覆盖 CORS 头
        res.headers.set('Access-Control-Allow-Origin', origin);
        res.headers.set('Access-Control-Allow-Credentials', 'true');
        res.headers.append('Vary', 'Origin');

        // 如果上游未正确 content-type，兜底设置为 JSON
        const ct = res.headers.get('content-type');
        if (!ct) res.headers.set('Content-Type', 'application/json; charset=utf-8');

        return res;
      } catch (e) {
        return new Response(JSON.stringify({ code: 502, msg: 'bad gateway', detail: String(e) }), {
          status: 502,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
            'Vary': 'Origin',
          }
        });
      }
    }

    // 其他路径走默认响应或静态资源（在 Pages 环境中由静态托管处理）
    return new Response('OK', {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
      }
    });
  }
};