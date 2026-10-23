# 拾赛 · 小众赛事雷达

第一版以数学建模旧题复现、科学计算案例、轻量代码迁移为筛选重点。无第三方运行依赖，Node.js 24 可直接开发，部署产物为 Cloudflare Worker ESM。

```powershell
npm run dev
npm test
npm run build
```

本机地址：http://127.0.0.1:5173 。网站默认私有发布，平台负责访问控制。

## 已实现

- 4 条真实赛事/历史参考，6 个信息源入口；每条有原文、费用说明、奖项口径与核实日期。
- 数学建模筛选、搜索、排序、历史归档、严格零成本筛选、收藏、手动添加公告、JSON 备份。
- 手动检查 3 个固定公开网页：限制响应大小、超时与跨域跳转，按正文 SHA-256 比较变化并提取本站公告链接。失败不会伪造成功；网页变化不自动改变已核实赛事事实。
- DeepSeek 服务端摘要接口；未配置 Key 返回 503，不会调用模型。解析结果始终为待核实，不能自动认定免费。

## 当前边界

- 公众号和小红书仅提供已核实的账号出处或搜索入口，尚无登录采集、文章订阅或关闭页面后的后台监听。
- 新发现的社交平台公告目前手动添加。人工线索、收藏和检查基线存于当前浏览器，不跨设备同步。
- 截至 2026-10-23，仅 MoonBit 十月黑客松处于已核实的当前报名周期；未核实任何候选全程零成本。北太 C 类是已截止的选题参考。
- 现有手动检查不是新赛事搜索器；动态网站入口的正文不涵盖全部子页面。

## DeepSeek 后续接入

本地将 `.env.example` 复制为 `.env.local`，填入 `DEEPSEEK_API_KEY`，运行 `node --env-file=.env.local scripts/dev.mjs`。托管端使用 Sites 原生 runtime secret 配置同名变量，不能把密钥放入前端、Git 或 hosting manifest。可用 `DEEPSEEK_MODEL` 覆盖模型，默认 `deepseek-flash`（2026-10-23 官方文档）。调用可能产生模型 API 费用。

API：`GET /api/data`、`GET /api/status`、`POST /api/check`、`POST /api/analyze`。后两者要求平台认证身份；本地开发服务器仅绑定 127.0.0.1。模型接口限制正文长度，校验来源和输出 schema；每实例每用户每接口 8 次/分钟限流，不是分布式预算控制。

## 信息出处

- 北太 2026 C 类赛题：https://baltamatica.pku.edu.cn/dssz/2f04b4ca483b4a288819587394761e84.htm
- 北太奖金与赛程：https://baltamatica.pku.edu.cn/index.htm
- 师苑数模作者公开说明：https://develop.baltamatica.com/community/sposts/userinfo/85bdf055435622d76a684b480b0bc9b1.html
- MoonBit 十月黑客松：https://moonbitlang.github.io/Hackathon2026/
- MoonBit 生态赛：https://moonbitlang.github.io/OSC2026/
- Datawhale 公众号出处：https://www.datawhale.cn/static/about/index.html
- 甲辰计划、苦芽科技公众号出处：https://rvspoc.org/
- DeepSeek 官方 API 文档：https://api-docs.deepseek.com/

官方信息和方向匹配判断分开记录。单项奖金不等于预期收益；获奖名额不等于获奖概率。竞赛当地截止日期按中国时区计算。
