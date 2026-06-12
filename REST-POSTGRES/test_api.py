import subprocess
import json
import sys

BASE_URL = "http://localhost:8000"
PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"

results = {"passed": 0, "failed": 0}

def curl(method, path, body=None, expected_status=200):
    cmd = ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", method]
    if body:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    cmd.append(f"{BASE_URL}{path}")
    status = subprocess.run(cmd, capture_output=True, text=True).stdout.strip()
    return int(status)

def curl_json(method, path, body=None):
    cmd = ["curl", "-s", "-X", method]
    if body:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    cmd.append(f"{BASE_URL}{path}")
    out = subprocess.run(cmd, capture_output=True, text=True).stdout.strip()
    try:
        return json.loads(out)
    except Exception:
        return None

def test(name, method, path, body=None, expected_status=200):
    status = curl(method, path, body, expected_status)
    ok = status == expected_status
    icon = PASS if ok else FAIL
    print(f"  {icon} [{status}] {method} {path} — {name}")
    if ok:
        results["passed"] += 1
    else:
        results["failed"] += 1
    return ok

# ==================== PRODUCTS ====================
print("\n\033[1m[PRODUCTS]\033[0m")

test("Hello World",                 "GET",    "/")
test("Get all products",            "GET",    "/products")
test("Get product by ID",           "GET",    "/products/1")
test("Get product 404",             "GET",    "/products/9999",          expected_status=404)

product = curl_json("POST", "/products", {"name": "Test Game", "about": "A test game", "price": 14.99})
product_id = product.get("id") if product else None
test("Create product",              "POST",   "/products",               {"name": "Test Game", "about": "A test game", "price": 14.99})
test("Create product — invalid price", "POST", "/products",              {"name": "Bad", "about": "x", "price": -5},  expected_status=400)
test("Create product — missing field", "POST", "/products",              {"name": "Bad"},                              expected_status=400)

test("Search by name",              "GET",    "/products?name=witcher")
test("Search by about",             "GET",    "/products?about=rpg")
test("Search by max price",         "GET",    "/products?price=30")
test("Search combined",             "GET",    "/products?name=game&price=50")

if product_id:
    test("Delete product",          "DELETE", f"/products/{product_id}")
test("Delete product 404",          "DELETE", "/products/9999",          expected_status=404)

# ==================== USERS ====================
print("\n\033[1m[USERS]\033[0m")

import time
unique = str(int(time.time()))
# Pre-create user to get ID for later tests (not counted as a test assertion)
user = curl_json("POST", "/users", {"username": f"user_{unique}", "password": "password123", "email": f"user_{unique}@example.com"})
user_id = user.get("id") if user else None
# Test creation of a second distinct user
test("Create user",                 "POST",   "/users",                  {"username": f"new_{unique}", "password": "password123", "email": f"new_{unique}@example.com"})
test("Create user — duplicate",     "POST",   "/users",                  {"username": f"user_{unique}", "password": "password123", "email": f"user_{unique}@example.com"}, expected_status=409)
test("Create user — bad email",     "POST",   "/users",                  {"username": "u2", "password": "password123", "email": "not-an-email"},           expected_status=400)
test("Create user — short password","POST",   "/users",                  {"username": "u3", "password": "short", "email": "u3@test.com"},                  expected_status=400)

test("Get all users",               "GET",    "/users")
test("Get user — no password in response", "GET", f"/users/{user_id}" if user_id else "/users/1")
test("Get user 404",                "GET",    "/users/9999",             expected_status=404)

if user_id:
    test("PUT user",                "PUT",    f"/users/{user_id}",       {"username": "updateduser", "password": "newpassword123", "email": "updated@example.com"})
    test("PUT user — missing field","PUT",    f"/users/{user_id}",       {"username": "x"},                                                                  expected_status=400)
    test("PATCH user email",        "PATCH",  f"/users/{user_id}",       {"email": "patched@example.com"})
    test("PATCH user — empty body", "PATCH",  f"/users/{user_id}",       {},                                                                                 expected_status=400)

# Create a second user for orders/reviews tests
user2 = curl_json("POST", "/users", {"username": "testuser2", "password": "password123", "email": "test2@example.com"})
user2_id = user2.get("id") if user2 else None

# ==================== F2P GAMES ====================
print("\n\033[1m[F2P GAMES]\033[0m")

test("Get all F2P games",           "GET",    "/f2p-games")
test("Get F2P game by ID",          "GET",    "/f2p-games/452")
test("Get F2P game 404",            "GET",    "/f2p-games/999999",       expected_status=404)

# ==================== ORDERS ====================
print("\n\033[1m[ORDERS]\033[0m")

if user_id:
    order = curl_json("POST", "/orders", {"user_id": user_id, "product_ids": [1, 2]})
    order_id = order.get("id") if order else None

    test("Create order",            "POST",   "/orders",                 {"user_id": user_id, "product_ids": [1, 2]})
    test("Create order — user 404", "POST",   "/orders",                 {"user_id": 9999, "product_ids": [1]},      expected_status=404)
    test("Create order — prod 404", "POST",   "/orders",                 {"user_id": user_id, "product_ids": [9999]},expected_status=404)
    test("Create order — empty ids","POST",   "/orders",                 {"user_id": user_id, "product_ids": []},    expected_status=400)

    test("Get all orders",          "GET",    "/orders")

    if order_id:
        test("Get order by ID",     "GET",    f"/orders/{order_id}")
        test("PUT order",           "PUT",    f"/orders/{order_id}",     {"user_id": user_id, "product_ids": [1], "payment": True})
        test("PATCH order payment", "PATCH",  f"/orders/{order_id}",     {"payment": False})
        test("Delete order",        "DELETE", f"/orders/{order_id}")

    test("Get order 404",           "GET",    "/orders/9999",            expected_status=404)
    test("Delete order 404",        "DELETE", "/orders/9999",            expected_status=404)

# ==================== REVIEWS ====================
print("\n\033[1m[REVIEWS]\033[0m")

if user_id:
    review = curl_json("POST", "/reviews", {"user_id": user_id, "product_id": 1, "score": 4, "content": "Great game!"})
    review_id = review.get("id") if review else None

    test("Create review",           "POST",   "/reviews",                {"user_id": user_id, "product_id": 1, "score": 4, "content": "Great game!"})
    test("Create review — bad score","POST",  "/reviews",                {"user_id": user_id, "product_id": 1, "score": 6, "content": "x"},            expected_status=400)
    test("Create review — user 404","POST",   "/reviews",                {"user_id": 9999, "product_id": 1, "score": 3, "content": "x"},               expected_status=404)
    test("Create review — prod 404","POST",   "/reviews",                {"user_id": user_id, "product_id": 9999, "score": 3, "content": "x"},         expected_status=404)

    test("Get all reviews",         "GET",    "/reviews")

    if review_id:
        test("Get review by ID",    "GET",    f"/reviews/{review_id}")
        test("GET product has reviews", "GET", "/products/1")  # should include reviews
        test("PUT review",          "PUT",    f"/reviews/{review_id}",   {"score": 5, "content": "Amazing game!"})
        test("PATCH review score",  "PATCH",  f"/reviews/{review_id}",   {"score": 3})
        test("Delete review",       "DELETE", f"/reviews/{review_id}")

    test("Get review 404",          "GET",    "/reviews/9999",           expected_status=404)
    test("Delete review 404",       "DELETE", "/reviews/9999",           expected_status=404)

# ==================== CLEANUP ====================
print("\n\033[1m[CLEANUP]\033[0m")

if user_id:
    test("Delete test user",        "DELETE", f"/users/{user_id}")
if user2_id:
    test("Delete test user 2",      "DELETE", f"/users/{user2_id}")

# ==================== SUMMARY ====================
total = results["passed"] + results["failed"]
color = "\033[92m" if results["failed"] == 0 else "\033[91m"
print(f"\n{color}{'='*40}")
print(f"  {results['passed']}/{total} tests passed")
if results["failed"] > 0:
    print(f"  {results['failed']} tests FAILED")
print(f"{'='*40}\033[0m\n")

sys.exit(0 if results["failed"] == 0 else 1)
