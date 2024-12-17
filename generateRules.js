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
        rules.push({
          id: id++,
          priority: 1,
          action: {
            type: "redirect",
            redirect: {
              regexSubstitution: `http://${targetHost}:${targetPort}\\1`
            }
          },
          condition: {
            regexFilter: `^https?://${sourceHost}:${sourcePort}(/.*)?$`,
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
                regexSubstitution: `http://${targetHost}:${targetPort}\\1`
              }
            },
            condition: {
              regexFilter: `^https?://${sourceHost}(/.*)?$`,
              resourceTypes: ["main_frame"]
            }
          });
        }
      } else {
        // 带备份的映射
        const [primaryHost, primaryPort] = mapping.primary.split(':');
        
        // 添加主要地址规则
        rules.push({
          id: id++,
          priority: 1,
          action: {
            type: "redirect",
            redirect: {
              regexSubstitution: `http://${primaryHost}:${primaryPort}\\1`
            }
          },
          condition: {
            regexFilter: `^https?://${sourceHost}:${sourcePort}(/.*)?$`,
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
                regexSubstitution: `http://${primaryHost}:${primaryPort}\\1`
              }
            },
            condition: {
              regexFilter: `^https?://${sourceHost}(/.*)?$`,
              resourceTypes: ["main_frame"]
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