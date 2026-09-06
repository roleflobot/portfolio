"""
개인 예산 관리 AI 에이전트
"""
import json
import os
from datetime import datetime
from dotenv import load_dotenv
from google import genai
from tools import TOOL_FUNCTIONS

# ============================================================================
# Environment settings
# ============================================================================
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
client = genai.Client(api_key=api_key)

# ============================================================================
# AI tool definitions (Tool Schemas)
# ============================================================================

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
                "memo": {"type": "string", "description": "사용 내역"}
            },
            "required": ["amount", "category", "date"]
        }
    },
    {
        "type": "function",
        "name": "add_income",
        "description": "수입을 등록합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "amount": {"type": "integer", "description": "금액 (원)"},
                "category": {"type": "string", "description": "카테고리 (급여, 부업, 용돈 등)"},
                "date": {"type": "string", "description": "날짜 (YYYY-MM-DD)"},
                "memo": {"type": "string", "description": "수입 내역"}
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
                "memo": {"type": "string", "description": "메모 텍스트"}
            }
        }
    },
    {
        "type": "function",
        "name": "search_income",
        "description": "조건에 맞는 수입을 검색합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "카테고리"},
                "month": {"type": "string", "description": "월 (YYYY-MM)"},
                "date": {"type": "string", "description": "날짜 (YYYY-MM-DD)"},
                "memo": {"type": "string", "description": "메모 텍스트"}
            }
        }
    },
    {
        "type": "function",
        "name": "update_expense",
        "description": "지출을 수정합니다.",
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
                "month": {"type": "string", "description": "월 (YYYY-MM)"},
                "category": {"type": "string", "description": "카테고리"}
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
        "description": "특정 월의 지출을 분석합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "month": {"type": "string", "description": "월 (YYYY-MM)"}
            }
        }
    },
    {
        "type": "function",
        "name": "get_category_ratio",
        "description": "카테고리별 지출 비율을 계산합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "month": {"type": "string", "description": "월 (YYYY-MM)"}
            }
        }
    }
]


# ============================================================================
# Function execution
# ============================================================================

def execute_function_call(step) -> dict:
    """AI가 요청한 함수를 실행합니다."""
    tool_function = TOOL_FUNCTIONS.get(step.name)

    if tool_function is None:
        error_msg = f"Tool not allowed: {step.name}"
        print(f"[ERROR] {error_msg}")
        return {"ok": False, "error": error_msg}

    try:
        result = tool_function(**step.arguments)
        if result.get("ok"):
            print(f"[OK] {step.name} executed")
        return result
    except TypeError as error:
        error_msg = f"Invalid arguments: {error}"
        print(f"[ERROR] {error_msg}")
        return {"ok": False, "error": error_msg}
    except Exception as error:
        error_msg = f"Tool execution failed: {type(error).__name__}: {error}"
        print(f"[ERROR] {error_msg}")
        return {"ok": False, "error": error_msg}


# ============================================================================
# AI Agent
# ============================================================================

def run_expense_agent(user_input: str, max_turns: int = 5, max_calls: int = 20) -> dict:
    """지출 관리 AI 에이전트를 실행합니다."""
    next_input = user_input
    previous_interaction_id = None
    logs = []
    function_call_count = 0

    today = datetime.now().strftime("%Y-%m-%d")

    for turn in range(1, max_turns + 1):
        request = {
            "model": model,
            "input": next_input,
            "tools": TOOLS,
            "system_instruction": (
                "당신은 개인 재정 관리 AI 에이전트입니다. "
                f"오늘 날짜는 {today}입니다. "
                "사용자가 '오늘', '어제', '이번 주' 같은 표현을 쓰면 정확한 날짜로 변환하세요. "
                "사용자의 요청을 정확히 이해하고, 필요한 도구를 사용해서 처리하세요. "
                "결과를 친절하게 설명해주세요."
            ),
            "store": True,
        }

        if previous_interaction_id is not None:
            request["previous_interaction_id"] = previous_interaction_id

        interaction = client.interactions.create(**request)
        function_calls = [step for step in interaction.steps if step.type == "function_call"]

        if not function_calls:
            return {
                "ok": True,
                "answer": interaction.output_text,
                "turns": turn,
                "function_calls": function_call_count,
                "tool_logs": logs,
            }

        next_input = []
        for function_call in function_calls:
            function_call_count += 1

            if function_call_count > max_calls:
                return {
                    "ok": False,
                    "answer": None,
                    "turns": turn,
                    "tool_logs": logs,
                    "error": f"함수 호출 제한({max_calls})을 초과했습니다.",
                }

            result = execute_function_call(function_call)
            logs.append({
                "turn": turn,
                "tool": function_call.name,
                "arguments": function_call.arguments,
                "result": result
            })

            function_result = {
                "type": "function_result",
                "name": function_call.name,
                "call_id": function_call.id,
                "result": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}],
            }
            next_input.append(function_result)

        previous_interaction_id = interaction.id

    return {
        "ok": False,
        "answer": None,
        "turns": max_turns,
        "function_calls": function_call_count,
        "tool_logs": logs,
        "error": "최대 반복 횟수를 초과했습니다.",
    }
