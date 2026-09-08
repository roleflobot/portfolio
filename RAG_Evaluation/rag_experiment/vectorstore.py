import logging
import chromadb
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_core.documents import Document
from google.genai.types import HttpOptions, HttpRetryOptions
from google import genai
from rag_experiment.config import RuntimeConfig

logger = logging.getLogger(__name__)


def build_embeddings_client(
    model_name: str,
    retry_config: RuntimeConfig,
) -> GoogleGenerativeAIEmbeddings:
    """
    재시도 설정을 포함한 임베딩 클라이언트 생성.
    429 (rate limit) 에러를 자동으로 재시도함.
    """
    embeddings = GoogleGenerativeAIEmbeddings(model=model_name)

    retry_client = genai.Client(
        http_options=HttpOptions(
            retry_options=HttpRetryOptions(
                attempts=retry_config.retry.attempts,
                initial_delay=retry_config.retry.initial_delay,
                max_delay=retry_config.retry.max_delay,
                exp_base=retry_config.retry.exp_base,
                jitter=retry_config.retry.jitter,
            )
        )
    )
    embeddings.client = retry_client

    return embeddings


def collection_name_for(chunk_size: int, chunk_overlap: int, tag: str = "public") -> str:
    """(chunk_size, chunk_overlap) 쌍을 기반으로 컬렉션 이름 생성"""
    return f"rag_exp_{tag}_cs{chunk_size}_co{chunk_overlap}"


def get_or_build_vectorstore(
    chunks: list[Document],
    persist_dir: str,
    collection_name: str,
    embeddings: GoogleGenerativeAIEmbeddings,
    force_rebuild: bool = False,
) -> Chroma:
    """
    벡터스토어 로드 또는 신규 생성.
    cache hit: 기존 컬렉션이 있으면 재임베딩 없이 로드
    cache miss: 없으면 from_documents로 신규 생성
    """
    client = chromadb.PersistentClient(path=persist_dir)
    existing_collections = {c.name for c in client.list_collections()}

    if force_rebuild and collection_name in existing_collections:
        logger.info(f"Deleting existing collection: {collection_name}")
        client.delete_collection(collection_name)
        existing_collections.discard(collection_name)

    # 컬렉션이 이름만 남아 있고 내용이 비어 있는 경우가 있다.
    # 임베딩 중 429로 실패하면 빈 컬렉션이 남는데, 이름만 보고 캐시 히트로 처리하면
    # 검색 결과가 0건이 되어 모든 지표가 조용히 0으로 집계된다. 문서 수까지 확인한다.
    if collection_name in existing_collections:
        stored_count = client.get_collection(collection_name).count()
        if stored_count != len(chunks):
            logger.warning(
                f"Collection {collection_name} has {stored_count} docs but "
                f"{len(chunks)} chunks expected. Rebuilding."
            )
            client.delete_collection(collection_name)
            existing_collections.discard(collection_name)

    if collection_name in existing_collections:
        logger.info(f"Loading existing vectorstore: {collection_name} ({len(chunks)} chunks)")
        vectorstore = Chroma(
            collection_name=collection_name,
            embedding_function=embeddings,
            client=client,
        )
    else:
        logger.info(f"Building new vectorstore: {collection_name} with {len(chunks)} chunks")
        vectorstore = Chroma.from_documents(
            documents=chunks,
            embedding=embeddings,
            collection_name=collection_name,
            client=client,
        )
        logger.info(f"Vectorstore created: {collection_name}")

    return vectorstore
