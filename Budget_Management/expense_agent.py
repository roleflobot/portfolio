import json
import os
from datetime import datetime
from dotenv import load_dotenv
from google import genai
from expense_functions import TOOLS, TOOL_FUNCTIONS

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
client = genai.Client(api_key=api_key)


def execute_function_call(step) -> dict:
    """Gemini가 요청한 함수를 실행합니다."""
    tool_function = TOOL_FUNCTIONS.get(step.name)

    if tool_function is None:
        return {"ok": False, "error": f"허용되지 않은 도구: {step.name}"}

    try:
        return tool_function(**step.arguments)
    except TypeError as error:
        return {"ok": False, "error": f"잘못된 인자: {error}"}
    except Exception as error:
        return {"ok": False, "error": f"도구 실행 실패: {type(error).__name__}: {error}"}


def run_expense_agent(user_input: str, max_turns: int = 5, max_calls: int = 20) -> dict:
    """지출 관리 에이전트를 실행합니다."""
    next_input = user_input
    previous_interaction_id = None
    logs = []
    function_call_count = 0  # ← 함수 호출 횟수 추적

    # 오늘 날짜 (YYYY-MM-DD 형식)
    today = datetime.now().strftime("%Y-%m-%d")

    for turn in range(1, max_turns + 1):
        request = {
            "model": model,
            "input": next_input,
            "tools": TOOLS,
            "system_instruction": (
                "당신은 지출 관리 AI 에이전트입니다. "
                f"오늘 날짜는 {today}입니다. "
                "사용자가 '오늘', '어제', '이번 주' 같은 표현을 쓰면 이 기준 날짜를 사용해서 정확한 날짜로 변환하세요. "
                "사용자의 요청을 정확히 이해하고, 필요한 도구를 사용해서 처리하세요. "
                "도구 결과를 기반으로 사용자가 이해할 수 있도록 친절하게 설명해주세요. "
                "예산이 설정되지 않았으면, 사용자에게 예산을 설정하도록 친절하게 제안해주세요."
            ),
            "store": True,
        }

        if previous_interaction_id is not None:
            request["previous_interaction_id"] = previous_interaction_id

        interaction = client.interactions.create(**request)
        function_calls = [step for step in interaction.steps if step.type == "function_call"]

        # 함수 호출이 없으면 최종 답변 반환
        if not function_calls:
            return {
                "ok": True,
                "answer": interaction.output_text,
                "turns": turn,
                "function_calls": function_call_count,  # ← 함수 호출 횟수 표시
                "tool_logs": logs,
            }

        # 함수 호출 실행
        next_input = []
        for function_call in function_calls:
            function_call_count += 1  # ← 횟수 증가

            # max_calls 초과 체크
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

            # 함수 결과를 Gemini에 전달
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
        "function_calls": function_call_count,  # ← 함수 호출 횟수 표시
        "tool_logs": logs,
        "error": "최대 반복 횟수를 초과했습니다.",
    }


if __name__ == "__main__":
    result = run_expense_agent("오늘 점심으로 12,000원 썼어")
    print(f"✅ 답변: {result['answer']}")
    print(f"📊 {len(result['tool_logs'])}개 도구 실행")
