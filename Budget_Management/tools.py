"""
지출/수입 관리 도구 함수들
"""
import json
from datetime import datetime
from pathlib import Path

# ============================================================================
# Data file path settings
# ============================================================================
DATA_DIR = Path("expense_data")
DATA_DIR.mkdir(exist_ok=True)
TRANSACTIONS_FILE = DATA_DIR / "transactions.json"
BUDGETS_FILE = DATA_DIR / "budgets.json"


# ============================================================================
# Date utility functions
# ============================================================================

def get_current_date():
    """오늘 날짜를 YYYY-MM-DD 형식으로 반환합니다."""
    return datetime.now().strftime("%Y-%m-%d")


def get_current_month():
    """현재 월을 YYYY-MM 형식으로 반환합니다."""
    return datetime.now().strftime("%Y-%m")


# ============================================================================
# Data load/save functions
# ============================================================================

def load_transactions():
    """저장된 거래 내역을 로드합니다."""
    if TRANSACTIONS_FILE.exists():
        with open(TRANSACTIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def load_budgets():
    """저장된 예산 정보를 로드합니다."""
    if BUDGETS_FILE.exists():
        with open(BUDGETS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_transactions(transactions):
    """거래 내역을 파일에 저장합니다."""
    with open(TRANSACTIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(transactions, f, ensure_ascii=False, indent=2)


def save_budgets(budgets):
    """예산 정보를 파일에 저장합니다."""
    with open(BUDGETS_FILE, 'w', encoding='utf-8') as f:
        json.dump(budgets, f, ensure_ascii=False, indent=2)


# ============================================================================
# Tool functions
# ============================================================================

def add_expense(amount: int, category: str, date: str = None, memo: str = None) -> dict:
    """지출을 등록합니다."""
    if not date:
        date = get_current_date()
    if not category:
        return {"ok": False, "error": "카테고리가 필요합니다."}
    if amount <= 0:
        return {"ok": False, "error": "금액은 0보다 커야 합니다."}

    transactions = load_transactions()
    # 삭제된 ID를 피하기 위해 최대 ID에 +1
    new_id = max([t['id'] for t in transactions], default=0) + 1
    new_expense = {
        "id": new_id,
        "type": "expense",
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


def add_income(amount: int, category: str, date: str = None, memo: str = None) -> dict:
    """수입을 등록합니다."""
    if not date:
        date = get_current_date()
    if not category:
        return {"ok": False, "error": "카테고리가 필요합니다."}
    if amount <= 0:
        return {"ok": False, "error": "금액은 0보다 커야 합니다."}

    transactions = load_transactions()
    # 삭제된 ID를 피하기 위해 최대 ID에 +1
    new_id = max([t['id'] for t in transactions], default=0) + 1
    new_income = {
        "id": new_id,
        "type": "income",
        "date": date,
        "amount": amount,
        "category": category,
        "memo": memo or "",
        "created_at": datetime.now().isoformat()
    }
    transactions.append(new_income)
    save_transactions(transactions)

    return {
        "ok": True,
        "message": f"[수입] {category} {amount:,}원이 {date}에 등록되었습니다.",
        "income": new_income
    }


def search_expense(category: str = None, month: str = None, date: str = None, memo: str = None) -> dict:
    """조건에 맞는 지출을 검색합니다."""
    transactions = load_transactions()
    results = [t for t in transactions if t.get("type") == "expense"]

    if category:
        results = [t for t in results if t['category'] == category]
    if month:
        results = [t for t in results if t['date'].startswith(month)]
    if date:
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


def search_income(category: str = None, month: str = None, date: str = None, memo: str = None) -> dict:
    """조건에 맞는 수입을 검색합니다."""
    transactions = load_transactions()
    results = [t for t in transactions if t.get("type") == "income"]

    if category:
        results = [t for t in results if t['category'] == category]
    if month:
        results = [t for t in results if t['date'].startswith(month)]
    if date:
        results = [t for t in results if t['date'] == date]
    if memo:
        results = [t for t in results if memo in t.get('memo', '')]

    if not results:
        return {
            "ok": True,
            "message": "조건에 맞는 수입이 없습니다.",
            "count": 0,
            "incomes": []
        }

    total = sum(t['amount'] for t in results)
    return {
        "ok": True,
        "message": f"총 {len(results)}개의 수입을 찾았습니다.",
        "count": len(results),
        "total": total,
        "incomes": results
    }


def update_expense(expense_id: int, amount: int = None, category: str = None,
                   date: str = None, memo: str = None) -> dict:
    """지출을 수정합니다."""
    transactions = load_transactions()
    expense = next((t for t in transactions if t['id'] == expense_id and t.get("type") == "expense"), None)

    if not expense:
        return {"ok": False, "error": f"ID {expense_id}인 거래를 찾을 수 없습니다."}

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
        month = get_current_month()

    budgets = load_budgets()
    if month not in budgets:
        return {
            "ok": True,
            "message": f"{month}의 예산이 설정되지 않았습니다.",
            "budget": None
        }

    month_budgets = budgets[month]

    expense_result = search_expense(month=month)
    if not expense_result['ok']:
        return expense_result
    month_expenses = expense_result['expenses']

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

    if category:
        result['details'] = [d for d in result['details'] if d['category'] == category]

    return result


def delete_expense(expense_id: int) -> dict:
    """지출을 삭제합니다."""
    transactions = load_transactions()
    expense = next((t for t in transactions if t['id'] == expense_id and t.get("type") == "expense"), None)

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
        month = get_current_month()

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
        month = get_current_month()

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


# ============================================================================
# Tool function mapping
# ============================================================================

TOOL_FUNCTIONS = {
    "add_expense": add_expense,
    "add_income": add_income,
    "search_expense": search_expense,
    "search_income": search_income,
    "update_expense": update_expense,
    "set_budget": set_budget,
    "check_budget": check_budget,
    "delete_expense": delete_expense,
    "analyze_by_month": analyze_by_month,
    "get_category_ratio": get_category_ratio,
}
