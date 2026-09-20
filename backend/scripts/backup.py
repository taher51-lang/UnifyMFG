import os
import csv
import json
import zipfile
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

try:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
except ImportError:
    Credentials = None

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_KEY not found in .env")
    exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Tables to backup
TABLES = [
    "raw_materials",
    "raw_material_price_history",
    "product_categories",
    "products",
    "product_formula",
    "formulations",
    "formulation_ingredients",
    "customers",
    "invoices",
    "invoice_items",
    "purchase_log",
    "production_log",
    "loose_packing_log",
    "product_purchase_log",
    "stock_ledger"
]

def backup():
    # Create timestamped folder name
    timestamp = datetime.now().strftime("%d-%b-%Y_%I-%M-%p")
    backup_dir = os.path.join(os.path.dirname(__file__), "../../backups")
    temp_dir = os.path.join(backup_dir, f"temp_{timestamp}")
    
    os.makedirs(temp_dir, exist_ok=True)
    
    print(f"Starting backup for {timestamp}...")
    
    csv_files = []
    
    for table_name in TABLES:
        print(f"  Exporting {table_name}...")
        try:
            # Fetch data
            res = supabase.table(table_name).select("*").execute()
            data = res.data
            
            if not data:
                print(f"    No data found for {table_name}, skipping.")
                continue
                
            # Write to CSV
            csv_path = os.path.join(temp_dir, f"{table_name}.csv")
            headers = data[0].keys()
            
            with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(data)
                
            csv_files.append(csv_path)
            
        except Exception as e:
            print(f"    Error exporting {table_name}: {str(e)}")

    if not csv_files:
        print("No data exported. Backup cancelled.")
        os.rmdir(temp_dir)
        return

    # Zip all CSVs
    zip_filename = f"Flavour_Backup_{timestamp}.zip"
    zip_path = os.path.join(backup_dir, zip_filename)
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file in csv_files:
            zipf.write(file, os.path.basename(file))
            os.remove(file) # Clean up temp CSV
            
        # Include schema.sql for disaster recovery
        schema_path = os.path.join(os.path.dirname(__file__), "..", "schema.sql")
        if os.path.exists(schema_path):
            zipf.write(schema_path, "schema.sql")
            
    os.rmdir(temp_dir) # Clean up temp dir

    print(f"Backup complete! File saved to: {zip_path}")
    upload_to_drive(zip_path)
    return zip_path

    
def upload_to_drive(zip_path):
    if not Credentials:
        print("Google API libraries not installed. Skipping upload.")
        return

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN")
    
    if not client_id or not client_secret or not refresh_token:
        print("Missing Google OAuth credentials in environment. Skipping upload.")
        print("Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.")
        return
        
    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
    if not folder_id:
        print("Warning: GOOGLE_DRIVE_FOLDER_ID not found in .env. Uploading to root drive.")
    
    try:
        print("Authenticating with Google Drive via OAuth 2.0...")
        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret
        )
        
        service = build('drive', 'v3', credentials=creds)
        
        file_metadata = {'name': os.path.basename(zip_path)}
        if folder_id:
            file_metadata['parents'] = [folder_id]
            
        media = MediaFileUpload(zip_path, mimetype='application/zip', resumable=True)
        
        print("Uploading to Google Drive...")
        file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        print(f"Uploaded successfully to Google Drive with File ID: {file.get('id')}")
    except Exception as e:
        print(f"Failed to upload to Google Drive: {str(e)}")


if __name__ == "__main__":
    backup()
