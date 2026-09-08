from pathlib import Path
from typing import Optional
import logging
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

logger = logging.getLogger(__name__)


def load_pages_by_file(document_dir: str) -> dict[str, list[Document]]:
    """
    문서 디렉토리에서 PDF 파일들을 로드하고 메타데이터를 정규화.
    Returns: {filename (stem): [Document with page_no (1-indexed), source (filename only)]}
    """
    document_path = Path(document_dir)
    if not document_path.exists():
        raise FileNotFoundError(f"Document directory not found: {document_dir}")

    pages_by_file = {}
    pdf_files = sorted(document_path.glob("*.pdf"))

    if not pdf_files:
        logger.warning(f"No PDF files found in {document_dir}")

    for pdf_path in pdf_files:
        try:
            logger.info(f"Loading {pdf_path.name}...")
            loader = PyPDFLoader(str(pdf_path))
            pages = loader.load()

            if not pages:
                logger.warning(f"No pages extracted from {pdf_path.name}")
                continue

            total_chars = sum(len(p.page_content) for p in pages)
            logger.info(f"  Extracted {len(pages)} pages, {total_chars} characters from {pdf_path.name}")

            # 메타데이터 정규화: source는 filename만, page_no는 1-indexed
            for page in pages:
                page.metadata["source"] = pdf_path.name
                page.metadata["page_no"] = page.metadata.get("page", 0) + 1

            pages_by_file[pdf_path.stem] = pages

        except Exception as e:
            logger.warning(f"Failed to load {pdf_path.name}: {e}")
            continue

    return pages_by_file


def split_into_chunks(
    pages_by_file: dict[str, list[Document]],
    chunk_size: int,
    chunk_overlap: int,
) -> list[Document]:
    """
    파일별 페이지들을 청크로 분할하고 chunk_id를 부여.
    chunk_id = f"{file_stem}:{local_index}" (RRF 조인 키로 사용)
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n### ", "\n\n", "\n", " "],
    )

    all_chunks = []
    for file_stem, pages in sorted(pages_by_file.items()):
        chunks = splitter.split_documents(pages)
        for local_index, chunk in enumerate(chunks):
            chunk.metadata["chunk_id"] = f"{file_stem}:{local_index}"
        all_chunks.extend(chunks)

    logger.info(f"Total chunks: {len(all_chunks)} (chunk_size={chunk_size}, overlap={chunk_overlap})")
    return all_chunks
