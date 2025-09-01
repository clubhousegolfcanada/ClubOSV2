#!/usr/bin/env python3
import csv
import json
import os
import re
from datetime import datetime
from pathlib import Path
from collections import defaultdict

# Paths
RECEIPTS_DIR = "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/Business/Finance/Tax Documents/Receipts"
MASTER_DIR = f"{RECEIPTS_DIR}/Master_Receipts_2024"

def parse_amount(amount_str):
    """Extract numeric amount from string"""
    if not amount_str or amount_str in ['TBD', 'N/A', '']:
        return 0.0
    # Remove currency symbols, commas, spaces
    clean = re.sub(r'[$,\s]', '', str(amount_str))
    try:
        return float(clean)
    except:
        return 0.0

def audit_amazon_csv():
    """Parse Amazon orders CSV and calculate total"""
    amazon_file = f"{RECEIPTS_DIR}/All amazon orders.csv"
    amazon_total = 0.0
    amazon_orders = []
    
    if os.path.exists(amazon_file):
        with open(amazon_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                amount = parse_amount(row.get('Item Net Total', 0))
                if amount > 0:
                    amazon_total += amount
                    amazon_orders.append({
                        'date': row.get('Order Date', ''),
                        'order_id': row.get('Order ID', ''),
                        'amount': amount,
                        'item': row.get('Title', '')[:50]
                    })
    
    return amazon_total, amazon_orders

def audit_master_receipts_csv():
    """Audit the complete_receipts_index.csv file"""
    csv_file = f"{MASTER_DIR}/complete_receipts_index.csv"
    vendor_totals = defaultdict(float)
    vendor_counts = defaultdict(int)
    receipts_with_amounts = 0
    receipts_pending = 0
    all_receipts = []
    
    if os.path.exists(csv_file):
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                vendor = row.get('Vendor', 'Unknown')
                amount = parse_amount(row.get('Amount', 0))
                
                all_receipts.append({
                    'date': row.get('Date', ''),
                    'vendor': vendor,
                    'amount': amount,
                    'filename': row.get('Filename', ''),
                    'notes': row.get('Notes', '')
                })
                
                vendor_counts[vendor] += 1
                
                if amount > 0:
                    vendor_totals[vendor] += amount
                    receipts_with_amounts += 1
                else:
                    receipts_pending += 1
    
    return vendor_totals, vendor_counts, receipts_with_amounts, receipts_pending, all_receipts

def audit_main_folder_receipts():
    """Check receipts in main folder (not in Master_Receipts_2024)"""
    main_receipts = []
    for file in os.listdir(RECEIPTS_DIR):
        file_path = os.path.join(RECEIPTS_DIR, file)
        if os.path.isfile(file_path):
            if file.endswith(('.pdf', '.txt', '.png', '.jpg', '.jpeg')):
                if 'Master_Receipts' not in file and file not in ['All amazon orders.csv', 'ETransfer HIstory.csv']:
                    main_receipts.append(file)
    return main_receipts

def count_actual_files():
    """Count actual receipt files in Master_Receipts_2024"""
    count = 0
    for root, dirs, files in os.walk(MASTER_DIR):
        for file in files:
            if file.endswith(('.pdf', '.txt', '.png', '.jpg', '.jpeg')):
                count += 1
    return count

def generate_audit_report():
    """Generate comprehensive audit report"""
    print("=" * 80)
    print("COMPREHENSIVE RECEIPTS AUDIT REPORT")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Amazon CSV audit
    print("\n1. AMAZON ORDERS CSV AUDIT")
    print("-" * 40)
    amazon_total, amazon_orders = audit_amazon_csv()
    print(f"Total Amazon orders: {len(amazon_orders)}")
    print(f"Total Amazon amount: ${amazon_total:,.2f}")
    
    # Master receipts CSV audit
    print("\n2. MASTER RECEIPTS CSV AUDIT")
    print("-" * 40)
    vendor_totals, vendor_counts, receipts_with_amounts, receipts_pending, all_receipts = audit_master_receipts_csv()
    
    total_receipts_csv = len(all_receipts)
    total_amount_csv = sum(vendor_totals.values())
    
    print(f"Total receipts in CSV: {total_receipts_csv}")
    print(f"Receipts with amounts: {receipts_with_amounts}")
    print(f"Receipts pending amounts: {receipts_pending}")
    print(f"Total amount in CSV: ${total_amount_csv:,.2f}")
    
    # Vendor breakdown
    print("\n3. VENDOR BREAKDOWN")
    print("-" * 40)
    sorted_vendors = sorted(vendor_totals.items(), key=lambda x: x[1], reverse=True)
    
    for vendor, total in sorted_vendors[:15]:  # Top 15 vendors
        count = vendor_counts[vendor]
        print(f"{vendor:30} {count:4} receipts  ${total:12,.2f}")
    
    # File count audit
    print("\n4. FILE COUNT AUDIT")
    print("-" * 40)
    actual_files = count_actual_files()
    main_folder_receipts = audit_main_folder_receipts()
    
    print(f"Files in Master_Receipts_2024: {actual_files}")
    print(f"Files in main Receipts folder: {len(main_folder_receipts)}")
    print(f"Total receipt files: {actual_files + len(main_folder_receipts)}")
    print(f"Entries in CSV index: {total_receipts_csv}")
    
    if len(main_folder_receipts) > 0:
        print("\nFiles in main folder:")
        for file in main_folder_receipts:
            print(f"  - {file}")
    
    # Check for Foresight invoices
    print("\n5. FORESIGHT SPORTS INVOICES")
    print("-" * 40)
    foresight_receipts = [r for r in all_receipts if 'Foresight' in r['vendor']]
    foresight_total = sum(r['amount'] for r in foresight_receipts)
    
    print(f"Foresight receipts found: {len(foresight_receipts)}")
    print(f"Foresight total: ${foresight_total:,.2f}")
    for receipt in foresight_receipts:
        print(f"  {receipt['date']} - {receipt['filename']} - ${receipt['amount']:,.2f}")
    
    # Summary
    print("\n6. AUDIT SUMMARY")
    print("-" * 40)
    print(f"GRAND TOTAL (CSV): ${total_amount_csv:,.2f}")
    
    # Check for discrepancies
    if actual_files != total_receipts_csv - 1:  # -1 for header
        print(f"\n⚠️  WARNING: File count mismatch!")
        print(f"   Actual files: {actual_files}")
        print(f"   CSV entries: {total_receipts_csv}")
    
    # Export to JSON
    audit_data = {
        'audit_date': datetime.now().isoformat(),
        'amazon': {
            'total': amazon_total,
            'count': len(amazon_orders)
        },
        'master_csv': {
            'total_receipts': total_receipts_csv,
            'receipts_with_amounts': receipts_with_amounts,
            'receipts_pending': receipts_pending,
            'total_amount': total_amount_csv
        },
        'vendors': {vendor: {'count': vendor_counts[vendor], 'total': total} 
                   for vendor, total in sorted_vendors},
        'file_counts': {
            'master_folder': actual_files,
            'main_folder': len(main_folder_receipts),
            'csv_entries': total_receipts_csv
        },
        'foresight': {
            'count': len(foresight_receipts),
            'total': foresight_total,
            'receipts': foresight_receipts
        },
        'grand_total': total_amount_csv
    }
    
    with open(f"{RECEIPTS_DIR}/audit_report_{datetime.now().strftime('%Y%m%d')}.json", 'w') as f:
        json.dump(audit_data, f, indent=2, default=str)
    
    print(f"\nAudit report saved to: audit_report_{datetime.now().strftime('%Y%m%d')}.json")
    
    return audit_data

if __name__ == "__main__":
    audit_data = generate_audit_report()