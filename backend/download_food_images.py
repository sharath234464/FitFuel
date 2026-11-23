import json
import os
import re
import time
from io import BytesIO

import requests
from PIL import Image


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FOOD_JSON = os.path.join(
    BASE_DIR,
    "data",
    "food.json"
)

IMAGE_DIR = os.path.abspath(
    os.path.join(
        BASE_DIR,
        "..",
        "frontend",
        "public",
        "images"
    )
)


# ============================================================
# SETTINGS
# ============================================================

# Process the COMPLETE dataset
TEST_MODE = False

# Used only if TEST_MODE = True
TEST_LIMIT = 5

# Wikimedia Commons API
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

# Request headers
HEADERS = {
    "User-Agent": (
        "FitFuelFoodImageDownloader/1.0 "
        "(educational project)"
    )
}

# Maximum image size
MAX_IMAGE_SIZE = (1200, 1200)

# Image quality
JPEG_QUALITY = 90

# Minimum score required before accepting an image
MINIMUM_SCORE = 30

# Delay between requests
REQUEST_DELAY = 1


# ============================================================
# MAKE SAFE FILENAME
# ============================================================

def make_filename(food_name):
    """
    Convert food name into a safe JPG filename.

    Example:
        Chicken Biryani -> chicken_biryani.jpg
        Masala Dosa -> masala_dosa.jpg
    """

    name = str(food_name).strip().lower()

    name = re.sub(
        r"[^a-z0-9]+",
        "_",
        name
    )

    name = name.strip("_")

    return f"{name}.jpg"


# ============================================================
# NORMALIZE TEXT
# ============================================================

def normalize_text(text):
    """
    Normalize text for matching food names.
    """

    text = str(text).lower()

    text = re.sub(
        r"[^a-z0-9\s]",
        " ",
        text
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


# ============================================================
# GET FOOD WORDS
# ============================================================

def get_food_tokens(food_name):
    """
    Extract useful words from food name.
    """

    stop_words = {
        "and",
        "with",
        "the",
        "of",
        "in",
        "on",
        "for",
        "style",
        "dish",
        "food"
    }

    words = normalize_text(
        food_name
    ).split()

    return [
        word
        for word in words
        if word not in stop_words
        and len(word) >= 2
    ]


# ============================================================
# SCORE SEARCH RESULT
# ============================================================

def calculate_score(food_name, title):

    food_normalized = normalize_text(
        food_name
    )

    title_normalized = normalize_text(
        title.replace(
            "File:",
            ""
        )
    )

    food_tokens = get_food_tokens(
        food_name
    )

    score = 0

    # --------------------------------------------------------
    # Exact complete food name
    # --------------------------------------------------------

    if food_normalized in title_normalized:
        score += 100

    # --------------------------------------------------------
    # Exact words
    # --------------------------------------------------------

    matched_tokens = 0

    for token in food_tokens:

        if token in title_normalized:

            matched_tokens += 1
            score += 25

    # --------------------------------------------------------
    # Percentage of food words matched
    # --------------------------------------------------------

    if food_tokens:

        match_ratio = (
            matched_tokens /
            len(food_tokens)
        )

        if match_ratio >= 1:
            score += 50

        elif match_ratio >= 0.75:
            score += 30

        elif match_ratio >= 0.5:
            score += 10

    # --------------------------------------------------------
    # Food-related words
    # --------------------------------------------------------

    food_related_words = [
        "food",
        "dish",
        "meal",
        "curry",
        "rice",
        "chicken",
        "fish",
        "vegetable",
        "vegetables",
        "dessert",
        "bread",
        "soup",
        "salad",
        "breakfast",
        "lunch",
        "dinner",
        "snack",
        "bowl",
        "roti",
        "naan",
        "dosa",
        "idli",
        "biryani",
        "paneer"
    ]

    for word in food_related_words:

        if word in title_normalized:

            score += 3

    return score


# ============================================================
# SEARCH WIKIMEDIA COMMONS
# ============================================================

def search_commons(food_name):

    print(
        f"\nSearching image for: {food_name}"
    )

    # Several searches improve results
    search_queries = [
        f'"{food_name}"',
        f"{food_name} food",
        f"{food_name} dish"
    ]

    best_result = None
    best_score = 0

    for search_query in search_queries:

        params = {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": search_query,
            "gsrnamespace": 6,
            "gsrlimit": 30,
            "prop": "imageinfo",
            "iiprop": "url|mime",
            "iiurlwidth": 1200
        }

        try:

            response = requests.get(
                COMMONS_API,
                params=params,
                headers=HEADERS,
                timeout=30
            )

            response.raise_for_status()

            data = response.json()

        except Exception as error:

            print(
                f"Search error: {error}"
            )

            continue

        pages = (
            data
            .get("query", {})
            .get("pages", {})
        )

        for page in pages.values():

            title = page.get(
                "title",
                ""
            )

            image_info = page.get(
                "imageinfo",
                []
            )

            if not image_info:
                continue

            info = image_info[0]

            mime = info.get(
                "mime",
                ""
            )

            # Only images
            if not mime.startswith(
                "image/"
            ):
                continue

            image_url = (
                info.get("thumburl")
                or info.get("url")
            )

            if not image_url:
                continue

            score = calculate_score(
                food_name,
                title
            )

            if score > best_score:

                best_score = score

                best_result = {
                    "title": title,
                    "url": image_url,
                    "score": score
                }

        # If we found a very strong match,
        # stop searching.
        if best_score >= 150:
            break

    # --------------------------------------------------------
    # Validate result
    # --------------------------------------------------------

    if best_result is None:

        print(
            "No image found."
        )

        return None

    if best_result["score"] < MINIMUM_SCORE:

        print(
            "No sufficiently relevant image found."
        )

        print(
            f"Best result: {best_result['title']}"
        )

        print(
            f"Score: {best_result['score']}"
        )

        return None

    print(
        f"Selected: {best_result['title']}"
    )

    print(
        f"Match score: {best_result['score']}"
    )

    return best_result["url"]


# ============================================================
# DOWNLOAD AND CONVERT IMAGE
# ============================================================

def download_image(
    image_url,
    output_path
):

    try:

        response = requests.get(
            image_url,
            headers=HEADERS,
            timeout=30
        )

        response.raise_for_status()

        image = Image.open(
            BytesIO(
                response.content
            )
        )

        # Convert everything to RGB
        image = image.convert(
            "RGB"
        )

        # Resize large images
        image.thumbnail(
            MAX_IMAGE_SIZE,
            Image.Resampling.LANCZOS
        )

        # Save as proper JPG
        image.save(
            output_path,
            "JPEG",
            quality=JPEG_QUALITY,
            optimize=True
        )

        return True

    except Exception as error:

        print(
            f"Download/conversion failed: {error}"
        )

        return False


# ============================================================
# MAIN
# ============================================================

def main():

    print()
    print("=" * 65)
    print("FITFUEL FOOD IMAGE DOWNLOADER")
    print("=" * 65)

    # --------------------------------------------------------
    # Check food.json
    # --------------------------------------------------------

    if not os.path.exists(
        FOOD_JSON
    ):

        print()
        print(
            "ERROR: food.json was not found."
        )

        print(
            FOOD_JSON
        )

        return

    # --------------------------------------------------------
    # Create images directory
    # --------------------------------------------------------

    os.makedirs(
        IMAGE_DIR,
        exist_ok=True
    )

    print()
    print(
        "Images folder:"
    )

    print(
        IMAGE_DIR
    )

    # --------------------------------------------------------
    # Read food.json
    # --------------------------------------------------------

    try:

        with open(
            FOOD_JSON,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(
                file
            )

    except Exception as error:

        print()
        print(
            f"ERROR reading food.json: {error}"
        )

        return

    # --------------------------------------------------------
    # Get dataset
    # --------------------------------------------------------

    foods = data.get(
        "foods_dataset",
        []
    )

    if not foods:

        print()
        print(
            "ERROR: foods_dataset not found."
        )

        return

    print()
    print(
        f"Total foods in dataset: {len(foods)}"
    )

    # --------------------------------------------------------
    # Choose foods
    # --------------------------------------------------------

    if TEST_MODE:

        foods_to_process = (
            foods[:TEST_LIMIT]
        )

        print()
        print(
            "TEST MODE ENABLED"
        )

        print(
            f"Processing first {len(foods_to_process)} foods."
        )

    else:

        foods_to_process = foods

        print()
        print(
            "FULL MODE ENABLED"
        )

        print(
            f"Processing all {len(foods_to_process)} foods."
        )

    # --------------------------------------------------------
    # Counters
    # --------------------------------------------------------

    successful = 0
    skipped_existing = 0
    failed = 0

    # --------------------------------------------------------
    # Process every food
    # --------------------------------------------------------

    for index, food in enumerate(
        foods_to_process,
        start=1
    ):

        food_name = str(
            food.get(
                "Food_Item",
                ""
            )
        ).strip()

        print()
        print("-" * 65)

        print(
            f"[{index}/{len(foods_to_process)}] {food_name}"
        )

        if not food_name:

            print(
                "Skipping: food name is empty."
            )

            failed += 1

            continue

        # ----------------------------------------------------
        # Filename
        # ----------------------------------------------------

        filename = make_filename(
            food_name
        )

        output_path = os.path.join(
            IMAGE_DIR,
            filename
        )

        # ----------------------------------------------------
        # Existing image
        # ----------------------------------------------------

        if os.path.exists(
            output_path
        ):

            print(
                "Image already exists - skipped."
            )

            # Make sure JSON points to it
            food["Image_URL"] = (
                f"/images/{filename}"
            )

            skipped_existing += 1

            continue

        # ----------------------------------------------------
        # Search
        # ----------------------------------------------------

        image_url = search_commons(
            food_name
        )

        if not image_url:

            print(
                "FAILED: no suitable image."
            )

            failed += 1

            continue

        # ----------------------------------------------------
        # Download
        # ----------------------------------------------------

        print(
            "Downloading..."
        )

        success = download_image(
            image_url,
            output_path
        )

        if success:

            # Update JSON
            food["Image_URL"] = (
                f"/images/{filename}"
            )

            successful += 1

            print(
                f"SUCCESS: {filename}"
            )

        else:

            failed += 1

            # Remove broken output if created
            if os.path.exists(
                output_path
            ):

                try:

                    os.remove(
                        output_path
                    )

                except Exception:
                    pass

        # ----------------------------------------------------
        # Wait
        # ----------------------------------------------------

        time.sleep(
            REQUEST_DELAY
        )

    # --------------------------------------------------------
    # Save updated JSON
    # --------------------------------------------------------

    try:

        with open(
            FOOD_JSON,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                data,
                file,
                indent=2,
                ensure_ascii=False
            )

        print()
        print(
            "food.json updated successfully."
        )

    except Exception as error:

        print()
        print(
            f"ERROR saving food.json: {error}"
        )

    # --------------------------------------------------------
    # Final summary
    # --------------------------------------------------------

    print()
    print("=" * 65)
    print("IMAGE DOWNLOAD COMPLETED")
    print("=" * 65)

    print(
        f"Total foods processed: {len(foods_to_process)}"
    )

    print(
        f"New images downloaded: {successful}"
    )

    print(
        f"Existing images kept: {skipped_existing}"
    )

    print(
        f"Failed / no suitable image: {failed}"
    )

    print()
    print(
        "Images folder:"
    )

    print(
        IMAGE_DIR
    )

    print()
    print(
        "food.json:"
    )

    print(
        FOOD_JSON
    )

    print("=" * 65)


# ============================================================
# START PROGRAM
# ============================================================

if __name__ == "__main__":
    main()