import express from "express";
import crypto from "node:crypto";
import prisma from "../lib/prisma.js";
import { authenticate, checkPassword, makePasswordHash } from "../middleware/auth.js";

const router = express.Router();
function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }
router.post("/register", async (req,res)=>{try{const name=String(req.body.name||"").trim();const email=normalizeEmail(req.body.email);const password=String(req.body.password||"");if(!name||!email||password.length<6)return res.status(400).json({error:"Name, email and a password of at least 6 characters are required"});if(await prisma.user.findUnique({where:{email}}))return res.status(409).json({error:"An account with this email already exists"});const user=await prisma.user.create({data:{name,email,role:"USER",passwordHash:makePasswordHash(password)}});res.status(201).json({id:user.id,name:user.name,email:user.email,role:user.role});}catch(error){res.status(500).json({error:error?.message||"Registration failed"});}});
router.post("/login", async (req,res)=>{try{const email=normalizeEmail(req.body.email);const password=String(req.body.password||"");const user=await prisma.user.findUnique({where:{email}});if(!user||!checkPassword(password,user.passwordHash))return res.status(401).json({error:"Invalid email or password"});const token=crypto.randomBytes(32).toString("hex");await prisma.session.create({data:{token,userId:user.id,expiresAt:new Date(Date.now()+1000*60*60*24*7)}});res.json({token,user:{id:user.id,name:user.name,email:user.email,role:user.role}});}catch(error){res.status(500).json({error:error?.message||"Login failed"});}});
router.get("/me",authenticate,async(req,res)=>res.json({id:req.user.id,name:req.user.name,email:req.user.email,role:req.user.role}));
router.post("/logout",authenticate,async(req,res)=>{await prisma.session.delete({where:{id:req.session.id}});res.json({message:"Logged out"});});
export default router;
