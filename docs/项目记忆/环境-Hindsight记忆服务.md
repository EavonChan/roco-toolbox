# 环境 · 本地 Hindsight 记忆服务（2026-11-28 装）

> 用途：给 DSH 插件 `dsh-hindsight` 提供后端，让 Agent 有跨会话长期记忆。
> 与本仓库无关（不影响 `src/`），但换机器时要照这份重装。

## 一、这套东西是什么

| 部件 | 是什么 | 装在哪 |
| --- | --- | --- |
| `dsh-hindsight`（DSH 插件） | `/hindsight` 命令 + 6 个记忆工具（recall / remember / list / forget / related / status） | DSH profile `desktop` |
| `hindsight-api` 1.3.0（服务端） | 真正干活的记忆引擎，REST 在 `127.0.0.1:8888` | Python venv：`C:\Users\Sasaki ishiran\.hindsight\venv` |
| 内嵌 PostgreSQL（pg0） | 存储 + pgvector | 随服务端自动拉起，**不用单独装数据库** |
| 本地模型 2 个 | embedding `BAAI/bge-small-en-v1.5` + reranker `hindsight-ai/hs-rerank-1` | 首次启动自动下载到 HF 缓存 |

## 二、装法（Windows，不用 Docker）

官方支持 Windows 裸机 pip，实测可行；**不需要管理员权限、不需要 Docker Desktop**。

```powershell
# 1) venv + 服务端
python -m venv "C:\Users\Sasaki ishiran\.hindsight\venv"
& "C:\Users\Sasaki ishiran\.hindsight\venv\Scripts\python.exe" -m pip install hindsight-api
```

## 三、环境变量（已写入「用户」级，不是在仓库里）

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `HINDSIGHT_API_LLM_PROVIDER` | `deepseek` | 抽取事实要用 LLM |
| `HINDSIGHT_API_LLM_MODEL` | `deepseek-chat` | |
| `HINDSIGHT_API_LLM_API_KEY` | `sk-...` | 来源 `D:\desk\ds-key.txt` 第二行；**不要提交进仓库** |
| `HF_ENDPOINT` | `https://hf-mirror.com` | **关键**：HuggingFace 原站在国内不通，不设这条启动会卡在下载模型上 |

## 四、启动 / 停止

```powershell
# 手动启动（日志追加到 server.log）
C:\Users\Sasaki ishiran\.hindsight\start-hindsight.cmd

# 健康检查
Invoke-RestMethod http://127.0.0.1:8888/health
# → {"status":"healthy","database":"connected",...}
```

**开机自启**：用户启动目录放了 `HindsightServer.vbs`（静默拉起 `start-hindsight.cmd`）
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\HindsightServer.vbs`
> `schtasks` 建计划任务被拒（Access denied），改用 Startup 目录，效果一样且不需要管理员。

## 五、插件配置（默认值正好对上，不用改）

```yaml
endpoint: http://localhost:8888
token: ''            # 本地无鉴权
bankId: hermes
defaultRecallLimit: 10
autoRemember: true
systemPromptSection: true
```

配置文件：`C:\Users\Sasaki ishiran\.dsh\profiles\desktop\package.json` 的 `dsh.profile.bundles` 里有 `dsh-hindsight`。

## 六、实测记录（2026-11-28）

```
写入   POST /v1/default/banks/hermes/memories  → items_count=1, output_tokens=123
召回   POST .../memories/recall                → 3 条（1 world fact + 2 observations）
中文   正常（事实与实体保持中文）
```

**一个反直觉点**：太"虚"的句子不产出事实。例如「用户偏好简短回复」这条第一次写入只回了 5 个 token、0 条事实；
换成带具体标识的内容（「UID 是 67606564 和 537809018，同一个人的两个号」）就正常抽出 2 条。
→ 写记忆时**给具体事实**，别写抽象评价。

## 七、踩过的坑

| 坑 | 现象 | 解法 |
| --- | --- | --- |
| HuggingFace 不通 | 启动日志反复 `WinError 10060 ... huggingface.co`，8088 端口一直不监听 | 设 `HF_ENDPOINT=https://hf-mirror.com` 后重启 |
| `schtasks /Create` 被拒 | `Access is denied` | 改用 Startup 目录放 vbs |
| 服务端启动要 1~2 分钟 | 首次要下两个模型 + 跑 alembic 迁移 | 用 `/health` 轮询，别当成挂了 |
| PowerShell 传中文 JSON 乱码 | 服务端收到 `?????`，422 `query must contain at least one word character` | 用 `[System.Text.Encoding]::UTF8.GetBytes($json)` 传 body |

## 八、ollama 为什么没用上

本机 `ollama` 已装但**一个模型都没有**，且显卡是集成 AMD（0.5 GB VRAM），本地模型只能跑 CPU。
Hindsight 的事实抽取要结构化 JSON，7B 以下会产脏数据、7B+ 在 CPU 上一条记忆要 30~60 秒。
所以走 DeepSeek API；ollama 留作以后完全离线时的备选。

| PowerShell 写的 .cmd 用了 LF | cmd 把 set/or 解析成"不是内部或外部命令" | **.cmd 必须 CRLF + ASCII**，用 "
" + ASCIIEncoding 写 |
| 启动脚本靠用户环境变量 | wscript/cmd 继承的是旧环境，读不到后设的变量 | 启动脚本里**自己 set** 全部变量，key 用 or /f "usebackq skip=1" 从 D:\desk\ds-key.txt 读 |
| 服务随终端退出 | 从 DSH 的 shell 里 Start-Process 起的服务，DSH 重启后被带走 | 用 Startup 目录的 vbs 拉起（wscript 派生的进程独立存活） |
