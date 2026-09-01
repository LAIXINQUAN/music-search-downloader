/**
 * 版本构建设置脚本
 * 用法：node scripts/set-edition.js <edition> [licenseName]
 *   edition: 'oss'（开源版，默认，含卡密）或 'pro'（开源版，无卡密）
 *   licenseName: 可选，开源版的授权人姓名（硬编码进安装包，用于防转卖署名）
 * 作用：构建前写入 edition.json，供运行时读取版本开关
 */
const fs = require('fs');
const path = require('path');

// 解析命令行参数
const edition = process.argv[2] || 'oss';
const licenseName = process.argv[3] || '';

// 校验版本标识合法
if (!['oss', 'pro'].includes(edition)) {
  console.error(`非法版本标识: ${edition}（仅支持 oss / pro）`);
  process.exit(1);
}

// 生成配置对象
const config = { edition, licenseName };

// 写入 edition.json（构建产物目录下）
const target = path.join(__dirname, '..', 'edition.json');
fs.writeFileSync(target, JSON.stringify(config, null, 2), 'utf8');

console.log(`✔ 已设置构建版本: ${edition}`);
if (edition === 'pro' && licenseName) {
  console.log(`✔ 授权人署名: ${licenseName}`);
}
