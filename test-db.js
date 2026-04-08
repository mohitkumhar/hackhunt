const mongoose = require('mongoose');

const uri = "mongodb+srv://hackhunt:hackhunt%40madhav@cluster0.my6eqmb.mongodb.net/hackhunt?retryWrites=true&w=majority&appName=Cluster0";

async function checkConnection() {
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
