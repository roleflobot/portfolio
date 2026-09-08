import logging
from typing import Callable
from langchain_chroma import Chroma
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document
from kiwipiepy import Kiwi

logger = logging.getLogger(__name__)

_KIWI_INSTANCE = None

def get_kiwi() -> Kiwi:
    """Kiwi 인스턴스 싱글톤 (매번 생성 방지)"""
    global _KIWI_INSTANCE
    if _KIWI_INSTANCE is None:
        _KIWI_INSTANCE = Kiwi()
    return _KIWI_INSTANCE


def kiwi_tokenize(text: str) -> list[str]:
    """Kiwi 형태소 분석기를 사용해 한글 토큰화"""
    kiwi = get_kiwi()
    tokens = kiwi.tokenize(text)
    return [
        token.form.lower()
        for token in tokens
        if token.tag.startswith(("N", "V", "M", "X")) or token.tag in {"SL", "SN"}
    ]


def build_similarity(vectorstore: Chroma, fetch_k: int) -> Callable[[str], list[Document]]:
    """Similarity 검색 retriever"""
    retriever = vectorstore.as_retriever(search_kwargs={"k": fetch_k})
    return lambda query: retriever.invoke(query)


def build_mmr(
    vectorstore: Chroma,
    fetch_k: int,
    fetch_k_candidates: int = 20,
    lambda_mult: float = 0.5,
) -> Callable[[str], list[Document]]:
    """MMR (Max Marginal Relevance) 검색 retriever"""
    retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": fetch_k,
            "fetch_k": fetch_k_candidates,
            "lambda_mult": lambda_mult,
        },
    )
    return lambda query: retriever.invoke(query)


def build_bm25(chunks: list[Document], fetch_k: int) -> BM25Retriever:
    """BM25 검색 retriever (Kiwi 토크나이저 사용)"""
    retriever = BM25Retriever.from_documents(
        chunks,
        preprocess_func=kiwi_tokenize,
        k=fetch_k,
    )
    return retriever


def build_hybrid_rrf(
    similarity_retriever: Callable[[str], list[Document]],
    bm25_retriever: BM25Retriever,
    fetch_k: int,
    weight_similarity: float = 0.5,
    weight_bm25: float = 0.5,
) -> Callable[[str], list[Document]]:
    """
    Hybrid 검색: Similarity와 BM25를 RRF(Reciprocal Rank Fusion)로 결합.
    chunk_id를 기준으로 점수를 합산한 뒤 상위 fetch_k개 반환.
    """
    def hybrid_search(query: str) -> list[Document]:
        # 두 검색기 모두 실행
        similarity_docs = similarity_retriever(query)
        bm25_docs = bm25_retriever.invoke(query)

        # 각 검색기별 점수: 1/(rank+1)
        sim_scores = {doc.metadata.get("chunk_id"): 1.0 / (i + 1) for i, doc in enumerate(similarity_docs)}
        bm25_scores = {doc.metadata.get("chunk_id"): 1.0 / (i + 1) for i, doc in enumerate(bm25_docs)}

        # RRF 점수: 가중치 합산
        combined_scores = {}
        for chunk_id in set(list(sim_scores.keys()) + list(bm25_scores.keys())):
            combined_scores[chunk_id] = (
                sim_scores.get(chunk_id, 0) * weight_similarity +
                bm25_scores.get(chunk_id, 0) * weight_bm25
            )

        # 점수 내림차순 정렬
        sorted_chunks = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)

        # 상위 fetch_k개의 Document 반환
        result_docs = []
        all_docs = similarity_docs + bm25_docs
        for chunk_id, score in sorted_chunks[:fetch_k]:
            for doc in all_docs:
                if doc.metadata.get("chunk_id") == chunk_id and doc not in result_docs:
                    result_docs.append(doc)
                    break

        return result_docs

    return hybrid_search


def get_search_fn(
    strategy: str,
    vectorstore: Chroma,
    chunks: list[Document],
    fetch_k: int,
    mmr_config: dict,
    hybrid_config: dict,
) -> Callable[[str], list[Document]]:
    """
    전략 이름에 따라 통일된 search_fn 반환.
    모든 검색기가 (question: str) -> list[Document] 형태로 통일됨.
    """
    if strategy == "similarity":
        return build_similarity(vectorstore, fetch_k)
    elif strategy == "mmr":
        return build_mmr(
            vectorstore,
            fetch_k,
            fetch_k_candidates=mmr_config.get("fetch_k_candidates", 20),
            lambda_mult=mmr_config.get("lambda_mult", 0.5),
        )
    elif strategy == "bm25":
        bm25_retriever = build_bm25(chunks, fetch_k)
        return lambda query: bm25_retriever.invoke(query)
    elif strategy == "hybrid":
        sim_retriever = build_similarity(vectorstore, fetch_k)
        bm25_retriever = build_bm25(chunks, fetch_k)
        return build_hybrid_rrf(
            sim_retriever,
            bm25_retriever,
            fetch_k,
            weight_similarity=hybrid_config.get("weight_similarity", 0.5),
            weight_bm25=hybrid_config.get("weight_bm25", 0.5),
        )
    else:
        raise ValueError(f"Unknown retrieval strategy: {strategy}")
