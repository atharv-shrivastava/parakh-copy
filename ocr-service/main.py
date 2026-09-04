import os,io
from fastapi import FastAPI,UploadFile,File
from PIL import Image
from paddleocr import PaddleOCR
app=FastAPI(title="PARAKH PaddleOCR")
ocr=PaddleOCR(use_doc_orientation_classify=False,use_doc_unwarping=False,use_textline_orientation=False,lang="en")
@app.get("/health")
def health(): return {"status":"ok","service":"parakh-paddleocr"}
@app.post("/api/ocr/analyze")
async def analyze(images:list[UploadFile]=File(...)):
    texts=[];evidence=[]
    for idx,f in enumerate(images[:int(os.getenv("OCR_MAX_IMAGES_PER_REQUEST","6"))]):
        data=await f.read(); image=Image.open(io.BytesIO(data)).convert("RGB")
        result=ocr.predict(image)
        lines=[]
        for res in result:
            j=res.json if hasattr(res,"json") else {}
            lines.extend(j.get("res",{}).get("rec_texts",[]) or [])
        texts.extend(lines)
        for n,t in enumerate(lines): evidence.append({"id":f"paddle:{idx}:{n}","imageIndex":idx,"text":str(t).strip(),"confidence":0.8,"boundingBox":None})
    raw="\n".join(x for x in texts if x)
    return {"result":{"rawText":raw,"declarationEvidence":evidence},"provider":"paddleocr","model":"PaddleOCR","detectionProvider":"paddleocr","detectionProviders":["paddleocr"]}
