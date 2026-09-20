# backend/routes/voice_stock.py
# Speech-to-Text Stock Update Route — uses Groq Whisper-large-v3 and Llama 3

import os
import re
import json
import tempfile
from flask import Blueprint, request, jsonify, current_app
from groq import Groq
from middleware.auth import require_auth

from pydantic import BaseModel, Field
from typing import List
from langchain_groq import ChatGroq

voice_stock_bp = Blueprint("voice_stock", __name__)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

def transcribe_audio(audio_path):
    """
    Transcribes audio file to text using Groq Whisper-large-v3.
    """
    client = Groq(api_key=GROQ_API_KEY)
    
    with open(audio_path, "rb") as f:
        transcription = client.audio.transcriptions.create(
            file=(os.path.basename(audio_path), f.read()),
            model="whisper-large-v3",
            response_format="json",
            temperature=0.0,
            language="en"
        )
    return transcription.text

class VoiceStockItem(BaseModel):
    product_name: str = Field(description="The full product name including any weights, volumes, or colors mentioned.")
    qty_sold: float = Field(description="The absolute numeric transaction quantity.")

class VoiceStockResult(BaseModel):
    items: List[VoiceStockItem] = Field(description="List of products and quantities extracted from the transcript.")

def parse_transcript_to_json(transcript_text):
    """
    Parses natural language speech transcript into product + quantity JSON list using LLM.
    Uses LangChain with_structured_output for guaranteed valid JSON in a single call.
    """
    llm = ChatGroq(api_key=GROQ_API_KEY, model="openai/gpt-oss-120b", temperature=0.0)
    structured_llm = llm.with_structured_output(VoiceStockResult)
    
    prompt = f"""Parse this voice transcription text and extract the product names and quantities mentioned.
    
Note: The transcription text may be in English, Hindi (Devanagari script like "गुलाब जल", "दश"), or Romanized Hindi/Hinglish (e.g., words like "das", "paanch", "aadha", "dhai", "ek", "do").

CRITICAL RULES FOR PRODUCT NAMES:
1. Our product names frequently contain weights, volumes, and sizes (e.g., "Blue Star 100g Pineapple Color", "Liquid Glucose 300L").
2. DO NOT split a product name just because it contains a number.
3. DO NOT confuse embedded weights (like "100g" or "500ml") with the transaction quantity.
4. The user will speak in a strict format like: "Product Name Quantity, Product Name Quantity". 
5. The true transaction quantity is usually the LAST number mentioned for each item in the sequence. Keep any preceding numbers, weights, or sizes intact as part of the product_name.
6. Translate any Hindi/Devanagari or Hinglish product names to English (e.g., "गुलाब जल" to "Rose Essence").
7. Convert the true transaction quantity words into standard numeric values (e.g., "ten", "das", "दस" -> 10).

Transcription text: "{transcript_text}"
"""

    try:
        print("CALLING LANGCHAIN STRUCTURED OUTPUT...")
        result = structured_llm.invoke(prompt)
        print("LANGCHAIN RESULT:", result)
        
        cleaned = []
        for item in result.items:
            product = item.product_name.strip()
            qty = item.qty_sold
            if product and qty > 0:
                cleaned.append({
                    "product_name": product,
                    "qty_sold": qty,
                    "raw_text": f"{product} | {qty}"
                })
        return cleaned
    except Exception as e:
        current_app.logger.error("Langchain structured output failed: %s", e)
        import traceback
        traceback.print_exc()
        raise ValueError(f"Failed to extract structured data from voice transcript: {e}")


@voice_stock_bp.route("/voice-stock", methods=["POST"])
@require_auth
def voice_stock():
    """
    Accepts an audio file of spoken stock commands.
    Transcribes it via Whisper, parses it to JSON, and returns it.
    """
    if not GROQ_API_KEY:
        return jsonify({"error": "GROQ_API_KEY not set in backend/.env", "data": None}), 500
        
    if "audio" not in request.files:
        return jsonify({"error": "No audio file uploaded", "data": None}), 400
        
    audio_file = request.files["audio"]
    
    if audio_file.filename == "":
        return jsonify({"error": "Empty filename", "data": None}), 400
        
    # Get extension or default to .webm / .wav
    ext = os.path.splitext(audio_file.filename)[1].lower() or ".webm"
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name
        
    try:
        transcript = transcribe_audio(tmp_path)
        print("WHISPER TRANSCRIPT:", transcript)
        
        if not transcript.strip():
            return jsonify({
                "error": "No speech detected. Please try speaking clearly.",
                "data": []
            }), 200
            
        extracted = parse_transcript_to_json(transcript)
        
        # ── 2. Run Semantic Match on LLM output ──
        from services.semantic_search import semantic_search_products
        for item in extracted:
            original_name = item.get("product_name", "")
            if not original_name:
                item["match_score"] = 0
                continue
                
            # Fetch top 3 semantic matches
            candidates = semantic_search_products(original_name, top_k=3)
            
            item["original_llm_name"] = original_name
            item["candidates"] = candidates
            
            if candidates:
                # Pre-select the best match
                item["product_name"] = candidates[0]["name"]
                item["match_score"] = candidates[0]["score"]
            else:
                item["match_score"] = 0
                
        return jsonify({
            "data": extracted,
            "transcript": transcript,
            "count": len(extracted),
            "error": None
        })
        
    except json.JSONDecodeError:
        current_app.logger.error("failed to parse voice transcript JSON")
        return jsonify({"error": "Could not parse the parsed voice results. Try speaking clearly.", "data": None}), 500
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        current_app.logger.error("failed to process voice stock: %s", e)
        return jsonify({"error": str(e), "data": None}), 500
        
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
