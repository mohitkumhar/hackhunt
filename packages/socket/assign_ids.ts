import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Support ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configDir = path.resolve(__dirname, '../../config');
const mongoUri = "mongodb+srv://hackhunt:hackhunt%40madhav@cluster0.my6eqmb.mongodb.net/hackhunt?retryWrites=true&w=majority&appName=Cluster0";

const questionSchema = new mongoose.Schema({
  eventType: { type: String, required: true },
  year: { type: Number, default: null },
  questionId: { type: String, required: true },
  question: { type: String, required: true },
  correctAnswer: { type: String },
  maxScore: { type: Number, default: 10 }
});
const Question = mongoose.models.Question || mongoose.model("Question", questionSchema);

async function processFiles() {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");

  const modes = ['blind_coding', 'bug_hunting', 'quizz', 'reverse_programming'];
  let totalAdded = 0;
  let totalMissingFixed = 0;

  for (const mode of modes) {
    const dirPath = path.join(configDir, mode);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      let modified = false;
      const lowerFile = file.toLowerCase();
      let yearNum = 1; // Default to 1st year
      if (lowerFile.includes('second')) yearNum = 2;
      if (lowerFile.includes('senior')) yearNum = 3;
      
      let eventType = mode === "quizz" ? "quiz" : mode;

      if (data.questions && Array.isArray(data.questions)) {
        for (const q of data.questions) {
          if (!q.id) {
            q.id = randomUUID();
            modified = true;
            totalMissingFixed++;
          }

          // Convert answer/solution correctly to string
          let correctAnswer = "None";
          if (q.solution !== undefined) correctAnswer = String(q.solution);
          else if (q.expectedOutput !== undefined) correctAnswer = String(q.expectedOutput);

          // Find or create question in MongoDB
          const existing = await Question.findOne({ questionId: q.id });
          if (!existing) {
            await Question.create({
              eventType: eventType,
              year: yearNum,
              questionId: q.id,
              question: q.title || q.question || "No Title",
              correctAnswer: correctAnswer,
              maxScore: q.points || q.time || 500
            });
            totalAdded++;
          }
        }
      }

      if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Updated ${file} with missing IDs.`);
      }
    }
  }

  console.log(`Finished processing. Inserted ${totalAdded} new questions to DB. Assigned IDs for ${totalMissingFixed} questions in config files.`);
  process.exit(0);
}

processFiles().catch(err => {
  console.error(err);
  process.exit(1);
});
