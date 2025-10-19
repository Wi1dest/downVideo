(function () {
  const els = {
    shareText: document.getElementById('shareText'),
    parseBtn: document.getElementById('parseBtn'),
    clearBtn: document.getElementById('clearBtn'),
    status: document.getElementById('status'),
    resultSection: document.getElementById('resultSection'),
    coverImg: document.getElementById('coverImg'),
    titleText: document.getElementById('titleText'),
    authorName: document.getElementById('authorName'),
    downloadCoverBtn: document.getElementById('downloadCoverBtn'),
    downloadVideoBtn: document.getElementById('downloadVideoBtn'),
  };

  const API_BASE = 'https://dy.lushuyan.dpdns.org/video/share/url/parse?url=';

  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;

  function setStatus(msg, type = 'info') {
    els.status.textContent = msg;
    if (type === 'error') {
      els.status.style.color = 'var(--danger)';
    } else if (type === 'success') {
      els.status.style.color = 'var(--success)';
    } else {
      els.status.style.color = 'var(--sub)';
    }
  }

  function clearStatus() { setStatus(''); }

  function sanitizeFilename(name, defaultName) {
    const base = (name || defaultName || 'file').toString();
    return base.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
  }

  function getExtFromType(type, fallback) {
    if (!type) return fallback || '';
    const map = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/webm': 'webm',
    };
    return map[type] || (fallback || '');
  }

  function extractUrl(text) {
    if (!text) return null;
    const regex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(regex) || [];
    // 优先匹配抖音/快手常见短链域名
    const preferredDomains = [
      'v.douyin.com',
      'www.iesdouyin.com',
      'www.douyin.com',
      'm.iesdouyin.com',
      'kuaishou.com',
      'www.kuaishou.com',
      'v.kuaishou.com',
    ];
    let candidate = null;
    for (const m of matches) {
      try {
        const u = new URL(m);
        if (preferredDomains.some(d => u.hostname.includes(d))) {
          candidate = m;
          break;
        }
      } catch (_) {}
    }
    if (!candidate && matches.length) candidate = matches[0];
    return candidate;
  }

  async function fetchJSON(url) {
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error('网络错误：' + res.status);
    return await res.json();
  }

  function showResult(data) {
    const { cover_url, title, author } = data || {};
    els.resultSection.classList.remove('hidden');
    els.titleText.textContent = title || '';
    els.authorName.textContent = (author && author.name) || '';

    if (cover_url) {
      els.coverImg.src = cover_url;
    } else {
      els.coverImg.removeAttribute('src');
    }

    // 绑定下载按钮
    els.downloadCoverBtn.onclick = () => downloadResource(cover_url, sanitizeFilename(title, 'cover'), 'image');
    els.downloadVideoBtn.onclick = () => downloadResource(data.video_url, sanitizeFilename(title, 'video'), 'video');
  }

  async function downloadResource(url, baseName, kind) {
    if (!url) {
      setStatus('资源链接缺失，无法下载', 'error');
      return;
    }
    setStatus('开始下载' + (kind === 'image' ? '封面' : '视频') + '...');
    try {
      const res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
      });
      if (!res.ok) throw new Error('下载失败：' + res.status);
      const blob = await res.blob();

      const ext = getExtFromType(blob.type, kind === 'image' ? 'jpg' : 'mp4');
      const filename = `${baseName || (kind === 'image' ? 'cover' : 'video')}.${ext}`;

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;

      // iOS Safari 对 download 属性支持较差，采用打开新标签页方案，用户可长按保存
      if (isIOS) {
        const newWin = window.open(blobUrl, '_blank');
        if (!newWin) {
          // 可能被拦截，尝试以 a 标签方式打开
          a.target = '_blank';
          a.rel = 'noopener';
          a.click();
        }
        setStatus('已在新标签打开，请长按选择保存（iOS）', 'success');
      } else {
        // 大多数桌面与安卓现代浏览器支持直接下载
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setStatus('已触发下载', 'success');
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch (err) {
      console.error(err);
      setStatus('下载失败：' + (err && err.message ? err.message : String(err)), 'error');
    }
  }

  async function handleParse() {
    clearStatus();
    els.resultSection.classList.add('hidden');

    const text = (els.shareText.value || '').trim();
    if (!text) {
      setStatus('请输入分享文本', 'error');
      return;
    }

    const url = extractUrl(text);
    if (!url) {
      setStatus('未能在文本中找到链接，请检查分享内容', 'error');
      return;
    }

    let encoded;
    try {
      // 规范化 URL（去掉可能的中文括号等干扰）
      const cleaned = url.replace(/[()<>]/g, '');
      // 若为短链，会由后端解析重定向
      encoded = encodeURIComponent(cleaned);
    } catch (e) {
      setStatus('链接处理失败：' + e.message, 'error');
      return;
    }

    const reqUrl = API_BASE + encoded;
    setStatus('正在解析，请稍候...');
    try {
      const json = await fetchJSON(reqUrl);
      if (json.code !== 200 || !json.data) {
        setStatus('解析失败：' + (json.msg || '未知错误'), 'error');
        return;
      }
      showResult(json.data);
      setStatus('解析成功', 'success');
    } catch (err) {
      console.error(err);
      setStatus('请求失败：' + (err && err.message ? err.message : String(err)), 'error');
    }
  }

  function handleClear() {
    els.shareText.value = '';
    els.resultSection.classList.add('hidden');
    clearStatus();
  }

  els.parseBtn.addEventListener('click', handleParse);
  els.clearBtn.addEventListener('click', handleClear);

  // 示例：用户可一键测试
  // document.addEventListener('DOMContentLoaded', () => {
  //   els.shareText.value = '示例：复制抖音分享 https://v.douyin.com/smJF7Gm2weI/';
  // });
})();