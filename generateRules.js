const fs = require('fs');

// 读取配置文件
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

function generateRules() {
  const rules = [];
  let id = 1;

  Object.entries(config.redirects).forEach(([sourcePattern, mapping]) => {
    if (sourcePattern === 'gitlab.bxplc.cn/*') {
      // 特殊处理 gitlab 规则
      const { scheme, host, port } = mapping.primary;
      rules.push({
        id: id++,
        priority: 1,
        action: {
          type: "redirect",
          redirect: {
            transform: {
              scheme,
              host,
              port
            }
          }
        },
        condition: {
          urlFilter: `|${scheme}://${host}/*`,
          resourceTypes: ["main_frame"]
        }
      });
    } else {
      // 处理普通映射
      const sourceBase = sourcePattern.replace('/*', '');
      const [sourceHost, sourcePort] = sourceBase.split(':');
      
      if (typeof mapping === 'string') {
        // 简单映射，没有备份
        const [targetHost, targetPort] = mapping.split(':');
        // 创建两个规则：一个带端口，一个不带端口（针对80端口）
        rules.push({
          id: id++,
          priority: 1,
          action: {
            type: "redirect",
            redirect: {
              url: `http://${targetHost}:${targetPort}`
            }
          },
          condition: {
            urlFilter: `*://${sourceBase}/*`,
            resourceTypes: ["main_frame"]
          }
        });

        // 如果是80端口，添加不带端口的规则
        if (sourcePort === '80') {
          rules.push({
            id: id++,
            priority: 1,
            action: {
              type: "redirect",
              redirect: {
                url: `http://${targetHost}:${targetPort}`
              }
            },
            condition: {
              urlFilter: `*://${sourceHost}/*`,
              resourceTypes: ["main_frame"]
            }
          });
        }
      } else {
        // 带备份的映射
        const [primaryHost, primaryPort] = mapping.primary.split(':');
        
        // 添加主要地址规则（优先级最高）
        // 创建两个规则：一个带端口，一个不带端口（针对80端口）
        rules.push({
          id: id++,
          priority: 2, // 主地址优先级更高
          action: {
            type: "redirect",
            redirect: {
              url: `http://${primaryHost}:${primaryPort}`
            }
          },
          condition: {
            urlFilter: `*://${sourceBase}/*`,
            resourceTypes: ["main_frame"]
          }
        });

        // 如果是80端口，添加不带端口的规则
        if (sourcePort === '80') {
          rules.push({
            id: id++,
            priority: 2,
            action: {
              type: "redirect",
              redirect: {
                url: `http://${primaryHost}:${primaryPort}`
              }
            },
            condition: {
              urlFilter: `*://${sourceHost}/*`,
              resourceTypes: ["main_frame"]
            }
          });
        }

        // 处理备份地址（按顺序降低优先级）
        if (mapping.backups) {
          mapping.backups.forEach((backup, index) => {
            const [backupHost, backupPort] = backup.split(':');
            // 创建带端口的规则
            rules.push({
              id: id++,
              priority: 1, // 备份地址优先级较低
              action: {
                type: "redirect",
                redirect: {
                  url: `http://${backupHost}:${backupPort}`
                }
              },
              condition: {
                urlFilter: `*://${sourceBase}/*`,
                resourceTypes: ["main_frame"]
              }
            });

            // 如果是80端口，添加不带端口的规则
            if (sourcePort === '80') {
              rules.push({
                id: id++,
                priority: 1,
                action: {
                  type: "redirect",
                  redirect: {
                    url: `http://${backupHost}:${backupPort}`
                  }
                },
                condition: {
                  urlFilter: `*://${sourceHost}/*`,
                  resourceTypes: ["main_frame"]
                }
              });
            }
          });
        }
      }
    }
  });

  return rules;
}

// 生成并保存规则文件
const rules = generateRules();
fs.writeFileSync('rules.json', JSON.stringify(rules, null, 2));
console.log('规则文件已生成！'); 