import logging
from typing import Optional, Callable
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.documents import Document
from rag_experiment.cost import CostRecord

logger = logging.getLogger(__name__)


class RelevanceScore(BaseModel):
    score: int = Field(ge=0, le=10, description="Relevance score 0-10")
    reason: str = Field(default="", description="Brief explanation for the score")


def build_reranker(llm: ChatGoogleGenerativeAI) -> Callable:
    """
    LLM-as-reranker 함수 생성.
    include_raw=True로 토큰 사용량을 캡처.
    """
    scoring_llm = llm.with_structured_output(RelevanceScore, include_raw=True)

    def rerank_candidates(
        question: str,
        candidates: list[Document],
        top_k: int = 5,
    ) -> tuple[list[Document], CostRecord]:
        """
        후보 문서들을 LLM으로 재정렬.
        Returns: (재정렬된 상위 top_k 문서, 토큰 비용 기록)
        """
        if not candidates:
            return [], CostRecord()

        cost_record = CostRecord()
        scored_docs = []

        for doc in candidates:
            context = doc.page_content[:500]  # 처음 500글자만
            prompt = f"""이 검색 결과가 질문에 얼마나 관련이 있는지 평가하세요.

질문: {question}

검색 결과:
{context}

0-10 점수로 평가하고 한 문장으로 이유를 설명하세요."""

            try:
                result = scoring_llm.invoke(prompt)

                # include_raw=True일 때는 {"raw": AIMessage, "parsed": Model, "parsing_error": ...}
                if isinstance(result, dict):
                    if result.get("parsing_error"):
                        logger.warning(f"Parsing error for candidate, using score=0")
                        score = 0
                    else:
                        score = result.get("parsed", RelevanceScore(score=0)).score
                    # 토큰 사용량 캡처
                    if result.get("raw") and hasattr(result["raw"], "usage_metadata"):
                        usage = result["raw"].usage_metadata
                        cost_record.input_tokens += usage.get("input_tokens", 0)
                        cost_record.output_tokens += usage.get("output_tokens", 0)
                        cost_record.total_tokens += usage.get("output_tokens", 0) + usage.get("input_tokens", 0)
                        cost_record.call_count += 1
                else:
                    # 구조화된 출력 대신 단순 객체가 반환된 경우
                    score = result.score if hasattr(result, "score") else 0

                scored_docs.append((score, doc))

            except Exception as e:
                logger.warning(f"Error scoring document: {e}, using score=0")
                scored_docs.append((0, doc))

        # 점수 내림차순 정렬 후 상위 top_k개 반환
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        reranked = [doc for score, doc in scored_docs[:top_k]]

        return reranked, cost_record

    return rerank_candidates
