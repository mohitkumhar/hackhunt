import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in the environment variables");
    }
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("Connected to MongoDB -> hackhunt");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
};

// ======================================
// SCHEMAS & MODELS
// ======================================

const submissionSchema = new mongoose.Schema({
  username: { type: String, required: true },
  participantId: { type: String, required: true },
  eventType: { type: String, required: true, enum: ["quiz", "bug_hunting", "blind_coding", "reverse_programming"] },
  year: { type: Number, default: null }, // 1, 2, or null
  submissions: [{
    questionId: { type: String },
    question: { type: String },
    answer: { type: String },
    language: { type: String },
    timeTaken: { type: Number },
    score: { type: Number, default: null },
    isCorrect: { type: Boolean, default: null }
  }],
  createdAt: { type: Date, default: Date.now }
});

const questionSchema = new mongoose.Schema({
  eventType: { type: String, required: true },
  year: { type: Number, default: null },
  questionId: { type: String, required: true },
  question: { type: String, required: true },
  correctAnswer: { type: String },
  maxScore: { type: Number, default: 10 }
});

const participantSchema = new mongoose.Schema({
  participantId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  eventType: { type: String, required: true },
  year: { type: Number, default: null },
  startTime: { type: Number, required: true },
  durationMinutes: { type: Number, default: 40 },
  totalQuestionsSubmitted: { type: Number, default: 0 },
  totalTimeTaken: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  questionDetails: [{
    questionId: String,
    timeTaken: Number,
    isCorrect: Boolean,
    score: Number,
    language: String
  }],
  createdAt: { type: Date, default: Date.now }
});

export const Submission = mongoose.model("Submission", submissionSchema);
export const Question = mongoose.model("Question", questionSchema);
export const Participant = mongoose.model("Participant", participantSchema);
