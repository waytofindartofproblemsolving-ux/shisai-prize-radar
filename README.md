# 拾赛 · 线上能做完的比赛

一张表：比赛名称、主要内容、日期、奖金、官网、费用。只收数学建模、编程、数据分析和 AI 应用类，优先免费、线上可完成。

## 本地运行

```powershell
npm run dev       # http://127.0.0.1:5173
npm test
npm run build
npm run monitor   # 检查信息源，写入 data/monitor.json
```

无第三方运行依赖，Node.js 24 即可。构建产物是 Cloudflare Worker ESM（`dist/server/index.js`）。

## 当前数据

- 26 项赛事：8 项已核实免费，4 项写明报名费，14 项官网未列费用、标待核实。
- 80 个信息源：30 个可自动检查，50 个需要手动打开（公众号、小红书、反爬平台；主列表之外还有“更多平台入口”）。
- 自动检查先直连，失败后自动改走 `r.jina.ai` 阅读代理；当前 30 个自动源里 28 个可读，2 个需人工。微信、小红书要登录/验证码，不走绕过登录的方案。
- 2 项需要先走校内选拔（标“需校赛”）：统计建模、计算机设计。
- 已删掉正大杯市调（获奖率低、知识赛+校赛复杂）和服务外包（总获奖率≤20%、校赛重）。
- 已知获奖率直接写在标签里：统计建模省奖 60%、计算机设计约 70%、电工杯 45%、华中杯约 33%。
- 仓颉 2026 作品提交已结束（10/31 只是赛事收尾），已从可报名表移除；下一届再跟踪。
- 2027 年日期是根据 2026 年赛程标注的预告，不当成已公布日期；每项都附“费用依据”链接。
- 费用口径：只有当届通知明确“不收费”才标“已核实免费”；写明金额的标“收费”；官网没写不推断为免费。
- 已剔除文学、外语、翻译、艺术、法律、医学、硬件和需要线下初赛、复杂校赛、专业笔试的项目；保留直接报名或校赛较轻的线上赛。
- 删掉了开放原子 Agentic OS、CCF 开源创新、开源之夏这类长期提 PR / 长期项目的赛事。
- 补充了小红书 Skill 创新赛（136 个奖）、榆林市智能体大赛（238 队、低竞争）、昇腾电力算子专场（19 万池）、世界科学智能大赛（AI4S，百万池）、openJiuwen 智能体大赛（38.5 万池、176 队）、中国电信星辰杯（70 万池、403 队）、开源鸿蒙大学生创新大赛（176 万池、111 队）、帆软全球数据分析、IP2Location 编程赛，以及 DoraHacks、AI赛事通、华为 ICT、华为开发者大赛、AtomGit 赛事、AITOP100、WaytoAGI、Devpost、Kaggle、AIcrowd、Luma、GitLink、数学中国、开放黑客松、量子位、机器之心、小红书比赛关键词等信息源。
- 去掉 BCH Blaze：奖金是 PUSD/BCH 等加密资产，国内合规兑换风险高。
- “更多平台入口”覆盖火山引擎、扣子、支付宝、京东云、小米、快手、B站、知乎、CSDN、开源中国、GitHub、Hugging Face、新智元、InfoQ、36氪、蓝桥杯、微信/飞书/钉钉开放平台、智谱、MiniMax、月之暗面、移动云、天翼云、OpenHarmony、openEuler、龙蜥、GitCode、互动吧等。

## 监测怎么工作

`npm run monitor` 读取 `lib/radar-data.ts` 里的 `monitorUrl`，请求公开网页，限制 15 秒超时和响应大小，按正文 SHA-256 与上次结果比对，写入 `data/monitor.json`。网页变化只提示“需人工确认”，不会自动改写赛事信息。

页面上的“检查更新”调用 `POST /api/check`，在浏览器里即时检查一次。托管端需要登录身份；本地开发不需要。

需要定时跑时，用系统计划任务或 CI 每天执行一次 `npm run monitor` 即可。监测不是新赛事搜索器：它只告诉我们固定入口有没有变化，新比赛仍需从信息源里人工发现。

## 网站内添加 API 信息源

信息源页底部有“API 信息源”表单：填名称、JSON API 地址、可选 Headers、数据路径和字段名，就能添加并立即检查。

- 配置保存在当前浏览器的 `localStorage`，不写进仓库、不上传服务器。
- Headers 会经本站的 `POST /api/fetch-json` 服务端代理转发；代理只允许公网 `http/https`，拒绝 localhost/内网地址，15 秒超时，最多 2MB，且只接受 JSON。
- 数据路径支持 `data.items` 这种点号路径；字段支持 `title`、`commit.message` 这种路径。
- 检查结果会显示前几条，并用内容指纹判断是否有变化。
- 只支持公开的 **GET JSON**；不支持 POST、OAuth、分页和需要登录的接口。
- 长期 API Key 不要放在公用电脑的浏览器里；`localStorage` 能被同源脚本读取。

## DeepSeek 接入

复制 `.env.example` 为 `.env.local`，填入 `DEEPSEEK_API_KEY`，然后 `npm run dev`。密钥只在服务端读取，前端不接收、不保存。

- `GET /api/data`：赛事表、信息源和最近监测结果
- `GET /api/status`：是否配置 Key
- `POST /api/check`：即时检查信息源
- `POST /api/fetch-json`：代理读取公开 JSON API（拒绝内网地址，限制超时/大小）
- `POST /api/analyze`：从公告正文提取摘要、奖金和费用说明，输出始终标记 `verified: false`

托管端用 Sites 的 runtime secret 配置同名变量。没有 Key 时返回 503，不调用模型。模型调用可能产生 API 费用。

## 主要出处

- 国赛 2026 江苏赛区通知（300 元/队）：https://www.cmathc.org.cn/mcm/news/421.html
- 电工杯 2026 通知（免费）：https://www.cmathc.org.cn/mcm/tz/433.html
- 华中杯 2026 通知（150 元/队）：https://www.cmathc.org.cn/mcm/tz/405.html
- 统计建模 2026 通知（免费）：https://xkjszx.nwafu.edu.cn/sstz/f03ec369c11348f394eef6f88ac9ff96.htm
- 市场调查第 17 届通知（30 元/人）：https://cbds.gufe.edu.cn/info/1003/4684.htm
- 计算机设计大赛 2026 北京赛区（200 元/件）：https://jwc.cueb.edu.cn/jwgg/6589b6a6ba8f430897ada1534223147c.htm
- 服务外包 2026 通知（免费）：https://jwzx.jhun.edu.cn/73/ed/c7531a226285/pagem.htm
- 软件创新第 19 届（免费）：https://sise.uestc.edu.cn/info/1030/14052.htm
- 全球校园 AI 2026（免费）：https://www2.ncwu.edu.cn/gcxlzx/info/1027/2158.htm
- CCF 开源创新大赛 2026：https://www.ccf.org.cn/Chapters/DC/ODC/wyhdt/2026-03-23/865096.shtml
- CCF BDCI 2026：https://openjiuwen.com/en/news/news-artical?id=42
- 讯飞星火杯 2026：https://challenge.xfyun.cn/xinghuo
- 开源之夏学生指南：https://blog.summer-ospp.ac.cn/help/student%20guide
- 北太天元 2026：https://baltamatica.com/news/show/1786938622.html
- MoonBit 2026：https://www.moonbitlang.cn/2026-scc/
- 美赛 2026 报名通知（100 美元/队）：https://chuangye.qut.edu.cn/info/1088/4092.htm
- 开放原子大赛 Agentic OS 赛项（免费，10 万）：https://competition.openatom.tech/competitionInfo?id=a3621254e3edc1797e6600f43fe3d07d
- MoonBit 十月黑客松（10/31 截止）：https://moonbitlang.github.io/Hackathon2026/
- 华为算法精英实战营（单期 10 万）：https://developer.huaweicloud.com/hackathon
- 华为 ICT 大赛 2025–2026 手册：https://e.huawei.com/cn/documents/others/212464e4d94143deaad4b1ee7f9dc55f
- 统计建模省赛奖项比例（10/20/30）：https://www.csust.edu.cn/stxy/info/1155/10544.htm
- 计算机设计大赛获奖比例（10/20/40）：https://jwc.cueb.edu.cn/jwgg/6589b6a6ba8f430897ada1534223147c.htm
- 昇腾电力算子专场（11/6 截止，19 万池）：https://ai6s.net/6aca399349ed150a32d6c12c.html
- 世界科学智能大赛（AI4S，百万池）：https://alumni.fudan.edu.cn/d4/ab/c14607a775339/page.htm
- 小红书 Skill 创新赛（50 万池，136 个奖）：https://www.guandian.hk/article/20261022/10038129.html

- 榆林市智能体应用开发大赛（238 队）：https://xxgc.yulinu.edu.cn/info/1059/2672.htm
- openJiuwen 智能体创新大赛（38.5 万池）：https://openjiuwen.com/en/news/news-artical?id=256
- 中国电信星辰杯（70 万池）：https://m.saikr.com/vse/XCB26
- 开源鸿蒙大学生创新大赛（176 万池）：https://harmonyosdev.csdn.net/6a58a60010ee7a33f28e2731.html
- 帆软全球数据分析大赛（7 万美元池，免费）：https://www.fanruan.com/en/events/datapioneer-2026
- IP2Location 编程竞赛（2027 参考）：https://contest.ip2location.com/?lang=zh_CN

官方通知和方向判断分开记录。单项奖金不等于预期收益，获奖名额不等于获奖概率。日期按中国时区理解；AI 使用规则各赛不同，提交前看当届规则。
