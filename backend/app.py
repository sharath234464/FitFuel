from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "users.db")
DATA_PATH = os.path.join(BASE_DIR, "data", "food.json")


def get_conn():
    return sqlite3.connect(DB_PATH)


def init_db():
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            age INTEGER,
            gender TEXT,
            weight REAL,
            height REAL,
            goal TEXT,
            diet_type TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saved_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            plan_type TEXT,
            content TEXT,
            created_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            weight REAL,
            recorded_at TEXT
        )
    """)

    conn.commit()
    conn.close()


def load_foods():
    try:
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)

        if isinstance(raw, dict) and "foods_dataset" in raw:
            return raw["foods_dataset"]
        if isinstance(raw, list):
            return raw
        return []
    except Exception as e:
        print("Error loading food.json:", e)
        return []


def get_user_profile(user_id):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, username, age, gender, weight, height, goal, diet_type
        FROM users
        WHERE id=?
    """, (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row[0],
        "username": row[1],
        "age": row[2],
        "gender": row[3],
        "weight": row[4],
        "height": row[5],
        "goal": row[6],
        "diet_type": row[7]
    }


init_db()
foods = load_foods()


@app.route("/")
def home():
    return "FitFuel Backend Running Successfully 🚀"


@app.route("/foods", methods=["GET"])
def get_foods():
    return jsonify(foods)


@app.route("/signup", methods=["POST"])
def signup():
    data = request.json or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (username, password)
        )
        conn.commit()
        return jsonify({"message": "Signup successful"})
    except sqlite3.IntegrityError:
        return jsonify({"message": "Username already exists"}), 400
    finally:
        conn.close()


@app.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM users WHERE username=? AND password=?",
        (username, password)
    )
    user = cursor.fetchone()
    conn.close()

    if user:
        return jsonify({"user_id": user[0], "message": "Login successful"})

    return jsonify({"message": "Invalid username or password"}), 401


@app.route("/save-profile", methods=["POST"])
def save_profile():
    data = request.json or {}
    user_id = data.get("user_id")
    age = data.get("age")
    gender = data.get("gender")
    weight = data.get("weight")
    height = data.get("height")
    goal = data.get("goal")
    diet_type = data.get("diet_type")

    if not user_id:
        return jsonify({"message": "User ID is required"}), 400

    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE users
        SET age=?, gender=?, weight=?, height=?, goal=?, diet_type=?
        WHERE id=?
    """, (age, gender, weight, height, goal, diet_type, user_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Profile saved successfully"})


@app.route("/user/<int:user_id>", methods=["GET"])
def get_user(user_id):
    user = get_user_profile(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
    return jsonify(user)


@app.route("/save-plan", methods=["POST"])
def save_plan():
    data = request.json or {}
    user_id = data.get("user_id")
    plan_type = data.get("plan_type")
    content = data.get("content")

    if not user_id or not plan_type or content is None:
        return jsonify({"message": "Missing plan data"}), 400

    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO saved_plans (user_id, plan_type, content, created_at)
        VALUES (?, ?, ?, ?)
    """, (
        user_id,
        plan_type,
        json.dumps(content),
        datetime.now().isoformat()
    ))
    conn.commit()
    conn.close()

    return jsonify({"message": "Plan saved successfully"})


@app.route("/plans/<int:user_id>", methods=["GET"])
def get_plans(user_id):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, plan_type, content, created_at
        FROM saved_plans
        WHERE user_id=?
        ORDER BY id DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()

    plans = []
    for row in rows:
        plans.append({
            "id": row[0],
            "plan_type": row[1],
            "content": json.loads(row[2]),
            "created_at": row[3]
        })

    return jsonify(plans)


@app.route("/save-progress", methods=["POST"])
def save_progress():
    data = request.json or {}
    user_id = data.get("user_id")
    weight = data.get("weight")
    recorded_at = data.get("recorded_at") or datetime.now().strftime("%Y-%m-%d")

    if not user_id or weight is None:
        return jsonify({"message": "Missing progress data"}), 400

    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO progress (user_id, weight, recorded_at)
        VALUES (?, ?, ?)
    """, (user_id, weight, recorded_at))
    conn.commit()
    conn.close()

    return jsonify({"message": "Progress saved successfully"})


@app.route("/progress/<int:user_id>", methods=["GET"])
def get_progress(user_id):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, weight, recorded_at
        FROM progress
        WHERE user_id=?
        ORDER BY id DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()

    progress = []
    for row in rows:
        progress.append({
            "id": row[0],
            "weight": row[1],
            "recorded_at": row[2]
        })

    return jsonify(progress)


@app.route("/chatbot", methods=["POST"])
def chatbot():
    data = request.json or {}
    message = (data.get("message") or "").lower().strip()

    def has_any(words):
        return any(word in message for word in words)

    if not message:
        return jsonify({"reply": "Please type your diet question."})

    if has_any(["weight loss", "fat loss", "fatloss", "lose weight", "cut fat", "cutting"]):
        return jsonify({
            "reply": "For fat loss, focus on high-protein, high-fiber foods with controlled calories. Prefer oats, idli, dal, curd, vegetables, fruits, and lighter snacks."
        })

    if has_any(["weight gain", "gain weight", "bulk", "bulking"]):
        return jsonify({
            "reply": "For weight gain, choose calorie-dense foods with protein such as paneer, rice meals, bananas, nuts, peanut butter, eggs, chicken, and healthy snacks between meals."
        })

    if has_any(["muscle gain", "muscle", "bodybuilding", "lean muscle"]):
        return jsonify({
            "reply": "For muscle gain, prioritize high-protein foods like eggs, paneer, chicken, fish, lentils, curd, and enough calories overall."
        })

    if has_any(["breakfast", "morning meal"]):
        return jsonify({
            "reply": "Good breakfast choices include oats, idli, dosa, poha, eggs, paneer dishes, curd, and fruit depending on your goal."
        })

    if has_any(["lunch"]):
        return jsonify({
            "reply": "A good lunch includes protein, carbs, and fiber. Examples are rice with dal, paneer curry, chicken with rice, roti with sabzi, curd, and vegetables."
        })

    if has_any(["dinner", "night meal"]):
        return jsonify({
            "reply": "For dinner, choose balanced meals like roti with paneer or chicken, rice with dal, soup with protein, and vegetables. Keep dinner lighter for fat loss."
        })

    if has_any(["snack", "snacks"]):
        return jsonify({
            "reply": "Healthy snack options include fruits, curd, nuts, sprouts, peanut butter toast, boiled eggs, or paneer cubes depending on your goal."
        })

    if has_any(["protein"]):
        return jsonify({
            "reply": "Protein-rich foods include eggs, paneer, chicken, fish, curd, milk, dal, chana, sprouts, tofu, and peanuts."
        })

    if has_any(["fiber", "digestion"]):
        return jsonify({
            "reply": "Fiber-rich foods include oats, fruits, vegetables, sprouts, dal, beans, seeds, and whole grains."
        })

    if has_any(["calorie", "calories"]):
        return jsonify({
            "reply": "Calories are your energy intake. For weight loss, keep calories controlled. For weight gain, increase them. For muscle gain, combine enough calories with high protein."
        })

    if has_any(["timing", "meal timing", "what time"]):
        return jsonify({
            "reply": "A simple meal schedule is breakfast around 8 AM, lunch around 1 PM, snack around 5 PM, and dinner around 8 PM."
        })

    if has_any(["alternative", "replace", "substitute"]):
        return jsonify({
            "reply": "You can replace foods with others from the same meal type and goal. For example, oats with poha, paneer with tofu, and chicken with eggs or fish."
        })

    if has_any(["hi", "hello", "hey"]):
        return jsonify({
            "reply": "Hello! Ask me about weight loss, weight gain, muscle gain, breakfast, dinner, protein foods, calorie control, or healthy alternatives."
        })

    return jsonify({
        "reply": "I can help with diet topics like fat loss, weight gain, muscle gain, breakfast, lunch, dinner, snacks, protein, calories, fiber, meal timing, and food alternatives."
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)