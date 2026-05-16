import {v2 as clouninary} from 'cloudinary';
import fs from 'fs';
import { devNull } from 'os';

clouninary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECERT
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null 
        
        const response = await clouninary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        })
        console.log(`File is uploded on cloudinary ${response.url}`)
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath)
    }
}

export {uploadOnCloudinary}