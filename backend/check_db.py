import sqlite3

def check():
    conn = sqlite3.connect('assessiq.db')
    cursor = conn.cursor()
    
    print("--- USERS ---")
    cursor.execute("SELECT id, name, email, role FROM users")
    for row in cursor.fetchall():
        print(row)
        
    print("\n--- CLASSES ---")
    cursor.execute("SELECT id, name, teacher_id, is_deleted FROM classes")
    for row in cursor.fetchall():
        print(row)

if __name__ == "__main__":
    check()
