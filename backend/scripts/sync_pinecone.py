import os
import sys
from dotenv import load_dotenv

# Add parent dir to path so we can import config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from config import supabase
from pinecone import Pinecone, ServerlessSpec
import cohere

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
COHERE_API_KEY = os.getenv("COHERE_API_KEY")

if not PINECONE_API_KEY or not COHERE_API_KEY:
    print("Error: PINECONE_API_KEY and COHERE_API_KEY must be set in .env")
    sys.exit(1)

print("Initializing clients...")
pc = Pinecone(api_key=PINECONE_API_KEY)
co = cohere.Client(api_key=COHERE_API_KEY)

INDEX_NAME = os.getenv("PINECONE_INDEX", "flavour-products")
EMBED_MODEL = "embed-english-v3.0"
DIMENSION = 1024 # embed-english-v3.0 has 1024 dimensions

# Check if index exists, if not create it
existing_indexes = [index_info["name"] for index_info in pc.list_indexes()]
if INDEX_NAME not in existing_indexes:
    print(f"Creating Pinecone index '{INDEX_NAME}'...")
    pc.create_index(
        name=INDEX_NAME,
        dimension=DIMENSION,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1")
    )
else:
    print(f"Pinecone index '{INDEX_NAME}' already exists.")

index = pc.Index(INDEX_NAME)

print("Fetching products from Supabase...")
res = supabase.table("products").select("id, name").execute()
products = res.data or []

if not products:
    print("No products found in Supabase.")
    sys.exit(0)

print(f"Fetched {len(products)} products. Generating embeddings...")

# Cohere allows batch processing of strings for embeddings
texts = [p["name"] for p in products]
ids = [str(p["id"]) for p in products]
metadata = [{"name": p["name"]} for p in products]

BATCH_SIZE = 96 # Cohere recommended batch size for embeddings
total_upserted = 0

for i in range(0, len(texts), BATCH_SIZE):
    batch_texts = texts[i:i+BATCH_SIZE]
    batch_ids = ids[i:i+BATCH_SIZE]
    batch_metadata = metadata[i:i+BATCH_SIZE]
    
    print(f"Processing batch {i//BATCH_SIZE + 1}...")
    
    # Generate embeddings
    embed_res = co.embed(
        texts=batch_texts,
        model=EMBED_MODEL,
        input_type="search_document" # Since these are documents we search against
    )
    embeddings = embed_res.embeddings
    
    # Prepare vectors for Pinecone
    vectors = []
    for j in range(len(embeddings)):
        vectors.append({
            "id": batch_ids[j],
            "values": embeddings[j],
            "metadata": batch_metadata[j]
        })
        
    # Upsert to Pinecone
    index.upsert(vectors=vectors)
    total_upserted += len(vectors)

print(f"Success! Upserted {total_upserted} product vectors to Pinecone.")
