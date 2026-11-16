import mongoose from "mongoose";
import mongodb from "mongodb";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config({ path: "./.env" });
}

const connectDB = async () => {
  try {
    console.log("MongoDB connecting...");
    const connectionInfo = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected successfully: ${connectionInfo.connection.host}`);
    console.log(`Database: ${connectionInfo.connection.name}`);
    return connectionInfo;
  } catch (error) {
    console.error("MongoDB connection error: ", error.message);
    throw error;
  }
};

export default connectDB;