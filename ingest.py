import os
import time
from uuid import uuid4
from docx import Document
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec, Vector
import openai

# === 🌍 Load Environment ===
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY_INDIVILLAGE")
PINECONE_INDEX = os.getenv("PINECONE_OPENAI_INDIVILLAGE")
PINECONE_NAMESPACE = os.getenv("PINECONE_NAMESPACE_INDIVILLAGE")

# === 🔐 Initialize APIs ===
openai.api_key = OPENAI_API_KEY
pc = Pinecone(api_key=PINECONE_API_KEY)

# === 🌲 Ensure Pinecone Index Exists ===
if PINECONE_INDEX not in pc.list_indexes().names():
    print(f"Index '{PINECONE_INDEX}' not found. Creating...")
    try:
        pc.create_index(
            name=PINECONE_INDEX,
            dimension=3072,  # for text-embedding-3-large
            metric='cosine',
            spec=ServerlessSpec(cloud='aws', region='us-east-1')
        )
        print(f"✅ Index '{PINECONE_INDEX}' created.")
        time.sleep(5)
    except Exception as e:
        print(f"❌ Failed to create index: {e}")
        exit()

index = pc.Index(PINECONE_INDEX)

# === 📄 Load and Chunk Document ===
DOC_PATH = os.path.join(os.path.dirname(__file__), "document.docx")
if not os.path.exists(DOC_PATH):
    print(f"❌ document.docx not found at {DOC_PATH}")
    exit()

doc = Document(DOC_PATH)
text = "\n".join([p.text.strip() for p in doc.paragraphs if p.text.strip()])

def chunk_text(text, chunk_size=1000, overlap=250):
    chunks, start = [], 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

chunks = chunk_text(text)

# === 🚀 Upload Chunks to Pinecone ===
start_time = time.perf_counter()
success_count = 0

for i, chunk in enumerate(chunks):
    try:
        response = openai.embeddings.create(
            model="text-embedding-3-large",
            input=chunk
        )
        embedding = response.data[0].embedding

        vector = Vector(
            id=str(uuid4()),
            values=embedding,
            metadata={"text": chunk}
        )
        index.upsert(vectors=[vector], namespace=PINECONE_NAMESPACE)
        success_count += 1
        print(f"✅ [{i+1}/{len(chunks)}] Upserted chunk.")

    except Exception as e:
        print(f"❌ Error at chunk {i+1}: {e}")

# === ⏱️ Final Summary ===
total_time = time.perf_counter() - start_time
print(f"\n✅ Ingestion complete. {success_count}/{len(chunks)} chunks uploaded.")
print(f"🕒 Total time: {total_time:.2f} seconds ({total_time/60:.2f} minutes)")
