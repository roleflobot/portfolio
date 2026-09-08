# RAG 검색 평가 실험 자동화

공공문서 RAG 파이프라인을 여러 조건에서 실행하고 검색 품질을 비교하는 CLI 프로그램이다.
실습 노트북(`10-rag-evaluation-practice-with-preprocessing.ipynb`)에서 한 번만 수행한 평가를,
조건을 바꿔 반복 실행할 수 있도록 옮긴 것이다.

실험 결과 해석과 결론은 두 곳에 있다.

- **결론·분석**: 실습 노트북 `10-rag-evaluation-practice-with-preprocessing.ipynb` 의 "결과 분석" 셀
- **실행별 유효성**: [`configs/outputs/chunk-strategy-sweep/RESULTS.md`](configs/outputs/chunk-strategy-sweep/RESULTS.md)

## 무엇을 비교하는가

golden set 35문항에 대해 검색을 실행하고, 정답 페이지가 상위 몇 번째에 등장하는지 측정한다.

| 축 | 값 |
|----|-----|
| 청킹 | `chunk_size` / `chunk_overlap` 조합 (기본 3종) |
| 검색 전략 | `similarity`, `mmr`, `bm25`, `hybrid` (기본 설정은 `similarity`/`mmr`만 돌리고, `bm25`/`hybrid`는 `--strategies`로 별도 실행) |
| 리랭킹 | LLM 재정렬 ON / OFF |

지표는 `file_hit@1`, `page_hit@{1,3,5}`, `MRR`, `latency_ms`, `cost_usd`이다.
`page_hit@k`는 정답 파일과 페이지가 **모두** 일치하는 문서가 상위 k개에 있으면 1,
`MRR`은 정답 페이지가 처음 등장한 순위의 역수다.

## 실행

```powershell
# 조합 수와 예상 비용만 확인 (실제 실행 없음)
python app.py --dry-run

# 실습 노트북과 같은 조건으로 재현
python app.py --chunk-matrix "700:100" --strategies "similarity,mmr" --rerank both

# 청킹 조건 비교
python app.py --chunk-matrix "500:50,700:100,1000:150" --strategies "similarity,mmr" --rerank off

# BM25/Hybrid 비교
python app.py --chunk-matrix "700:100" --strategies "bm25,hybrid" --rerank both
```

`GOOGLE_API_KEY`가 필요하다. 상위 디렉토리의 `.env`에서 `load_dotenv()`로 읽는다.

### 주요 옵션

| 옵션 | 설명 |
|------|------|
| `--document-path` | 검색 대상 PDF 디렉토리 |
| `--result-dir` | 결과 저장 디렉토리 |
| `--experiment-name` | 실험 이름 (결과가 이 이름의 하위 폴더에 쌓인다) |
| `--eval-data-path` | golden set JSON 경로 |
| `--persist-dir` | Chroma 저장 경로 |
| `--chunk-matrix` | 청킹 조건. `"500:50,700:100"` 형식 |
| `--strategies` | 검색 전략. `"similarity,mmr"` 형식 |
| `--rerank` | `on` / `off` / `both` |
| `--sample-limit` | 문항 수 제한 (개발 중 확인용) |
| `--no-cache` | Chroma 컬렉션 강제 재생성 |
| `--dry-run` | 조합 수·예상 비용만 출력 |

CLI 옵션은 `configs/default.yaml`의 값을 덮어쓴다.

## config 구조

실험 조건을 코드에서 분리해 `configs/default.yaml`에 둔다. 조건을 바꿀 때 코드를 수정하지 않는다.
파이프라인 단계별로 블록을 나누었다.

```yaml
paths:        # 문서, 평가 데이터, 벡터 저장소, 결과 경로
embedding:    # 임베딩 모델
chunking:     # 청킹 조건 목록 (matrix - 이 목록을 순회한다)
retrieval:    # fetch_k, 전략 목록, 전략별 하위 파라미터(mmr/hybrid)
rerank:       # 리랭킹 ON/OFF 목록과 top_k
generation:   # 리랭킹에 쓰는 LLM 모델과 temperature
evaluation:   # 측정할 k 값, 샘플 수, 시드
cost:         # 토큰 단가 (비용 환산용)
runtime:      # API 재시도 정책 (429 대응)
```

`chunking.matrix`, `retrieval.strategies`, `rerank.enabled_options`는 **목록**이며,
`runner.py`가 이 세 목록의 모든 조합을 순회한다. 조합 수 = 청킹 x 전략 x 리랭킹.

`paths`의 상대 경로는 **config 파일 위치 기준**으로 해석된다(`config.resolve_paths()`).
그래서 `result_dir: "./outputs"`는 `configs/outputs/`가 된다.

## 코드 구성

| 파일 | 역할 |
|------|------|
| `app.py` | CLI 인자 파싱, config 로드·병합 후 `run_experiment()` 호출 |
| `rag_experiment/config.py` | config 데이터클래스, YAML 로드, CLI 병합, 검증 |
| `rag_experiment/corpus.py` | PDF 로드, 메타데이터 정규화(`source`, 1-indexed `page_no`), 청킹 |
| `rag_experiment/vectorstore.py` | 임베딩 클라이언트, Chroma 컬렉션 get-or-build (청킹 조건별 캐시) |
| `rag_experiment/retrievers.py` | 전략별 검색 함수를 `(question) -> list[Document]`로 통일 |
| `rag_experiment/reranker.py` | LLM 관련성 점수 기반 재정렬 |
| `rag_experiment/metrics.py` | hit@k, reciprocal rank 계산과 문항 단위 평가 루프 |
| `rag_experiment/cost.py` | 토큰 누적과 USD 환산 |
| `rag_experiment/report.py` | 조합별 집계, CSV 출력, 콘솔 테이블 |
| `rag_experiment/runner.py` | 전체 스윕 오케스트레이션 |
| `rag_experiment/runner_skeleton.py` | `runner.py` 작성용 뼈대 (개발 과정 산출물) |

벡터 저장소는 `(chunk_size, chunk_overlap)`으로 컬렉션 이름을 만들어 재사용한다.
같은 청킹 조건을 다시 돌릴 때 임베딩을 만들지 않는다.

## 출력

`{result_dir}/{experiment_name}/` 에 타임스탬프별로 쌓인다.

| 파일 | 내용 |
|------|------|
| `detail_{ts}.csv` | 문항 x 조합 단위 원본. 검색된 문서의 순위·파일명·페이지 포함 |
| `summary_{ts}.csv` | 조합별 지표 평균 |
| `config_used_{ts}.yaml` | 그 실행에 사용된 설정 전체 |
| `run_meta_{ts}.json` | 실행 시간, 문항 수, 완료 조합 수, 오류 목록 |

실패 문항 분석은 `detail_*.csv`에서 `page_hit@5 == 0`인 행의 `retrieved`를 보면 된다.

## 실험에서 확인한 것

35문항, `chunk 700/100`, `k=5` 기준.

1. **Similarity와 MMR의 지표 차이는 재현되지 않는다.** 노트북 실행에서는 `page_hit@5`가
   91.4% vs 94.3%로 갈렸지만 이는 1문항 차이이고, 벡터 저장소를 다시 만들어 재실행하면
   두 전략이 모두 94.3%로 같아진다. Chroma의 HNSW 근사 탐색 때문에 4~5위 경계가 흔들린다.
2. **재현되는 차이는 후보 페이지 커버리지다.** 상위 5개 안의 고유 (파일, 페이지) 수가
   Similarity 3.80개, MMR 4.83개다. Similarity는 같은 페이지의 청크를 중복으로 올려
   5개 슬롯 중 평균 1.2개를 낭비한다.
3. **검색 단위와 평가 단위가 어긋나 있다.** `file_hit@3`은 100%인데 `page_hit@5`는 94.3%에서
   막힌다. 236페이지를 700자로 나누면 402청크(페이지당 1.7개)가 되고, 같은 페이지의 청크가
   상위를 차지하면 실제로 확인하는 페이지 수가 줄어든다.
4. **`chunk_size`를 1000으로 키우면 개선되지 않는다.** 중복은 줄지만(고유 페이지 3.80 → 4.09)
   임베딩이 희석되어 `page_hit@1`이 2문항 나빠지고 `page_hit@5`는 그대로다.
   중복을 줄이려면 청크를 키우는 대신 페이지 단위로 합쳐야 한다.
5. **LLM 리랭킹은 소폭이지만 실제 효과가 있다 (2026-09-08 재측정, 스키마 버그 수정 후).**
   `file_hit@1`이 0.971 → 1.000, `page_hit@3`이 0.914 → 0.943로 개선됐다(similarity/mmr 공통).
   대신 지연시간이 700~1500ms에서 19~21초로 20~27배 늘고, 문항당 비용이 약
   $0.0007~0.0008 발생한다($0 → $0.025~0.028/35문항). `page_hit@1`과 `page_hit@5`는
   변화 없음 — 재랭킹이 순위를 3~5위 구간에서만 재배치하고 1위·상위 5개 집합 자체는
   크게 바꾸지 못한다는 뜻이다.
6. **BM25가 임베딩 없이도 similarity와 동급 지표를, 압도적으로 빠르게 낸다 (2026-09-08 측정).**
   `latency_ms`가 11.9(BM25, rerank off) vs 700~1500(similarity/mmr/hybrid) — 임베딩 API 호출이
   없는 로컬 렉시컬 검색이라서다. 그런데도 `file_hit@1`/`page_hit@{1,3,5}`/`MRR`은 similarity와
   완전히 동일했다. 이 golden set 질문들은 키워드 매칭만으로 벡터 검색과 같은 성능이 나온다는 뜻.
7. **네 전략 중 BM25+rerank 조합이 MRR·page_hit@1 최고치를 냈다.** `MRR` 0.924, `page_hit@1` 0.914로
   similarity/mmr/hybrid+rerank(모두 page_hit@1 0.886)보다 높다. Hybrid(RRF)는 rerank 없이도
   `page_hit@3`이 0.943으로 similarity/mmr(0.914)보다 높아, 재랭킹 비용 없이 얻는 개선으로는
   가장 효율적이었다.

## 알려진 제약

- ~~LLM 리랭킹 결과는 유효하지 않다~~ **(2026-09-08 수정됨).** 원래는 저장된 실행에서
  리랭킹 호출이 API 요청 한도(429)로 실패해 무효라고 기록했었는데, 재조사 결과 실제 원인은
  다른 버그였다: `reranker.py`의 `RelevanceScore` 스키마가 `score`와 `reason`을 모두
  필수로 요구했는데, LLM 구조화 출력이 `reason` 없이 `score`만 반환하는 경우가 있어
  매 후보마다 pydantic validation error가 나고 예외 처리가 `score=0`으로 fallback했다
  (안정 정렬로 원래 순서 유지, `total_tokens=0`이면서 `latency`만 증가). `reason` 필드를
  optional로 바꿔([`rag_experiment/reranker.py`](rag_experiment/reranker.py)) 해결했고,
  수정 후 결과는 위 5번 항목 참조. 이전 429 rate-limit 관련 경위는 `RESULTS.md` 참조.
- `chunk_size=500` 조건은 아직 측정되지 않았다.
- 실행마다 임베딩 API 요청 한도(429)에 걸릴 수 있다. `runtime.retry`로 백오프를 설정하지만
  청킹 조건을 여러 개 동시에 새로 만들면 실패할 수 있으므로 `--chunk-matrix`로 나누어 실행한다.
