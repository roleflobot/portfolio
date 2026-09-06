#!/usr/bin/env python3
"""
Agent test script
"""
from agent import run_expense_agent

# Test cases
test_cases = [
    "I spent 15,000 won on lunch today",
    "I want to know about last month's food expenses",
    "Set the food budget for September to 600,000 won",
]

print("=" * 70)
print("Budget Management AI Agent - Test Run")
print("=" * 70)
print()

for i, test_input in enumerate(test_cases, 1):
    print(f"Test {i}: {test_input}")
    print("-" * 70)

    result = run_expense_agent(test_input)

    if result['ok']:
        print(f"Result: {result['answer']}")
        print(f"Turns: {result['turns']}, Function Calls: {result['function_calls']}")
    else:
        print(f"Error: {result['error']}")

    print()
    print()

print("=" * 70)
print("Test completed!")
print("=" * 70)
