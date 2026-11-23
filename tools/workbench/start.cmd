@echo off
chcp 65001 >nul
rem 从仓库根启动：工作台按「当前目录」读 docs/任务看板.md，必须在仓库根跑
cd /d "%~dp0..\.."
node tools/workbench/server.mjs
pause
