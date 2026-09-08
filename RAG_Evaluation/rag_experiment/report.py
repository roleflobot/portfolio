import json
import logging
from pathlib import Path
from collections import defaultdict
import pandas as pd
import yaml

logger = logging.getLogger(__name__)


def aggregate_by_combo(detail_rows: list[dict]) -> dict:
    """
    detail_rows를 (chunk_size, chunk_overlap, strategy, rerank) 조합별로 집계.
    Returns: {combo_key: {file_hit_1, page_hit_1/3/5, mrr, latency_ms, cost_usd, count}}
    """
    combos = defaultdict(list)

    for row in detail_rows:
        key = (
            row["chunk_size"],
            row["chunk_overlap"],
            row["strategy"],
            row["rerank"],
        )
        combos[key].append(row)

    summary = {}
    for combo_key, rows in combos.items():
        chunk_size, chunk_overlap, strategy, rerank = combo_key

        summary[combo_key] = {
            "chunk_size": chunk_size,
            "chunk_overlap": chunk_overlap,
            "strategy": strategy,
            "rerank": rerank,
            "count": len(rows),
            "file_hit@1": sum(r.get("file_hit@1", 0) for r in rows) / len(rows) if rows else 0.0,
            "page_hit@1": sum(r.get("page_hit@1", 0) for r in rows) / len(rows) if rows else 0.0,
            "page_hit@3": sum(r.get("page_hit@3", 0) for r in rows) / len(rows) if rows else 0.0,
            "page_hit@5": sum(r.get("page_hit@5", 0) for r in rows) / len(rows) if rows else 0.0,
            "mrr": sum(r.get("mrr", 0.0) for r in rows) / len(rows) if rows else 0.0,
            "latency_ms": sum(r.get("latency_ms", 0.0) for r in rows) / len(rows) if rows else 0.0,
            "cost_usd": sum(r.get("cost_usd", 0.0) for r in rows),
            "total_tokens": sum(r.get("total_tokens", 0) for r in rows),
        }

    return summary


def write_detail_csv(rows: list[dict], output_path: Path):
    """상세 결과를 CSV로 저장 (question 단위)"""
    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    logger.info(f"Written detail CSV: {output_path}")


def write_summary_csv(summary: dict, output_path: Path):
    """조합별 요약을 CSV로 저장"""
    rows = [v for v in summary.values()]
    # 정렬: page_hit@5 내림차순 → mrr 내림차순 → latency_ms 오름차순
    rows.sort(
        key=lambda x: (-x["page_hit@5"], -x["mrr"], x["latency_ms"])
    )
    df = pd.DataFrame(rows)
    cols = [
        "chunk_size", "chunk_overlap", "strategy", "rerank", "count",
        "file_hit@1", "page_hit@1", "page_hit@3", "page_hit@5",
        "mrr", "latency_ms", "cost_usd", "total_tokens",
    ]
    df = df[[c for c in cols if c in df.columns]]
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    logger.info(f"Written summary CSV: {output_path}")


def print_summary_table(summary: dict):
    """요약을 표 형태로 출력"""
    rows = [v for v in summary.values()]
    rows.sort(key=lambda x: (-x["page_hit@5"], -x["mrr"], x["latency_ms"]))

    headers = [
        "chunk_size", "chunk_overlap", "strategy", "rerank", "count",
        "file_hit@1", "page_hit@1", "page_hit@3", "page_hit@5", "mrr",
        "latency_ms", "cost_usd",
    ]

    # 헤더 출력
    print("\n" + " | ".join(f"{h:>12}" for h in headers))
    print("-" * (13 * len(headers)))

    # 데이터 행 출력
    for row in rows:
        values = [
            str(row["chunk_size"]),
            str(row["chunk_overlap"]),
            row["strategy"],
            str(row["rerank"]),
            str(row["count"]),
            f"{row['file_hit@1']:.3f}",
            f"{row['page_hit@1']:.3f}",
            f"{row['page_hit@3']:.3f}",
            f"{row['page_hit@5']:.3f}",
            f"{row['mrr']:.3f}",
            f"{row['latency_ms']:.1f}",
            f"{row['cost_usd']:.4f}",
        ]
        print(" | ".join(f"{v:>12}" for v in values))


def save_config_used(config_dict: dict, output_path: Path):
    """사용된 config를 YAML로 저장 (재현용)"""
    with open(output_path, "w", encoding="utf-8") as f:
        yaml.dump(config_dict, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    logger.info(f"Written config used: {output_path}")


def save_run_metadata(
    run_meta: dict,
    output_path: Path,
):
    """실행 메타데이터를 JSON으로 저장"""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(run_meta, f, ensure_ascii=False, indent=2)
    logger.info(f"Written run metadata: {output_path}")
