# Budget Management AI Agent

An intelligent personal finance management chatbot powered by Google Gemini AI. Manage your expenses and income through natural language conversations.

## Features

- **Natural Language Interface**: Talk to the AI agent in Korean or English
- **Expense & Income Tracking**: Add, search, and delete financial transactions
- **Budget Management**: Set monthly budgets by category and track spending
- **Financial Analysis**: Get insights into spending patterns and category breakdowns
- **Persistent Storage**: All data saved to JSON files for future reference
- **Error Recovery**: Robust error handling and validation throughout

## Requirements

- Python 3.8 or higher
- Google Gemini API key
- Internet connection

## Installation

### 1. Clone or download the project
```bash
cd Budget_Management
```

### 2. Create a virtual environment (optional but recommended)
```bash
python -m venv venv
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up environment variables
Create a `.env` file in the project root:
```bash
cp .env.example .env
```

Then edit `.env` and add your Gemini API key:
```
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.0-flash
```

Get your API key from: https://ai.google.dev/

## Usage

### Interactive Mode
```bash
python main.py
```

Then start talking to the agent:
```
User: I spent 15,000 won on lunch today
Agent: Lunch food expense of 15,000 won has been registered for today (2026-08-31).
```

### Test Mode
Run the test script to see example conversations:
```bash
python test_agent.py
```

## Example Commands

- **Add expense**: "I spent 12,000 won on coffee"
- **Check expenses**: "Show me my food expenses for August"
- **Set budget**: "Set my food budget for September to 600,000 won"
- **View budget status**: "How much food budget do I have left?"
- **Analyze spending**: "Analyze my spending for August by category"

## Project Structure

```
Budget_Management/
├── main.py                 # CLI interface and main entry point
├── agent.py               # AI agent with tool orchestration
├── tools.py               # Financial tool functions and utilities
├── test_agent.py          # Test script with example conversations
├── .env.example           # Environment variables template
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── Budget_Management.ipynb # Jupyter notebook version (legacy)
└── expense_data/          # Data directory (auto-created)
    ├── transactions.json  # Expense and income records
    └── budgets.json       # Budget information
```

## Key Files

### tools.py
Contains 10 financial management functions:
- `add_expense()` / `add_income()` - Record transactions
- `search_expense()` / `search_income()` - Query transactions
- `update_expense()` / `delete_expense()` - Modify transactions
- `set_budget()` / `check_budget()` - Budget management
- `analyze_by_month()` / `get_category_ratio()` - Financial analysis

### agent.py
Implements the AI agent:
- Defines available tools for the AI
- Executes tool calls with error handling
- Manages conversation flow with Gemini API
- Handles tool results and passes them back to AI

### main.py
Command-line interface:
- Interactive conversation loop
- User input handling
- Response formatting and display
- Error management

## Architecture

The project follows a standard AI agent architecture:

```
User Input
    ↓
AI Agent (Gemini)
    ↓
Tool Selection
    ↓
Execute Tool (add_expense, search, etc.)
    ↓
Tool Result
    ↓
AI Formatting
    ↓
User Output
```

## Data Storage

All data is stored as JSON files for simplicity:
- **transactions.json**: Records of all expenses and income
- **budgets.json**: Monthly budget settings

IDs are generated using the maximum existing ID + 1 to avoid collisions when deleting records.

## Error Handling

The agent includes comprehensive error handling:
- Invalid inputs are validated before processing
- API errors are caught and reported to the user
- Tool execution failures are logged and communicated
- Graceful degradation for missing data

## Future Improvements

- Database migration (JSON → SQLite/PostgreSQL)
- User authentication for multi-user support
- Export to CSV/Excel formats
- Recurring transaction templates
- Budget alerts and notifications
- Mobile app version

## Troubleshooting

### "API key not found" error
- Make sure `.env` file exists
- Check that `GEMINI_API_KEY` is set correctly
- Verify the key is active on Google AI Studio

### "Module not found" error
- Run `pip install -r requirements.txt`
- Check Python version (3.8+ required)

### No response from agent
- Check internet connection
- Verify API key is valid
- Check if Gemini API service is available

## License

Personal project for educational purposes.

## Author

Created as a learning project for AI agent architecture and LLM integration.
