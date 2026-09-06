#!/usr/bin/env python3
"""
Budget Management AI Agent
CLI interface
"""
from agent import run_expense_agent


def main():
    """Main function - interactive loop"""
    print("=" * 70)
    print("Budget Management AI Agent")
    print("=" * 70)
    print("Start a conversation.")
    print("Example: 'I spent 12,000 won on lunch today'")
    print("Exit: type 'exit' or 'quit'")
    print("=" * 70)
    print()

    while True:
        try:
            user_input = input("User: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ["exit", "quit"]:
                print("\nGoodbye!")
                break

            print("\nProcessing...\n")
            result = run_expense_agent(user_input)

            if result['ok']:
                print(f"Agent: {result['answer']}")
                if result['tool_logs']:
                    print(f"\nTools used: {len(result['tool_logs'])}")
                    for log in result['tool_logs']:
                        print(f"   - Turn {log['turn']}: {log['tool']}")
            else:
                print(f"Error: {result['error']}")

            print()

        except KeyboardInterrupt:
            print("\n\nProgram terminated.")
            break
        except Exception as e:
            print(f"Error: {e}")
            print()


if __name__ == "__main__":
    main()
