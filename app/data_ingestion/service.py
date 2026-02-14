import pandas as pd
from datetime import datetime, timedelta

def categorize_customer(row):
    """
    Categorize customer based on payment history.
    Returns: Consistent, Inconsistent, or Overdue
    """
    # Define payment month columns
    due_months = ['DUE_MONTH_2', 'DUE_MONTH_3', 'DUE_MONTH_4', 'DUE_MONTH_5', 'DUE_MONTH_6']
    
    # Count paid months
    paid_months = sum(1 for month in due_months if pd.notna(row.get(month)) and str(row.get(month)).strip())
    
    # Calculate missed months
    missed_months = 5 - paid_months
    
    # Get status
    status = str(row.get('STATUS', '')).upper().strip()
    
    # Apply categorization rules (ORDER MATTERS!)
    # Check Overdue first (NPA with low payments)
    if paid_months <= 3 and status == 'NPA':
        return 'Overdue'
    # Then check Inconsistent (missed many payments)
    elif missed_months >= 2:
        return 'Inconsistent'
    # Then check Consistent (good payment history with STD status)
    elif missed_months < 2 and status == 'STD':
        return 'Consistent'
    else:
        # Default to Inconsistent if doesn't match other rules
        return 'Inconsistent'


def categorize_by_due_date(row):
    """
    Categorize customer based on days until due date.
    Due date = LAST DUE REVD DATE + 30 days
    Returns: More_than_7_days, 1-7_days, or Today
    """
    try:
        # Get last payment date
        raw_date = row.get('LAST DUE REVD DATE')
        if pd.isna(raw_date):
            return 'Unknown'
        
        # Convert to datetime (handle if already datetime or needs parsing)
        if isinstance(raw_date, (datetime, pd.Timestamp)):
            last_due_date = raw_date
        else:
            last_due_date = pd.to_datetime(raw_date, dayfirst=True, errors='coerce')
        
        if pd.isna(last_due_date):
            return 'Date_Format_Error'
        
        # Calculate due date (last payment + 30 days)
        due_date = last_due_date + timedelta(days=30)
        
        # Get current date (without time)
        current_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Calculate days until due
        days_left = (due_date - current_date).days
        
        # Categorize
        if days_left > 7:
            return 'More_than_7_days'
        elif 1 <= days_left <= 7:
            return '1-7_days'
        else:
            # 0 or negative (today or overdue)
            return 'Today'
    except Exception as e:
        return 'Parse_Error'


def calculate_kpis(borrowers: list):
    """
    Calculate KPIs and breakdown from a list of borrower records.
    """
    if not borrowers:
        return {
            "kpis": {
                "total_borrowers": 0,
                "total_arrears": 0,
                "calls_pending": 0,
                "calls_completed": 0
            },
            "detailed_breakdown": {
                "by_due_date_category": {
                    "More_than_7_days": [],
                    "1-7_days": [],
                    "Today": []
                }
            }
        }

    # Initialize counters
    total_arrears = 0
    
    # Initialize breakdown
    breakdown = {
        "More_than_7_days": [],
        "1-7_days": [],
        "Today": []
    }

    for b in borrowers:
        # Sum arrears (handle possible string/numeric issues)
        try:
            val = b.get('ARREARS', 0)
            total_arrears += float(val) if val is not None else 0
        except:
            pass
            
        # Add to category breakdown
        cat = b.get('Due_Date_Category', 'More_than_7_days')
        if cat in breakdown:
            # Add indicator color for frontend
            p_cat = b.get('Payment_Category', 'Inconsistent')
            b['indicator_color'] = 'green' if p_cat == 'Consistent' else ('orange' if p_cat == 'Inconsistent' else 'red')
            breakdown[cat].append(b)

    return {
        "kpis": {
            "total_borrowers": len(borrowers),
            "total_arrears": total_arrears,
            "calls_pending": 0, # Placeholder for now
            "calls_completed": 0 # Placeholder for now
        },
        "detailed_breakdown": {
            "by_due_date_category": breakdown
        }
    }
