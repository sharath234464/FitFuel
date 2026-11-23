import json

with open("data/food.json", "r", encoding="utf-8") as f:
    data = json.load(f)

foods = data["foods_dataset"] if isinstance(data, dict) and "foods_dataset" in data else data

for item in foods:
    name = item.get("Food_Item", "food").replace(" ", "+")
    item["Image_URL"] = f"https://source.unsplash.com/400x300/?{name},food"

output = {"foods_dataset": foods} if isinstance(data, dict) and "foods_dataset" in data else foods

with open("data/food.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2)

print("Done: Image_URL added to all foods")