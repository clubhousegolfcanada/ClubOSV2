#!/usr/bin/env python3
"""
Bank statement PDF parser entry point.
Called from Node.js via child_process.

Usage:
  python3 parse_statement.py <pdf_path> <account_type>

Prints JSON to stdout with extracted transactions.
"""

import json
import sys
import os
import re

# Add parent dir so we can import the parsers
sys.path.insert(0, os.path.dirname(__file__))

from extract_chequing import parse_chequing_pdf
from extract_visa import parse_visa_pdf

# Account detection from filename
ACCOUNT_PATTERNS = {
    r"General.*Account.*1908": "chequing_1908",
    r"Build.*Account.*0551": "chequing_0551",
    r"Tax.*Holding.*0700": "tax_holding_0700",
    r"Visa.*7542": "visa_7542",
    r"Visa.*8407": "visa_8407",
    r"1908": "chequing_1908",
    r"0551": "chequing_0551",
    r"0700": "tax_holding_0700",
    r"7542": "visa_7542",
    r"8407": "visa_8407",
}


def detect_account(filename):
    for pattern, account in ACCOUNT_PATTERNS.items():
        if re.search(pattern, filename, re.IGNORECASE):
            return account
    return None


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: parse_statement.py <pdf_path> [account_type]"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    account = sys.argv[2] if len(sys.argv) > 2 else None

    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    # Auto-detect account from filename if not provided
    if not account:
        account = detect_account(os.path.basename(pdf_path))
    if not account:
        print(json.dumps({"error": f"Could not detect account type from filename. Provide account as 2nd arg."}))
        sys.exit(1)

    # Run appropriate parser
    try:
        if account.startswith("visa_"):
            result = parse_visa_pdf(pdf_path, account)
        elif account.startswith("chequing_") or account.startswith("tax_"):
            result = parse_chequing_pdf(pdf_path, account)
        else:
            print(json.dumps({"error": f"Unknown account type: {account}"}))
            sys.exit(1)

        if "error" in result:
            print(json.dumps({"error": result["error"]}))
            sys.exit(1)

        # Output JSON
        output = {
            "success": True,
            "account": account,
            "account_type": "visa" if account.startswith("visa_") else "chequing",
            "statement_start": result.get("statement_start"),
            "statement_end": result.get("statement_end"),
            "transaction_count": len(result.get("transactions", [])),
            "transactions": result.get("transactions", []),
            "validation": result.get("validation", {}),
            "summary": result.get("summary", {}),
        }
        print(json.dumps(output, default=str))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
