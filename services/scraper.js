/**
 * 爬虫服务模块
 * 负责爬取多站点音乐资源，支持 gequbao、toomic(酷我)、酷我直连、酷狗、QQ音乐
 * 播放源缺失时自动使用网易云后备播放
 */
const axios = require('axios');
const cheerio = require('cheerio');

// 音源站点配置
const BASE_URL = 'https://www.gequbao.com';
const MIRROR_URL = 'https://www.gequbao.net';
const TOOMIC_URL = 'https://www.toomic.com';
const NETEASE_API = 'https://music.163.com';
const KUWO_SEARCH_URL = 'http://search.kuwo.cn/r.s';
const KUWO_PLAY_URL = 'https://antiserver.kuwo.cn/anti.s';
const KUGOU_SEARCH_URL = 'https://songsearch.kugou.com/song_search_v2';
const KUGOU_PLAY_URL = 'https://wwwapi.kugou.com/yy/index.php';
const QQ_SEARCH_URL = 'https://shc.y.qq.com/soso/fcgi-bin/client_search_cp';
const QQ_VKEY_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';

// 创建axios实例，设置通用请求头模拟浏览器访问
const httpClient = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://www.gequbao.com/'
  }
});

/**
 * 从 title 属性中解析歌曲名和歌手
 * 格式: "歌曲名 - 歌手名"
 * @param {string} title - title属性值
 * @returns {{name: string, singer: string}}
 */
function parseTitle(title) {
  if (!title) return { name: '', singer: '' };
  const parts = title.split(/[-—–]/);
  if (parts.length >= 2) {
    return { name: parts[0].trim(), singer: parts.slice(1).join('-').trim() };
  }
  return { name: title.trim(), singer: '' };
}

/**
 * 从单个站点搜索音乐
 * @param {string} keyword - 搜索关键词
 * @param {string} siteUrl - 站点基础URL
 * @returns {Promise<Array>} 歌曲列表
 */
async function searchFromSite(keyword, siteUrl) {
  try {
    const url = `${siteUrl}/s/${encodeURIComponent(keyword)}`;
    const response = await httpClient.get(url);
    const $ = cheerio.load(response.data);
    const songs = [];
    const seenIds = new Set();

    // 解析搜索结果列表 - 适配 gequbao 实际HTML结构
    $('a[href*="/music/"]').each((_index, element) => {
      const $a = $(element);
      const href = $a.attr('href') || '';
      const idMatch = href.match(/\/music\/(\d+)/);
      if (!idMatch) return;

      const id = idMatch[1];
      if (seenIds.has(id)) return;
      seenIds.add(id);

      const title = $a.attr('title') || '';
      const { name, singer } = parseTitle(title);

      if (!name) {
        const linkText = $a.text().trim();
        if (linkText) {
          const p = parseTitle(linkText);
          if (p.name) {
            songs.push({ id, name: p.name, singer: p.singer, cover: '' });
            return;
          }
        }
        return;
      }

      // 提取封面图
      const $row = $a.closest('.row');
      const $img = $row.find('img').first();
      const cover = $img.attr('src') || $img.attr('data-src') || '';

      songs.push({
        id,
        name,
        singer,
        cover: cover.startsWith('http') ? cover : (cover ? `${siteUrl}${cover}` : '')
      });
    });

    return songs;
  } catch (error) {
    console.error(`从 ${siteUrl} 搜索失败: ${error.message}`);
    return [];
  }
}

/**
 * 搜索音乐（双站点合并）
 * 同时从 gequbao.com 和 gequbao.net 搜索，合并去重结果
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<Array>} 合并后的歌曲列表
 */
async function searchMusic(keyword, source = 'all') {
  // 根据音源选择决定搜索哪些站点
  const tasks = [];
  const sources = [];

  // gequbao 源
  if (source === 'all' || source === 'gequbao') {
    tasks.push(searchFromSite(keyword, BASE_URL));
    tasks.push(searchFromSite(keyword, MIRROR_URL));
    sources.push('gequbao', 'gequbao');
  } else {
    tasks.push(Promise.resolve([]));
    tasks.push(Promise.resolve([]));
    sources.push('', '');
  }

  // toomic 源
  if (source === 'all' || source === 'toomic') {
    tasks.push(searchFromToomic(keyword));
    sources.push('toomic');
  } else {
    tasks.push(Promise.resolve([]));
    sources.push('');
  }

  // 酷我直连源
  if (source === 'all' || source === 'kuwo') {
    tasks.push(searchFromKuwo(keyword));
    sources.push('kuwo');
  } else {
    tasks.push(Promise.resolve([]));
    sources.push('');
  }

  // 酷狗源
  if (source === 'all' || source === 'kugou') {
    tasks.push(searchFromKugou(keyword));
    sources.push('kugou');
  } else {
    tasks.push(Promise.resolve([]));
    sources.push('');
  }

  // QQ音乐源
  if (source === 'all' || source === 'qq') {
    tasks.push(searchFromQQ(keyword));
    sources.push('qq');
  } else {
    tasks.push(Promise.resolve([]));
    sources.push('');
  }

  const results = await Promise.all(tasks);

  // 合并去重
  const songMap = new Map();
  for (const songs of results) {
    for (const song of songs) {
      if (!songMap.has(song.id)) {
        songMap.set(song.id, song);
      }
    }
  }

  return Array.from(songMap.values());
}

/**
 * 解码字符串中的 Unicode 转义序列 (\uXXXX)
 * @param {string} str - 包含Unicode转义的字符串
 * @returns {string} 解码后的字符串
 */
function decodeUnicode(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/\\u([\dA-Fa-f]{4})/g, (_m, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/\\\//g, '/');
}

/**
 * 从详情页HTML中提取 appData JSON 对象
 * @param {string} html - 页面HTML
 * @returns {Object|null} appData对象
 */
function extractAppData(html) {
  const match = html.match(/window\.appData\s*=\s*JSON\.parse\('([^']*)'\)/);
  if (!match) return null;
  try {
    let raw = match[1].replace(/\\u0022/g, '"');
    const parsed = JSON.parse(raw);
    return decodeUnicodeValues(parsed);
  } catch {
    return null;
  }
}

/**
 * 递归解码对象中所有字符串值的 Unicode 转义
 * @param {*} obj - 需要解码的对象
 * @returns {*} 解码后的对象
 */
function decodeUnicodeValues(obj) {
  if (typeof obj === 'string') {
    return decodeUnicode(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => decodeUnicodeValues(item));
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const key of Object.keys(obj)) {
      result[key] = decodeUnicodeValues(obj[key]);
    }
    return result;
  }
  return obj;
}

/**
 * 通过 play_id 获取实际的 MP3 播放地址
 * @param {string} playId - 加密的播放ID
 * @param {string} siteUrl - 站点基础URL
 * @returns {Promise<string>} MP3播放地址
 */
async function resolvePlayUrl(playId, siteUrl = BASE_URL) {
  try {
    const response = await axios({
      method: 'POST',
      url: `${siteUrl}/member/common-play-url`,
      data: { id: playId },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': siteUrl
      },
      transformRequest: [(data) => {
        return Object.entries(data).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      }],
      timeout: 10000
    });

    if (response.data && response.data.code === 1 && response.data.data) {
      return response.data.data.url || response.data.data || '';
    }
    return '';
  } catch (error) {
    console.error(`解析播放地址失败: ${error.message}`);
    return '';
  }
}

/**
 * 从网易云音乐搜索歌曲，返回最匹配的歌曲ID
 * 当 gequbao 双站点均无播放地址时，作为后备播放源
 * @param {string} keyword - 歌曲名
 * @param {string} singer - 歌手名
 * @returns {Promise<number|null>} 网易云歌曲ID，未找到返回null
 */
async function searchNetease(keyword, singer) {
  try {
    const searchKey = singer ? `${keyword} ${singer}` : keyword;
    const response = await axios.post(
      `${NETEASE_API}/api/search/get`,
      new URLSearchParams({ s: searchKey, type: '1', limit: '5', offset: '0' }).toString(),
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': NETEASE_API,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );
    const songs = response.data?.result?.songs || [];
    if (songs.length === 0) return null;
    return songs[0].id;
  } catch (error) {
    console.error('网易云搜索失败:', error.message);
    return null;
  }
}

/**
 * 从 toomic.com 搜索音乐
 * 解析搜索页中的 base64 编码 dates 属性，提取歌曲信息
 * ID 使用 t_ 前缀以区分 gequbao 源
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<Array>} 歌曲列表，每项包含 id, name, singer, cover
 */
async function searchFromToomic(keyword) {
  try {
    const url = `${TOOMIC_URL}/?search=${encodeURIComponent(keyword)}`;
    const response = await httpClient.get(url);
    const $ = cheerio.load(response.data);
    const songs = [];

    $('a[name=a_bank]').each((_index, element) => {
      const raw = $(element).attr('dates') || '';
      // dates 属性格式: 9 + base64编码的JSON
      const b64 = raw.replace(/^9/, '');
      try {
        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
        const obj = JSON.parse(decoded);
        if (!obj.EID || !obj.Name) return;

        // 构建封面URL（toomic 封面是相对路径）
        let cover = '';
        if (obj.Img) {
          cover = obj.Img.startsWith('http') ? obj.Img : `${TOOMIC_URL}/${obj.Img}`;
        }

        songs.push({
          id: `t_${obj.EID}`,
          name: obj.Name,
          singer: obj.Tag || '',
          cover
        });
      } catch {
        // base64 解码失败则跳过
      }
    });

    return songs;
  } catch (error) {
    console.error(`从 toomic.com 搜索失败: ${error.message}`);
    return [];
  }
}

/**
 * 获取 toomic.com 歌曲详情
 * 通过 EID 直接构建酷我播放URL，并从详情页获取歌词
 * @param {string} eid - toomic 歌曲的 EID（不含 t_ 前缀）
 * @returns {Promise<Object>} 音乐详情对象
 */
async function getToomicDetail(eid) {
  // 构建酷我播放URL（toomic 底层使用酷我音乐API）
  const playUrl = `https://antiserver.kuwo.cn/anti.s?format=mp3|aac&rid=${eid}&br=320kmp3&type=convert_url&response=res`;

  let name = '';
  let singer = '';
  let cover = '';
  let lyrics = '';

  // 从搜索页获取歌曲基本信息（通过重新搜索太慢，直接访问详情页）
  // 构建访问 toomic 详情页所需的 token
  try {
    // token = 9 + base64(JSON)，但我们需要 Name/Tag 等信息
    // 直接构建一个最小 token 来访问详情页
    const tokenData = Buffer.from(JSON.stringify({ EID: eid, Name: '', Tag: '', Img: '', Type: 'kw', Vip: '1' })).toString('base64');
    const token = '9' + tokenData;
    const detailUrl = `${TOOMIC_URL}/searchr/?token=${encodeURIComponent(token)}`;
    const response = await httpClient.get(detailUrl, {
      headers: { 'Referer': TOOMIC_URL }
    });
    const $ = cheerio.load(response.data);

    // 提取歌曲名和歌手
    name = $('h1').first().text().trim();
    const singerMatch = $('.taglist a').first().text().trim();
    singer = singerMatch || '';

    // 提取歌词
    const $content = $('.content');
    if ($content.length > 0) {
      lyrics = $content.text().trim();
    }

    // 提取封面（从 script 中的 pics 变量解码）
    const scriptText = $('script:not([src])').text();
    const imgsMatch = scriptText.match(/var\s+imgs\s*=\s*"([^"]+)"/);
    if (imgsMatch) {
      try {
        const decoded = Buffer.from(imgsMatch[1], 'base64').toString('utf-8');
        // imgs 可能包含封面URL或播放URL
      } catch { /* 忽略解码失败 */ }
    }
  } catch (error) {
    console.error(`获取 toomic 详情失败: ${error.message}`);
  }

  return {
    id: `t_${eid}`,
    name,
    singer,
    cover,
    lyrics,
    playUrl,
    downloadUrl: playUrl,
    extraUrls: []
  };
}

/**
 * 从酷我音乐搜索歌曲（直连API）
 * 使用 search.kuwo.cn 搜索接口，返回歌曲列表
 * ID 使用 kw_ 前缀，播放URL通过 antiserver.kuwo.cn 获取
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<Array>} 歌曲列表
 */
async function searchFromKuwo(keyword) {
  try {
    const url = `${KUWO_SEARCH_URL}?all=${encodeURIComponent(keyword)}&ft=music&itemset=1&st=1&newsearch=1&pn=0&rn=20&rformat=json&encoding=utf8&ver=mbox&plat=pc`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'http://www.kuwo.cn/' },
      timeout: 10000
    });

    // 酷我返回的JSON可能用单引号，需要修复
    let data = response.data;
    if (typeof data === 'string') {
      data = JSON.parse(data.replace(/'/g, '"'));
    }

    const songs = (data?.abslist || []).map(s => ({
      id: `kw_${s.DC_TARGETID}`,
      name: (s.SONGNAME || '').replace(/&nbsp;/g, ' ').trim(),
      singer: (s.ARTIST || '').replace(/&nbsp;/g, ' ').trim(),
      cover: ''
    })).filter(s => s.name);

    return songs;
  } catch (error) {
    console.error(`酷我音乐搜索失败: ${error.message}`);
    return [];
  }
}

/**
 * 获取酷我音乐详情
 * 通过 rid 直接构建播放URL，支持在线播放和下载
 * @param {string} rid - 酷我歌曲ID（不含 kw_ 前缀）
 * @returns {Promise<Object>} 音乐详情对象
 */
async function getKuwoDetail(rid) {
  const playUrl = `${KUWO_PLAY_URL}?format=mp3|aac&rid=${rid}&br=320kmp3&type=convert_url&response=res`;
  return {
    id: `kw_${rid}`,
    name: '',
    singer: '',
    cover: '',
    lyrics: '',
    playUrl,
    downloadUrl: playUrl,
    extraUrls: []
  };
}

/**
 * 从酷狗音乐搜索歌曲
 * 使用 songsearch.kugou.com 搜索接口
 * ID 使用 kg_ 前缀，播放URL需通过 hash+album_id 获取（可能需VIP）
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<Array>} 歌曲列表
 */
async function searchFromKugou(keyword) {
  try {
    const url = `${KUGOU_SEARCH_URL}?keyword=${encodeURIComponent(keyword)}&page=1&pagesize=20&platform=WebFilter&userid=-1&iscorrection=1&privilege_filter=0&token=`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://www.kugou.com/' },
      timeout: 10000
    });

    const songs = (response.data?.data?.lists || []).map(s => ({
      id: `kg_${s.FileHash}_${s.AlbumID}`,
      name: s.SongName,
      singer: s.SingerName,
      cover: ''
    })).filter(s => s.name);

    return songs;
  } catch (error) {
    console.error(`酷狗音乐搜索失败: ${error.message}`);
    return [];
  }
}

/**
 * 获取酷狗音乐详情
 * 通过 hash+album_id 获取播放URL，若需VIP则使用网易云后备播放
 * @param {string} id - 格式 kg_{hash}_{albumId}
 * @param {{name?: string, singer?: string}} [fallbackInfo] - 前端透传的歌曲名/歌手名，用于网易云后备搜索
 * @returns {Promise<Object>} 音乐详情对象
 */
async function getKugouDetail(id, fallbackInfo) {
  const parts = id.substring(3).split('_');
  const hash = parts[0];
  const albumId = parts[1] || '';

  let name = '';
  let singer = '';
  let playUrl = '';
  let lyrics = '';

  try {
    const url = `${KUGOU_PLAY_URL}?r=play/getdata&hash=${hash}&album_id=${albumId}&mid=abc123`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://www.kugou.com/' },
      timeout: 10000
    });
    const data = response.data?.data;
    if (data) {
      name = data.song_name || '';
      singer = data.author_name || '';
      playUrl = data.play_url || '';
      lyrics = data.lyrics || '';
    }
  } catch (error) {
    console.error(`酷狗详情获取失败: ${error.message}`);
  }

  // 优先使用接口返回的 name/singer，为空时回退到前端透传的搜索结果数据
  const finalName = name || (fallbackInfo?.name || '');
  const finalSinger = singer || (fallbackInfo?.singer || '');

  const result = {
    id: `kg_${hash}_${albumId}`,
    name: finalName,
    singer: finalSinger,
    cover: '',
    lyrics,
    playUrl,
    downloadUrl: playUrl,
    extraUrls: []
  };

  // 酷狗播放URL常需VIP（err_code 30020），为空时尝试网易云后备播放
  if (!result.playUrl && finalName) {
    const neteaseId = await searchNetease(finalName, finalSinger);
    if (neteaseId) {
      result.neteaseId = neteaseId;
    }
  }

  return result;
}

/**
 * 从QQ音乐搜索歌曲
 * 使用 shc.y.qq.com 搜索接口
 * ID 使用 qq_ 前缀 + songmid，播放URL需 vkey（可能需登录）
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<Array>} 歌曲列表
 */
async function searchFromQQ(keyword) {
  try {
    const url = `${QQ_SEARCH_URL}?g_tk=5381&p=1&n=20&w=${encodeURIComponent(keyword)}&format=json&cr=1`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://y.qq.com/n/ryqq/search' },
      timeout: 10000
    });

    const songs = (response.data?.data?.song?.list || []).map(s => ({
      id: `qq_${s.songmid}`,
      name: s.songname,
      singer: (s.singer || []).map(a => a.name).join(','),
      cover: s.albummid ? `https://y.gtimg.cn/music/photo_new/T002r300x300M000${s.albummid}.jpg` : ''
    })).filter(s => s.name);

    return songs;
  } catch (error) {
    console.error(`QQ音乐搜索失败: ${error.message}`);
    return [];
  }
}

/**
 * 获取QQ音乐详情
 * 通过 songmid 获取 vkey 播放URL，若获取失败则使用网易云后备播放
 * @param {string} songmid - QQ音乐歌曲mid（不含 qq_ 前缀）
 * @param {{name?: string, singer?: string}} [fallbackInfo] - 前端透传的歌曲名/歌手名，用于网易云后备搜索
 * @returns {Promise<Object>} 音乐详情对象
 */
async function getQQDetail(songmid, fallbackInfo) {
  let playUrl = '';

  try {
    const guid = String(Math.floor(Math.random() * 1e10));
    const data = {
      req_0: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: { guid, songmid: [songmid], songtype: [0], uin: '0', loginflag: 1, platform: '20' }
      }
    };
    const response = await axios.get(QQ_VKEY_URL, {
      params: { data: JSON.stringify(data) },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://y.qq.com/' },
      timeout: 10000
    });
    const info = response.data?.req_0?.data?.midurlinfo?.[0];
    const sip = response.data?.req_0?.data?.sip?.[0];
    if (info?.purl && sip) {
      playUrl = `${sip}${info.purl}`;
    }
  } catch (error) {
    console.error(`QQ音乐详情获取失败: ${error.message}`);
  }

  // QQ音乐详情接口本身拿不到 name/singer/cover，使用前端透传的搜索结果数据
  const finalName = fallbackInfo?.name || '';
  const finalSinger = fallbackInfo?.singer || '';

  const result = {
    id: `qq_${songmid}`,
    name: finalName,
    singer: finalSinger,
    cover: '',
    lyrics: '',
    playUrl,
    downloadUrl: playUrl,
    extraUrls: []
  };

  // QQ音乐purl常为空（需登录），为空时尝试网易云后备播放
  if (!result.playUrl && finalName) {
    const neteaseId = await searchNetease(finalName, finalSinger);
    if (neteaseId) {
      result.neteaseId = neteaseId;
    }
  }

  return result;
}

/**
 * 从单个站点获取音乐详情
 * @param {string} musicId - 音乐ID
 * @param {string} siteUrl - 站点基础URL
 * @returns {Promise<Object|null>} 音乐详情对象，失败返回null
 */
async function getDetailFromSite(musicId, siteUrl) {
  try {
    const url = `${siteUrl}/music/${musicId}`;
    const response = await httpClient.get(url);
    const $ = cheerio.load(response.data);
    const html = response.data;

    const appData = extractAppData(html);

    const name = appData?.mp3_title || $('h1').first().text().trim() || '';
    const singer = appData?.mp3_author || '';
    const cover = appData?.mp3_cover || '';

    // 提取歌词
    let lyrics = '';
    const $lyrics = $('#content-lrc, #lrc_content, #lyrics, .lyrics, pre');
    if ($lyrics.length > 0) {
      lyrics = $lyrics.text().trim();
    }

    // 通过 play_id 获取实际播放地址
    let playUrl = '';
    if (appData?.play_id) {
      playUrl = await resolvePlayUrl(appData.play_id, siteUrl);
    }

    // 提取网盘下载链接
    const extraUrls = [];
    if (appData?.mp3_extra_urls) {
      for (const item of appData.mp3_extra_urls) {
        try {
          const decodedLink = Buffer.from(item.share_link, 'base64').toString('utf-8');
          extraUrls.push({
            type: item.type,
            url: decodedLink
          });
        } catch {
          // base64 解码失败则跳过
        }
      }
    }

    return {
      id: musicId,
      name,
      singer,
      cover: cover.startsWith('http') ? cover : (cover ? `${siteUrl}${cover}` : ''),
      lyrics,
      playUrl,
      downloadUrl: playUrl,
      extraUrls
    };
  } catch (error) {
    console.error(`从 ${siteUrl} 获取详情失败: ${error.message}`);
    return null;
  }
}

/**
 * 获取音乐详情（双站点合并）
 * 先从主站获取，再从镜像站补充网盘链接
 * @param {string} musicId - 音乐ID
 * @param {{name?: string, singer?: string}} [fallbackInfo] - 前端透传的歌曲名/歌手名，
 *   当主播放源为空时作为网易云后备播放的搜索关键词（kw_/kg_/qq_ 源详情接口本身拿不到这些信息）
 * @returns {Promise<Object>} 合并后的音乐详情对象
 */
async function getMusicDetail(musicId, fallbackInfo) {
  // 检测 toomic 源（t_ 前缀），直接走 toomic 详情逻辑
  if (musicId.startsWith('t_')) {
    const eid = musicId.substring(2);
    return await getToomicDetail(eid);
  }

  // 检测酷我直连源（kw_ 前缀）
  if (musicId.startsWith('kw_')) {
    const rid = musicId.substring(3);
    return await getKuwoDetail(rid);
  }

  // 检测酷狗源（kg_ 前缀）
  if (musicId.startsWith('kg_')) {
    return await getKugouDetail(musicId, fallbackInfo);
  }

  // 检测QQ音乐源（qq_ 前缀）
  if (musicId.startsWith('qq_')) {
    const songmid = musicId.substring(3);
    return await getQQDetail(songmid, fallbackInfo);
  }

  // 并行从两个站点获取详情
  const [primary, mirror] = await Promise.all([
    getDetailFromSite(musicId, BASE_URL),
    getDetailFromSite(musicId, MIRROR_URL)
  ]);

  // 以主站结果为基准
  const result = primary || mirror || {
    id: musicId, name: '', singer: '', cover: '',
    lyrics: '', playUrl: '', downloadUrl: '', extraUrls: []
  };

  // 合并镜像站的网盘链接（去重）
  if (mirror && mirror.extraUrls && mirror.extraUrls.length > 0) {
    const existingUrls = new Set(result.extraUrls.map(e => e.url));
    for (const extra of mirror.extraUrls) {
      if (!existingUrls.has(extra.url)) {
        result.extraUrls.push(extra);
        existingUrls.add(extra.url);
      }
    }
  }

  // 如果主站没有播放地址但镜像站有，使用镜像站的
  if (!result.playUrl && mirror && mirror.playUrl) {
    result.playUrl = mirror.playUrl;
    result.downloadUrl = mirror.playUrl;
  }

  // 如果主站没有歌词但镜像站有，使用镜像站的
  if (!result.lyrics && mirror && mirror.lyrics) {
    result.lyrics = mirror.lyrics;
  }

  // 如果主站没有封面但镜像站有，使用镜像站的
  if (!result.cover && mirror && mirror.cover) {
    result.cover = mirror.cover;
  }

  // 如果两个站点都没有播放地址，尝试从网易云音乐获取后备播放源
  if (!result.playUrl && result.name) {
    const neteaseId = await searchNetease(result.name, result.singer);
    if (neteaseId) {
      result.neteaseId = neteaseId;
    }
  }

  return result;
}

/**
 * 获取热门歌曲推荐
 * 爬取首页热门歌曲列表
 * @returns {Promise<Array>} 热门歌曲列表
 */
async function getHotMusic() {
  const response = await httpClient.get(BASE_URL);
  const $ = cheerio.load(response.data);
  const songs = [];
  const seenIds = new Set();

  $('a[href*="/music/"]').each((_index, element) => {
    const $a = $(element);
    const href = $a.attr('href') || '';
    const idMatch = href.match(/\/music\/(\d+)/);
    if (!idMatch || songs.length >= 30) return;

    const id = idMatch[1];
    if (seenIds.has(id)) return;
    seenIds.add(id);

    const title = $a.attr('title') || '';
    const { name, singer } = parseTitle(title);

    if (!name) return;

    songs.push({ id, name, singer, cover: '' });
  });

  return songs;
}

module.exports = { searchMusic, getMusicDetail, getHotMusic };
