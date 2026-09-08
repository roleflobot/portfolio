#!/usr/bin/env python3
import sys
import logging
import argparse
from pathlib import Path
from dotenv import load_dotenv
from rag_experiment.config import load_config, merge_overrides, Config
from rag_experiment.runner import run_experiment

# 기본 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def parse_chunk_matrix(chunk_matrix_str: str) -> list[dict]:
    """CLI에서 --chunk-matrix "500:50,700:100" 형식의 입력을 파싱"""
    if not chunk_matrix_str:
        return None
    try:
        matrix = []
        for pair in chunk_matrix_str.split(","):
            size, overlap = pair.strip().split(":")
            matrix.append({"chunk_size": int(size), "chunk_overlap": int(overlap)})
        return matrix
    except Exception as e:
        logger.error(f"Failed to parse chunk_matrix: {e}")
        sys.exit(1)


def parse_strategies(strategies_str: str) -> list[str]:
    """CLI에서 --strategies "similarity,hybrid" 형식의 입력을 파싱"""
    if not strategies_str:
        return None
    return [s.strip() for s in strategies_str.split(",")]


def parse_rerank(rerank_str: str) -> list[bool]:
    """CLI에서 --rerank {on,off,both} 형식의 입력을 파싱"""
    if not rerank_str:
        return None
    if rerank_str.lower() == "both":
        return [False, True]
    elif rerank_str.lower() == "on":
        return [True]
    elif rerank_str.lower() == "off":
        return [False]
    else:
        logger.error(f"Invalid rerank option: {rerank_str}. Use 'on', 'off', or 'both'.")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="RAG 실험 자동화: 청크 사이즈, 검색 전략, rerank 조합 비교"
    )

    # 기본 설정 경로
    parser.add_argument(
        "--config",
        default="configs/default.yaml",
        help="Config YAML 파일 경로 (기본: configs/default.yaml)",
    )

    # 가이드에서 지정한 필수 플래그
    parser.add_argument(
        "--document-path",
        help="문서 디렉토리 경로 (config에서 document_dir 덮어씀)",
    )
    parser.add_argument(
        "--result-dir",
        help="결과 저장 디렉토리 (config에서 result_dir 덮어씀)",
    )
    parser.add_argument(
        "--experiment-name",
        help="실험 이름 (config에서 experiment.name 덮어씀)",
    )

    # 추가 오버라이드 플래그
    parser.add_argument(
        "--eval-data-path",
        help="Golden set JSON 경로",
    )
    parser.add_argument(
        "--persist-dir",
        help="Chroma 벡터스토어 경로",
    )
    parser.add_argument(
        "--sample-limit",
        type=int,
        help="개발 중 질문 수 제한 (e.g., 5; null=35전체)",
    )

    # 매트릭스 축소 플래그
    parser.add_argument(
        "--strategies",
        help="사용할 검색 전략 (쉼표 구분, e.g., 'similarity,hybrid')",
    )
    parser.add_argument(
        "--rerank",
        choices=["on", "off", "both"],
        help="Rerank 옵션 (on=True만, off=False만, both=둘다)",
    )
    parser.add_argument(
        "--chunk-matrix",
        help="청크 설정 (쉼표 구분, e.g., '500:50,700:100')",
    )

    # 비용 통제 플래그
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Chroma 컬렉션 강제 재생성 (캐시 무시)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="조합 수와 예상 비용만 출력, 실제 실행하지 않음",
    )

    args = parser.parse_args()

    # .env 로드
    load_dotenv()

    # Config 로드
    config_path = Path(args.config)
    if not config_path.exists():
        logger.error(f"Config file not found: {args.config}")
        sys.exit(1)

    config = load_config(config_path)

    # CLI 오버라이드 준비
    overrides = {}
    if args.document_path:
        overrides["document_path"] = args.document_path
    if args.result_dir:
        overrides["result_dir"] = args.result_dir
    if args.experiment_name:
        overrides["experiment_name"] = args.experiment_name
    if args.eval_data_path:
        overrides["eval_data_path"] = args.eval_data_path
    if args.persist_dir:
        overrides["persist_dir"] = args.persist_dir
    if args.sample_limit is not None:
        overrides["sample_limit"] = args.sample_limit
    if args.strategies:
        overrides["strategies"] = parse_strategies(args.strategies)
    if args.rerank:
        overrides["rerank_options"] = parse_rerank(args.rerank)
    if args.chunk_matrix:
        overrides["chunk_matrix"] = parse_chunk_matrix(args.chunk_matrix)

    # 오버라이드 병합
    if overrides:
        config = merge_overrides(config, **overrides)

    # --no-cache 플래그 전달 (force_rebuild)
    if args.no_cache:
        config.force_rebuild = True
    else:
        config.force_rebuild = False

    # 실험 실행
    try:
        result = run_experiment(config, dry_run=args.dry_run)
        if result is None and args.dry_run:
            logger.info("Dry-run completed successfully")
            sys.exit(0)
        elif result:
            logger.info("Experiment completed successfully")
            sys.exit(0)
    except Exception as e:
        logger.error(f"Experiment failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
