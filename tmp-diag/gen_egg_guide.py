#!/usr/bin/env python3
"""生成品种静态资料 `src/data/eggGuide.json`（可复跑）。

数据源（三份）：
1. `D:\\download\\孵蛋攻略.xlsx`「按序号」表：档位 / 蛋组 / 性别比 / 大块头 / 满重 /
   小不点 / 满轻 / 区间数 / 孵蛋时间；
2. `tmp-diag/analysis.json`：DATA1 已落位的「名称 → gameId」映射（直接复用，不重做）；
3. `src/data/eggWeights.json`：只做交叉核对，同一物种数值不一致时**以攻略表为准**，
   差异写进 `tmp-diag/eggGuide-report.json`。

运行：
    python tmp-diag/gen_egg_guide.py

输出：
    src/data/eggGuide.json
    tmp-diag/eggGuide-report.json
    tmp-diag/eggGuide-report.txt
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = Path(r"D:\download\孵蛋攻略.xlsx")
ANALYSIS = ROOT / "tmp-diag" / "analysis.json"
WEIGHTS = ROOT / "src" / "data" / "eggWeights.json"
OUT = ROOT / "src" / "data" / "eggGuide.json"
REPORT_JSON = ROOT / "tmp-diag" / "eggGuide-report.json"
REPORT_TXT = ROOT / "tmp-diag" / "eggGuide-report.txt"

EXPECTED_HEADER = [
    "档位",
    "精灵编号",
    "蛋组",
    "精灵名称",
    "性格（集市&排行）",
    "三维（排行[主pvp]）",
    "性别比（♀：♂）",
    "大块头(≥)",
    "满重",
    "小不点(≤)",
    "满轻",
    "区间数",
    "孵蛋时间",
    "是否收集",
]


def is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def read_rows() -> list[dict]:
    workbook = openpyxl.load_workbook(XLSX, data_only=True)
    if "按序号" not in workbook.sheetnames:
        raise SystemExit(f"{XLSX} 缺少「按序号」工作表，实际：{workbook.sheetnames}")
    sheet = workbook["按序号"]
    rows = list(sheet.iter_rows(values_only=True))
    header = [str(cell) if cell is not None else "" for cell in rows[0]]
    if header != EXPECTED_HEADER:
        raise SystemExit(f"表头变了，先核对再生成：\n实际 {header}\n预期 {EXPECTED_HEADER}")

    analysis = json.loads(ANALYSIS.read_text(encoding="utf-8"))
    mapped = analysis["sheets"]["按序号"]
    data = rows[1:]
    if len(data) != len(mapped):
        raise SystemExit(f"攻略表 {len(data)} 行，analysis.json {len(mapped)} 行，行数对不上")

    result = []
    for index, (row, item) in enumerate(zip(data, mapped), start=2):
        if row[1] != item.get("dexRaw") or row[3] != item.get("name"):
            raise SystemExit(
                f"第 {index} 行与 analysis.json 错位："
                f"{row[1]}/{row[3]} vs {item.get('dexRaw')}/{item.get('name')}"
            )
        result.append(
            {
                "row": index,
                "tier": row[0],
                "dex": row[1],
                "eggGroups": row[2],
                "name": row[3],
                "genderRatio": row[6],
                "big": row[7],
                "max": row[8],
                "small": row[9],
                "min": row[10],
                "ranges": row[11],
                "hatchHours": row[12],
                "gameId": item.get("gameId"),
                "analysisConfidence": item.get("confidence"),
                "analysisMatchMethod": item.get("matchMethod"),
                "analysisReason": item.get("matchReason"),
            }
        )
    return result


def normalize_name(name: str) -> str:
    """只抹平排版差异（空格 / 全半角括号 / 冒号），不做别名猜测。"""
    return (
        name.replace(" ", "")
        .replace("（", "(")
        .replace("）", ")")
        .replace("：", ":")
    )


def cross_check(rows: list[dict]) -> dict:
    weights = json.loads(WEIGHTS.read_text(encoding="utf-8"))
    by_name = {normalize_name(key): (key, value) for key, value in weights.items()}
    checked, only_in_guide, diffs = 0, [], []
    fields = ("big", "max", "small", "min")
    for row in rows:
        if row["gameId"] is None:
            continue
        # 与 src/domain/eggWeight.ts 一致：按 "_" 截掉形态后缀后查表
        key = row["name"].split("_")[0]
        hit = by_name.get(normalize_name(key)) or by_name.get(normalize_name(row["name"]))
        if not hit:
            only_in_guide.append(row["name"])
            continue
        checked += 1
        weight_key, weight = hit
        changed = {}
        for field in fields:
            guide_value = row[field]
            weight_value = weight.get(field)
            if is_number(guide_value) and is_number(weight_value) and abs(float(guide_value) - float(weight_value)) > 1e-9:
                changed[field] = {"guide": guide_value, "eggWeights": weight_value}
        if changed:
            diffs.append(
                {
                    "name": row["name"],
                    "gameId": row["gameId"],
                    "eggWeightsKey": weight_key,
                    "fields": changed,
                }
            )

    report = {
        "checked": checked,
        "onlyInGuide": len(only_in_guide),
        "diffRows": len(diffs),
        "policy": "同一物种数值不一致时以攻略表（xlsx）为准",
        "diffs": diffs,
        "onlyInGuideNames": only_in_guide,
    }
    return report


def main() -> None:
    rows = read_rows()

    guide: dict[str, dict] = {}
    unmapped = []
    for row in rows:
        game_id = row["gameId"]
        if game_id is None:
            unmapped.append(
                {
                    "row": row["row"],
                    "dex": row["dex"],
                    "name": row["name"],
                    "reason": row["analysisReason"],
                }
            )
            continue

        missing = [
            field
            for field in ("tier", "eggGroups", "genderRatio", "big", "max", "small", "min", "ranges", "hatchHours")
            if row[field] is None
        ]
        if missing:
            raise SystemExit(f"{row['name']}（gameId {game_id}）缺字段：{missing}")

        numbers = {field: row[field] for field in ("big", "max", "small", "min", "ranges", "hatchHours")}
        bad = [field for field, value in numbers.items() if not is_number(value)]
        if bad:
            raise SystemExit(f"{row['name']}（gameId {game_id}）字段不是数字：{bad}")
        if not row["eggGroups"].strip() or not row["genderRatio"].strip():
            raise SystemExit(f"{row['name']}（gameId {game_id}）蛋组 / 性别比为空")
        if not (float(row["min"]) <= float(row["small"]) <= float(row["big"]) <= float(row["max"])):
            raise SystemExit(f"{row['name']}（gameId {game_id}）区间关系不成立：{numbers}")

        key = str(int(game_id))
        if key in guide:
            raise SystemExit(f"gameId 重复：{key}（{row['name']} / {guide[key]}）")
        guide[key] = {
            "tier": int(row["tier"]),
            "eggGroups": [part.strip() for part in row["eggGroups"].split("/") if part.strip()],
            "genderRatio": row["genderRatio"].strip(),
            "big": row["big"],
            "max": row["max"],
            "small": row["small"],
            "min": row["min"],
            "ranges": int(row["ranges"]),
            "hatchHours": row["hatchHours"],
        }

    ordered = {key: guide[key] for key in sorted(guide, key=int)}
    OUT.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    weights_report = cross_check(rows)
    report = {
        "generatedFrom": {
            "xlsx": str(XLSX),
            "nameToGameId": "tmp-diag/analysis.json（复用 DATA1 结果）",
            "weights": "src/data/eggWeights.json（仅交叉核对）",
        },
        "coverage": {
            "guideRows": len(rows),
            "mapped": len(ordered),
            "unmapped": len(unmapped),
            "unmappedRows": unmapped,
        },
        "weightsCrossCheck": weights_report,
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        f"攻略表行数：{len(rows)}；落位 gameId：{len(ordered)}；未落位：{len(unmapped)}",
        *[f"  未落位：第 {item['row']} 行 {item['name']}（{item['reason']}）" for item in unmapped],
        "",
        f"与 eggWeights 交叉核对：命中 {weights_report['checked']} 条；仅在攻略表 {weights_report['onlyInGuide']} 条；数值差异 {weights_report['diffRows']} 条",
        "规则：同一物种不一致时以攻略表为准",
        *[
            "  差异：" + item["name"] + f"（gameId {item['gameId']}，eggWeights key={item['eggWeightsKey']}）"
            + "；".join(
                f"{field} 攻略={value['guide']} / eggWeights={value['eggWeights']}"
                for field, value in item["fields"].items()
            )
            for item in weights_report["diffs"]
        ],
    ]
    REPORT_TXT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(ordered)} entries")
    print(f"wrote {REPORT_JSON.relative_to(ROOT)} / {REPORT_TXT.relative_to(ROOT)}")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
