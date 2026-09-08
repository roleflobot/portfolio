import time
import logging
import json
from typing import Callable, Optional
from langchain_core.documents import Document
from rag_experiment.cost import CostRecord

logger = logging.getLogger(__name__)


def file_hit_at_k(docs: list[Document], case: dict, k: int) -> int:
    """target_file_name이 상위 k개 중에 있으면 1, 없으면 0"""
    ranked = [doc.metadata.get("source", "") for doc in docs[:k]]
    return int(case["target_file_name"] in ranked)


def page_hit_at_k(docs: list[Document], case: dict, k: int) -> int:
    """target_file_name과 target_page_no가 모두 일치하는 문서가 상위 k개 중에 있으면 1, 없으면 0"""
    for doc in docs[:k]:
        if (doc.metadata.get("source") == case["target_file_name"] and
            doc.metadata.get("page_no") == case["target_page_no"]):
            return 1
    return 0


def reciprocal_rank(docs: list[Document], case: dict) -> float:
    """파일+페이지가 모두 일치하는 첫 번째 문서의 rank의 역수 (1-indexed), 없으면 0.0"""
    for rank, doc in enumerate(docs, start=1):
        if (doc.metadata.get("source") == case["target_file_name"] and
            doc.metadata.get("page_no") == case["target_page_no"]):
            return 1.0 / rank
    return 0.0


def evaluate_retriever(
    name: str,
    search_fn: Callable[[str], list[Document]],
    cases: list[dict],
    k_values: dict,
    rerank_fn: Optional[Callable] = None,
) -> dict:
    """
    각 케이스마다 검색을 실행하고 지표를 계산.
    rerank_fn이 있으면 재정렬 후 토큰 비용을 누적.
    Returns: {name, rows: [...], latency_ms, cost_record}
    """
    rows = []
    cost_record = CostRecord()
    started = time.perf_counter()

    file_k_values = k_values.get("file", [1])
    page_k_values = k_values.get("page", [1, 3, 5])

    for case_idx, case in enumerate(cases):
        question = case["question"]

        # 검색 실행
        docs = search_fn(question)

        # rerank 적용
        if rerank_fn is not None:
            if docs:
                docs, rerank_cost = rerank_fn(question, docs)
                cost_record += rerank_cost
            # else: 빈 결과면 rerank 스킵

        # 지표 계산
        row = {
            "case_id": case.get("id", case_idx),
            "question": question,
            "target_file_name": case["target_file_name"],
            "target_page_no": case["target_page_no"],
        }

        # file_hit@k
        for k in file_k_values:
            row[f"file_hit@{k}"] = file_hit_at_k(docs, case, k)

        # page_hit@k
        for k in page_k_values:
            row[f"page_hit@{k}"] = page_hit_at_k(docs, case, k)

        # reciprocal_rank (page-level)
        row["mrr"] = reciprocal_rank(docs, case)

        # retrieved: rank/source/page_no 리스트 (실패 분석용)
        row["retrieved"] = json.dumps([
            {
                "rank": i + 1,
                "source": doc.metadata.get("source", ""),
                "page_no": doc.metadata.get("page_no", 0),
            }
            for i, doc in enumerate(docs)
        ])

        rows.append(row)

        if (case_idx + 1) % 10 == 0:
            logger.info(f"  {name}: {case_idx + 1}/{len(cases)} completed")

    elapsed_ms = (time.perf_counter() - started) * 1000
    latency_ms = elapsed_ms / len(cases) if cases else 0.0

    return {
        "name": name,
        "rows": rows,
        "latency_ms": latency_ms,
        "cost_record": cost_record,
    }
