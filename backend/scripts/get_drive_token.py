import os
from google_auth_oauthlib.flow import InstalledAppFlow

def get_token():
    # Define the scopes required for Google Drive API
    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    
    # Read client credentials from environment or prompt the user
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        print("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables.")
        print("Please enter them below (or set them in your environment):")
        client_id = input("Client ID: ").strip()
        client_secret = input("Client Secret: ").strip()

    if not client_id or not client_secret:
        print("Client ID and Secret are required.")
        return

    client_config = {
        "installed": {
            "client_id": client_id,
            "project_id": "flavour-backup",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": client_secret,
            "redirect_uris": ["http://localhost"]
        }
    }

    try:
        print("\nStarting local server for OAuth flow...")
        print("Your browser should open automatically. If not, click the link that appears.")
        flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
        creds = flow.run_local_server(port=0)
        
        print("\n" + "="*50)
        print("SUCCESS! Here is your Refresh Token:")
        print("="*50)
        print(creds.refresh_token)
        print("="*50)
        print("\nAdd this token as GOOGLE_REFRESH_TOKEN in your Render environment variables.")
        
    except Exception as e:
        print(f"Error during OAuth flow: {str(e)}")

if __name__ == "__main__":
    get_token()
