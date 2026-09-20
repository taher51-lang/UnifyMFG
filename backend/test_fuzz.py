from rapidfuzz import process, fuzz

product_names = ["Red Apple", "Green Apple", "Banana"]

# What if user types just "Apple" twice?
match1 = process.extractOne("Apple", product_names, scorer=fuzz.WRatio, score_cutoff=70)
print(match1)
