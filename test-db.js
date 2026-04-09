require('dotenv').config();
const mongoose = require('mongoose');

async function checkConnection() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("FAIL! MONGO_URI is not defined in the environment variables.");
    process.exit(1);
  }

  console.log("Attempting to connect to MongoDB from Windows Host...");
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("SUCCESS! Connected cleanly to MongoDB Atlas!");
    process.exit(0);
  } catch (err) {
    console.error("FAIL! Could not connect:", err.message);
    process.exit(1);
  }
}

checkConnection();
