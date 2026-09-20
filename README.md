# UnifyMFG — Smart Factory OS

UnifyMFG is a modern, responsive, and high-performance Manufacturing Execution System (MES) and ERP designed for the process manufacturing industry (flavours, fragrances, chemicals, and food & beverage). 

It elegantly handles complex, multi-level Formulations (BOMs), immutable Stock Ledgers, and B2B Invoicing all within a sleek, intuitive React interface.

## 🚀 Key Features

*   **Dynamic Formulation Engine**: Build complex recipes where ingredients can be raw materials *or* other compound products (sub-assemblies).
*   **Immutable Stock Ledger**: All inventory changes are recorded in an append-only ledger, ensuring absolute traceability and preventing accidental stock overwrites.
*   **B2B Sales & Invoicing**: Generate PDF invoices on the fly, track partial payments, and manage customer credit.
*   **Production Analytics**: Track Overall Equipment Effectiveness (OEE), Yield Efficiency, and Material Shortages in real-time.
*   **Hackathon-Ready Authentication**: Seamlessly bypass complex role-based access for demos while keeping the JWT security perimeter active.

## 🛠 Tech Stack

*   **Frontend**: React (Vite) + Vanilla CSS + Lucide Icons
*   **Backend**: Python (Flask) + Supabase Py
*   **Database**: Supabase (PostgreSQL)
*   **PDF Generation**: ReportLab (Python)

## 📖 Documentation

For detailed technical specs, please refer to the `docs/` directory:
*   [System Architecture](./docs/ARCHITECTURE.md)
*   [Database Schema & ERD](./docs/DATABASE_SCHEMA.md)
*   [API Reference](./docs/API_REFERENCE.md)

## ⚙️ Quickstart (Local Development)

### Prerequisites
1.  Node.js v18+
2.  Python 3.10+
3.  A local [Supabase](https://supabase.com/docs/guides/cli/local-development) container running.

### 1. Database Setup
Copy the contents of `backend/migrations/final_schema.sql` and run it in your Supabase SQL editor to create the necessary tables.

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create your .env.development file based on the template below
export FLASK_ENV=development
python app.py
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# Create your .env file based on the template below
npm run dev
```

### Environment Variables Template

**`backend/.env.development`**
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=your-supabase-service-role-key
FLASK_SECRET_KEY=super-secret-dev-key
```

**`frontend/.env`**
```env
VITE_API_URL=http://localhost:5005/api
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```
