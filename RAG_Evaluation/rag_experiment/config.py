from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import json
import yaml


@dataclass
class MMRConfig:
    fetch_k_candidates: int = 20
    lambda_mult: float = 0.5


@dataclass
class HybridConfig:
    weight_similarity: float = 0.5
    weight_bm25: float = 0.5


@dataclass
class RetrievalConfig:
    fetch_k: int = 5
    strategies: list[str] = field(default_factory=lambda: ["similarity", "mmr", "bm25", "hybrid"])
    mmr: MMRConfig = field(default_factory=MMRConfig)
    hybrid: HybridConfig = field(default_factory=HybridConfig)


@dataclass
class ReRankConfig:
    enabled_options: list[bool] = field(default_factory=lambda: [False, True])
    top_k: int = 5


@dataclass
class KValuesConfig:
    file: list[int] = field(default_factory=lambda: [1])
    page: list[int] = field(default_factory=lambda: [1, 3, 5])


@dataclass
class EvaluationConfig:
    k_values: KValuesConfig = field(default_factory=KValuesConfig)
    sample_limit: Optional[int] = None
    sample_seed: int = 42


@dataclass
class ChunkingConfig:
    matrix: list[dict] = field(default_factory=lambda: [
        {"chunk_size": 500, "chunk_overlap": 50},
        {"chunk_size": 700, "chunk_overlap": 100},
        {"chunk_size": 1000, "chunk_overlap": 150},
    ])


@dataclass
class PricingConfig:
    input_usd_per_1k_tokens: float = 0.000075
    output_usd_per_1k_tokens: float = 0.0003


@dataclass
class CostConfig:
    currency: str = "USD"
    pricing: PricingConfig = field(default_factory=PricingConfig)


@dataclass
class PathsConfig:
    document_dir: str = "../data/public"
    golden_set_path: str = "../data/public/public_paragraph_golden_set.json"
    persist_dir: str = "../chroma_db"
    result_dir: str = "./outputs"


@dataclass
class ExperimentConfig:
    name: str = "chunk-strategy-sweep"
    seed: int = 42


@dataclass
class EmbeddingConfig:
    model_name: str = "gemini-embedding-2"


@dataclass
class GenerationConfig:
    model_name: str = "gemini-3.6-flash"
    temperature: float = 0.0


@dataclass
class RetryConfig:
    attempts: int = 8
    initial_delay: float = 2.0
    max_delay: float = 60.0
    exp_base: float = 2
    jitter: float = 1.0


@dataclass
class RuntimeConfig:
    retry: RetryConfig = field(default_factory=RetryConfig)


@dataclass
class Config:
    experiment: ExperimentConfig = field(default_factory=ExperimentConfig)
    paths: PathsConfig = field(default_factory=PathsConfig)
    embedding: EmbeddingConfig = field(default_factory=EmbeddingConfig)
    generation: GenerationConfig = field(default_factory=GenerationConfig)
    chunking: ChunkingConfig = field(default_factory=ChunkingConfig)
    retrieval: RetrievalConfig = field(default_factory=RetrievalConfig)
    rerank: ReRankConfig = field(default_factory=ReRankConfig)
    evaluation: EvaluationConfig = field(default_factory=EvaluationConfig)
    cost: CostConfig = field(default_factory=CostConfig)
    runtime: RuntimeConfig = field(default_factory=RuntimeConfig)

    def validate(self):
        """검증: rerank.top_k가 fetch_k와 page k 조건을 만족하는지 확인"""
        if self.rerank.top_k > self.retrieval.fetch_k:
            raise ValueError(f"rerank.top_k ({self.rerank.top_k}) must be <= retrieval.fetch_k ({self.retrieval.fetch_k})")
        max_page_k = max(self.evaluation.k_values.page) if self.evaluation.k_values.page else 1
        if self.rerank.top_k < max_page_k:
            raise ValueError(f"rerank.top_k ({self.rerank.top_k}) must be >= max(evaluation.k_values.page) ({max_page_k})")
        for chunk_cfg in self.chunking.matrix:
            if chunk_cfg["chunk_overlap"] >= chunk_cfg["chunk_size"]:
                raise ValueError(f"chunk_overlap ({chunk_cfg['chunk_overlap']}) must be < chunk_size ({chunk_cfg['chunk_size']})")

    def resolve_paths(self, config_file_path: Path):
        """config 파일 기준으로 상대 경로들을 절대 경로로 변환"""
        config_dir = config_file_path.parent.absolute()
        self.paths.document_dir = str((config_dir / self.paths.document_dir).resolve())
        self.paths.golden_set_path = str((config_dir / self.paths.golden_set_path).resolve())
        self.paths.persist_dir = str((config_dir / self.paths.persist_dir).resolve())
        self.paths.result_dir = str((config_dir / self.paths.result_dir).resolve())


def load_config(config_file: Path) -> Config:
    """YAML 설정 파일 로드"""
    with open(config_file, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}

    config = Config()

    if "experiment" in data:
        config.experiment = ExperimentConfig(**{k: v for k, v in data["experiment"].items() if hasattr(config.experiment, k)})
    if "paths" in data:
        config.paths = PathsConfig(**{k: v for k, v in data["paths"].items() if hasattr(config.paths, k)})
    if "embedding" in data:
        config.embedding = EmbeddingConfig(**{k: v for k, v in data["embedding"].items() if hasattr(config.embedding, k)})
    if "generation" in data:
        config.generation = GenerationConfig(**{k: v for k, v in data["generation"].items() if hasattr(config.generation, k)})
    if "chunking" in data:
        config.chunking = ChunkingConfig(**{k: v for k, v in data["chunking"].items() if hasattr(config.chunking, k)})
    if "retrieval" in data:
        retrieval_data = data["retrieval"].copy()
        if "mmr" in retrieval_data:
            retrieval_data["mmr"] = MMRConfig(**retrieval_data["mmr"])
        if "hybrid" in retrieval_data:
            retrieval_data["hybrid"] = HybridConfig(**retrieval_data["hybrid"])
        config.retrieval = RetrievalConfig(**{k: v for k, v in retrieval_data.items() if hasattr(config.retrieval, k)})
    if "rerank" in data:
        config.rerank = ReRankConfig(**{k: v for k, v in data["rerank"].items() if hasattr(config.rerank, k)})
    if "evaluation" in data:
        eval_data = data["evaluation"].copy()
        if "k_values" in eval_data:
            eval_data["k_values"] = KValuesConfig(**eval_data["k_values"])
        config.evaluation = EvaluationConfig(**{k: v for k, v in eval_data.items() if hasattr(config.evaluation, k)})
    if "cost" in data:
        cost_data = data["cost"].copy()
        if "pricing" in cost_data:
            cost_data["pricing"] = PricingConfig(**cost_data["pricing"])
        config.cost = CostConfig(**{k: v for k, v in cost_data.items() if hasattr(config.cost, k)})
    if "runtime" in data:
        runtime_data = data["runtime"].copy()
        if "retry" in runtime_data:
            runtime_data["retry"] = RetryConfig(**runtime_data["retry"])
        config.runtime = RuntimeConfig(**{k: v for k, v in runtime_data.items() if hasattr(config.runtime, k)})

    config.resolve_paths(config_file)
    config.validate()

    return config


def merge_overrides(config: Config, **overrides) -> Config:
    """CLI 오버라이드를 config에 병합"""
    if overrides.get("experiment_name"):
        config.experiment.name = overrides["experiment_name"]
    if overrides.get("document_path"):
        config.paths.document_dir = str(Path(overrides["document_path"]).resolve())
    if overrides.get("eval_data_path"):
        config.paths.golden_set_path = str(Path(overrides["eval_data_path"]).resolve())
    if overrides.get("persist_dir"):
        config.paths.persist_dir = str(Path(overrides["persist_dir"]).resolve())
    if overrides.get("result_dir"):
        config.paths.result_dir = str(Path(overrides["result_dir"]).resolve())
    if overrides.get("sample_limit") is not None:
        config.evaluation.sample_limit = overrides["sample_limit"]
    if overrides.get("strategies"):
        config.retrieval.strategies = overrides["strategies"]
    if overrides.get("rerank_options"):
        if isinstance(overrides["rerank_options"], list):
            config.rerank.enabled_options = overrides["rerank_options"]
    if overrides.get("chunk_matrix"):
        config.chunking.matrix = overrides["chunk_matrix"]

    return config


def config_to_dict(config: Config) -> dict:
    """config 객체를 YAML 저장용 dict로 변환"""
    def to_dict(obj):
        if hasattr(obj, '__dataclass_fields__'):
            return {k: to_dict(getattr(obj, k)) for k in obj.__dataclass_fields__}
        elif isinstance(obj, list):
            return [to_dict(item) for item in obj]
        else:
            return obj
    return to_dict(config)


def save_config(config: Config, output_path: Path):
    """config를 YAML로 저장"""
    data = config_to_dict(config)
    with open(output_path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
