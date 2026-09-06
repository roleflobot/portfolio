import json
from pathlib import Path

# 폴더 생성
Path('expense_data').mkdir(parents=True, exist_ok=True)

# transactions 데이터
transactions = [
    {"id": 1, "type": "expense", "date": "2026-08-01", "amount": 12000, "category": "식비", "memo": "회사 구내식당 점심", "created_at": "2026-08-01T12:30:00"},
    {"id": 2, "type": "expense", "date": "2026-08-02", "amount": 5000, "category": "커피", "memo": "스타벅스 아메리카노", "created_at": "2026-08-02T10:15:00"},
    {"id": 3, "type": "expense", "date": "2026-08-05", "amount": 35000, "category": "식비", "memo": "저녁 회식", "created_at": "2026-08-05T18:45:00"},
    {"id": 4, "type": "expense", "date": "2026-08-07", "amount": 8000, "category": "교통", "memo": "지하철 충전", "created_at": "2026-08-07T09:00:00"},
    {"id": 5, "type": "expense", "date": "2026-08-10", "amount": 120000, "category": "쇼핑", "memo": "옷 구매", "created_at": "2026-08-10T14:30:00"},
    {"id": 6, "type": "expense", "date": "2026-08-12", "amount": 15000, "category": "식비", "memo": "베트남 쌀국수", "created_at": "2026-08-12T12:00:00"},
    {"id": 7, "type": "expense", "date": "2026-08-15", "amount": 70000, "category": "쇼핑", "memo": "바람막이 재킷", "created_at": "2026-08-15T16:20:00"},
    {"id": 8, "type": "income", "date": "2026-08-01", "amount": 2000000, "category": "급여", "memo": "회사 월급", "created_at": "2026-08-01T09:00:00"},
    {"id": 9, "type": "income", "date": "2026-08-10", "amount": 500000, "category": "부업", "memo": "프리랜싱 프로젝트", "created_at": "2026-08-10T18:00:00"},
    {"id": 10, "type": "expense", "date": "2026-08-19", "amount": 5000, "category": "커피", "memo": "커피", "created_at": "2026-08-19T10:30:00"},
    {"id": 11, "type": "expense", "date": "2026-08-21", "amount": 30000, "category": "식비", "memo": "해물탕", "created_at": "2026-08-21T19:00:00"}
]

# budgets 데이터
budgets = {
    "2026-08": {
        "식비": {"budget": 500000, "set_at": "2026-08-01T00:00:00"},
        "교통": {"budget": 100000, "set_at": "2026-08-01T00:00:00"},
        "쇼핑": {"budget": 400000, "set_at": "2026-08-01T00:00:00"},
        "커피": {"budget": 50000, "set_at": "2026-08-02T00:00:00"}
    },
    "2026-09": {
        "식비": {"budget": 550000, "set_at": "2026-09-01T00:00:00"},
        "교통": {"budget": 100000, "set_at": "2026-09-01T00:00:00"}
    }
}

# 파일 저장 (BOM 없이)
with open('expense_data/transactions.json', 'w', encoding='utf-8') as f:
    json.dump(transactions, f, ensure_ascii=False, indent=2)

with open('expense_data/budgets.json', 'w', encoding='utf-8') as f:
    json.dump(budgets, f, ensure_ascii=False, indent=2)

print('JSON files created successfully! (BOM removed)')
