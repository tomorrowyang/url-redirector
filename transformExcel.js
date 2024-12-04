const xlsx = require('node-xlsx');
const fs = require('fs');

// 读取Excel文件
const workSheetsFromFile = xlsx.parse(fs.readFileSync('工作簿1.xlsx'));

// 选择第一个工作表
const data = workSheetsFromFile[0].data;

// 初始化最终的JSON对象
const redirects = {};

// 遍历每一行数据
data.forEach((row, index) => {
  if (index === 0 || !row[0] || !row[1] || !row[2] || !row[3]) return; // 跳过标题行

  const sourceAddress = `${row[2]}:${row[3]}/*`; // 源地址和端口
  const primaryTarget = `${row[0]}`; // 目标地址和端口
  
  // 检查是否有备份地址
  const backups = [];
  if (row[6] === '.11') backups.push(`192.168.0.11:${primaryTarget.split(':')[1]}`);
  if (row[7] === '.201停') backups.push(`192.168.0.201:${primaryTarget.split(':')[1]}`);

  // 构建redirects对象
  if (backups.length > 0) {
    redirects[sourceAddress] = {
      "primary": primaryTarget,
      "backups": backups
    };
  } else {
    redirects[sourceAddress] = primaryTarget;
  }
});

// 添加gitlab特殊规则
redirects["gitlab.bxplc.cn/*"] = {
  "primary": {
    "scheme": "http",
    "host": "gitlab.bxplc.cn",
    "port": "8011"
  }
};

// 初始化最终的JSON对象
const finalJson = {
  "redirects": redirects
};

// 将最终的JSON对象格式化为字符串
const jsonOutput = JSON.stringify(finalJson, null, 2);

// 保存到文件
fs.writeFileSync('config.json', jsonOutput);
console.log('配置文件已生成！'); 