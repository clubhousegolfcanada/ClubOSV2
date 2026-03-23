"""
RBC Business Chequing PDF parser.

Extracts transactions from RBC chequing/tax-holding account statements
using pdfplumber word-position extraction. Handles:
- Variable column positions per page (detected from column headers)
- Date forward-filling
- Doubled character artifacts on continuation pages
- Multi-line descriptions
- Opening/closing balance validation
"""

import re
import hashlib
from datetime import datetime, date
from pathlib import Path
from typing import Optional, Tuple, List, Dict

import pdfplumber

# Month abbreviations used in RBC statements
MONTH_ABBRS = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

# Full month names for statement period header
MONTH_FULL = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
}


def file_hash(filepath: str) -> str:
    """SHA-256 hash of file contents, first 16 hex chars."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def deduplicate_chars(text: str) -> str:
    """Fix doubled-character artifacts from PDF rendering.

    E.g., '1155' -> '15', 'SSeepp' -> 'Sep', 'OOcctt' -> 'Oct'
    Only applies when every character is doubled consecutively.
    """
    if len(text) < 2 or len(text) % 2 != 0:
        return text
    deduped = ""
    for i in range(0, len(text), 2):
        if text[i] != text[i + 1]:
            return text  # Not all doubled, return original
        deduped += text[i]
    return deduped


def parse_amount(text: str) -> float:
    """Parse a dollar amount string: strip $, commas, handle negatives."""
    text = text.replace("$", "").replace(",", "").strip()
    return float(text)


def is_amount_str(text: str) -> bool:
    """Check if a string looks like a dollar amount."""
    cleaned = text.replace("$", "").replace(",", "").replace("-", "").strip()
    return bool(re.match(r"^\d+\.\d{2}$", cleaned))


def parse_date_str(day_str: str, month_str: str) -> tuple[int, str]:
    """Parse day and month abbreviation, return (day, month_abbr).

    Handles doubled-character artifacts.
    """
    day_str = deduplicate_chars(day_str)
    month_str = deduplicate_chars(month_str)

    day = int(day_str)
    # Normalize month abbreviation
    if month_str not in MONTH_ABBRS:
        # Try case-insensitive match
        for abbr in MONTH_ABBRS:
            if month_str.lower() == abbr.lower():
                month_str = abbr
                break
    return day, month_str


def group_words_by_row(words: list, y_tolerance: float = 3.0) -> dict:
    """Group words into rows by y-coordinate with tolerance.

    Words within y_tolerance pixels of each other are in the same row.
    Returns dict mapping canonical y -> list of words.
    """
    if not words:
        return {}

    sorted_words = sorted(words, key=lambda w: w["top"])
    rows = {}
    current_y = sorted_words[0]["top"]
    current_key = int(current_y)
    rows[current_key] = [sorted_words[0]]

    for w in sorted_words[1:]:
        if abs(w["top"] - current_y) <= y_tolerance:
            rows[current_key].append(w)
        else:
            current_y = w["top"]
            current_key = int(current_y)
            # Handle rare case where int(y) collides with existing key
            while current_key in rows:
                current_key += 1
            rows[current_key] = [w]

    return rows


def detect_column_boundaries(words: list) -> Optional[dict]:
    """Detect column boundaries from the header row on a page.

    Looks for the row containing 'Description' and 'Cheques' (or similar)
    and returns the x-positions for column classification.
    """
    rows_by_y = group_words_by_row(words)

    for y_key in sorted(rows_by_y):
        row_words = rows_by_y[y_key]
        row_text = " ".join(w["text"] for w in row_words)

        # Look for the column header row
        if "Description" in row_text and ("Cheques" in row_text or "Debits" in row_text):
            boundaries = {}
            for w in row_words:
                text = w["text"]
                if text == "Date":
                    boundaries["date_x0"] = w["x0"]
                elif text == "Description":
                    boundaries["desc_x0"] = w["x0"]
                elif "Cheques" in text or "Debits" in text:
                    boundaries["debit_x0"] = w["x0"]
                    boundaries["debit_x1"] = w["x1"]
                elif "Deposits" in text or "Credits" in text:
                    boundaries["credit_x0"] = w["x0"]
                    boundaries["credit_x1"] = w["x1"]
                elif "Balance" in text:
                    boundaries["balance_x1"] = w["x1"]

            if len(boundaries) >= 4:
                debit_x0 = boundaries.get("debit_x0", 290)
                debit_x1 = boundaries.get("debit_x1", 390)
                credit_x0 = boundaries.get("credit_x0", 390)
                credit_x1 = boundaries.get("credit_x1", 493)
                balance_x1 = boundaries.get("balance_x1", 593)
                desc_x0 = boundaries.get("desc_x0", 90)
                date_x0 = boundaries.get("date_x0", 45)

                # The minimum x0 for an amount to be classified as debit/credit/balance
                # is the left edge of the debit column header minus a margin.
                # This prevents description-zone numbers (e.g., "2.50" in fee text)
                # from being classified as amounts.
                amount_min_x0 = debit_x0 - 30

                return {
                    "date_x0": date_x0,
                    "desc_x0": desc_x0,
                    "header_y": y_key,
                    "amount_min_x0": amount_min_x0,
                    "debit_max_x1": debit_x1 + 5,
                    "credit_max_x1": credit_x1 + 5,
                    "balance_min_x1": credit_x1 + 5,
                }

    return None


def classify_word(w: dict, bounds: dict) -> str:
    """Classify a word into a column based on its x-position."""
    x0 = w["x0"]
    x1 = w["x1"]

    # Date column: left of description start
    if x0 < bounds["desc_x0"] - 5:
        return "date"

    # Amount columns: must be right-aligned AND positioned past the description zone.
    # x0 must be past amount_min_x0 to avoid classifying description-zone numbers
    # (e.g., "2.50" in "1 Cr @ 2.50") as amounts.
    if is_amount_str(w["text"]) and x0 >= bounds["amount_min_x0"]:
        if x1 <= bounds["debit_max_x1"]:
            return "debit"
        elif x1 <= bounds["credit_max_x1"]:
            return "credit"
        else:
            return "balance"

    # Everything else in the description zone
    if x0 >= bounds["desc_x0"] - 5:
        return "description"

    return "unknown"


def is_skip_row(row_text: str) -> bool:
    """Check if a row should be skipped (headers, footers, etc.)."""
    skip_patterns = [
        r"^\d+of\d+$",           # Page footer "1of3"
        r"^Business\s*Account",   # Page header
        r"^Account\s*Activity",   # Section header
        r"^Account\s*Summary",    # Summary header
        r"^Date\s*Description",   # Column header
        r"^Opening\s*balance",    # Opening balance line (handled separately)
        r"^Closing\s*balance",    # Closing balance line (handled separately)
        r"^Account\s*Fees",       # Fee summary
        r"^Account\s*number",     # Account number header
        r"^ROYAL\s*BANK",         # Bank name
        r"^P\.O\.BOX",            # Address
        r"^MONTREAL",             # Address
        r"^CLUBHOUSE",            # Company name
        r"^SUITE\s+\d",           # Address
        r"^\d+\s+WEST\s+ST",     # Address
        r"^HALIFAX",              # Address
        r"^RBC\s*Digital",        # Account type
        r"^Royal\s*Bank",         # Bank reference
        r"^How\s*to\s*reach",     # Contact info
        r"^Please\s*contact",     # Contact info
        r"www\.",                  # URL
        r"^\(?\d{1,4}-\d{3}-\d{4}",  # Phone number
        r"^1-800",                # Phone number
        r"^Total\s+deposits",     # Summary totals
        r"^Total\s+cheques",      # Summary totals
        r"^Closing\s+balance",    # Summary closing
        r"^Opening\s+balance",    # Summary opening
        r"^September|^October|^November|^December|^January|^February|^March|^April|^May|^June|^July|^August",
        r"^continued$",          # Continuation marker
    ]
    for pat in skip_patterns:
        if re.search(pat, row_text, re.IGNORECASE):
            return True
    return False


def is_etransfer_hash(row_text: str) -> bool:
    """Check if a row is an e-transfer reference hash (32-char hex)."""
    cleaned = row_text.strip()
    return bool(re.match(r"^[a-f0-9]{32}$", cleaned))


def extract_statement_period(words: list) -> Optional[Tuple[date, date]]:
    """Extract the statement period from the first page header.

    Looks for pattern like: "September 5, 2025 to October 6, 2025"
    """
    full_text = " ".join(w["text"] for w in words)

    # Match pattern: Month DD, YYYY to Month DD, YYYY
    pattern = r"(" + "|".join(MONTH_FULL.keys()) + r")\s+(\d{1,2}),?\s+(\d{4})\s+to\s+(" + "|".join(MONTH_FULL.keys()) + r")\s+(\d{1,2}),?\s+(\d{4})"
    match = re.search(pattern, full_text)
    if match:
        start_month = MONTH_FULL[match.group(1)]
        start_day = int(match.group(2))
        start_year = int(match.group(3))
        end_month = MONTH_FULL[match.group(4)]
        end_day = int(match.group(5))
        end_year = int(match.group(6))
        return (
            date(start_year, start_month, start_day),
            date(end_year, end_month, end_day),
        )
    return None


def extract_account_number(words: list) -> Optional[str]:
    """Extract account number from header, e.g., '01554 100-190-8' -> '1908'."""
    full_text = " ".join(w["text"] for w in words)
    # Look for pattern like "100-190-8" or "100-055-1" or "100-070-0"
    match = re.search(r"(\d{3})-(\d{3})-(\d)", full_text)
    if match:
        return match.group(1) + match.group(2) + match.group(3)
    # Alternative: "Accountnumber: 01554 100-190-8"
    match = re.search(r"Accountnumber:\s*\d+\s+(\d{3}-\d{3}-\d)", full_text)
    if match:
        return match.group(1).replace("-", "")
    return None


def extract_summary(words: list[dict]) -> dict:
    """Extract summary values from page 1: opening/closing balance, totals."""
    summary = {}
    full_text = " ".join(w["text"] for w in words)

    # Opening balance
    match = re.search(r"Opening\s+balance.*?\$?([\d,]+\.\d{2})", full_text)
    if match:
        summary["opening_balance"] = parse_amount(match.group(1))

    # Closing balance (in summary section)
    match = re.search(r"Closing\s+balance.*?=?\s*\$?([\d,]+\.\d{2})", full_text)
    if match:
        summary["closing_balance"] = parse_amount(match.group(1))

    # Total deposits & credits (count)
    match = re.search(r"Total\s+deposits\s+&\s+credits\s+\((\d+)\).*?([\d,]+\.\d{2})", full_text)
    if match:
        summary["credit_count"] = int(match.group(1))
        summary["credit_total"] = parse_amount(match.group(2))

    # Total cheques & debits (count)
    match = re.search(r"Total\s+cheques\s+&\s+debits\s+\((\d+)\).*?([\d,]+\.\d{2})", full_text)
    if match:
        summary["debit_count"] = int(match.group(1))
        summary["debit_total"] = parse_amount(match.group(2))

    return summary


def extract_opening_balance(page_words: list, bounds: dict) -> Optional[float]:
    """Extract the opening balance from the first transaction page."""
    rows_by_y = group_words_by_row(page_words)

    for y_key in sorted(rows_by_y):
        row_words = rows_by_y[y_key]
        row_text = " ".join(w["text"] for w in row_words)
        if "Opening" in row_text and "balance" in row_text:
            # Find the balance amount on this row
            for w in row_words:
                if is_amount_str(w["text"]) and w["x1"] > bounds.get("balance_min_x1", 500):
                    return parse_amount(w["text"])
    return None


def extract_transactions_from_page(
    page, page_num: int, statement_period: Tuple[date, date],
    carry_date: Optional[Tuple[int, str]] = None
) -> Tuple[list, Optional[Tuple[int, str]]]:
    """Extract transaction rows from a single page.

    Returns (transactions, last_date) where last_date is carried to the next page.
    Each transaction is a dict with keys: day, month_str, description, debit, credit, balance.
    """
    words = page.extract_words(x_tolerance=2, y_tolerance=3)
    if not words:
        return [], carry_date

    bounds = detect_column_boundaries(words)
    if not bounds:
        return [], carry_date

    # Group words by y-coordinate with tolerance
    rows_by_y = group_words_by_row(words)

    transactions = []
    current_date = carry_date  # (day, month_abbr)
    # Pending transaction: a description-only row that may get its amount
    # from the next row (e.g., e-Transfer Autodeposit where hash+amount
    # appears on a separate line below the description).
    pending_txn = None

    def flush_pending():
        """Flush any pending transaction as description-only (no amount)."""
        nonlocal pending_txn
        if pending_txn is not None:
            # A description-only row that never got an amount —
            # append it as description continuation to the last real transaction
            if transactions:
                transactions[-1]["description"] += " " + pending_txn["description"]
            pending_txn = None

    # Process rows in y-order, starting after the header
    for y_key in sorted(rows_by_y):
        if y_key <= bounds["header_y"] + 5:
            continue  # Skip header area

        row_words = sorted(rows_by_y[y_key], key=lambda w: w["x0"])
        row_text = " ".join(w["text"] for w in row_words)

        # Skip non-transaction rows
        if is_skip_row(row_text):
            continue

        # Skip page footer
        if re.match(r"^\d+of\d+$", row_text.replace(" ", "")):
            continue

        # Handle "Opening balance" row — skip (captured in summary)
        if "Opening" in row_text and "balance" in row_text:
            continue

        # Handle "Closing balance" row
        if "Closing" in row_text and "balance" in row_text:
            continue

        # Handle "Account Fees" summary row
        if "Account" in row_text and "Fees" in row_text:
            continue

        # Classify words in this row
        date_words = []
        desc_words = []
        debit_val = None
        credit_val = None
        balance_val = None

        for w in row_words:
            col = classify_word(w, bounds)
            if col == "date":
                date_words.append(w["text"])
            elif col == "description":
                desc_words.append(w["text"])
            elif col == "debit":
                debit_val = parse_amount(w["text"])
            elif col == "credit":
                credit_val = parse_amount(w["text"])
            elif col == "balance":
                balance_val = parse_amount(w["text"])

        # If we have date words, parse them
        if len(date_words) >= 2:
            try:
                day, month_abbr = parse_date_str(date_words[0], date_words[1])
                current_date = (day, month_abbr)
            except (ValueError, KeyError):
                pass  # Keep previous date

        # Skip rows with no description and no amount
        if not desc_words and debit_val is None and credit_val is None:
            continue

        description = " ".join(desc_words) if desc_words else ""
        has_amount = debit_val is not None or credit_val is not None
        desc_is_hash = is_etransfer_hash(description.replace(" ", ""))

        if has_amount and pending_txn is not None:
            # There's a pending description-only row waiting for an amount.
            # This row provides the amount (possibly with a hash as description).
            pending_txn["debit"] = debit_val
            pending_txn["credit"] = credit_val
            pending_txn["balance"] = balance_val
            transactions.append(pending_txn)
            pending_txn = None
            continue

        if has_amount and not desc_is_hash:
            # Normal complete transaction row: description + amount
            flush_pending()
            txn = {
                "day": current_date[0] if current_date else None,
                "month_str": current_date[1] if current_date else None,
                "description": description,
                "debit": debit_val,
                "credit": credit_val,
                "balance": balance_val,
            }
            transactions.append(txn)
        elif has_amount and desc_is_hash:
            # Hash + amount on same row, no pending — treat hash line amount
            # as a standalone (the description came from a prior line that was
            # already attached as continuation). Create a synthetic txn.
            flush_pending()
            txn = {
                "day": current_date[0] if current_date else None,
                "month_str": current_date[1] if current_date else None,
                "description": "(e-transfer reference)",
                "debit": debit_val,
                "credit": credit_val,
                "balance": balance_val,
            }
            transactions.append(txn)
        elif not has_amount and not desc_is_hash and description:
            # Description-only row. Could be:
            # 1. A new transaction whose amount is on the next row
            # 2. A continuation of the previous transaction's description
            # Heuristic: if the description starts with a known transaction-type
            # keyword, treat it as a new pending transaction.
            if _looks_like_new_transaction(description):
                flush_pending()
                pending_txn = {
                    "day": current_date[0] if current_date else None,
                    "month_str": current_date[1] if current_date else None,
                    "description": description,
                    "debit": None,
                    "credit": None,
                    "balance": None,
                }
            else:
                # Continuation of previous description
                if pending_txn is not None:
                    pending_txn["description"] += " " + description
                elif transactions:
                    transactions[-1]["description"] += " " + description
        elif desc_is_hash and not has_amount:
            # Pure hash line with no amount — skip
            continue

    flush_pending()
    return transactions, current_date


def _looks_like_new_transaction(desc: str) -> bool:
    """Check if a description looks like the start of a new transaction.

    Used to distinguish between a new transaction whose amount is on the next
    row vs. a continuation of the previous transaction's multi-line description.
    """
    patterns = [
        r"^e-Transfer",
        r"^Misc\s+Payment",
        r"^Online\s+Banking",
        r"^Funds\s+transfer",
        r"^Loan\b",
        r"^Insurance\b",
        r"^Interac\s+purchase",
        r"^Deposit\b",
        r"^Item\s+Paid",
        r"^Monthly\s+fee",
        r"^COMM\s+GAS",
        r"^Utility\s+Bill",
        r"^Telephone\s+Bill",
        r"^Regular\s+transaction",
        r"^Overdraft",
    ]
    for pat in patterns:
        if re.match(pat, desc, re.IGNORECASE):
            return True
    return False


def resolve_transaction_dates(
    transactions: list[dict], statement_start: date, statement_end: date
) -> list[dict]:
    """Resolve month abbreviations to full dates using statement period context.

    Statement periods cross month boundaries (e.g., Sep 5 to Oct 6).
    We need to figure out the year for each month abbreviation.
    """
    start_year = statement_start.year
    end_year = statement_end.year
    start_month = statement_start.month
    end_month = statement_end.month

    for txn in transactions:
        if txn["day"] is None or txn["month_str"] is None:
            continue

        month_num = MONTH_ABBRS.get(txn["month_str"])
        if month_num is None:
            continue

        # Determine the year: if the month is >= statement start month and
        # we're not crossing a year boundary, use start_year.
        # If crossing year boundary (e.g., Dec -> Jan), Jan gets end_year.
        if start_year == end_year:
            year = start_year
        else:
            # Year boundary crossing (e.g., Dec 2025 -> Jan 2026)
            if month_num >= start_month:
                year = start_year
            else:
                year = end_year

        try:
            txn["txn_date"] = date(year, month_num, txn["day"])
        except ValueError:
            # Invalid date (e.g., Feb 30) — skip
            txn["txn_date"] = None

    return transactions


def generate_txn_ids(transactions: list[dict], account: str) -> list[dict]:
    """Generate stable, deterministic transaction IDs.

    Format: CHQ-{last4}-{YYYYMMDD}-{seq}
    Sequence is per-date, based on statement order.
    """
    last4 = account.split("_")[-1]

    # Count transactions per date to generate sequence numbers
    date_counts = {}
    for txn in transactions:
        txn_date = txn.get("txn_date")
        if txn_date is None:
            continue
        date_key = txn_date.isoformat()
        date_counts.setdefault(date_key, 0)
        date_counts[date_key] += 1
        txn["_seq"] = date_counts[date_key]

    # Now generate IDs
    # Reset date_counts to track sequence within each date
    date_seq = {}
    for txn in transactions:
        txn_date = txn.get("txn_date")
        if txn_date is None:
            continue
        date_key = txn_date.strftime("%Y%m%d")
        date_seq.setdefault(date_key, 0)
        date_seq[date_key] += 1
        seq = date_seq[date_key]
        txn["txn_id"] = f"CHQ-{last4}-{date_key}-{seq:03d}"

    return transactions


def parse_chequing_pdf(filepath: str, account: str) -> dict:
    """Parse an RBC chequing/tax-holding PDF statement.

    Args:
        filepath: Path to the PDF file
        account: Account identifier (e.g., 'chequing_1908', 'tax_holding_0700')

    Returns:
        dict with keys:
            - transactions: list of transaction dicts ready for DB insertion
            - summary: statement summary (opening/closing balance, totals)
            - statement_start: start date of statement period
            - statement_end: end date of statement period
            - file_hash: SHA-256 hash of the PDF file
            - validation: validation results
    """
    fhash = file_hash(filepath)

    with pdfplumber.open(filepath) as pdf:
        if not pdf.pages:
            return {"error": "Empty PDF", "file_hash": fhash}

        # Extract statement period and summary from page 1
        page1_words = pdf.pages[0].extract_words(x_tolerance=2, y_tolerance=3)
        period = extract_statement_period(page1_words)
        if period is None:
            return {"error": "Could not parse statement period", "file_hash": fhash}

        statement_start, statement_end = period
        summary = extract_summary(page1_words)

        # Extract transactions from all pages
        all_transactions = []
        carry_date = None

        for page_num, page in enumerate(pdf.pages):
            page_txns, carry_date = extract_transactions_from_page(
                page, page_num, (statement_start, statement_end), carry_date
            )
            all_transactions.extend(page_txns)

        # Resolve dates
        all_transactions = resolve_transaction_dates(
            all_transactions, statement_start, statement_end
        )

        # Generate transaction IDs
        all_transactions = generate_txn_ids(all_transactions, account)

        # Validate
        validation = validate_extraction(all_transactions, summary)

        # Format for database insertion
        db_transactions = []
        for txn in all_transactions:
            if txn.get("txn_date") is None:
                continue
            db_txn = {
                "txn_id": txn["txn_id"],
                "account": account,
                "card": None,
                "txn_date": txn["txn_date"].isoformat(),
                "posting_date": None,
                "description": txn["description"],
                "debit": txn.get("debit"),
                "credit": txn.get("credit"),
                "balance": txn.get("balance"),
                "currency": "CAD",
                "fx_rate": None,
                "cad_amount": None,
                "visa_ref": None,
                "source_pdf_hash": fhash,
            }
            db_transactions.append(db_txn)

        return {
            "transactions": db_transactions,
            "summary": summary,
            "statement_start": statement_start.isoformat(),
            "statement_end": statement_end.isoformat(),
            "file_hash": fhash,
            "validation": validation,
            "raw_count": len(all_transactions),
        }


def validate_extraction(transactions: list[dict], summary: dict) -> dict:
    """Validate extracted transactions against statement summary."""
    results = {"passed": True, "errors": []}

    # Count debits and credits
    debit_count = sum(1 for t in transactions if t.get("debit") is not None)
    credit_count = sum(1 for t in transactions if t.get("credit") is not None)

    debit_total = sum(t["debit"] for t in transactions if t.get("debit") is not None)
    credit_total = sum(t["credit"] for t in transactions if t.get("credit") is not None)

    results["debit_count"] = debit_count
    results["credit_count"] = credit_count
    results["debit_total"] = round(debit_total, 2)
    results["credit_total"] = round(credit_total, 2)
    results["total_count"] = debit_count + credit_count

    # Check against summary
    if "debit_count" in summary:
        if debit_count != summary["debit_count"]:
            results["passed"] = False
            results["errors"].append(
                f"Debit count mismatch: extracted {debit_count}, "
                f"expected {summary['debit_count']}"
            )

    if "credit_count" in summary:
        if credit_count != summary["credit_count"]:
            results["passed"] = False
            results["errors"].append(
                f"Credit count mismatch: extracted {credit_count}, "
                f"expected {summary['credit_count']}"
            )

    if "debit_total" in summary:
        if abs(debit_total - summary["debit_total"]) > 0.02:
            results["passed"] = False
            results["errors"].append(
                f"Debit total mismatch: extracted {debit_total:.2f}, "
                f"expected {summary['debit_total']:.2f}"
            )

    if "credit_total" in summary:
        if abs(credit_total - summary["credit_total"]) > 0.02:
            results["passed"] = False
            results["errors"].append(
                f"Credit total mismatch: extracted {credit_total:.2f}, "
                f"expected {summary['credit_total']:.2f}"
            )

    # Balance check: opening + credits - debits = closing
    if "opening_balance" in summary and "closing_balance" in summary:
        expected_closing = summary["opening_balance"] + credit_total - debit_total
        if abs(expected_closing - summary["closing_balance"]) > 0.02:
            results["passed"] = False
            results["errors"].append(
                f"Balance check failed: {summary['opening_balance']:.2f} "
                f"+ {credit_total:.2f} - {debit_total:.2f} = {expected_closing:.2f}, "
                f"expected closing {summary['closing_balance']:.2f}"
            )
        else:
            results["balance_verified"] = True

    return results


def identify_account_from_filename(filename: str) -> Optional[str]:
    """Determine account identifier from statement filename.

    Patterns:
        'General Account Statement-1908 ...' -> 'chequing_1908'
        'Build Account (Nick) Statement-0551 ...' -> 'chequing_0551'
        'Tax Holding Statement-0700 ...' -> 'tax_holding_0700'
    """
    filename_lower = filename.lower()

    if "general account" in filename_lower:
        match = re.search(r"statement-(\d{4})", filename_lower)
        if match:
            return f"chequing_{match.group(1)}"
    elif "build account" in filename_lower:
        match = re.search(r"statement-(\d{4})", filename_lower)
        if match:
            return f"chequing_{match.group(1)}"
    elif "tax holding" in filename_lower:
        match = re.search(r"statement-(\d{4})", filename_lower)
        if match:
            return f"tax_holding_{match.group(1)}"

    return None


if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) < 2:
        print("Usage: python extract_chequing.py <pdf_path> [account]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    account = sys.argv[2] if len(sys.argv) > 2 else None

    if account is None:
        account = identify_account_from_filename(Path(pdf_path).name)
        if account is None:
            print(f"Could not determine account from filename: {Path(pdf_path).name}")
            sys.exit(1)

    result = parse_chequing_pdf(pdf_path, account)

    if "error" in result:
        print(f"ERROR: {result['error']}")
        sys.exit(1)

    print(f"\n=== Statement: {result['statement_start']} to {result['statement_end']} ===")
    print(f"Account: {account}")
    print(f"Transactions extracted: {result['raw_count']}")
    print(f"\nValidation:")
    v = result["validation"]
    print(f"  Debits:  {v['debit_count']} txns, ${v['debit_total']:,.2f}")
    print(f"  Credits: {v['credit_count']} txns, ${v['credit_total']:,.2f}")
    if v.get("balance_verified"):
        print(f"  Balance: VERIFIED ✓")
    if not v["passed"]:
        print(f"  ERRORS:")
        for err in v["errors"]:
            print(f"    - {err}")
    else:
        print(f"  All checks PASSED ✓")

    print(f"\nFirst 5 transactions:")
    for txn in result["transactions"][:5]:
        amt = f"-${txn['debit']:,.2f}" if txn['debit'] else f"+${txn['credit']:,.2f}"
        bal = f"  bal={txn['balance']:,.2f}" if txn['balance'] else ""
        print(f"  {txn['txn_id']}  {txn['txn_date']}  {amt:>12}  {txn['description'][:50]}{bal}")

    print(f"\nLast 5 transactions:")
    for txn in result["transactions"][-5:]:
        amt = f"-${txn['debit']:,.2f}" if txn['debit'] else f"+${txn['credit']:,.2f}"
        bal = f"  bal={txn['balance']:,.2f}" if txn['balance'] else ""
        print(f"  {txn['txn_id']}  {txn['txn_date']}  {amt:>12}  {txn['description'][:50]}{bal}")
