#!/bin/bash

# ============================================
# DATABASE MIGRATION ROLLBACK PROCEDURES
# ============================================
# Generated: 2025-08-24
# Purpose: Emergency rollback for migration consolidation
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="database-backups/2025-08-24T12-23-52"
MIGRATIONS_DIR="src/database/migrations"
ARCHIVE_DIR="$MIGRATIONS_DIR/archived_2025_08_24"

echo -e "${YELLOW}🔄 DATABASE MIGRATION ROLLBACK${NC}"
echo "======================================"
echo ""

# Function to show menu
show_menu() {
    echo "Select rollback option:"
    echo "1) Rollback migration files only (SAFE)"
    echo "2) Rollback migration tracking table (MEDIUM RISK)"
    echo "3) Full database restore from backup (HIGH RISK)"
    echo "4) Verify current state (no changes)"
    echo "5) Exit"
    echo ""
    read -p "Enter choice [1-5]: " choice
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check if backup exists
    if [ ! -d "../$BACKUP_DIR" ]; then
        echo -e "${RED}❌ Backup directory not found at $BACKUP_DIR${NC}"
        exit 1
    fi
    
    # Check if we have psql
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}❌ psql command not found${NC}"
        exit 1
    fi
    
    # Check DATABASE_URL
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${YELLOW}Loading .env file...${NC}"
        source .env
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}❌ DATABASE_URL not set${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites checked${NC}"
}

# Option 1: Rollback migration files only
rollback_files() {
    echo -e "${YELLOW}Rolling back migration files...${NC}"
    
    # Check if archive exists
    if [ ! -d "$ARCHIVE_DIR" ]; then
        echo -e "${RED}❌ Archive directory not found at $ARCHIVE_DIR${NC}"
        echo "Cannot rollback - no archived migrations found"
        return 1
    fi
    
    # Count files
    archived_count=$(ls -1 $ARCHIVE_DIR/*.sql 2>/dev/null | wc -l)
    current_count=$(ls -1 $MIGRATIONS_DIR/*.sql 2>/dev/null | wc -l)
    
    echo "Found $archived_count archived migration files"
    echo "Current migrations directory has $current_count files"
    
    read -p "Restore archived migrations? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Rollback cancelled"
        return 1
    fi
    
    # Create backup of current state
    echo "Backing up current migrations..."
    mkdir -p "$MIGRATIONS_DIR/before_rollback_$(date +%Y%m%d_%H%M%S)"
    cp $MIGRATIONS_DIR/*.sql "$MIGRATIONS_DIR/before_rollback_$(date +%Y%m%d_%H%M%S)/" 2>/dev/null || true
    
    # Restore archived migrations
    echo "Restoring archived migrations..."
    cp $ARCHIVE_DIR/*.sql $MIGRATIONS_DIR/
    
    # Remove consolidated baseline if it exists
    rm -f $MIGRATIONS_DIR/200_consolidated_production_baseline.sql
    
    echo -e "${GREEN}✅ Migration files rolled back${NC}"
    echo "Previous state backed up to: $MIGRATIONS_DIR/before_rollback_*"
}

# Option 2: Rollback migration tracking
rollback_tracking() {
    echo -e "${YELLOW}Rolling back migration tracking table...${NC}"
    
    # Show current state
    echo "Current migration tracking:"
    psql $DATABASE_URL -c "SELECT version, name, executed_at FROM schema_migrations ORDER BY version;" 2>/dev/null || echo "No tracking table found"
    
    read -p "Remove consolidated baseline entry? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Rollback cancelled"
        return 1
    fi
    
    # Remove consolidated baseline entry
    psql $DATABASE_URL -c "DELETE FROM schema_migrations WHERE version = '200';" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Migration tracking rolled back${NC}"
}

# Option 3: Full database restore
full_restore() {
    echo -e "${RED}⚠️  WARNING: FULL DATABASE RESTORE${NC}"
    echo "This will:"
    echo "  - Drop all current data"
    echo "  - Restore from backup"
    echo "  - Reset to state from 2025-08-24"
    echo ""
    
    read -p "Are you ABSOLUTELY SURE? Type 'RESTORE' to confirm: " confirm
    if [ "$confirm" != "RESTORE" ]; then
        echo "Restore cancelled"
        return 1
    fi
    
    # Double confirmation
    read -p "This is irreversible. Continue? (yes/no): " confirm2
    if [ "$confirm2" != "yes" ]; then
        echo "Restore cancelled"
        return 1
    fi
    
    echo -e "${YELLOW}Starting full restore...${NC}"
    
    # Change to backup directory
    cd "../$BACKUP_DIR"
    
    # Run restore script
    if [ -f "restore.sh" ]; then
        bash restore.sh
    else
        echo -e "${RED}❌ Restore script not found${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Full database restored${NC}"
}

# Option 4: Verify current state
verify_state() {
    echo -e "${YELLOW}Verifying current state...${NC}"
    
    # Check migration files
    echo ""
    echo "Migration files:"
    current_count=$(ls -1 $MIGRATIONS_DIR/*.sql 2>/dev/null | wc -l)
    echo "  Total SQL files: $current_count"
    
    if [ -f "$MIGRATIONS_DIR/200_consolidated_production_baseline.sql" ]; then
        echo "  ✓ Consolidated baseline exists"
    else
        echo "  ✗ No consolidated baseline found"
    fi
    
    # Check migration tracking
    echo ""
    echo "Migration tracking table:"
    psql $DATABASE_URL -c "SELECT version, name, executed_at FROM schema_migrations ORDER BY version;" 2>/dev/null || echo "  No tracking table found"
    
    # Check database stats
    echo ""
    echo "Database statistics:"
    psql $DATABASE_URL -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null
    psql $DATABASE_URL -c "SELECT SUM(n_live_tup) as total_rows FROM pg_stat_user_tables;" 2>/dev/null
    
    # Check critical tables
    echo ""
    echo "Critical tables:"
    for table in users customer_profiles challenges cc_transactions seasons; do
        count=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ')
        if [ -n "$count" ]; then
            echo "  $table: $count rows"
        else
            echo "  $table: NOT FOUND"
        fi
    done
    
    echo ""
    echo -e "${GREEN}✅ Verification complete${NC}"
}

# Main script
main() {
    # Check we're in the right directory
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ Must run from ClubOSV1-backend directory${NC}"
        exit 1
    fi
    
    check_prerequisites
    
    while true; do
        show_menu
        
        case $choice in
            1)
                rollback_files
                ;;
            2)
                rollback_tracking
                ;;
            3)
                full_restore
                ;;
            4)
                verify_state
                ;;
            5)
                echo "Exiting..."
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
        echo ""
    done
}

# Run main function
main