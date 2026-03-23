"""
RBC Visa Business PDF parser.

Extracts transactions from RBC Visa statements using pdfplumber
word-position extraction. Handles:
- Two cardholder sections per statement (e.g., card 8407 + card 8415)
- Multi-line transactions: line 1 = data, line 2 = 23-digit ref, line 3 = FX
- Signed amounts (positive = purchase, negative = payment/credit)
- Statement-level validation against CALCULATING YOUR BALANCE section
"""

import re
import hashlib
from datetime import date
from pathlib import Path
from typing import Optional, Tuple, List

import pdfplumber

MONTH_ABBRS = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}


def file_hash(filepath: str) -> str:
    """SHA-256 hash of file contents, first 16 hex chars."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def parse_visa_amount(text: str) -> float:
    """Parse Visa amount string. Handles -$X,XXX.XX and $X,XXX.XX formats."""
    text = text.strip()
    negative = text.startswith("-")
    cleaned = text.replace("-", "").replace("$", "").replace(",", "")
    val = float(cleaned)
    return -val if negative else val


def is_visa_amount(text: str) -> bool:
    """Check if text looks like a Visa statement amount."""
    cleaned = text.replace("-", "").replace("$", "").replace(",", "").strip()
    return bool(re.match(r"^\d+\.\d{2}$", cleaned))


def is_reference_number(text: str) -> bool:
    """Check if text is a 23-digit Visa reference number."""
    return bool(re.match(r"^\d{23}$", text.strip()))


def is_month_abbr(text: str) -> bool:
    """Check if text is a 3-letter month abbreviation (uppercase)."""
    return text.upper() in MONTH_ABBRS


def group_words_by_row(words: list, y_tolerance: float = 3.0) -> dict:
    """Group words into rows by y-coordinate with tolerance."""
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
            while current_key in rows:
                current_key += 1
            rows[current_key] = [w]
    return rows


def extract_visa_statement_period(words: list) -> Optional[Tuple[date, date]]:
    """Extract statement period from Visa header.

    Handles two formats:
    1. "STATEMENT FROM SEP 23 TO OCT 20, 2025"  (single year at end)
    2. "STATEMENT FROM DEC 23, 2025 TO JAN 20, 2026"  (year on each date)
    """
    full_text = " ".join(w["text"] for w in words)
    months = "|".join(MONTH_ABBRS.keys())

    # Format 2: both dates have year — "FROM DEC 23, 2025 TO JAN 20, 2026"
    pattern2 = (
        r"FROM\s+(" + months + r")\s+(\d{1,2}),?\s+(\d{4})\s+"
        r"TO\s+(" + months + r")\s+(\d{1,2}),?\s+(\d{4})"
    )
    match = re.search(pattern2, full_text, re.IGNORECASE)
    if match:
        start_month = MONTH_ABBRS[match.group(1).upper()]
        start_day = int(match.group(2))
        start_year = int(match.group(3))
        end_month = MONTH_ABBRS[match.group(4).upper()]
        end_day = int(match.group(5))
        end_year = int(match.group(6))
        return (
            date(start_year, start_month, start_day),
            date(end_year, end_month, end_day),
        )

    # Format 1: single year at end — "FROM SEP 23 TO OCT 20, 2025"
    pattern1 = (
        r"FROM\s+(" + months + r")\s+(\d{1,2})\s+"
        r"TO\s+(" + months + r")\s+(\d{1,2}),?\s+(\d{4})"
    )
    match = re.search(pattern1, full_text, re.IGNORECASE)
    if match:
        start_month = MONTH_ABBRS[match.group(1).upper()]
        start_day = int(match.group(2))
        end_month = MONTH_ABBRS[match.group(3).upper()]
        end_day = int(match.group(4))
        year = int(match.group(5))

        # Handle year boundary: if start month > end month, start is previous year
        start_year = year - 1 if start_month > end_month else year
        end_year = year

        return (
            date(start_year, start_month, start_day),
            date(end_year, end_month, end_day),
        )
    return None


def extract_visa_summary(words: list) -> dict:
    """Extract the CALCULATING YOUR BALANCE section from page 1."""
    summary = {}
    full_text = " ".join(w["text"] for w in words)

    # Previous Statement Balance
    match = re.search(
        r"PREVIOUS\s+STATEMENT\s+BALANCE\s+(-?\$?[\d,]+\.\d{2})", full_text
    )
    if match:
        summary["previous_balance"] = parse_visa_amount(match.group(1))

    # Payments & credits
    match = re.search(
        r"Payments\s+&\s+credits\s+(-?\$?[\d,]+\.\d{2})", full_text
    )
    if match:
        summary["payments_credits"] = parse_visa_amount(match.group(1))

    # Purchases & debits
    match = re.search(
        r"Purchases\s+&\s+debits\s+(-?\$?[\d,]+\.\d{2})", full_text
    )
    if match:
        summary["purchases_debits"] = parse_visa_amount(match.group(1))

    # Cash advances — require $ to avoid matching "Cash advances 22.99%" rate
    match = re.search(
        r"Cash\s+advances\s+(-?\$[\d,]+\.\d{2})", full_text
    )
    if match:
        summary["cash_advances"] = parse_visa_amount(match.group(1))

    # Interest — require $ to avoid matching "Interest Rate" percentages
    match = re.search(
        r"(?<!\w)Interest\s+(-?\$[\d,]+\.\d{2})", full_text
    )
    if match:
        summary["interest"] = parse_visa_amount(match.group(1))

    # Fees — require $ to avoid matching fee rate percentages
    match = re.search(
        r"(?<!\w)Fees\s+(-?\$[\d,]+\.\d{2})", full_text
    )
    if match:
        summary["fees"] = parse_visa_amount(match.group(1))

    # CREDIT BALANCE or NEW BALANCE
    match = re.search(
        r"(?:CREDIT\s+BALANCE|NEW\s+BALANCE)\s+(-?\$?[\d,]+\.\d{2})", full_text
    )
    if match:
        summary["new_balance"] = parse_visa_amount(match.group(1))

    return summary


def detect_card_sections(pages_words: list) -> list:
    """Detect cardholder section boundaries across all pages.

    Returns list of (card_number, page_num, start_y) tuples indicating where
    each card's transaction section begins.
    """
    sections = []

    for page_num, words in enumerate(pages_words):
        rows = group_words_by_row(words)
        for y_key in sorted(rows):
            row_words = sorted(rows[y_key], key=lambda w: w["x0"])
            row_text = " ".join(w["text"] for w in row_words)

            # Look for card number patterns in section headers
            # Pattern: "LIMIT / 4516 07** **** 8407" or card number at end
            # or "4516 07** **** 8415"
            card_match = re.search(r"\*{4}\s+(\d{4})", row_text)
            if card_match:
                card_num = card_match.group(1)
                # Check if this is a section header (not just the page header)
                # Section headers for the secondary card are centered
                # and may contain "(continued)"
                first_x0 = row_words[0]["x0"] if row_words else 0

                # The page header shows both cards on lines at x0~59
                # The actual section divider for the secondary card
                # appears centered (x0 > 100) with just the card info
                if "SUBTOTAL" not in row_text:
                    sections.append((card_num, page_num, y_key))

    return sections


def parse_visa_page_transactions(
    page, page_num: int, statement_period: Tuple[date, date],
    current_card: str, account_last4: str,
) -> Tuple[list, Optional[str]]:
    """Extract transactions from a single Visa page.

    Returns (transactions, updated_card) where transactions is a list of
    raw transaction dicts and updated_card is the card active at end of page.

    IMPORTANT: Page 1 has a dual-column layout. The right column (x0 > 370)
    contains summary info (balance, contact details, interest rates) that must
    be filtered out to avoid corrupting transaction amounts and references.
    """
    words = page.extract_words(x_tolerance=2, y_tolerance=3)
    if not words:
        return [], current_card

    # Filter out right-column words (summary/contact info on page 1).
    # Transaction data lives entirely in the left column (x0 < 370).
    # The transaction amount column right-aligns to x1 ~344.7.
    LEFT_COLUMN_MAX_X0 = 370
    left_words = [w for w in words if w["x0"] < LEFT_COLUMN_MAX_X0]

    rows = group_words_by_row(left_words)
    transactions = []
    active_card = current_card

    # Determine amount column right edge from AMOUNT header
    amount_max_x1 = 360  # amounts must have x1 < this to be in the txn column
    for y_key in sorted(rows):
        row_text = " ".join(w["text"] for w in rows[y_key])
        if "AMOUNT" in row_text:
            for w in rows[y_key]:
                if "AMOUNT" in w["text"]:
                    amount_max_x1 = w["x1"] + 15
                    break
            break

    for y_key in sorted(rows):
        row_words = sorted(rows[y_key], key=lambda w: w["x0"])
        row_text = " ".join(w["text"] for w in row_words)

        # 1. Card section detection FIRST (before skip check)
        #    Detect card changes from section divider lines containing **** DDDD
        card_match = re.search(r"\*{4}\s+(\d{4})", row_text)
        if card_match and "SUBTOTAL" not in row_text:
            new_card = card_match.group(1)
            first_x0 = row_words[0]["x0"] if row_words else 0
            # Section dividers for the secondary card are centered (x0 > 100)
            # Page header card lines are at x0 ~59 (left-aligned)
            # Only change card for centered section dividers
            if first_x0 > 100:
                active_card = new_card
            continue  # Skip this row either way (it's a header/divider)

        # 2. Skip non-transaction rows
        if _is_visa_skip_row(row_text):
            continue

        # 3. Check for SUBTOTAL line
        if "SUBTOTAL" in row_text:
            # Extract the FIRST amount on this row (left-column subtotal)
            for w in row_words:
                if is_visa_amount(w["text"]) and w["x1"] < amount_max_x1:
                    transactions.append({
                        "_type": "subtotal",
                        "card": active_card,
                        "amount": parse_visa_amount(w["text"]),
                    })
                    break  # Only take the first (left-column) amount
            continue

        # 4. Check for reference number (23-digit string) — check per-word
        for w in row_words:
            if is_reference_number(w["text"]):
                if transactions and transactions[-1].get("_type") == "transaction":
                    transactions[-1]["visa_ref"] = w["text"]
                break  # Reference found, skip rest of row processing
        else:
            # No reference number found — continue with other checks

            # 5. Check for Foreign Currency line
            if "Foreign" in row_text and "Currency" in row_text:
                if transactions and transactions[-1].get("_type") == "transaction":
                    fx_match = re.search(
                        r"Foreign\s+Currency\s+-\s+(\w+)\s+([\d,.]+)\s+"
                        r"Exchange\s+rate\s+-\s+([\d.]+)",
                        row_text,
                    )
                    if fx_match:
                        transactions[-1]["fx_currency"] = fx_match.group(1)
                        transactions[-1]["fx_amount"] = float(
                            fx_match.group(2).replace(",", "")
                        )
                        transactions[-1]["fx_rate"] = float(fx_match.group(3))
                continue

            # 6. Try to parse as a transaction row
            txn = _parse_visa_transaction_row(
                row_words, statement_period, active_card, account_last4,
                amount_max_x1,
            )
            if txn:
                transactions.append(txn)

    return transactions, active_card


def _parse_visa_transaction_row(
    row_words: list,
    statement_period: Tuple[date, date],
    card: str,
    account_last4: str,
    amount_x1: float,
) -> Optional[dict]:
    """Try to parse a row as a Visa transaction.

    A transaction row has: txn_date, posting_date, description, amount
    """
    if not row_words:
        return None

    txn_date_parts = []
    posting_date_parts = []
    desc_words = []
    amount_val = None

    for w in row_words:
        x0 = w["x0"]
        x1 = w["x1"]
        text = w["text"]

        # Transaction date column: x0 < 85
        if x0 < 85:
            txn_date_parts.append(text)
        # Posting date column: 85 <= x0 < 125
        elif x0 < 125:
            posting_date_parts.append(text)
        # Amount column: right-aligned, check x1 near amount_x1
        elif is_visa_amount(text) and x1 > 290:
            amount_val = parse_visa_amount(text)
        # Description: everything else in the middle
        elif x0 >= 125:
            desc_words.append(text)

    # Need at least a transaction date and an amount to be a valid transaction
    if len(txn_date_parts) < 2 or amount_val is None:
        return None

    # Parse transaction date (MON DD format)
    txn_date = _parse_visa_date(txn_date_parts, statement_period)
    if txn_date is None:
        return None

    # Parse posting date
    posting_date = _parse_visa_date(posting_date_parts, statement_period)

    description = " ".join(desc_words)

    return {
        "_type": "transaction",
        "card": card,
        "txn_date": txn_date,
        "posting_date": posting_date,
        "description": description,
        "amount": amount_val,
        "visa_ref": None,
        "fx_currency": None,
        "fx_amount": None,
        "fx_rate": None,
    }


def _parse_visa_date(parts: list, statement_period: Tuple[date, date]) -> Optional[date]:
    """Parse MON DD date parts into a full date using statement period context."""
    if len(parts) < 2:
        return None

    month_str = parts[0].upper()
    if month_str not in MONTH_ABBRS:
        return None

    try:
        day = int(parts[1])
    except ValueError:
        return None

    month_num = MONTH_ABBRS[month_str]
    start_year = statement_period[0].year
    end_year = statement_period[1].year

    if start_year == end_year:
        year = start_year
    else:
        # Year boundary: months >= start month use start_year
        if month_num >= statement_period[0].month:
            year = start_year
        else:
            year = end_year

    try:
        return date(year, month_num, day)
    except ValueError:
        return None


def _is_visa_skip_row(row_text: str) -> bool:
    """Check if a Visa row should be skipped."""
    skip_patterns = [
        r"^\d+\s+OF\s+\d+$",           # Page footer "1 OF 6"
        r"^RBC.*Visa.*Business",         # Page header
        r"^STATEMENT\s+FROM",            # Statement period line
        r"^PREVIOUS\s+STATEMENT",        # Previous balance line
        r"^TRANSACTION\s+DATE",          # Column header (part 1)
        r"^POSTING\s+DATE",              # Column header (part 2)
        r"^ACTIVITY\s+DESCRIPTION",      # Column header
        r"^AMOUNT\s*\(\$\)",             # Column header
        r"^CALCULATING\s+YOUR",          # Balance section header
        r"^Payments\s+&\s+credits",      # Summary line
        r"^Purchases\s+&\s+debits",      # Summary line
        r"^Cash\s+advances",             # Summary line
        r"^Interest$",                   # Summary line
        r"^Fees$",                       # Summary line
        r"^CREDIT\s+BALANCE",            # Balance line
        r"^NEW\s+BALANCE",               # Balance line
        r"^MINIMUM\s+PAYMENT",           # Payment info
        r"^PAYMENT\s+DUE",               # Payment info
        r"^AMOUNT\s+PAID",               # Payment info
        r"^RBC\s+ROYAL\s+BANK",          # Bank info
        r"^CREDIT\s+CARD\s+PAYMENT",     # Bank info
        r"^P\.O\.\s+BOX",               # Address
        r"^TORONTO",                     # Address
        r"^For\s+your\s+security",       # Security notice
        r"^If\s+you\s+recognize",        # Security notice
        r"^call\s+us\s+at",             # Contact info
        r"^Avis\s+de",                   # French notices
        r"^In\s+case\s+of",             # Terms
        r"^Pour\s+les",                  # French
        r"^Rewards\s+Summary",           # Rewards section
        r"^Base\s+Avion\s+points",       # Rewards detail
        r"^Bonus\s+Avion\s+points",      # Rewards detail
        r"^Total\s+Avion\s+points",      # Rewards detail
        r"^Current\s+Avion\s+balance",   # Rewards detail
        r"^Annual\s+Interest\s+Rate",    # Terms
        r"^Date$",                       # Stray header
        r"^CLUBHOUSE",                   # Company name in header
        r"^MICHAEL\s+BELAIR",            # Cardholder in header
        r"^NICHOLAS\s+STEWART",          # Cardholder in header
        r"^\(continued\)$",              # Continuation marker
        r"^DATE$",                       # Standalone header word
    ]
    for pat in skip_patterns:
        if re.search(pat, row_text, re.IGNORECASE):
            return True
    return False


def generate_visa_txn_id(account_last4: str, card_last4: str,
                          txn_date: date, ref: str) -> str:
    """Generate a stable Visa transaction ID.

    Format: VISA-{acct_last4}-{card_last4}-{YYYYMMDD}-{ref_last8}
    If no reference, use a hash-based fallback.
    """
    date_str = txn_date.strftime("%Y%m%d")
    if ref and len(ref) >= 8:
        ref_part = ref[-8:]
    else:
        # Fallback: should not happen for real transactions
        ref_part = "00000000"
    return f"VISA-{account_last4}-{card_last4}-{date_str}-{ref_part}"


def parse_visa_pdf(filepath: str, account: str) -> dict:
    """Parse an RBC Visa Business PDF statement.

    Args:
        filepath: Path to the PDF file
        account: Account identifier (e.g., 'visa_8407', 'visa_7542')

    Returns:
        dict with transactions, summary, validation results, etc.
    """
    fhash = file_hash(filepath)
    account_last4 = account.split("_")[-1]

    with pdfplumber.open(filepath) as pdf:
        if not pdf.pages:
            return {"error": "Empty PDF", "file_hash": fhash}

        # Extract statement period from page 1
        page1_words = pdf.pages[0].extract_words(x_tolerance=2, y_tolerance=3)
        period = extract_visa_statement_period(page1_words)
        if period is None:
            return {"error": "Could not parse statement period", "file_hash": fhash}

        statement_start, statement_end = period
        summary = extract_visa_summary(page1_words)

        # Detect which card starts first from the page header
        # The LIMIT line tells us the primary card
        first_card = account_last4  # default to account number
        full_p1_text = " ".join(w["text"] for w in page1_words)
        limit_match = re.search(r"LIMIT.*\*{4}\s+(\d{4})", full_p1_text)
        if limit_match:
            first_card = limit_match.group(1)

        # Extract transactions from all pages
        all_raw = []
        current_card = first_card

        for page_num, page in enumerate(pdf.pages):
            page_txns, current_card = parse_visa_page_transactions(
                page, page_num, (statement_start, statement_end),
                current_card, account_last4,
            )
            all_raw.extend(page_txns)

        # Separate transactions from subtotals
        transactions = [t for t in all_raw if t.get("_type") == "transaction"]
        subtotals = [t for t in all_raw if t.get("_type") == "subtotal"]

        # Generate transaction IDs
        # Handle missing references with sequence-based fallback
        ref_seen = set()
        for txn in transactions:
            ref = txn.get("visa_ref")
            if ref and ref in ref_seen:
                # Duplicate ref (shouldn't happen, but handle gracefully)
                ref = None
            if ref:
                ref_seen.add(ref)

            txn["txn_id"] = generate_visa_txn_id(
                account_last4, txn["card"],
                txn["txn_date"], txn.get("visa_ref", ""),
            )

        # Handle duplicate IDs (same date + same ref last 8)
        id_counts = {}
        for txn in transactions:
            tid = txn["txn_id"]
            id_counts[tid] = id_counts.get(tid, 0) + 1
            if id_counts[tid] > 1:
                # Append a sequence suffix to disambiguate
                txn["txn_id"] = f"{tid}-{id_counts[tid]:02d}"

        # Validate
        validation = validate_visa_extraction(transactions, subtotals, summary)

        # Format for database insertion
        db_transactions = []
        for txn in transactions:
            amount = txn["amount"]
            db_txn = {
                "txn_id": txn["txn_id"],
                "account": account,
                "card": txn["card"],
                "txn_date": txn["txn_date"].isoformat(),
                "posting_date": txn["posting_date"].isoformat() if txn["posting_date"] else None,
                "description": txn["description"],
                "debit": amount if amount > 0 else None,
                "credit": -amount if amount < 0 else None,
                "balance": None,  # Visa statements don't show running balance
                "currency": txn.get("fx_currency", "CAD") if txn.get("fx_currency") else "CAD",
                "fx_rate": txn.get("fx_rate"),
                "cad_amount": amount if txn.get("fx_currency") else None,
                "visa_ref": txn.get("visa_ref"),
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
            "raw_count": len(transactions),
        }


def validate_visa_extraction(transactions: list, subtotals: list, summary: dict) -> dict:
    """Validate Visa extraction against statement summary."""
    results = {"passed": True, "errors": []}

    # Separate purchases (positive) and payments (negative)
    purchases = [t for t in transactions if t["amount"] > 0]
    payments = [t for t in transactions if t["amount"] < 0]

    purchase_total = sum(t["amount"] for t in purchases)
    payment_total = sum(t["amount"] for t in payments)
    total = sum(t["amount"] for t in transactions)

    results["purchase_count"] = len(purchases)
    results["payment_count"] = len(payments)
    results["total_count"] = len(transactions)
    results["purchase_total"] = round(purchase_total, 2)
    results["payment_total"] = round(payment_total, 2)
    results["net_total"] = round(total, 2)

    # Group by card for per-card subtotal validation
    card_totals = {}
    for t in transactions:
        card = t["card"]
        card_totals[card] = card_totals.get(card, 0) + t["amount"]
    results["card_totals"] = {k: round(v, 2) for k, v in card_totals.items()}

    # Validate against subtotals
    for st in subtotals:
        card = st["card"]
        expected = st["amount"]
        actual = card_totals.get(card, 0)
        if abs(actual - expected) > 0.02:
            results["passed"] = False
            results["errors"].append(
                f"Card {card} subtotal mismatch: "
                f"extracted {actual:.2f}, expected {expected:.2f}"
            )

    # Validate against summary totals
    # The statement breaks positive amounts into: Purchases & debits, Fees,
    # Cash advances, Interest. Our extracted purchase_total includes all of these.
    summary_positive_total = sum(
        summary.get(k, 0)
        for k in ["purchases_debits", "fees", "cash_advances", "interest"]
    )
    if "purchases_debits" in summary:
        if abs(purchase_total - summary_positive_total) > 0.02:
            results["passed"] = False
            results["errors"].append(
                f"Purchases+fees total mismatch: extracted {purchase_total:.2f}, "
                f"expected {summary_positive_total:.2f} "
                f"(purchases={summary.get('purchases_debits', 0):.2f} "
                f"fees={summary.get('fees', 0):.2f})"
            )

    if "payments_credits" in summary:
        if abs(payment_total - summary["payments_credits"]) > 0.02:
            results["passed"] = False
            results["errors"].append(
                f"Payments total mismatch: extracted {payment_total:.2f}, "
                f"expected {summary['payments_credits']:.2f}"
            )

    # Balance check: previous + payments + purchases + fees + cash + interest = new balance
    if all(k in summary for k in ["previous_balance", "payments_credits",
                                    "purchases_debits", "new_balance"]):
        expected_balance = (
            summary["previous_balance"]
            + summary["payments_credits"]
            + summary_positive_total
        )
        if abs(expected_balance - summary["new_balance"]) > 0.02:
            results["passed"] = False
            results["errors"].append(
                f"Balance check failed: {summary['previous_balance']:.2f} "
                f"+ {summary['payments_credits']:.2f} "
                f"+ {summary_positive_total:.2f} "
                f"= {expected_balance:.2f}, "
                f"expected {summary['new_balance']:.2f}"
            )
        else:
            results["balance_verified"] = True

    return results


def identify_visa_account(filename: str) -> Optional[str]:
    """Determine Visa account from filename."""
    fn = filename.lower()
    if "visa" in fn:
        match = re.search(r"statement-(\d{4})", fn)
        if match:
            return f"visa_{match.group(1)}"
    return None


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python extract_visa.py <pdf_path> [account]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    account = sys.argv[2] if len(sys.argv) > 2 else None

    if account is None:
        account = identify_visa_account(Path(pdf_path).name)
        if account is None:
            print(f"Could not determine account from filename: {Path(pdf_path).name}")
            sys.exit(1)

    result = parse_visa_pdf(pdf_path, account)

    if "error" in result:
        print(f"ERROR: {result['error']}")
        sys.exit(1)

    print(f"\n=== Visa Statement: {result['statement_start']} to {result['statement_end']} ===")
    print(f"Account: {account}")
    print(f"Transactions extracted: {result['raw_count']}")
    print(f"\nSummary from statement:")
    for k, v in result["summary"].items():
        print(f"  {k}: {v}")
    print(f"\nValidation:")
    v = result["validation"]
    print(f"  Purchases: {v['purchase_count']} txns, ${v['purchase_total']:,.2f}")
    print(f"  Payments:  {v['payment_count']} txns, ${v['payment_total']:,.2f}")
    if v.get("card_totals"):
        for card, total in v["card_totals"].items():
            print(f"  Card {card}: ${total:,.2f}")
    if v.get("balance_verified"):
        print(f"  Balance: VERIFIED")
    if not v["passed"]:
        print(f"  ERRORS:")
        for err in v["errors"]:
            print(f"    - {err}")
    else:
        print(f"  All checks PASSED")

    print(f"\nFirst 5 transactions:")
    for txn in result["transactions"][:5]:
        amt = txn["debit"] if txn["debit"] else -(txn["credit"] or 0)
        sign = "+" if amt > 0 else ""
        ref = f" ref={txn['visa_ref'][-8:]}" if txn.get("visa_ref") else ""
        print(f"  {txn['txn_id']}  card={txn['card']}  {txn['txn_date']}  {sign}${abs(amt):,.2f}  {txn['description'][:45]}{ref}")

    print(f"\nLast 5 transactions:")
    for txn in result["transactions"][-5:]:
        amt = txn["debit"] if txn["debit"] else -(txn["credit"] or 0)
        sign = "+" if amt > 0 else ""
        ref = f" ref={txn['visa_ref'][-8:]}" if txn.get("visa_ref") else ""
        print(f"  {txn['txn_id']}  card={txn['card']}  {txn['txn_date']}  {sign}${abs(amt):,.2f}  {txn['description'][:45]}{ref}")
