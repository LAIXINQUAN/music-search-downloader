/**
 * 卡密管理服务
 * 封装 GitHub Contents API 调用，实现卡密页面文件的读取与更新
 * GitHub Token 采用 AES-256-CBC 加密内置，运行时解密使用
 *
 * 仓库结构说明：
 * - 卡密页面 URL: https://laixinquan.github.io/LAIQB/
 * - 实际对应仓库: LAIXINQUAN/LAIQB（project 仓库启用 GitHub Pages）
 * - 卡密页面文件位于仓库根目录（README.md / index.md / index.html 之一）
 */
const axios = require('axios');
const crypto = require('crypto');

// GitHub 仓库配置
const OWNER = 'LAIXINQUAN';
const REPO = 'LAIQB';
const GITHUB_API = 'https://api.github.com';

// 加密密钥（SHA-256 派生，32 字节）与初始化向量（16 字节）
const ENC_KEY = crypto.createHash('sha256').update('QBMusic_CardKey_2024_Secure_Internal').digest();
const ENC_IV = Buffer.from('QB_Music_IV_16b!', 'utf8');

// AES-256-CBC 加密后的 GitHub Token（密文 hex）
const ENCRYPTED_TOKEN = '6bbaa617cae72c9e782906b51c4c3f87ecbd0805de1a2a1c7f83bbe80c8b647a24f5dfc879a950eed2dec917ce89a066';

/**
 * 解密内置的 GitHub Token
 * 使用 AES-256-CBC 算法，密钥通过 SHA-256 从固定字符串派生
 * @returns {string} 解密后的 GitHub Token
 */
function decryptToken() {
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, ENC_IV);
  let decrypted = decipher.update(ENCRYPTED_TOKEN, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * 识别卡密页面文件路径与当前 sha
 * 调用 GitHub Contents API 列出仓库根目录，按 index.md > README.md > index.html 优先级选择
 * 目录为空或 404 则返回新建路径 index.md
 * @returns {Promise<{path: string, sha: string|null}>} 文件路径与 sha
 */
async function getCardKeyFile() {
  const token = decryptToken();
  try {
    const res = await axios.get(`${GITHUB_API}/repos/${OWNER}/${REPO}/contents/`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'QB-Music-App'
      },
      timeout: 15000
    });
    const files = Array.isArray(res.data) ? res.data : [];
    // 优先级：index.md > README.md > index.html
    const priority = ['index.md', 'README.md', 'index.html'];
    for (const name of priority) {
      const f = files.find(item => item.name === name && item.type === 'file');
      if (f) {
        return { path: f.name, sha: f.sha };
      }
    }
    // 仓库根目录无候选文件，新建 index.md
    return { path: 'index.md', sha: null };
  } catch (err) {
    // 404 表示仓库为空或路径不存在，新建 index.md
    if (err.response && err.response.status === 404) {
      return { path: 'index.md', sha: null };
    }
    const reason = err.response && err.response.data && err.response.data.message
      ? err.response.data.message
      : err.message;
    throw new Error(`获取卡密文件失败: ${reason}`);
  }
}

/**
 * 读取卡密页面文件的当前内容，解析出所有 8 位卡密
 * 调用 GitHub Contents API GET 单个文件，返回的 content 是 base64 编码
 * @returns {Promise<{keys: string[], path: string, sha: string|null, rawContent: string}>} 卡密列表、文件路径、sha、原始内容
 */
async function readCardKeys() {
  const { path, sha } = await getCardKeyFile();
  // 新建场景（sha 为 null），返回空列表
  if (!sha) {
    return { keys: [], path, sha: null, rawContent: '' };
  }
  const token = decryptToken();
  try {
    const res = await axios.get(`${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${path}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'QB-Music-App'
      },
      timeout: 15000
    });
    // content 字段是 base64 编码的文件内容
    const rawContent = Buffer.from(res.data.content || '', 'base64').toString('utf8');
    // 提取所有 8 位数字卡密
    const matches = rawContent.match(/\b\d{8}\b/g) || [];
    // 去重，保持顺序
    const seen = new Set();
    const keys = [];
    for (const k of matches) {
      if (!seen.has(k)) { seen.add(k); keys.push(k); }
    }
    // 用最新接口返回的 sha（更准确）
    return { keys, path, sha: res.data.sha, rawContent };
  } catch (err) {
    const reason = err.response && err.response.data && err.response.data.message
      ? err.response.data.message
      : err.message;
    throw new Error(`读取卡密文件内容失败: ${reason}`);
  }
}

/**
 * 根据卡密数组生成完整全新的 markdown 内容
 * 生成的就是替换后的完整文件内容
 * @param {string[]} keys - 卡密数组（每项为 8 位数字）
 * @returns {string} markdown 内容
 */
function buildCardKeyMarkdown(keys) {
  const lines = ['# LAIQB', '', '最新版本：3.6.6', '', '## 下载地址', '- 下载地址：https://laixinquan.github.io/music-search-downloader/', '', '# 卡密列表', ''];
  keys.forEach((key, idx) => {
    lines.push(`- 卡密 ${idx + 1}：\`${key}\``);
  });
  lines.push('');
  return lines.join('\n');
}

/**
 * 用新的 markdown 内容写回 GitHub 文件（完全覆盖）
 * @param {string} path - 文件路径
 * @param {string|null} sha - 当前文件 sha（更新已有文件时必须携带）
 * @param {string} content - 全新 markdown 内容
 * @returns {Promise<void>}
 */
async function writeCardKeyFile(path, sha, content) {
  const token = decryptToken();
  const contentBase64 = Buffer.from(content, 'utf8').toString('base64');
  const body = {
    message: 'update card keys',
    content: contentBase64
  };
  if (sha) body.sha = sha;
  try {
    await axios.put(
      `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${path}`,
      body,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'QB-Music-App'
        },
        timeout: 30000
      }
    );
  } catch (err) {
    const reason = err.response && err.response.data && err.response.data.message
      ? err.response.data.message
      : err.message;
    throw new Error(`写入卡密文件失败: ${reason}`);
  }
}

/**
 * 替换当前卡密：读取云端卡密文件原始内容，只替换卡密文本，保留其他内容不变
 * 如果 oldKey 不在云端列表中，则报错
 * @param {string} oldKey - 当前使用的卡密（8 位数字）
 * @param {string} newKey - 新卡密（8 位数字）
 * @returns {Promise<{success: true, replaced: boolean}>}
 * @throws {Error} 失败时抛出含原因的错误
 */
async function replaceCardKey(oldKey, newKey) {
  // 参数校验
  if (!/^\d{8}$/.test(String(oldKey))) {
    throw new Error(`非法当前卡密格式: ${oldKey}`);
  }
  if (!/^\d{8}$/.test(String(newKey))) {
    throw new Error(`非法新卡密格式: ${newKey}`);
  }
  if (oldKey === newKey) {
    throw new Error('新卡密与当前卡密相同，无需修改');
  }

  // 1. 读取云端卡密文件原始内容
  const { keys, path, sha, rawContent } = await readCardKeys();

  // 2. 检查 oldKey 是否在列表中
  if (!keys.includes(String(oldKey))) {
    throw new Error('当前卡密不在云端列表中，可能已被修改');
  }

  // 3. 新建场景（sha 为 null），转用 buildCardKeyMarkdown 生成初始内容
  if (!sha) {
    const newKeys = keys.map(k => k === String(oldKey) ? String(newKey) : k);
    const content = buildCardKeyMarkdown(newKeys);
    await writeCardKeyFile(path, sha, content);
    return { success: true, replaced: true };
  }

  // 4. 对原始内容做文本替换：把 oldKey 替换为 newKey
  // 使用单词边界确保只替换完整 8 位数字卡密，避免误替换文件中其他数字
  const regex = new RegExp(`\\b${oldKey}\\b`, 'g');
  const newContent = rawContent.replace(regex, String(newKey));

  // 如果替换后内容没变，说明 oldKey 虽在卡密列表中但未出现在原始内容中（理论上不会发生）
  if (newContent === rawContent) {
    throw new Error('卡密替换失败：无法在原始文件中定位到该卡密');
  }

  // 5. 写回文件（保留原始格式、版本号、链接、说明等所有内容）
  await writeCardKeyFile(path, sha, newContent);
  return { success: true, replaced: true };
}

module.exports = { getCardKeyFile, readCardKeys, buildCardKeyMarkdown, replaceCardKey };
