# RAG 실험 CLI 구현 가이드

## 현황

`D:\aim-ai-agent-my\langchain_\10-rag-evalution-script\` 에서 작업 중.

### ✅ 완성된 모듈들
- `rag_experiment/config.py` — YAML 로드, CLI 오버라이드, 검증
- `rag_experiment/corpus.py` — PDF 로드, 메타데이터 정규화, 청킹
- `rag_experiment/vectorstore.py` — Chroma 캐시 빌드/로드, 임베딩 클라이언트
- `rag_experiment/retrievers.py` — 4가지 검색 전략 팩토리 (similarity/mmr/bm25/hybrid)
- `rag_experiment/reranker.py` — LLM-as-reranker, `include_raw=True`로 토큰 비용 캡처
- `rag_experiment/metrics.py` — file_hit_at_k/page_hit_at_k/reciprocal_rank/evaluate_retriever
- `rag_experiment/cost.py` — 토큰→비용 환산
- `rag_experiment/report.py` — CSV 저장, 요약 테이블 출력
- `configs/default.yaml` — 기본 설정 (청크 매트릭스, 검색 전략, rerank 옵션)
- `app.py` — CLI argparse 엔트리포인트

### ⚠️ TODO: runner.py 구현

`rag_experiment/runner_skeleton.py` 에 뼈대가 있다. 이걸 바탕으로 `rag_experiment/runner.py` 를 완성하면 된다.

---

## runner.py 구현 요구사항

### 함수 1: `load_golden_set(golden_set_path: str) -> list[dict]`

**역할**: JSON 파일 로드

**구현**:
```python
# 1. Path(golden_set_path) 로 파일 존재 확인
# 2. json.load() 또는 Path.read_text() + json.loads()
# 3. logger.info(f"Loaded golden set: {len(cases)} cases")
# 4. 리스트 반환
```

**테스트**:
```python
cases = load_golden_set("../data/public/public_paragraph_golden_set.json")
assert len(cases) == 35
assert "target_file_name" in cases[0]
assert "target_page_no" in cases[0]
```

---

### 함수 2: `apply_sample_limit(cases: list[dict], limit: Optional[int], seed: int) -> list[dict]`

**역할**: 개발 중 질문 수를 줄이기 (비용 절감)

**구현**:
```python
# 1. limit이 None이거나 len(cases) 이상이면 전체 반환
# 2. random.Random(seed).shuffle(sampled_copy) 로 섞기
# 3. sliced = sampled[:limit]
# 4. logger.info(f"Sampled {limit} cases from {len(cases)}")
# 5. 반환
```

**중요**: 왜 shuffle인가?
- golden set이 파일별로 정렬되어 있을 수 있음
- 앞쪽 5개만 쓰면 1~2개 파일만 테스트될 위험
- shuffle 후 슬라이스하면 여러 파일에 걸친 대표 샘플 보장

**테스트**:
```python
cases = [{"id": i} for i in range(35)]
sampled = apply_sample_limit(cases, 5, seed=42)
assert len(sampled) == 5
assert set(s["id"] for s in sampled) != {0,1,2,3,4}  # 순서 섞임
```

---

### 함수 3: `plan_combinations(config) -> tuple[int, int]`

**역할**: dry-run에서 전체 조합 수와 예상 LLM 호출 수 계산

**반환**: `(total_combos, estimated_rerank_calls)`

**구현**:
```python
# total_combos = 
#   len(config.chunking.matrix) × 
#   len(config.retrieval.strategies) × 
#   len(config.rerank.enabled_options)
#
# estimated_rerank_calls =
#   (rerank=True인 조합만이므로 ×1) × 
#   len(golden_set) × 
#   config.retrieval.fetch_k

# 예: chunk_matrix=3, strategies=4, rerank_options=2, questions=35, fetch_k=5
#   total_combos = 3 × 4 × 2 = 24
#   estimated_rerank_calls = 3 × 4 × 1 × 35 × 5 = 2100
```

**테스트**:
```python
config = load_config("configs/default.yaml")
combos, rerank_calls = plan_combinations(config)
assert combos == 24  # 3 × 4 × 2
```

---

### 함수 4: `run_experiment(config, dry_run=False, skip_logging=False) -> dict`

**핵심**: 7단계 흐름을 순서대로 구현

#### **PHASE 1: Dry-run 체크**

```python
if dry_run:
    combos, rerank_calls = plan_combinations(config)
    logger.info(f"DRY-RUN: {combos} total combos, {rerank_calls} estimated rerank calls")
    # 예상 비용 계산 (rough):
    #   rough_cost = rerank_calls × avg_tokens_per_rerank × (pricing)
    logger.info(f"Estimated cost (rough): ${rough_cost:.4f}")
    return None
```

#### **PHASE 2: Golden set + 샘플링**

```python
golden_set = load_golden_set(config.paths.golden_set_path)
golden_set = apply_sample_limit(golden_set, config.evaluation.sample_limit, config.evaluation.sample_seed)
```

#### **PHASE 3: 클라이언트 생성 (1회만)**

```python
embeddings = build_embeddings_client(config.embedding.model_name, config.runtime)
llm = ChatGoogleGenerativeAI(model=config.generation.model_name, temperature=config.generation.temperature)
```

#### **PHASE 4: PDF 로딩 (1회만)**

```python
logger.info("Loading PDFs...")
pages_by_file = load_pages_by_file(config.paths.document_dir)
logger.info(f"Loaded {sum(len(p) for p in pages_by_file.values())} pages from {len(pages_by_file)} files")
```

#### **PHASE 5: 메인 스윕 루프 (3중 루프)**

```python
all_detail_rows = []
run_errors = []

for chunk_idx, chunk_config in enumerate(config.chunking.matrix):
    chunk_size = chunk_config["chunk_size"]
    chunk_overlap = chunk_config["chunk_overlap"]
    logger.info(f"[{chunk_idx+1}/{len(config.chunking.matrix)}] size={chunk_size}, overlap={chunk_overlap}")
    
    # 5a. 청킹
    chunks = split_into_chunks(pages_by_file, chunk_size, chunk_overlap)
    
    # 5b. 벡터스토어 (캐시)
    collection_name = collection_name_for(chunk_size, chunk_overlap)
    vectorstore = get_or_build_vectorstore(
        chunks,
        config.paths.persist_dir,
        collection_name,
        embeddings,
        force_rebuild=getattr(config, "force_rebuild", False)
    )
    
    # 5c. 검색 전략 루프
    for strategy_idx, strategy in enumerate(config.retrieval.strategies):
        logger.info(f"  [{strategy_idx+1}/{len(config.retrieval.strategies)}] {strategy}")
        
        # search_fn 생성
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
            }
        )
        
        # 5d. Rerank 옵션 루프
        for rerank_idx, enable_rerank in enumerate(config.rerank.enabled_options):
            rerank_label = "on" if enable_rerank else "off"
            logger.info(f"    [{rerank_idx+1}/{len(config.rerank.enabled_options)}] rerank={rerank_label}")
            
            # rerank_fn 생성
            rerank_fn = None
            if enable_rerank:
                rerank_fn_base = build_reranker(llm)
                # 람다로 감싸기: (question, docs) -> (reranked_docs, cost_record)
                rerank_fn = lambda q, docs: rerank_fn_base(q, docs, config.rerank.top_k)
            
            # 5e. 평가 실행
            try:
                eval_result = evaluate_retriever(
                    f"{strategy}_rerank={rerank_label}",
                    search_fn,
                    golden_set,
                    {"file": config.evaluation.k_values.file, "page": config.evaluation.k_values.page},
                    rerank_fn
                )
                
                # 결과에 메타데이터 추가
                for row in eval_result["rows"]:
                    row["chunk_size"] = chunk_size
                    row["chunk_overlap"] = chunk_overlap
                    row["strategy"] = strategy
                    row["rerank"] = enable_rerank
                    row["latency_ms"] = eval_result["latency_ms"]
                    
                    # 비용 계산 (조합당 누적 비용을 행 수로 나눔)
                    cost_usd = compute_cost_usd(
                        eval_result["cost_record"],
                        config.cost.pricing.input_usd_per_1k_tokens,
                        config.cost.pricing.output_usd_per_1k_tokens
                    )
                    if eval_result["rows"]:
                        row["cost_usd"] = cost_usd / len(eval_result["rows"])
                        row["total_tokens"] = eval_result["cost_record"].total_tokens // len(eval_result["rows"])
                
                all_detail_rows.extend(eval_result["rows"])
                
            except Exception as e:
                logger.error(f"Error: {e}")
                run_errors.append({
                    "chunk_size": chunk_size,
                    "chunk_overlap": chunk_overlap,
                    "strategy": strategy,
                    "rerank": enable_rerank,
                    "error": str(e)
                })
```

#### **PHASE 6: 결과 저장**

```python
result_dir = Path(config.paths.result_dir) / config.experiment.name
result_dir.mkdir(parents=True, exist_ok=True)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
detail_csv = result_dir / f"detail_{timestamp}.csv"
summary_csv = result_dir / f"summary_{timestamp}.csv"
config_used_path = result_dir / "config_used.yaml"
run_meta_path = result_dir / "run_meta.json"

# detail CSV
write_detail_csv(all_detail_rows, detail_csv)

# summary + table
summary = aggregate_by_combo(all_detail_rows)
write_summary_csv(summary, summary_csv)
print_summary_table(summary)

# config 저장
save_config_used(config_to_dict(config), config_used_path)

# 메타데이터
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

logger.info(f"Results saved to {result_dir}")
```

#### **PHASE 7: 반환**

```python
return {
    "detail_rows": all_detail_rows,
    "summary": summary,
    "run_meta": run_meta,
}
```

---

## 필요한 import들

```python
import json
import logging
import random
from pathlib import Path
from datetime import datetime
from typing import Optional

from rag_experiment.config import Config, config_to_dict
from rag_experiment.corpus import load_pages_by_file, split_into_chunks
from rag_experiment.vectorstore import (
    build_embeddings_client,
    collection_name_for,
    get_or_build_vectorstore
)
from rag_experiment.retrievers import get_search_fn
from rag_experiment.reranker import build_reranker
from rag_experiment.metrics import evaluate_retriever
from rag_experiment.cost import compute_cost_usd
from rag_experiment.report import (
    aggregate_by_combo,
    write_detail_csv,
    write_summary_csv,
    print_summary_table,
    save_config_used,
    save_run_metadata
)
from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)
```

---

## 테스트 단계

### 1단계: Dry-run 검증
```bash
cd D:\aim-ai-agent-my\langchain_\10-rag-evalution-script
python app.py --dry-run --sample-limit 3
```
**예상 출력**:
- DRY-RUN 모드 확인
- 조합 수 (24)
- 예상 rerank 호출 수
- 예상 비용

### 2단계: 최소 실행 (비용 <$0.01)
```bash
python app.py \
  --sample-limit 3 \
  --chunk-matrix "700:100" \
  --strategies similarity \
  --rerank off
```
**예상 결과**:
- `outputs/chunk-strategy-sweep/detail_*.csv` 생성
- `outputs/chunk-strategy-sweep/summary_*.csv` 생성
- 요약 테이블 출력

### 3단계: 점진적 확대
- `--strategies similarity,hybrid` (2개)
- `--rerank both` (2개 옵션)
- `--sample-limit 10` (10문항)

### 4단계: 전체 스윕
```bash
python app.py --sample-limit 35
# 약 3~5분 소요, 예상 비용 $0.20~0.50
```

---

## 디버깅 팁

- **로깅 레벨**: 각 단계마다 logger.info()로 진행률 표시
- **중간 실패**: run_errors에 기록하고 계속 진행
- **CSV 확인**: 생성된 CSV를 엑셀에서 열어서 데이터 형식 확인
- **성능**: latency_ms와 cost_usd가 제대로 채워졌는지 확인

---

## 주의사항

1. **config.force_rebuild** — app.py에서 --no-cache 플래그로 설정됨
2. **rerank_fn 람다** — 클로저 문제 주의 (변수 캡처)
3. **UTF-8 인코딩** — 한글 파일명 때문에 모든 파일 I/O에서 encoding="utf-8" 명시
4. **pandas CSV** — encoding="utf-8-sig" 사용 (Excel 호환)

---

## 완성 체크리스트

- [ ] runner.py 구현 완료
- [ ] --dry-run 테스트
- [ ] --sample-limit 3 최소 실행
- [ ] CSV/테이블 포맷 확인
- [ ] 점진적 스윕 확대
- [ ] 전체 35문항 스윕 실행
- [ ] 결과 테이블에서 page_hit@5 / mrr / latency_ms / cost_usd 비교 가능한지 확인
