from rapidfuzz import process, fuzz

product_names = ["Apple", "Banana", "Cherry"]
items = [{"product_name": "Apple", "qty_sold": 5}, {"product_name": "Banana", "qty_sold": 3}]

for item in items:
    product_name = item.get("product_name")
    match = process.extractOne(
        product_name, 
        product_names, 
        scorer=fuzz.WRatio, 
        score_cutoff=70
    )
    print(f"Product: {product_name}, Match: {match}")

