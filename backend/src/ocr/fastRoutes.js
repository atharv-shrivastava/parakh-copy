import "dotenv/config";
import express from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth.js";

const router=express.Router();
const upload=multer({storage:multer.memoryStorage(),limits:{files:Number(process.env.OCR_MAX_IMAGES_PER_REQUEST||6),fileSize:Number(process.env.OCR_MAX_IMAGE_SIZE_BYTES||8388608)}});

router.post("/analyze",authenticate,upload.array("images",Number(process.env.OCR_MAX_IMAGES_PER_REQUEST||6)),async(req,res)=>{
  try{
    const files=req.files||[]; if(!files.length)return res.status(400).json({error:"At least one image is required."});
    const target=String(process.env.PADDLE_OCR_URL||"http://localhost:8081").replace(/\/$/,"");
    const fd=new FormData(); for(const f of files)fd.append("images",new Blob([f.buffer],{type:f.mimetype}),f.originalname||"image.jpg");
    const response=await fetch(`${target}/api/ocr/analyze`,{method:"POST",body:fd,signal:AbortSignal.timeout(Number(process.env.OCR_TIMEOUT_MS||45000))});
    const data=await response.json().catch(()=>({})); if(!response.ok)return res.status(502).json({error:data?.error||data?.detail||`PaddleOCR service failed (${response.status})`});
    res.json({result:data.result||data,provider:data.provider||"paddleocr",model:data.model||"PaddleOCR",semantic:data.semantic||null,detectionProvider:data.detectionProvider||"paddleocr",detectionProviders:data.detectionProviders||["paddleocr"],fallbackReason:data.fallbackReason||null});
  }catch(e){res.status(e?.name==="TimeoutError"?504:502).json({error:e?.message||"OCR service unavailable"});}
});
export default router;
