import os
from fastapi import FastAPI
from pydantic import BaseModel
try:
    from gliner2 import GLiNER2
except Exception:
    GLiNER2=None
app=FastAPI(title="PARAKH GLiNER2 Semantic Service")
model=None
@app.on_event("startup")
async def startup():
    global model
    if GLiNER2 is None:return
    try:model=GLiNER2.from_pretrained(os.getenv("GLINER_MODEL","fastino/gliner2-base-v1"))
    except Exception:model=None
@app.get("/health")
def health(): return {"status":"ok","service":"parakh-gliner2","model":os.getenv("GLINER_MODEL","fastino/gliner2-base-v1"),"loaded":model is not None}
class Payload(BaseModel): evidence:list[dict]=[]
@app.post("/map")
def map_fields(p:Payload):
    text="\n".join(str(x.get("text", "")) for x in p.evidence)
    if model is not None:
        labels=["PRODUCT_NAME","BRAND","MRP","NET_QUANTITY","MANUFACTURER","PACKER","MARKETER","IMPORTER","ADDRESS","BATCH_NUMBER","DATE_OF_MANUFACTURE","DATE_OF_PACKING","BEST_BEFORE","EXPIRY_DATE","CONSUMER_CARE","COUNTRY_OF_ORIGIN","FSSAI_LICENSE","BARCODE"]
        try:return {"provider":"gliner2-local","entities":model.extract_entities(text,labels)}
        except Exception:pass
    return {"provider":"gliner2-local-fallback","entities":[]}
