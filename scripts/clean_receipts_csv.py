#!/usr/bin/env python3
import csv
import os
import json
from pathlib import Path
from collections import defaultdict

# Paths
RECEIPTS_DIR = "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/Business/Finance/Tax Documents/Receipts"
MASTER_DIR = f"{RECEIPTS_DIR}/Master_Receipts_2024"
CSV_FILE = f"{MASTER_DIR}/complete_receipts_index.csv"
BACKUP_CSV = f"{MASTER_DIR}/complete_receipts_index_backup_before_clean.csv"
CLEAN_CSV = f"{MASTER_DIR}/complete_receipts_index_clean.csv"

def parse_amount(amount_str):
    """Extract numeric amount from string"""
    if not amount_str or amount_str in ['TBD', 'N/A', '']:
        return 0.0
    clean = str(amount_str).replace('$', '').replace(',', '').strip()
    try:
        return float(clean)
    except:
        return 0.0

def get_all_receipt_files():
    """Get list of all actual receipt files"""
    all_files = set()
    
    # Files in Master_Receipts_2024
    for root, dirs, files in os.walk(MASTER_DIR):
        for file in files:
            if file.endswith(('.pdf', '.txt', '.png', '.jpg', '.jpeg')):
                # Get relative path from Master_Receipts_2024
                rel_path = os.path.relpath(os.path.join(root, file), MASTER_DIR)
                all_files.add(file)
                all_files.add(rel_path)
    
    # Files in main Receipts folder
    for file in os.listdir(RECEIPTS_DIR):
        file_path = os.path.join(RECEIPTS_DIR, file)
        if os.path.isfile(file_path):
            if file.endswith(('.pdf', '.txt', '.png', '.jpg', '.jpeg')):
                if 'Master_Receipts' not in file:
                    all_files.add(file)
    
    return all_files

def clean_csv():
    """Clean CSV to only include entries with matching files"""
    
    # Get all actual files
    actual_files = get_all_receipt_files()
    print(f"Found {len(actual_files)} actual receipt files")
    
    # Read current CSV
    all_entries = []
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            all_entries.append(row)
    
    print(f"Current CSV has {len(all_entries)} entries")
    
    # Filter entries to only those with matching files
    matched_entries = []
    unmatched_entries = []
    
    for entry in all_entries:
        filename = entry.get('Filename', '')
        # Check various possible matches
        if filename in actual_files:
            matched_entries.append(entry)
        elif filename.replace('2025-08-13_', '') in actual_files:
            matched_entries.append(entry)
        elif filename.split('/')[-1] in actual_files:
            matched_entries.append(entry)
        else:
            # Check if it's one of the known files in main folder
            if filename in ['INV-202413361.pdf', 'INV-202413474.pdf', 'INV-202414113.pdf', 
                          'EST-20235097.pdf', 'T4_Form_2023__2025_06_17_10_10_34_-0700.pdf',
                          'T4_Form_2023__2025_06_17_10_10_39_-0700.pdf', 
                          'T4_Form_2024__2025_06_17_10_10_09_-0700.pdf']:
                matched_entries.append(entry)
            else:
                unmatched_entries.append(entry)
    
    print(f"Matched entries: {len(matched_entries)}")
    print(f"Unmatched entries to remove: {len(unmatched_entries)}")
    
    # Calculate totals
    vendor_totals = defaultdict(float)
    vendor_counts = defaultdict(int)
    total_amount = 0
    receipts_with_amounts = 0
    receipts_pending = 0
    
    for entry in matched_entries:
        vendor = entry.get('Vendor', 'Unknown')
        amount = parse_amount(entry.get('Amount', 0))
        
        vendor_counts[vendor] += 1
        if amount > 0:
            vendor_totals[vendor] += amount
            total_amount += amount
            receipts_with_amounts += 1
        else:
            receipts_pending += 1
    
    # Write clean CSV
    with open(CLEAN_CSV, 'w', newline='', encoding='utf-8') as f:
        if matched_entries:
            fieldnames = matched_entries[0].keys()
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(matched_entries)
    
    # Print summary
    print("\n" + "="*60)
    print("CLEANED RECEIPTS SUMMARY")
    print("="*60)
    print(f"Total entries after cleaning: {len(matched_entries)}")
    print(f"Receipts with amounts: {receipts_with_amounts}")
    print(f"Receipts pending: {receipts_pending}")
    print(f"Total amount: ${total_amount:,.2f}")
    
    print("\nTop Vendors:")
    sorted_vendors = sorted(vendor_totals.items(), key=lambda x: x[1], reverse=True)
    for vendor, total in sorted_vendors[:10]:
        count = vendor_counts[vendor]
        print(f"  {vendor:30} {count:4} receipts  ${total:12,.2f}")
    
    # Save summary
    summary = {
        'cleaned_date': '2025-08-13',
        'total_entries': len(matched_entries),
        'removed_entries': len(unmatched_entries),
        'receipts_with_amounts': receipts_with_amounts,
        'receipts_pending': receipts_pending,
        'total_amount': total_amount,
        'vendors': {vendor: {'count': vendor_counts[vendor], 'total': total} 
                   for vendor, total in sorted_vendors}
    }
    
    with open(f"{RECEIPTS_DIR}/clean_summary.json", 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\nClean CSV saved to: {CLEAN_CSV}")
    print(f"Summary saved to: clean_summary.json")
    
    # Show some unmatched entries for review
    if unmatched_entries:
        print(f"\nFirst 10 unmatched entries removed:")
        for entry in unmatched_entries[:10]:
            print(f"  - {entry.get('Date', '')} | {entry.get('Vendor', '')} | {entry.get('Filename', '')}")
    
    return summary

if __name__ == "__main__":
    # Backup original first
    import shutil
    shutil.copy(CSV_FILE, BACKUP_CSV)
    print(f"Backup saved to: {BACKUP_CSV}")
    
    summary = clean_csv()