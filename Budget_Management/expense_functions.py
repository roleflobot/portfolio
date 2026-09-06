import json
from datetime import datetime
from pathlib import Path

# 데이터 파일 경로
DATA_DIR = Path("expense_data")
DATA_DIR.mkdir(exist_ok=True)
TRANSACTIONS_FILE = DATA_DIR / "transactions.json"
BUDGETS_FILE = DATA_DIR / "budgets.json"


def load_transactions():
    """거래 내역 로드"""
    if TRANSACTIONS_FILE.exists():
        with open(TRANSACTIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def load_budgets():
    """예산 정보 로드"""
    if BUDGETS_FILE.exists():
        with open(BUDGETS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_transactions(transactions):
    """거래 내역 저장"""
    with open(TRANSACTIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(transactions, f, ensure_ascii=False, indent=2)


def save_budgets(budgets):
    """예산 정보 저장"""
    with open(BUDGETS_FILE, 'w', encoding='utf-8') as f:
        json.dump(budgets, f, ensure_ascii=False, indent=2)


# ============ Function Definitions ============

def add_expense(amount: int, category: str, date: str = None, memo: str = None) -> dict:
    """지출을 등록합니다."""
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")

    if not category:
        return {"ok": False, "error": "카테고리가 필요합니다."}

    if amount <= 0:
        return {"ok": False, "error": "금액은 0보다 커야 합니다."}

    transactions = load_transactions()

    new_expense = {
        "id": len(transactions) + 1,
        "date": date,
        "amount": amount,
        "category": category,
        "memo": memo or "",
        "created_at": datetime.now().isoformat()
    }

    transactions.append(new_expense)
    save_transactions(transactions)

    return {
        "ok": True,
        "message": f"{category} {amount:,}원이 {date}에 등록되었습니다.",
        "expense": new_expense
    }


def search_expense(category: str = None, month: str = None, date: str = None, memo: str = None) -> dict:
    """조건에 맞는 지출을 검색합니다."""
    transactions = load_transactions()

    # 필터링
    results = transactions

    if category:
        results = [t for t in results if t['category'] == category]

    if month:  # month: "2026-08"
        results = [t for t in results if t['date'].startswith(month)]

    if date:  # date: "2026-08-27"
        results = [t for t in results if t['date'] == date]

    if memo:
        results = [t for t in results if memo in t.get('memo', '')]

    if not results:
        return {
            "ok": True,
            "message": "조건에 맞는 거래가 없습니다.",
            "count": 0,
            "expenses": []
        }

    total = sum(t['amount'] for t in results)
    return {
        "ok": True,
        "message": f"총 {len(results)}개의 거래를 찾았습니다.",
        "count": len(results),
        "total": total,
        "expenses": results
    }


def update_expense(expense_id: int, amount: int = None, category: str = None,
                   date: str = None, memo: str = None) -> dict:
    """지출을 수정합니다."""
    transactions = load_transactions()

    # ID로 찾기
    expense = next((t for t in transactions if t['id'] == expense_id), None)

    if not expense:
        return {"ok": False, "error": f"ID {expense_id}인 거래를 찾을 수 없습니다."}

    # 수정
    if amount is not None:
        expense['amount'] = amount
    if category is not None:
        expense['category'] = category
    if date is not None:
        expense['date'] = date
    if memo is not None:
        expense['memo'] = memo

    save_transactions(transactions)

    return {
        "ok": True,
        "message": f"거래 ID {expense_id}가 수정되었습니다.",
        "expense": expense
    }


def set_budget(month: str, category: str, amount: int) -> dict:
    """월별 카테고리 예산을 설정합니다."""
    if amount <= 0:
        return {"ok": False, "error": "예산은 0보다 커야 합니다."}

    budgets = load_budgets()

    if month not in budgets:
        budgets[month] = {}

    budgets[month][category] = {
        "budget": amount,
        "set_at": datetime.now().isoformat()
    }

    save_budgets(budgets)

    return {
        "ok": True,
        "message": f"{month} {category} 예산이 {amount:,}원으로 설정되었습니다.",
        "budget": budgets[month][category]
    }


def check_budget(month: str = None, category: str = None) -> dict:
    """예산과 지출을 비교합니다."""
    if not month:
        month = datetime.now().strftime("%Y-%m")

    budgets = load_budgets()
    transactions = load_transactions()

    if month not in budgets:
        return {
            "ok": True,
            "message": f"{month}의 예산이 설정되지 않았습니다.",
            "budget": None
        }

    month_budgets = budgets[month]

    # 지출 계산
    month_expenses = search_expense(month=month)['expenses']

    result = {
        "ok": True,
        "month": month,
        "details": []
    }

    for cat, budget_info in month_budgets.items():
        spent = sum(t['amount'] for t in month_expenses if t['category'] == cat)
        budget = budget_info['budget']
        remaining = budget - spent

        detail = {
            "category": cat,
            "budget": budget,
            "spent": spent,
            "remaining": remaining,
            "percent": int((spent / budget * 100)) if budget > 0 else 0
        }
        result['details'].append(detail)

    # 특정 카테고리만 조회
    if category:
        result['details'] = [d for d in result['details'] if d['category'] == category]

    return result


def delete_expense(expense_id: int) -> dict:
    """지출을 삭제합니다."""
    transactions = load_transactions()

    expense = next((t for t in transactions if t['id'] == expense_id), None)
    if not expense:
        return {"ok": False, "error": f"ID {expense_id}인 거래를 찾을 수 없습니다."}

    transactions = [t for t in transactions if t['id'] != expense_id]
    save_transactions(transactions)

    return {
        "ok": True,
        "message": f"거래 ID {expense_id}가 삭제되었습니다.",
        "deleted": expense
    }


def analyze_by_month(month: str = None) -> dict:
    """특정 월의 지출을 분석합니다."""
    if not month:
        month = datetime.now().strftime("%Y-%m")

    result = search_expense(month=month)
    if not result['expenses']:
        return {
            "ok": True,
            "message": f"{month}의 지출 내역이 없습니다.",
            "month": month,
            "total": 0,
            "count": 0,
            "by_category": {}
        }

    expenses = result['expenses']
    total = result['total']

    by_category = {}
    for exp in expenses:
        cat = exp['category']
        if cat not in by_category:
            by_category[cat] = {"count": 0, "amount": 0}
        by_category[cat]["count"] += 1
        by_category[cat]["amount"] += exp['amount']

    return {
        "ok": True,
        "month": month,
        "total": total,
        "count": len(expenses),
        "by_category": by_category
    }


def get_category_ratio(month: str = None) -> dict:
    """특정 월의 카테고리별 지출 비율을 계산합니다."""
    if not month:
        month = datetime.now().strftime("%Y-%m")

    analysis = analyze_by_month(month)
    if not analysis['by_category']:
        return {
            "ok": True,
            "message": f"{month}의 지출 내역이 없습니다.",
            "month": month,
            "ratios": {}
        }

    total = analysis['total']
    ratios = {}

    for cat, data in analysis['by_category'].items():
        percent = int((data['amount'] / total * 100)) if total > 0 else 0
        ratios[cat] = {
            "amount": data['amount'],
            "count": data['count'],
            "percent": percent
        }

    sorted_ratios = dict(sorted(ratios.items(), key=lambda x: x[1]['amount'], reverse=True))

    return {
        "ok": True,
        "month": month,
        "total": total,
        "ratios": sorted_ratios
    }


# ============ Tool Schemas ============

TOOLS = [
    {
        "type": "function",
        "name": "add_expense",
        "description": "지출을 등록합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "amount": {"type": "integer", "description": "금액 (원)"},
                "category": {"type": "string", "description": "카테고리 (식비, 교통, 쇼핑 등)"},
                "date": {"type": "string", "description": "날짜 (YYYY-MM-DD)"},
                "memo": {"type": "string", "description": "사용 내역 (예: 스타벅스에서 커피, 점심 식사 등)"}
            },
            "required": ["amount", "category", "date"]
        }
    },
    {
        "type": "function",
        "name": "search_expense",
        "description": "조건에 맞는 지출을 검색합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "카테고리"},
                "month": {"type": "string", "description": "월 (YYYY-MM)"},
                "date": {"type": "string", "description": "날짜 (YYYY-MM-DD)"},
                "memo": {"type": "string", "description": "사용 내역 (메모에 포함된 텍스트로 검색)"}
            }
        }
    },
    {
        "type": "function",
        "name": "update_expense",
        "description": "지출을 수정합니다. 먼저 search_expense로 expense_id를 찾아야 합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "expense_id": {"type": "integer", "description": "거래 ID"},
                "amount": {"type": "integer", "description": "새 금액"},
                "category": {"type": "string", "description": "새 카테고리"},
                "date": {"type": "string", "description": "새 날짜"},
                "memo": {"type": "string", "description": "새 사용 내역"}
            },
            "required": ["expense_id"]
        }
    },
    {
        "type": "function",
        "name": "set_budget",
        "description": "월별 카테고리 예산을 설정합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "month": {"type": "string", "description": "월 (YYYY-MM)"},
                "category": {"type": "string", "description": "카테고리"},
                "amount": {"type": "integer", "description": "예산 (원)"}
            },
            "required": ["month", "category", "amount"]
        }
    },
    {
        "type": "function",
        "name": "check_budget",
        "description": "예산과 지출을 비교합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "month": {"type": "string", "description": "월 (YYYY-MM), 생략하면 현재월"},
                "category": {"type": "string", "description": "특정 카테고리만 조회"}
            }
        }
    },
    {
        "type": "function",
        "name": "delete_expense",
        "description": "지출을 삭제합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "expense_id": {"type": "integer", "description": "거래 ID"}
            },
            "required": ["expense_id"]
        }
    },
    {
        "type": "function",
        "name": "analyze_by_month",
        "description": "특정 월의 지출을 카테고리별로 분석합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "month": {"type": "string", "description": "월 (YYYY-MM), 생략하면 현재월"}
            }
        }
    },
    {
        "type": "function",
        "name": "get_category_ratio",
        "description": "특정 월의 카테고리별 지출 비율을 계산합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "month": {"type": "string", "description": "월 (YYYY-MM), 생략하면 현재월"}
            }
        }
    }
]


TOOL_FUNCTIONS = {
    "add_expense": add_expense,
    "search_expense": search_expense,
    "update_expense": update_expense,
    "set_budget": set_budget,
    "check_budget": check_budget,
    "delete_expense": delete_expense,
    "analyze_by_month": analyze_by_month,
    "get_category_ratio": get_category_ratio,
}


if __name__ == "__main__":
    # 테스트
    print("=== 지출 등록 ===")
    result = add_expense(amount=12000, category="식비", memo="회사 구내식당에서 점심")
    print(json.dumps(result, ensure_ascii=False, indent=2))

    print("\n=== 지출 조회 ===")
    result = search_expense(category="식비")
    print(json.dumps(result, ensure_ascii=False, indent=2))

    print("\n=== 예산 설정 ===")
    result = set_budget(month="2026-08", category="식비", amount=300000)
    print(json.dumps(result, ensure_ascii=False, indent=2))

    print("\n=== 예산 확인 ===")
    result = check_budget(month="2026-08")
    print(json.dumps(result, ensure_ascii=False, indent=2))
