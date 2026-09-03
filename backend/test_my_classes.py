import sys
from fastapi.testclient import TestClient
from main import app
from routers.auth import create_access_token

def test():
    # User ID 3 is teachernew
    token = create_access_token(3)
    client = TestClient(app)
    try:
        response = client.get("/classes/my-classes", headers={"Authorization": f"Bearer {token}"})
        print("STATUS:", response.status_code)
        print("RESPONSE:", response.text)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()
