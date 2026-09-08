import json
import logging
import random
from pathlib import Path
from datetime import datetime
from typing import Optional
from rag_experiment.config import Config
from rag_experiment.corpus import load_pages_by_file, split_into_chunks
from rag_experiment.vectorstore import build_embeddings_client, collection_name_for, get_or_build_vectorstore
from rag_experiment.retrievers import get_search_fn
from rag_experiment.reranker import build_reranker
from rag_experiment.metrics import evaluate_retriever
from rag_experiment.cost import compute_cost_usd
from rag_experiment.report import (
    aggregate_by_combo, write_detail_csv, write_summary_csv,
    print_summary_table, save_config_used, save_run_metadata
)
from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)


def load_golden_set(golden_set_path: str) -> list[dict]:
    """golden set JSON 로드"""
    with open(golden_set_path, "r", encoding="utf-8") as f:
        cases = json.load(f)
    logger.info(f"Loaded golden set: {len(cases)} cases")
    return cases


def apply_sample_limit(cases: list[dict], limit: Optional[int], seed: int) -> list[dict]:
    """
    sample_limit 적용: seeded shuffle 후 슬라이스.
    여러 파일에 걸친 대표 샘플을 보장.
    """
    if limit is None or limit >= len(cases):
        return cases
    rng = random.Random(seed)
    sampled = cases.copy()
    rng.shuffle(sampled)
    sampled = sampled[:limit]
    logger.info(f"Sampled {limit} cases from {len(cases)}")
    return sampled


def plan_combinations(config: Config) -> tuple[int, int]:
    """
    전체 조합 수 계산 (dry-run 출력용).
    Returns: (total_combos, estimated_rerank_calls)
    """
    num_chunk_configs = len(config.chunking.matrix)
    num_strategies = len(config.retrieval.strategies)
    num_rerank_options = len(config.rerank.enabled_options)
    num_questions = config.evaluation.sample_limit or 35  # 임시로 35로 추정

    total_combos = num_chunk_configs * num_strategies * num_rerank_options
    # rerank_on인 경우만 LLM 호출 (fetch_k * questions)
    rerank_on_combos = num_chunk_configs * num_strategies * 1  # rerank=True인 것만
    estimated_rerank_calls = rerank_on_combos * num_questions * config.retrieval.fetch_k

    return total_combos, estimated_rerank_calls


def run_experiment(
    config: Config,
    dry_run: bool = False,
    skip_logging: bool = False,
) -> dict:
    """
    전체 실험 스윕 실행.
    Returns: {detail_rows, summary, run_meta}
    """
    if not skip_logging:
        logger.info("=" * 80)
        logger.info(f"RAG Experiment Runner")
        logger.info(f"Experiment: {config.experiment.name}")
        logger.info(f"Paths:")
        logger.info(f"  Document dir: {config.paths.document_dir}")
        logger.info(f"  Golden set: {config.paths.golden_set_path}")
        logger.info(f"  Persist dir: {config.paths.persist_dir}")
        logger.info(f"  Result dir: {config.paths.result_dir}")

    run_start_time = datetime.now()

    # 1. Dry-run 모드
    if dry_run:
        total_combos, estimated_rerank_calls = plan_combinations(config)
        logger.info(f"\nDRY-RUN MODE:")
        logger.info(f"  Total combinations: {total_combos}")
        logger.info(f"  Chunking configs: {len(config.chunking.matrix)}")
        logger.info(f"  Strategies: {len(config.retrieval.strategies)}")
        logger.info(f"  Rerank options: {len(config.rerank.enabled_options)}")
        logger.info(f"  Estimated rerank LLM calls: {estimated_rerank_calls}")

        estimated_cost = estimated_rerank_calls * (
            (config.retrieval.fetch_k * 500 / 1000) * config.cost.pricing.input_usd_per_1k_tokens +
            (100 / 1000) * config.cost.pricing.output_usd_per_1k_tokens
        )
        logger.info(f"  Estimated cost (rough): ${estimated_cost:.4f}")
        logger.info("DRY-RUN: No actual execution. Exiting.")
        return None

    # 2. Golden set 로드 및 샘플링
    golden_set = load_golden_set(config.paths.golden_set_path)
    golden_set = apply_sample_limit(
        golden_set,
        config.evaluation.sample_limit,
        config.evaluation.sample_seed
    )

    # 3. 클라이언트 생성 (전체 실행에서 1회만)
    embeddings = build_embeddings_client(
        config.embedding.model_name,
        config.runtime,
    )
    llm = ChatGoogleGenerativeAI(
        model=config.generation.model_name,
        temperature=config.generation.temperature,
    )

    # 4. PDF 로딩 (1회만)
    logger.info("Loading PDFs...")
    pages_by_file = load_pages_by_file(config.paths.document_dir)
    logger.info(f"Loaded {sum(len(p) for p in pages_by_file.values())} pages from {len(pages_by_file)} files")

    # 5. 결과 저장용 컨테이너
    all_detail_rows = []
    run_errors = []

    # 6. 메인 스윕 루프
    total_chunk_configs = len(config.chunking.matrix)
    for chunk_config_idx, chunk_config in enumerate(config.chunking.matrix):
        chunk_size = chunk_config["chunk_size"]
        chunk_overlap = chunk_config["chunk_overlap"]

        logger.info(f"\n[{chunk_config_idx + 1}/{total_chunk_configs}] "
                   f"Chunking: size={chunk_size}, overlap={chunk_overlap}")

        # 6a. 청크 분할
        chunks = split_into_chunks(pages_by_file, chunk_size, chunk_overlap)

        # 6b. 벡터스토어 get-or-build (캐시 활용)
        collection_name = collection_name_for(chunk_size, chunk_overlap)
        vectorstore = get_or_build_vectorstore(
            chunks,
            config.paths.persist_dir,
            collection_name,
            embeddings,
            force_rebuild=getattr(config, "force_rebuild", False),  # CLI --no-cache로 설정됨
        )

        # 6c. 검색 전략 구성
        total_strategies = len(config.retrieval.strategies)
        for strategy_idx, strategy in enumerate(config.retrieval.strategies):
            logger.info(f"  [{strategy_idx + 1}/{total_strategies}] Strategy: {strategy}")

            search_fn = get_search_fn(
                strategy,
                vectorstore,
                chunks,
                config.retrieval.fetch_k,
                {
                    "fetch_k_candidates": config.retrieval.mmr.fetch_k_candidates,
                    "lambda_mult": config.retrieval.mmr.lambda_mult,
                },
                {
                    "weight_similarity": config.retrieval.hybrid.weight_similarity,
                    "weight_bm25": config.retrieval.hybrid.weight_bm25,
                },
            )

            # 6d. Rerank 옵션
            total_rerank_options = len(config.rerank.enabled_options)
            for rerank_idx, enable_rerank in enumerate(config.rerank.enabled_options):
                rerank_label = "on" if enable_rerank else "off"
                logger.info(f"    [{rerank_idx + 1}/{total_rerank_options}] Rerank: {rerank_label}")

                rerank_fn = None
                if enable_rerank:
                    rerank_fn_raw = build_reranker(llm)
                    rerank_fn = lambda q, docs: rerank_fn_raw(q, docs, config.rerank.top_k)

                # 6e. 평가 실행
                try:
                    eval_result = evaluate_retriever(
                        f"{strategy}_rerank={rerank_label}",
                        search_fn,
                        golden_set,
                        config.evaluation.k_values.__dict__,
                        rerank_fn,
                    )

                    # 행에 설정 정보 추가
                    for row in eval_result["rows"]:
                        row["chunk_size"] = chunk_size
                        row["chunk_overlap"] = chunk_overlap
                        row["strategy"] = strategy
                        row["rerank"] = enable_rerank
                        row["latency_ms"] = eval_result["latency_ms"]

                        # 비용 계산
                        cost_usd = compute_cost_usd(
                            eval_result["cost_record"],
                            config.cost.pricing.input_usd_per_1k_tokens,
                            config.cost.pricing.output_usd_per_1k_tokens,
                        )
                        row["cost_usd"] = cost_usd / len(eval_result["rows"]) if eval_result["rows"] else 0.0
                        row["total_tokens"] = eval_result["cost_record"].total_tokens // len(eval_result["rows"]) if eval_result["rows"] else 0

                    all_detail_rows.extend(eval_result["rows"])

                except Exception as e:
                    logger.error(f"Error in evaluation: {e}")
                    run_errors.append({
                        "chunk_size": chunk_size,
                        "chunk_overlap": chunk_overlap,
                        "strategy": strategy,
                        "rerank": enable_rerank,
                        "error": str(e),
                    })

    # 7. 결과 저장
    result_dir = Path(config.paths.result_dir) / config.experiment.name
    result_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    detail_csv_path = result_dir / f"detail_{timestamp}.csv"
    summary_csv_path = result_dir / f"summary_{timestamp}.csv"
    # detail/summary와 짝이 맞도록 타임스탬프를 붙인다.
    # 타임스탬프가 없으면 다음 실행이 덮어써서, 어떤 설정으로 나온 결과인지 알 수 없게 된다.
    config_used_path = result_dir / f"config_used_{timestamp}.yaml"
    run_meta_path = result_dir / f"run_meta_{timestamp}.json"

    write_detail_csv(all_detail_rows, detail_csv_path)

    summary = aggregate_by_combo(all_detail_rows)
    write_summary_csv(summary, summary_csv_path)
    print_summary_table(summary)

    from rag_experiment.config import config_to_dict
    save_config_used(config_to_dict(config), config_used_path)

    run_duration = (datetime.now() - run_start_time).total_seconds()
    run_meta = {
        "experiment_name": config.experiment.name,
        "timestamp": timestamp,
        "duration_seconds": run_duration,
        "total_questions": len(golden_set),
        "total_detail_rows": len(all_detail_rows),
        "total_combos_completed": len(summary),
        "errors": run_errors,
    }
    save_run_metadata(run_meta, run_meta_path)

    logger.info(f"\n" + "=" * 80)
    logger.info(f"Experiment completed in {run_duration:.1f} seconds")
    logger.info(f"Results saved to: {result_dir}")

    return {
        "detail_rows": all_detail_rows,
        "summary": summary,
        "run_meta": run_meta,
    }
