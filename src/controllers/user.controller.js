import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from 'jsonwebtoken'
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, 'Something went wrong while generating the access and refresh token')
    }
}

const registerUser = asyncHandler( async (req, res) => {
    console.log("BODY:", req.body)
    console.log("FILES:", req.files)
    // GET USER INFORMATION FROM FRONTEND
    const {fullName, username, email, password} = req.body
    console.log(`email: ${email}`)
    // VALIDATION - NOT EMPTY (IN BIG PROJECT VALIDATIONS HAVE SEPRATE FILE WHERE WE CHECK ALL VALIDATIONS AND THEN CALL THAT FIEL)
    if (
        [username, email, fullName, password].some(fields => fields?.trim() === '')
    ) {
        throw new ApiError(400, 'All fields are required')
    }
    // CHECK IF USER IS ALREDY EXIST: USERNAME, E-MAIL
    const existedUser = await User.findOne({
        $or: [{email}, {username}]
    })
    if (existedUser) {
        throw new ApiError(409, 'User with this email and username already exist')
    }
    // CHECK FOR IMAGES AND AVATAR
    const avatarLocalPath = req.files?.avatar[0]?.path
    console.log(`Avatar Local Path: ${avatarLocalPath}`)
    const coverImageLocalPath = req.files?.coverImage[0]?.path
    console.log(`Cover Image Local Path: ${coverImageLocalPath}`)

    if (!avatarLocalPath) throw new ApiError(400, 'Avatar is required 1')
    if (!coverImageLocalPath) throw new ApiError(400, 'Cover Image is required')
    
    // UPLOAD AVATAR AND IMAGES ON CLOUDINARY
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar) throw new ApiError(400, 'Avatar is required 2')
    if (!coverImage) throw new ApiError(400, 'Cover Image is required')
    // CREATE USER OBJECT - CREATE ENTRY IN DATA-BASE
    const user = await User.create({
        username,
        avatar: avatar.url,
        coverImage: coverImage?.url || '',
        email,
        fullName,
        password
    })
    const createdUser = await User.findById(user._id).select('-password -refreshToken') // CHECK FOR USER CREATION & REMOVE PASSWORD AND REFRESHTOKEN FIELD FROM RESPONSE
    if(!createdUser) throw new ApiError(500, 'Something Went Wrong')

    console.log("Avatar:", avatar)
    console.log("CoverImage:", coverImage)
    // RETURN RESPONSE
    return res.status(201).json(
        new ApiResponse(200, createdUser, 'User registerd succesfully  ')
    )
} )

const loginUser = asyncHandler(async (req, res) => {
    // TAKE USER INFO USERNAME/EMAIL, PASSWORD
    // VERIFY USER INFO USERNAME/EMAIL, PASSWORD CORRECT OR NOT
    // SEND RESPONCE OR COOKIES TO USER OR STORE USER
    // GIVE A TOKEN OR SOMETHING SO THEY CAN ACCESS DATABASE
    // ^ STEPS I HAVE WRITTEN 

    // REQ BODY -> DATA
    const {email, username, password} = req.body
    // USERNAME OR EMAIL 
    if(!(email || username)) throw new ApiError(400, 'Email or Username Required')
    // FIND THE USER
    const user = await User.findOne({
        $or: [{email}, {username}]
    })

    if(!user) throw new ApiError(400, 'User not registered with username or email')
    // PASSWORD CHECK
    const isPasswordValid = await user.isPasswordCorrect(password) 
    if(!isPasswordValid) throw new ApiError(401, 'Password is incorrect')
    // ACCESS AND REFRESH TOKEN 
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select('-password -refreshToken')
    // SEND COOKIE
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser.accessToken.refreshToken
            }
        )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        user.req._id,
        {
            $set:{
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(200, {}, 'user logged out')
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.body.refreshToken || req.cookies.refreshToken

    if(!incomingRefreshToken) throw new ApiError(401, 'unauthorized request')

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECERT
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user) throw new ApiError(401, 'invalid refresh token')
    
        if(incomingRefreshToken !== user?.refreshToken) throw new ApiError(401, 'refresh token is expired or used')
    
        const options = {
            httpsOnly: true,
            secure: true
        }
    
        const {newAccessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie('accessToken', newAccessToken, options)
        .cookie('refreshToken', newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {newAccessToken, refreshToken: newRefreshToken},
                'Access Token Refreshed SuccessFully'
            )
        )
    } catch (error) {
        
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect) throw new ApiError(400, 'Invalid Old Password')

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password Changed Succefully'))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(200, req.user, 'Current User fetched Successfully')
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullName, email} = req.body

    if(!fullname || !email) throw new ApiError(400, 'All The Feilds Are Required')

    User.findByIdAndUpdate(
        req.user?._id, 
        {
            $set: {
                fullName,
                email
            }
        }, 
        {new: true}
    ).select('-password')

    return res.status(200).json(new ApiResponse(200, User, 'Account details updated successfully'))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath) throw new ApiError(400, 'Avatar File is missing')

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url) throw new ApiError(400, 'Error While uploading on Avatar')

    const user =  await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select('-password')

    return res.status(200).json(new ApiResponse(200, user, 'Avatar Updated Successfully'))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath) throw new ApiError(400, 'Cover Image File is missing')

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url) throw new ApiError(400, 'Error While uploading on Cover Image')

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select('-password')

    return res.status(200).json(new ApiResponse(200, user, 'Cover Image Updated Successfully'))
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params

    if(!username?.trim()) throw new ApiError(400, 'Username is missing')

    const channel = await User.aggregate([
        {
            $match: {
                username: username
            }
        },
        {
            $lookup: {
                from: "substriptions",
                localField: "_id",
                foreignField: 'channel',
                as: 'subscriber'
            }
        },
        {
            $lookup: {
                from: "substriptions",
                localField: "_id",
                foreignField: 'subscriber',
                as: 'subscribedTo'
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: '$subscriber'
                },
                channelsSubscribedToCounts: {
                    $size: '$subscribedTo'
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, '$subscribers.subcriber']},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCounts: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
            }
        }
    ])

    if(!channel?.length) throw new ApiError(404, 'channel does not exists')

    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], 'user fetched successfully'))
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: 'videos',
                localField: 'watchHistory',
                foreignField: '_id',
                as: 'watchHistory',
                pipeline: [
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'owner',
                            foreignField: '_id',
                            as: 'owner',
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: '$owner'
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200).json(new ApiResponse(
        200,
        user[0].watchHistory,
        'Watch History fetched Successfully'
    ))
})

export {registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory}