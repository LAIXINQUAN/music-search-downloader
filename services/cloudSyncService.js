/**
 * 收藏云同步服务（飞书多维表格存储）
 * 把每台设备的收藏列表按匿名 deviceId 存到飞书多维表格，实现真正的跨设备云同步
 * 复用 usageService 的飞书应用凭据与 token 获取逻辑（凭据 AES 加密内置）
 *
 * 存储设计（每台设备一行）：
 * - 设备标识（文本）：匿名 deviceId
 * - 收藏数据（文本）：收藏列表 JSON 字符串
 * - 更新时间（文本）：最近一次同步时间
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getTenantToken } = require('./usageService');

const FEISHU_API = 'https://open.feishu.cn/open-apis';
// 复用使用统计同一飞书应用的多维表格（APP_TOKEN），新建独立子表存储收藏
const BITABLE_APP_TOKEN = 'LP1rbleZ9anXyRsuse9cuFv2n5X';

// 已创建好的收藏云同步表 ID（避免打包版因配置丢失而重复建表）
const DEFAULT_TABLE_ID = 'tbletcAbpffcZepA';

// 收藏云同步表的字段名
const FIELD_DEVICE = '设备标识';
const FIELD_DATA = '收藏数据';
const FIELD_UPDATE = '更新时间';
const FIELD_OWNER = '账号邮箱';

/**
 * 计算可写的数据目录
 * 打包后的 Electron 应用中 __dirname 位于只读的 app.asar 内，
 * 因此配置必须存到 Electron 的 userData 目录（可写）；纯 Node 测试时回退到项目 data/。
 * @returns {string} 数据目录绝对路径
 */
function getDataDir() {
  try {
    const electron = require('electron');
    if (electron && electron.app && typeof electron.app.getPath === 'function') {
      return electron.app.getPath('userData');
    }
  } catch (err) {
    // 非 Electron 环境（如 node 单测）
  }
  return path.join(__dirname, '..', 'data');
}

// 表 id 缓存文件（首次创建后持久化到可写目录，避免重复建表）
const CONFIG_FILE = path.join(getDataDir(), 'cloud-sync-config.json');

// 并发去重：多个请求同时触发建表/查询时只执行一次
let tableEnsurePromise = null;

/**
 * 读取云同步配置（table_id）
 * @returns {Object} 配置对象
 */
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (err) {
    return {};
  }
}

/**
 * 保存云同步配置
 * @param {Object} cfg - 配置对象
 */
function saveConfig(cfg) {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg), 'utf8');
}

/**
 * 确保收藏云同步表存在（首次使用时自动创建，并缓存 table_id）
 * @returns {Promise<string>} 表 id
 */
async function ensureTable() {
  const cfg = loadConfig();
  // 已有配置优先；其次复用已创建好的默认表；都没有才自动建表
  if (cfg.tableId) return cfg.tableId;
  if (DEFAULT_TABLE_ID) {
    saveConfig({ tableId: DEFAULT_TABLE_ID });
    return DEFAULT_TABLE_ID;
  }
  // 并发去重：建表只执行一次
  if (tableEnsurePromise) return tableEnsurePromise;
  tableEnsurePromise = (async () => {
    const token = await getTenantToken();
    const res = await axios.post(
      `${FEISHU_API}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables`,
      {
        table: {
          name: '收藏云同步',
          fields: [
            { field_name: FIELD_DEVICE, type: 1 },
            { field_name: FIELD_DATA, type: 1 },
            { field_name: FIELD_UPDATE, type: 1 }
          ]
        }
      },
      {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );
    if (!res.data || res.data.code !== 0) {
      throw new Error(`创建收藏表失败: ${res.data && res.data.msg || '未知错误'}`);
    }
    const tableId = res.data.data.table_id;
    saveConfig({ tableId });
    return tableId;
  })().finally(() => {
    tableEnsurePromise = null;
  });
  return tableEnsurePromise;
}

/**
 * 查询收藏记录（按账号邮箱或设备标识）
 * @param {string} token - 飞书 token
 * @param {string} tableId - 表 id
 * @param {Object} opts - { owner?, deviceId? }（至少提供一个）
 * @returns {Promise<{recordId: string, favorites: Array} | null>} 记录或 null
 */
async function findRecord(token, tableId, opts) {
  const conditions = [];
  if (opts.owner) {
    conditions.push({ field_name: FIELD_OWNER, operator: 'is', value: [opts.owner] });
  } else if (opts.deviceId) {
    conditions.push({ field_name: FIELD_DEVICE, operator: 'is', value: [opts.deviceId] });
  } else {
    return null;
  }
  const res = await axios.post(
    `${FEISHU_API}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${tableId}/records/search`,
    {
      filter: { conjunction: 'and', conditions },
      page_size: 1
    },
    {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 15000
    }
  );
  if (!res.data || res.data.code !== 0) {
    throw new Error(`查询收藏记录失败: ${res.data && res.data.msg || '未知错误'}`);
  }
  const items = (res.data.data && res.data.data.items) || [];
  if (items.length === 0) return null;
  const item = items[0];
  // 飞书文本字段返回数组 [{text, type}]，需提取 text 拼接
  const dataField = item.fields[FIELD_DATA];
  let raw = '';
  if (Array.isArray(dataField)) {
    raw = dataField.map(x => (x && x.text) || '').join('');
  } else if (typeof dataField === 'string') {
    raw = dataField;
  }
  let favorites = [];
  try {
    favorites = JSON.parse(raw || '[]');
  } catch (err) {
    favorites = [];
  }
  return { recordId: item.record_id, favorites };
}

/**
 * 保存收藏到飞书多维表格（按 owner 邮箱或 deviceId 更新或新建）
 * @param {Object} opts - { owner?, deviceId?, favorites }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function saveCloudFavorites(opts) {
  try {
    const { owner, deviceId, favorites } = opts || {};
    if (!owner && !deviceId) {
      return { success: false, error: '缺少账号或设备标识' };
    }
    const tableId = await ensureTable();
    const token = await getTenantToken();
    const now = new Date().toLocaleString('zh-CN', { hour12: false });
    const fields = {
      [FIELD_DATA]: JSON.stringify(favorites || []).slice(0, 60000),
      [FIELD_UPDATE]: now
    };
    if (owner) fields[FIELD_OWNER] = owner.slice(0, 100);
    if (deviceId) fields[FIELD_DEVICE] = deviceId.slice(0, 64);
    const existing = await findRecord(token, tableId, { owner, deviceId });
    let res;
    if (existing && existing.recordId) {
      res = await axios.put(
        `${FEISHU_API}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${tableId}/records/${existing.recordId}`,
        { fields },
        {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );
    } else {
      res = await axios.post(
        `${FEISHU_API}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${tableId}/records`,
        { fields },
        {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );
    }
    if (res.data && res.data.code === 0) {
      return { success: true };
    }
    throw new Error((res.data && res.data.msg) || '飞书写入失败');
  } catch (err) {
    console.error('[收藏云同步] 保存失败:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 从飞书多维表格拉取收藏
 * @param {Object} opts - { owner?, deviceId? }
 * @returns {Promise<{success: boolean, favorites?: Array, error?: string}>}
 */
async function loadCloudFavorites(opts) {
  try {
    const { owner, deviceId } = opts || {};
    if (!owner && !deviceId) {
      return { success: true, favorites: [] };
    }
    const tableId = await ensureTable();
    const token = await getTenantToken();
    const existing = await findRecord(token, tableId, { owner, deviceId });
    return { success: true, favorites: existing ? existing.favorites : [] };
  } catch (err) {
    console.error('[收藏云同步] 拉取失败:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { saveCloudFavorites, loadCloudFavorites };
