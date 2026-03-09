/**
 * Chatbot router – Express routes for chatbot API.
 * Mount at /api/chatbot
 */

import { Router } from "express";
import { handleMessage, handleCommand, handleHelp } from "./chatbot.controller";

const router = Router();

router.post("/message", (req, res) => void handleMessage(req, res));
router.post("/command", (req, res) => void handleCommand(req, res));
router.get("/help", (req, res) => void handleHelp(req, res));

export default router;
