import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req,res)=>{
  /* 
  
  1. Get user details from frontend 
  2. validation (if not empty etc..)
  3. check if user already exist : username
  4. check for images , check for avatar
  5. upload them to cloudinary, avatar
  6. create user object - create entry in db
  7. remove password and refresh token field from response 
  8. check for user creation 
  9. return res (response)
  
  */
   
  // req.body => from -> json or form 
  const { fullName , email , username , password  } 
  = req.body

/* 
  if(fullName === ""){
    throw new ApiError(400,"FullName is required")
  } 
*/

if(
    [fullName,email,username,password].some((field) => field?.trim()==="")
){
    throw new ApiError(400,"All fields are required")
}

const existedUser = await User.findOne({
    $or:[{ username },{ email }]
})

if(existedUser){
    throw new ApiError(409,"User with email or username already exists")
}

console.log(req.files);
//name = avatar so ,
const avatarLocalPath = req.files?.avatar[0]?.path; 
//const coverImageLocalPath = req.files?.coverImage[0]?.path; 

let coverImageLocalPath ;
if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0) {
  coverImageLocalPath = req.files.coverImage[0].path
}

//check for avatar 
if(!avatarLocalPath){
    throw new ApiError(400,"Avatar file is required")
}


const avatar = await uploadOnCloudinary(avatarLocalPath) //because it takes time

const coverImage = await uploadOnCloudinary(coverImageLocalPath) //because it takes time



//check for avatar again
if(!avatarLocalPath){
  throw new ApiError(400,"Avatar file is required")
}

const user = await User.create({
  
  fullName,
  avatar : avatar.url,
  coverImage:coverImage?.url || "",
  email,
  password,
  username:username.toLowerCase()

})

// to check user created or not , and delete password later

const createdUser = await  User.findById(user._id).select(
  "-password -refreshToken"
)

if(!createdUser){
  throw new ApiError(500,"Server Error user not regist. ")
}

//now send response back
//return it 

return res.status(201).json(
  new ApiResponse(200,createdUser,"User registered Successfully")
)




})

export {registerUser} 