from dataclasses import dataclass, field


@dataclass
class CostRecord:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    call_count: int = 0

    def __iadd__(self, other: "CostRecord") -> "CostRecord":
        self.input_tokens += other.input_tokens
        self.output_tokens += other.output_tokens
        self.total_tokens += other.total_tokens
        self.call_count += other.call_count
        return self

    def add(self, other: "CostRecord"):
        self += other


def compute_cost_usd(record: CostRecord, input_rate_per_1k: float, output_rate_per_1k: float) -> float:
    """토큰 수와 요금표로부터 USD 비용 계산"""
    input_cost = (record.input_tokens / 1000) * input_rate_per_1k
    output_cost = (record.output_tokens / 1000) * output_rate_per_1k
    return input_cost + output_cost
