import mongoose from 'mongoose';
import express from 'express';
import { DB_NAME } from '../constant.js';

const app = express();

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`mongodb connected !! DB HOST: ${connectionInstance.connection.host}`)
    } catch (error) {
        console.log(`mongoose conection error`,error);
        process.exit(1)
    }
}

export default connectDB