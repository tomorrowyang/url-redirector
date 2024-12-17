// // background.js

// // 存储主机状态和重定向规则
// let hostStatus = {};
// let redirectRules = {};

// // 从config.json加载规则
// async function loadRules() {
//   try {
//     const response = await fetch(chrome.runtime.getURL('config.json'));
//     const config = await response.json();
//     redirectRules = config.redirects;
//     initializeHostStatus();
//   } catch (error) {
//     console.error('加载规则失败:', error);
//   }
// }

// // 初始化主机状态
// function initializeHostStatus() {
//   Object.values(redirectRules).forEach(mapping => {
//     if (typeof mapping === 'object') {
//       // 处理 gitlab 特殊情况
//       if (mapping.primary && mapping.primary.host) {
//         const key = `${mapping.primary.host}:${mapping.primary.port}`;
//         hostStatus[key] = { isAvailable: true, lastCheck: Date.now() };
//       }
//       // 处理普通带备份的情况
//       else if (mapping.primary && typeof mapping.primary === 'string') {
//         const [host, port] = mapping.primary.split(':');
//         const key = `${host}:${port}`;
//         hostStatus[key] = { isAvailable: true, lastCheck: Date.now() };
//       }
//     }
//   });
// }

// // 检查主机可用性
// async function checkHostAvailability(host, port) {
//   try {
//     const controller = new AbortController();
//     const timeoutId = setTimeout(() => controller.abort(), 2000);

//     try {
//       const response = await fetch(`http://${host}:${port}/`, {
//         method: 'HEAD',
//         mode: 'no-cors',
//         signal: controller.signal,
//         cache: 'no-store'
//       });
      
//       clearTimeout(timeoutId);
//       console.log(`检查 ${host}:${port} - 状态: 可用`);
//       return true;
//     } catch (error) {
//       clearTimeout(timeoutId);
//       console.log(`检查 ${host}:${port} - 状态: 不可用 (${error.message})`);
//       return false;
//     }
//   } catch (error) {
//     console.log(`检查 ${host}:${port} 失败:`, error.message);
//     return false;
//   }
// }

// // 定期检查所有主机状态
// async function checkAllHosts() {
//   console.log('开始检查主机状态...');
//   for (const [hostPort, status] of Object.entries(hostStatus)) {
//     const [host, port] = hostPort.split(':');
//     const isAvailable = await checkHostAvailability(host, port);
//     console.log(`${host}:${port} 状态:`, isAvailable ? '可用' : '不可用');
    
//     if (status.isAvailable !== isAvailable) {
//       status.isAvailable = isAvailable;
//       status.lastCheck = Date.now();
//       console.log(`${host}:${port} 状态发生变化，更新规则...`);
//       await updateRedirectRules(host, port, isAvailable);
//     }
//   }
// }

// // 更新重定向规则
// async function updateRedirectRules(host, port, isAvailable) {
//   try {
//     console.log(`更新规则: ${host}:${port} ${isAvailable ? '可用' : '不可用'}`);
    
//     // 获取当前所有规则
//     const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
//     const removeRuleIds = [];
//     const addRules = [];
//     let nextRuleId = Math.max(...currentRules.map(r => r.id), 0) + 1;

//     if (!isAvailable) {
//       // 找到并移除所有指向不可用��机的规则
//       currentRules.forEach(rule => {
//         if (rule.action.redirect && rule.action.redirect.url) {
//           const redirectUrl = rule.action.redirect.url;
//           if (redirectUrl.includes(`${host}:${port}`)) {
//             removeRuleIds.push(rule.id);
//             console.log(`将移除规则 ${rule.id}: ${redirectUrl}`);
//           }
//         }
//       });

//       // 为每个使用该主机作为主要地址的规则添加备用规则
//       Object.entries(redirectRules).forEach(([sourcePattern, mapping]) => {
//         if (typeof mapping === 'object' && mapping.backups && mapping.primary) {
//           const [primaryHost, primaryPort] = mapping.primary.split(':');
//           if (primaryHost === host && primaryPort === port) {
//             const [sourceHost, sourcePort] = sourcePattern.replace('/*', '').split(':');
//             const backup = mapping.backups[0];
//             const [backupHost, backupPort] = backup.split(':');

//             console.log(`为 ${sourceHost}:${sourcePort} 添加备用规则: ${backupHost}:${backupPort}`);

//             // 添加带端口的规则
//             addRules.push({
//               id: nextRuleId++,
//               priority: 3,
//               action: {
//                 type: "redirect",
//                 redirect: {
//                   url: `http://${backupHost}:${backupPort}`
//                 }
//               },
//               condition: {
//                 urlFilter: `*://${sourceHost}:${sourcePort}/*`,
//                 resourceTypes: ["main_frame"]
//               }
//             });

//             // 如果是80端口，添加不带端口的规则
//             if (sourcePort === '80') {
//               addRules.push({
//                 id: nextRuleId++,
//                 priority: 3,
//                 action: {
//                   type: "redirect",
//                   redirect: {
//                   url: `http://${backupHost}:${backupPort}`
//                   }
//                 },
//                 condition: {
//                   urlFilter: `*://${sourceHost}/*`,
//                   resourceTypes: ["main_frame"]
//                 }
//               });
//             }
//           }
//         }
//       });
//     } else {
//       // 如果主机恢复可用，移除所有备用规则并恢复原始规则
//       // 首先移除所有相关的规则（包括备用规则）
//       currentRules.forEach(rule => {
//         if (rule.priority === 3) {  // 备用规则
//           removeRuleIds.push(rule.id);
//         }
//       });

//       // 恢复原始规则
//       Object.entries(redirectRules).forEach(([sourcePattern, mapping]) => {
//         if (typeof mapping === 'object' && mapping.primary) {
//           const [primaryHost, primaryPort] = mapping.primary.split(':');
//           if (primaryHost === host && primaryPort === port) {
//             const [sourceHost, sourcePort] = sourcePattern.replace('/*', '').split(':');

//             // 添加带端口的规则
//             addRules.push({
//               id: nextRuleId++,
//               priority: 1,
//               action: {
//                 type: "redirect",
//                 redirect: {
//                   url: `http://${host}:${port}`
//                 }
//               },
//               condition: {
//                 urlFilter: `*://${sourceHost}:${sourcePort}/*`,
//                 resourceTypes: ["main_frame"]
//               }
//             });

//             // 如果是80端口，添加不带端口的规则
//             if (sourcePort === '80') {
//               addRules.push({
//                 id: nextRuleId++,
//                 priority: 1,
//                 action: {
//                   type: "redirect",
//                   redirect: {
//                     url: `http://${host}:${port}`
//                   }
//                 },
//                 condition: {
//                   urlFilter: `*://${sourceHost}/*`,
//                   resourceTypes: ["main_frame"]
//                 }
//               });
//             }
//           }
//         }
//       });
//     }

//     // 更新规则
//     if (removeRuleIds.length > 0 || addRules.length > 0) {
//       await chrome.declarativeNetRequest.updateDynamicRules({
//         removeRuleIds: removeRuleIds,
//         addRules: addRules
//       });
//       console.log(`规则更新完成 - 移除: ${removeRuleIds.length}, 添加: ${addRules.length}`);
//     }
//   } catch (error) {
//     console.error('更新规则失败:', error);
//   }
// }

// // 初始化时立即检查一次
// loadRules().then(() => {
//   console.log('规则加载完成，开始首次检查...');
//   checkAllHosts();
// });

// // 每5秒检查一次主机状态
// chrome.alarms.create('checkHosts', { periodInMinutes: 0.083 });
// chrome.alarms.onAlarm.addListener((alarm) => {
//   if (alarm.name === 'checkHosts') {
//     checkAllHosts();
//   }
// });

// // 监听安装/更新事件
// chrome.runtime.onInstalled.addListener(() => {
//   console.log('扩展已安装/更新，重新加载规则...');
//   loadRules().then(() => checkAllHosts());
// });