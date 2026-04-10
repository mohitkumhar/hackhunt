import express, { Request, Response } from "express";
import cors from "cors";
import { connectDB, Participant, Question, Submission } from "./services/db";

// Connect to MongoDB
connectDB();

export const app = express();

app.use(cors());
app.use(express.json());

const WANDBOX_API = "https://wandbox.org/api/compile.json";

// Map our language names to Wandbox compiler IDs (exact names from Wandbox API)
const COMPILER_MAP: Record<string, { compiler: string; options?: string }> = {
  python:     { compiler: "cpython-3.12.7" },
  javascript: { compiler: "nodejs-20.17.0" },
  "c++":      { compiler: "gcc-13.2.0" },
  c:          { compiler: "gcc-13.2.0-c" },
  java:       { compiler: "openjdk-jdk-22+36" },
  go:         { compiler: "go-1.23.2" },
};

app.post("/api/execute", async (req: Request, res: Response): Promise<any> => {
  try {
    const pistonReq = req.body;
    const lang = pistonReq.language as string;
    const code = pistonReq.files?.[0]?.content || "";
    const compilerInfo = COMPILER_MAP[lang];

    if (!compilerInfo) {
      return res.status(400).json({ run: { stdout: "", stderr: `Unsupported language: ${lang}` }, compile: null });
    }

    const wandboxBody: Record<string, string> = {
      code,
      compiler: compilerInfo.compiler,
    };
    if (compilerInfo.options) {
      wandboxBody["compiler-option-raw"] = compilerInfo.options;
    }

    console.log(`Executing ${lang} code via Wandbox (${compilerInfo.compiler})...`);

    const response = await fetch(WANDBOX_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wandboxBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Wandbox returned ${response.status}: ${errText}`);
      return res.status(200).json({
        compile: null,
        run: { stdout: "", stderr: `Execution engine error (${response.status})`, signal: null, code: 1 },
      });
    }

    const result = await response.json() as Record<string, string>;
    const hasCompileError = result.compiler_error && result.status !== "0" && !result.program_output;
    const pistonResponse = {
      compile: hasCompileError ? { code: 1, output: result.compiler_error || "" } : null,
      run: {
        stdout: result.program_output || "",
        stderr: result.program_error || "",
        signal: result.signal || null,
        code: parseInt(result.status || "0", 10),
      },
    };

    return res.status(200).json(pistonResponse);
  } catch (err: any) {
    console.error("Execution API error:", err);
    return res.status(502).json({ message: "Failed to reach execution engine" });
  }
});

// -----------------------------------
// 1. START QUIZ API
// -----------------------------------
app.post("/api/start-quiz", async (req: Request, res: Response): Promise<any> => {
  try {
    const { participantId, username, eventType, year } = req.body;

    if (!participantId || !username || !eventType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if participant already started
    let participant = await Participant.findOne({ participantId });
    
    if (!participant) {
      participant = new Participant({
        participantId,
        username,
        eventType,
        year: year || null,
        startTime: Date.now(),
        durationMinutes: 40
      });
      await participant.save();
      console.log(`New participant registered: ${username} (${participantId})`);
    } else {
      console.log(`Existing participant continuing: ${participant.username} (${participantId})`);
    }

    res.status(200).json({
      message: "Quiz started",
      startTime: participant.startTime,
      durationMinutes: participant.durationMinutes
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------
// 2. SUBMIT ANSWER API
// -----------------------------------
app.post("/api/submit-answer", async (req: Request, res: Response): Promise<any> => {
  try {
    const { participantId, username, questionId, answer, timeTaken } = req.body;

    const participant = await Participant.findOne({ participantId });
    if (!participant) {
      return res.status(404).json({ error: "Participant not found. Start quiz first." });
    }

    // 2. TIMER VALIDATION
    const endTime = participant.startTime + (participant.durationMinutes * 60 * 1000);
    const currentTime = Date.now();

    if (currentTime > endTime) {
      return res.status(403).json({ error: "Time Over" });
    }

    // Fetch the question
    const questionDoc = await Question.findOne({ questionId });
    if (!questionDoc) {
      return res.status(404).json({ error: "Question not found" });
    }

    let score = null;
    let isCorrect = null;

    if (participant.eventType !== "blind_coding") {
      if (answer === questionDoc.correctAnswer) {
        score = questionDoc.maxScore;
        isCorrect = true;
      } else {
        score = 0;
        isCorrect = false;
      }
    }

    // Store in submissions
    // Note: If user submits multiple times for the same question, we might want to update or append.
    // The instructions say "Store in submissions". We'll just create a new record or update existing.
    // Let's use findOneAndUpdate with upsert to prevent duplicates for the same question
    
    await Submission.findOneAndUpdate(
      { participantId, questionId },
      {
        username,
        participantId,
        eventType: participant.eventType,
        year: participant.year,
        questionId,
        question: questionDoc.question,
        answer,
        timeTaken,
        score,
        isCorrect,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Update aggregate participant metrics
    const qIndex = participant.questionDetails.findIndex((q: any) => q.questionId === questionId);
    if (qIndex >= 0) {
      participant.totalTimeTaken -= (participant.questionDetails[qIndex].timeTaken || 0);
      participant.totalScore -= (participant.questionDetails[qIndex].score || 0);
      participant.questionDetails[qIndex].timeTaken = timeTaken;
      participant.questionDetails[qIndex].isCorrect = isCorrect;
      participant.questionDetails[qIndex].score = isCorrect ? score : 0;
    } else {
      participant.totalQuestionsSubmitted = (participant.totalQuestionsSubmitted || 0) + 1;
      participant.questionDetails.push({ questionId, timeTaken, isCorrect, score: isCorrect ? score : 0 });
    }
    participant.totalTimeTaken = (participant.totalTimeTaken || 0) + timeTaken;
    participant.totalScore = (participant.totalScore || 0) + (isCorrect ? score : 0);
    await participant.save();

    res.status(200).json({ success: true, isCorrect, score });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------
// 4. FETCH QUESTIONS API
// -----------------------------------
app.get("/api/questions", async (req: Request, res: Response): Promise<any> => {
  try {
    const { eventType, year } = req.query;
    const filter: any = {};
    if (eventType) filter.eventType = eventType;
    if (year) filter.year = Number(year);

    const questions = await Question.find(filter);
    // Don't expose correctAnswer to frontend!
    const sanitized = questions.map((q: any) => ({
      questionId: q.questionId,
      question: q.question,
      eventType: q.eventType,
      year: q.year,
      maxScore: q.maxScore
    }));

    res.status(200).json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------
// 5. LEADERBOARD API
// -----------------------------------
app.get("/api/leaderboard", async (req: Request, res: Response): Promise<any> => {
  try {
    const { eventType, year } = req.query;
    
    const filter: any = {};
    if (eventType) filter.eventType = eventType;
    if (year) filter.year = Number(year);

    const leaderboardRaw = await Participant.find(filter)
      .sort({ totalScore: -1, totalTimeTaken: 1 }) // Highest score first, then least time taken
      .select('participantId username eventType totalQuestionsSubmitted totalTimeTaken totalScore questionDetails');

    // Format the response for the frontend
    const leaderboard = leaderboardRaw.map(p => ({
      participantId: p.participantId,
      username: p.username,
      eventType: p.eventType,
      totalScore: p.totalScore,
      totalQuestionsSubmitted: p.totalQuestionsSubmitted,
      totalTimeTaken: p.totalTimeTaken,
      questionDetails: p.questionDetails
    }));

    res.status(200).json(leaderboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
