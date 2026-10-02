"""
Bank Statement Import Router
Accepts CSV or PDF bank statements and extracts/categorizes transactions using AI.
"""
import io
import csv
import json
import re
from fastapi import APIRouter, UploadFile, File, HTTPException

try:
    import pdfplumber
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    from langchain_openai import ChatOpenAI
    from langchain.prompts import ChatPromptTemplate
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False

from app.config import settings

router = APIRouter()

BIZPULSE_CATEGORIES = [
    "Food & Groceries", "Dining & Restaurants", "Transport & Fuel",
    "Software & Subscriptions", "Utilities & Bills", "Rent & Housing",
    "Entertainment & Leisure", "Shopping & Apparel", "Healthcare & Medical",
    "Education & Courses", "Travel & Hotels", "Office & Supplies",
    "Insurance", "EMI & Loan Repayment", "Salary & Income",
    "Investment", "Client Payment", "Other Income", "Other Expense"
]

INCOME_KEYWORDS = [
    "salary", "credit", "neft cr", "imps cr", "upi cr", "deposit",
    "received", "interest cr", "dividend", "refund", "cashback", "reward"
]

EXPENSE_KEYWORDS = [
    "debit", "neft dr", "imps dr", "upi dr", "withdrawal", "payment",
    "purchase", "emi", "bill pay", "auto debit"
]


def detect_transaction_type(description: str, amount_str: str = "") -> str:
    """Heuristically detect if a transaction is income or expense."""
    desc_lower = description.lower()
    amt_lower = amount_str.lower()
    
    for kw in INCOME_KEYWORDS:
        if kw in desc_lower or kw in amt_lower:
            return "income"
    for kw in EXPENSE_KEYWORDS:
        if kw in desc_lower or kw in amt_lower:
            return "expense"
    return "expense"  # default


def parse_csv_statement(content: str) -> list[dict]:
    """Parse CSV bank statement content into raw transaction rows."""
    reader = csv.DictReader(io.StringIO(content))
    rows = []
    for row in reader:
        # Normalize keys to lowercase
        normalized = {k.lower().strip(): v.strip() for k, v in row.items() if v}
        rows.append(normalized)
    return rows


def extract_transactions_from_rows(rows: list[dict]) -> list[dict]:
    """
    Map raw CSV rows to a standard transaction format.
    Handles various Indian bank CSV formats.
    """
    transactions = []
    
    # Common column name mappings
    date_keys = ["date", "txn date", "transaction date", "value date", "posting date"]
    desc_keys = ["description", "narration", "particulars", "remarks", "details", "transaction details"]
    amount_keys = ["amount", "debit", "credit", "withdrawal", "deposit", "dr", "cr"]
    debit_keys = ["debit", "withdrawal", "dr", "debit amount", "withdrawal amount"]
    credit_keys = ["credit", "deposit", "cr", "credit amount", "deposit amount"]
    
    def find_key(row, candidates):
        for k in candidates:
            if k in row:
                return k
        return None
    
    for row in rows:
        date_key = find_key(row, date_keys)
        desc_key = find_key(row, desc_keys)
        
        if not date_key or not desc_key:
            continue
        
        raw_date = row.get(date_key, "")
        description = row.get(desc_key, "")
        
        if not description or not raw_date:
            continue
        
        # Try separate debit/credit columns
        debit_key = find_key(row, debit_keys)
        credit_key = find_key(row, credit_keys)
        
        amount = 0.0
        tx_type = "expense"
        
        if debit_key and credit_key:
            debit_val = row.get(debit_key, "").replace(",", "").strip()
            credit_val = row.get(credit_key, "").replace(",", "").strip()
            
            if credit_val and float(credit_val or 0) > 0:
                amount = float(credit_val)
                tx_type = "income"
            elif debit_val and float(debit_val or 0) > 0:
                amount = float(debit_val)
                tx_type = "expense"
        else:
            amount_key = find_key(row, amount_keys)
            if amount_key:
                raw_amount = row.get(amount_key, "").replace(",", "").strip()
                if raw_amount:
                    try:
                        amount = abs(float(raw_amount))
                        tx_type = detect_transaction_type(description)
                    except ValueError:
                        continue
        
        if amount <= 0:
            continue
        
        # Normalize date format to YYYY-MM-DD
        normalized_date = normalize_date(raw_date)
        
        transactions.append({
            "date": normalized_date,
            "description": description,
            "amount": amount,
            "type": tx_type,
            "category": None,  # Will be filled by AI
        })
    
    return transactions


def normalize_date(date_str: str) -> str:
    """Convert various date formats to YYYY-MM-DD."""
    date_str = date_str.strip()
    # Common Indian bank formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d %b %Y", "%d-%b-%Y", "%d/%b/%Y"]:
        try:
            from datetime import datetime
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return date_str  # Return as-is if unparseable


def ai_categorize_transactions(transactions: list[dict]) -> list[dict]:
    """
    Use GPT to categorize transactions in bulk.
    Falls back to rule-based categorization if LLM unavailable.
    """
    if not LLM_AVAILABLE or not settings.openai_api_key:
        return rule_based_categorize(transactions)
    
    try:
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.openai_api_key, temperature=0)
        
        # Batch transactions to avoid token limits
        batch_size = 30
        categorized = []
        
        for i in range(0, len(transactions), batch_size):
            batch = transactions[i:i + batch_size]
            
            tx_list = "\n".join([
                f"{j+1}. [{t['type']}] {t['description']} - ₹{t['amount']}"
                for j, t in enumerate(batch)
            ])
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", f"""You are a financial transaction categorizer for an Indian fintech app.
                
Categorize each transaction into EXACTLY one of these categories:
{', '.join(BIZPULSE_CATEGORIES)}

Rules:
- Salary credits → "Salary & Income"
- UPI payments to food apps (Swiggy, Zomato) → "Dining & Restaurants"  
- Grocery stores (BigBasket, DMart, Reliance Fresh) → "Food & Groceries"
- EMI payments → "EMI & Loan Repayment"
- Netflix, Spotify, OTT → "Software & Subscriptions"
- Fuel stations → "Transport & Fuel"
- Medical/pharmacy → "Healthcare & Medical"

Respond ONLY with a JSON array of category strings, one per transaction, in the same order.
Example: ["Food & Groceries", "Salary & Income", "Transport & Fuel"]"""),
                ("human", f"Categorize these {len(batch)} transactions:\n{tx_list}")
            ])
            
            response = llm.invoke(prompt.format_messages())
            content = response.content.strip()
            
            # Extract JSON array from response
            match = re.search(r'\[.*?\]', content, re.DOTALL)
            if match:
                categories = json.loads(match.group())
                for j, tx in enumerate(batch):
                    tx["category"] = categories[j] if j < len(categories) else "Other Expense"
                    categorized.append(tx)
            else:
                # Fallback for this batch
                for tx in batch:
                    tx["category"] = rule_based_single(tx)
                    categorized.append(tx)
        
        return categorized
    
    except Exception:
        return rule_based_categorize(transactions)


def rule_based_single(tx: dict) -> str:
    """Simple keyword-based fallback categorizer."""
    desc = tx.get("description", "").lower()
    
    if tx.get("type") == "income":
        if "salary" in desc or "payroll" in desc:
            return "Salary & Income"
        if "interest" in desc:
            return "Other Income"
        return "Client Payment"
    
    rules = [
        (["swiggy", "zomato", "restaurant", "cafe", "hotel", "dine"], "Dining & Restaurants"),
        (["bigbasket", "grofer", "dmart", "reliance fresh", "grocery", "supermarket"], "Food & Groceries"),
        (["netflix", "spotify", "hotstar", "prime", "subscription", "saas"], "Software & Subscriptions"),
        (["petrol", "fuel", "shell", "hp petro", "uber", "ola", "rapido"], "Transport & Fuel"),
        (["rent", "lease", "housing", "maintenance"], "Rent & Housing"),
        (["electricity", "water", "broadband", "airtel", "jio", "bsnl", "utility", "bill"], "Utilities & Bills"),
        (["amazon", "flipkart", "myntra", "apparel", "shopping", "meesho"], "Shopping & Apparel"),
        (["hospital", "pharmacy", "medical", "doctor", "apollo"], "Healthcare & Medical"),
        (["emi", "loan", "repayment", "equated"], "EMI & Loan Repayment"),
        (["insurance", "lic", "premium"], "Insurance"),
    ]
    
    for keywords, category in rules:
        if any(kw in desc for kw in keywords):
            return category
    
    return "Other Expense"


def rule_based_categorize(transactions: list[dict]) -> list[dict]:
    for tx in transactions:
        tx["category"] = rule_based_single(tx)
    return transactions


@router.post("/statement")
async def import_bank_statement(
    file: UploadFile = File(...),
):
    """
    Parse a bank statement (CSV or PDF) and extract categorized transactions.
    
    Returns a list of transactions ready for user review and bulk import.
    """
    filename = file.filename or ""
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    
    if ext not in ["csv", "pdf", "txt"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a CSV or PDF bank statement."
        )
    
    content_bytes = await file.read()
    
    transactions = []
    
    if ext == "csv" or ext == "txt":
        # Try multiple encodings
        for encoding in ["utf-8", "utf-8-sig", "latin-1", "cp1252"]:
            try:
                content_str = content_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise HTTPException(status_code=400, detail="Could not decode file. Please ensure it's a valid CSV.")
        
        rows = parse_csv_statement(content_str)
        if not rows:
            raise HTTPException(status_code=400, detail="No data rows found in CSV. Check the file format.")
        
        transactions = extract_transactions_from_rows(rows)
    
    elif ext == "pdf":
        if not PDF_AVAILABLE:
            raise HTTPException(status_code=500, detail="PDF parsing not available. Please upload a CSV file.")
        
        try:
            with pdfplumber.open(io.BytesIO(content_bytes)) as pdf:
                all_text = ""
                csv_data = []
                
                for page in pdf.pages:
                    # Try table extraction first
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            csv_data.extend(table)
                    else:
                        all_text += page.extract_text() or ""
                
                if csv_data and len(csv_data) > 1:
                    # Convert table to CSV-like format
                    headers = [str(h).lower().strip() if h else "" for h in csv_data[0]]
                    rows = []
                    for row in csv_data[1:]:
                        if row and any(cell for cell in row if cell):
                            rows.append({headers[i]: str(cell).strip() if cell else "" for i, cell in enumerate(row)})
                    transactions = extract_transactions_from_rows(rows)
                else:
                    # Fall back to text parsing - limited but better than nothing
                    raise HTTPException(
                        status_code=422,
                        detail="Could not extract table data from this PDF. Please export as CSV from your bank portal."
                    )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF parsing error: {str(e)}")
    
    if not transactions:
        raise HTTPException(
            status_code=422,
            detail="No valid transactions found. Please check the file format or try a different export."
        )
    
    # AI categorization
    categorized = ai_categorize_transactions(transactions)
    
    # Add confidence indicator
    for tx in categorized:
        tx["confidence"] = "high" if tx.get("category") and tx["category"] not in ["Other Expense", "Other Income"] else "review"
    
    income_total = sum(t["amount"] for t in categorized if t["type"] == "income")
    expense_total = sum(t["amount"] for t in categorized if t["type"] == "expense")
    
    return {
        "success": True,
        "total_transactions": len(categorized),
        "income_transactions": len([t for t in categorized if t["type"] == "income"]),
        "expense_transactions": len([t for t in categorized if t["type"] == "expense"]),
        "income_total": income_total,
        "expense_total": expense_total,
        "transactions": categorized,
        "message": f"Successfully extracted {len(categorized)} transactions. Please review categories before importing."
    }
