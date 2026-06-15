#!/bin/bash
# Move to the web project directory
cd "$(dirname "$0")/homework-repo-web"

# Activate Python virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run the app
python run.py
