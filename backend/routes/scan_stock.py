# backend/routes/scan_stock.py
# OCR Stock Update Route — uses Groq Llama 4 Scout Vision (free tier)

import os
import re
import json
import base64
import tempfile
import time
from flask import Blueprint, request, jsonify, current_app
from rapidfuzz import process, fuzz  # FIXED: Added rapidfuzz for fuzzy matching
from middleware.auth import require_auth
from config import supabase
from services.inventory_ledger import log_stock_change

scan_stock_bp = Blueprint("scan_stock", __name__)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")


def image_to_base64(image_path):
    """Convert image file to base64 string."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def call_groq_ocr(image_path, mime_type="image/jpeg"):
    """
    Send image to Groq Llama 4 Scout Vision and extract product + qty pairs.
    Returns list of dicts: [{"product_name": "...", "qty_sold": 10}]
    """
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)
    image_b64 = image_to_base64(image_path)

    response = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_b64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": """This is a handwritten stock sheet with 2 columns: Product Name and Quantity Sold.

Extract every row and return ONLY a JSON array like this:
[
  {"product_name": "Vanillin", "qty_sold": 500},
  {"product_name": "Rose Essence", "qty_sold": 5}
]

Rules:
- Skip the header row
- product_name must be a string
- qty_sold must be a number only (no units)
- Skip rows you cannot read clearly
- Return ONLY the JSON array, no explanation, no markdown, no backticks"""
                    }
                ]
            }
        ],
        temperature=0.1,
        max_tokens=1000
    )

    text = response.choices[0].message.content.strip()
    print("GROQ RAW RESPONSE:", text)  # ← add this

    # Clean accidental markdown backticks
    text = re.sub(r"```json|```", "", text).strip()

    # Parse JSON
    extracted = json.loads(text)

    # Validate and clean
    cleaned = []
    for item in extracted:
        product = str(item.get("product_name", "")).strip()
        try:
            qty = float(str(item.get("qty_sold", 0)).replace(",", ""))
        except (ValueError, TypeError):
            continue
        if product and qty > 0:
            cleaned.append({
                "product_name": product,
                "qty_sold": qty,
                "raw_text": f"{product} | {qty}"
            })

    return cleaned


@scan_stock_bp.route("/scan-stock", methods=["POST"])
@require_auth
def scan_stock():
    """
    Accepts a photo of a handwritten stock sheet.
    Returns extracted product name + qty sold pairs as JSON.
    """
    if not GROQ_API_KEY:
        return jsonify({"error": "GROQ_API_KEY not set in backend/.env", "data": None}), 500

    if "image" not in request.files:
        return jsonify({"error": "No image uploaded", "data": None}), 400

    image_file = request.files["image"]

    if image_file.filename == "":
        return jsonify({"error": "Empty filename", "data": None}), 400

    ext = os.path.splitext(image_file.filename)[1].lower()
    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".heic": "image/heic",
        ".webp": "image/webp"
    }
    mime_type = mime_map.get(ext, "image/jpeg")

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext or ".jpg") as tmp:
        image_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        extracted = call_groq_ocr(tmp_path, mime_type)

        if not extracted:
            return jsonify({
                "error": "Could not read any rows. Try a clearer photo in good lighting.",
                "data": []
            }), 200

        return jsonify({
            "data": extracted,
            "count": len(extracted),
            "error": None
        })

    except json.JSONDecodeError:
        current_app.logger.error("failed to parse OCR response as JSON")
        return jsonify({"error": "Could not parse response. Try a clearer photo.", "data": None}), 500

    except Exception as e:
        import traceback
        traceback.print_exc()
        current_app.logger.error("failed to scan stock image: %s", e)
        return jsonify({"error": str(e), "data": None}), 500

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@scan_stock_bp.route("/confirm-scan", methods=["POST"])
@require_auth
def confirm_scan():
    """
    Accepts confirmed OCR/Voice/Manual results and updates stock in Supabase.

    Smart two-phase resolution:
      Phase 1 — ID-based (O(1) per item, single targeted Supabase query):
        Items that carry a product_id are fetched in one .in_("id", [...]) call.
        No fuzzy matching, no name comparison, zero ambiguity.

      Phase 2 — Name-based fallback (only for items WITHOUT a product_id):
        Falls back to tiered name matching:
        1. Exact case-sensitive name
        2. Case-insensitive normalized name
        3. Alphanumeric punctuation-stripped name
        4. Rapidfuzz WRatio fallback (score_cutoff=70)
    """
    from config import supabase

    body = request.get_json() or {}
    items = body.get("items", [])
    action = body.get("action", "outbound")

    if not items:
        return jsonify({"error": "No items to process", "data": None}), 400

    results = []
    errors = []

    # ── Separate items into ID-based and name-based buckets ──
    id_items = []       # Items with a product_id → fast path
    name_items = []     # Items without a product_id → fallback path

    for item in items:
        product_name = (item.get("product_name") or "").strip()
        item_id = item.get("product_id")

        try:
            qty_sold = float(item.get("qty_sold", 0))
        except (ValueError, TypeError):
            qty_sold = 0.0

        if qty_sold <= 0:
            continue

        parsed = {"product_name": product_name, "product_id": item_id, "qty_sold": qty_sold}

        if item_id:
            id_items.append(parsed)
        elif product_name:
            name_items.append(parsed)
        # else: skip — no ID and no name

    # ── Phase 1: ID-based targeted fetch ──
    products_by_id = {}
    if id_items:
        unique_ids = list({str(it["product_id"]) for it in id_items})
        try:
            res = supabase.table("products") \
                .select("id, name, stock_qty") \
                .in_("id", unique_ids) \
                .execute()
            for p in (res.data or []):
                products_by_id[str(p["id"])] = p
        except Exception as e:
            current_app.logger.error("failed to fetch products by ID: %s", e)
            return jsonify({"error": f"Database error: {str(e)}", "data": None}), 500

    for item in id_items:
        pid = str(item["product_id"])
        product = products_by_id.get(pid)

        if not product:
            errors.append(f"Product ID '{pid}' not found in database")
            continue

        _apply_stock_change(product, item["qty_sold"], action, results, errors, supabase)

    # ── Phase 2: Name-based fallback (only if needed) ──
    if name_items:
        try:
            all_products_res = supabase.table("products").select("id, name, stock_qty").execute()
            all_products = all_products_res.data or []
        except Exception as e:
            current_app.logger.error("failed to fetch products for name matching: %s", e)
            return jsonify({"error": f"Database error: {str(e)}", "data": None}), 500

        # Build lookup dictionaries
        by_exact = {}
        by_norm = {}
        by_clean = {}

        for p in all_products:
            p_name = p.get("name")
            if not p_name:
                continue

            if p_name not in by_exact:
                by_exact[p_name] = p

            norm = " ".join(p_name.strip().lower().split())
            if norm and norm not in by_norm:
                by_norm[norm] = p

            clean = re.sub(r'[^a-z0-9]', '', norm)
            if clean and clean not in by_clean:
                by_clean[clean] = p

        catalog_names = list(by_exact.keys())

        for item in name_items:
            product_name = item["product_name"]
            product = None

            # Tier 1: Exact case-sensitive
            if product_name in by_exact:
                product = by_exact[product_name]

            # Tier 2: Normalized lowercase
            if not product:
                norm_name = " ".join(product_name.lower().split())
                if norm_name in by_norm:
                    product = by_norm[norm_name]

            # Tier 3: Alphanumeric stripped
            if not product:
                clean_name = re.sub(r'[^a-z0-9]', '', norm_name)
                if clean_name in by_clean:
                    product = by_clean[clean_name]

            # Tier 4: Rapidfuzz fallback
            if not product and catalog_names:
                match = process.extractOne(
                    product_name,
                    catalog_names,
                    scorer=fuzz.WRatio,
                    score_cutoff=70
                )
                if match:
                    product = by_exact.get(match[0])

            if not product:
                errors.append(f"Product '{product_name}' not found (no close match)")
                continue

            _apply_stock_change(product, item["qty_sold"], action, results, errors, supabase)

    user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
    current_app.logger.info(
        "user %s confirmed scan: %d items updated, %d errors, action=%s",
        user_email, len(results), len(errors), action
    )
    return jsonify({
        "data": results,
        "errors": errors,
        "error": None
    })


def _apply_stock_change(product, qty_sold, action, results, errors, supabase):
    """
    Shared helper: applies a single stock change (inbound/outbound) to a product.
    Mutates `product["stock_qty"]` in-memory so subsequent rows for the same
    product within the same request see the updated value.
    """
    matched_name = product["name"]
    current_stock = float(product.get("stock_qty", 0) or 0)

    if action == "inbound":
        new_stock = current_stock + qty_sold
        note_action = "added"
    else:
        new_stock = current_stock - qty_sold
        note_action = "deducted"

        if new_stock < 0:
            errors.append(
                f"Insufficient stock for '{matched_name}': "
                f"tried to deduct {qty_sold} but only {current_stock} available"
            )
            return

    try:
        supabase.table("products") \
            .update({"stock_qty": round(new_stock, 6)}) \
            .eq("id", product["id"]) \
            .execute()

        # Update in-memory so subsequent rows for the same product stay correct
        product["stock_qty"] = new_stock

        log_stock_change(
            "product", product["id"],
            qty_sold if action == "inbound" else -qty_sold,
            new_stock,
            f"scan_{action}", f"Scanner {note_action} {qty_sold} units"
        )

        results.append({
            "product": matched_name,
            "qty_updated": qty_sold,
            "new_stock": new_stock
        })
    except Exception as e:
        current_app.logger.error("failed to update stock for product %s: %s", product["id"], e)
        errors.append(f"Failed to update '{matched_name}': {str(e)}")