"""
runner.py 뼈대 (skeleton)

학습용: 이 파일은 runner.py의 구조만 보여주고, 각 함수의 세부 구현은 빠져있다.
너가 TODO 부분을 채우면서 다음을 생각해보자:

1. 각 단계에서 어떤 정보가 필요한가?
2. 이전 단계의 결과를 다음 단계에 어떻게 전달할까?
3. 에러가 나면 어떻게 처리할까?
"""

import logging
from pathlib import Path
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


def load_golden_set(golden_set_path: str) -> list[dict]:
    """
    TODO: golden set JSON 파일을 로드하고 리스트로 반환

    고려사항:
    - 파일이 없으면? (예외 처리)
    - 파일은 UTF-8 인코딩
    - 로깅: "Loaded golden set: {n} cases" 형식으로
    """
    pass


def apply_sample_limit(cases: list[dict], limit: Optional[int], seed: int) -> list[dict]:
    """
    TODO: sample_limit이 있으면 seeded shuffle 후 슬라이스

    고려사항:
    - limit이 None이면? (전체 반환)
    - limit이 전체 개수보다 크면? (전체 반환)
    - 왜 shuffle이 필요할까? (앞쪽 N개만 쓰면 한두 파일만 테스트될 수 있음)
    - random.Random(seed).shuffle() 사용
    """
    pass


def plan_combinations(config) -> tuple[int, int]:
    """
    TODO: dry-run에서 출력할 조합 수 계산

    반환: (total_combos, estimated_rerank_calls)

    고려사항:
    - total_combos = chunk_matrix 개수 × strategy 개수 × rerank_options 개수
    - estimated_rerank_calls = rerank=True인 조합만 × questions × fetch_k
    """
    pass


def run_experiment(config, dry_run: bool = False, skip_logging: bool = False) -> dict:
    """
    TODO: 전체 실험 스윕 실행

    반환: {detail_rows, summary, run_meta} 또는 None (dry_run일 때)

    다음 7단계를 순서대로 수행:

    === PHASE 1: 초기 설정 ===
    1. Dry-run 모드 체크
       - plan_combinations() 호출해서 조합 수 + 예상 rerank 호출 수 계산
       - dry_run이면 이 정보 출력 후 return None

    2. Golden set 로드 및 샘플링
       - load_golden_set(config.paths.golden_set_path)
       - apply_sample_limit(...) 적용

    3. LLM/임베딩 클라이언트 생성 (전체 실행에서 1회만)
       - build_embeddings_client()
       - ChatGoogleGenerativeAI(model=..., temperature=0.0)

    4. PDF 로딩 (1회만)
       - load_pages_by_file(config.paths.document_dir)

    === PHASE 2: 메인 스윕 루프 ===
    5. 바깥 루프: chunk_config 순회
       - 바깥 루프 인덱스를 추적해서 진행률 표시

       5a. 청크 분할
           - split_into_chunks(pages_by_file, chunk_size, chunk_overlap)

       5b. 벡터스토어 get-or-build
           - collection_name 결정
           - get_or_build_vectorstore(chunks, persist_dir, collection_name, ...)

       5c. 중간 루프: strategy 순회
           - get_search_fn(strategy, vectorstore, chunks, ...) 호출

           5d. 안쪽 루프: rerank_option 순회
               - enable_rerank = True/False
               - rerank_fn 생성 (enable_rerank에 따라)

               5e. 평가 실행
                   - evaluate_retriever() 호출
                   - 결과에 chunk_size/chunk_overlap/strategy/rerank 태깅
                   - cost_usd 계산 후 행에 추가
                   - all_detail_rows에 extend

    === PHASE 3: 결과 저장 ===
    6. 결과 디렉토리 생성 및 파일 저장
       - result_dir = Path(config.paths.result_dir) / config.experiment.name
       - mkdir(parents=True, exist_ok=True)

       6a. detail CSV 저장
           - write_detail_csv(all_detail_rows, detail_csv_path)

       6b. 요약 CSV 저장
           - aggregate_by_combo(all_detail_rows)
           - write_summary_csv(summary, summary_csv_path)
           - print_summary_table(summary)

       6c. Config와 메타데이터 저장
           - config_to_dict() → save_config_used()
           - run_meta dict 구성 → save_run_metadata()

    7. 로깅 및 반환
       - 로그: "Experiment completed in X.X seconds"
       - return {"detail_rows": ..., "summary": ..., "run_meta": ...}

    ===== 예외 처리 =====
    각 단계에서 에러 발생 시:
    - 로깅 (logger.error(...))
    - run_errors에 기록하고 계속 진행 (다른 조합은 처리)
    """
    pass
