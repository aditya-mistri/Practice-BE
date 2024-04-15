import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

//when res is not used => _
//generate access and refresh token

const generateAccessAndRefreshTokens = async(userId)=>{
  try {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    //saving refreshToken in db
    user.refreshToken = refreshToken;
    // user.save() wrong
    await user.save({validBeforeSave:false})

    return {accessToken,refreshToken} 
    
  } catch (error) {
    throw new ApiError(500,"something went wrong genrating Access token and refresh token")
  }
}

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

const loginUser = asyncHandler(async(req,res)=>{

  // req body => data 
  // username or email 
  // find the user
  // check password
  // access and refresh token
  // send cookie
  // response that successfully logged in 

  const {email,username,password} = req.body

  if(!username && !email){
    throw new ApiError(400,"Username or Email required ")
  }

  const user = await  User.findOne({
    $or : [{username},{email}]
  })

  if(!user){
    throw new ApiError(404,"User does not exist")
  }
  
  // CAUTION : cant use User here , User is of mongoose , but we have generated user above (const user)


  const isPasswordValid = await user.isPasswordCorrect(password)

  if(!isPasswordValid){
    throw new ApiError(401,"Invalid Password credentials")
  }

  const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

  const loggedInUser = await User.findById(user._id).select("-password -refreshtoken" )

  const options = {
    httpOnly : true,
    secure:true
  }

  return res
  .status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken",refreshToken,options)
  .json(
    new ApiResponse(
      200,{
        user : loggedInUser,accessToken,
        refreshToken 
      },
      "User logged in successfully"
    )
  )


})


// we created an middle ware just to get loggged out
// in login we got it from req destructuring { , , }
// but for logut we cant get user input of name etc...
// so we created middle ware to get details (auth.middleware.js) 

const logoutUser = asyncHandler(async(req,res)=>{
  // ye kese mila req.user ?? 
  // aap login the , aap pe access token tha , usko leke humne query maari db pe , req.user add krdiya

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        refreshToken : undefined
      } 
    },
    {
      new :true
    }
  )

  const options = {
    httpOnly : true,
    secure:true
  }

  return res
  .status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200,"","User logged out successfully"))

})

const refreshAccessToken = asyncHandler(async (req,res)=>{
  const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken){
    throw new ApiError(401,"unauth request")
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )
  
    const user = await User.findById(decodedToken?._id);
  
    if(!user){
      throw new ApiError(401,"Invalid Refresh Token")
    }
  
    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401,"Refresh Token is expired")
    }
  
    // now generate new access refresh token 
    // firstly send it to cookies
  
    const options = {
      httpOnly:true,
      secured :true
    }
  
    const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
  
    return res 
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",newRefreshToken,options)
    .json(
      new ApiResponse(
        200,
        {accessToken,refreshToken:newRefreshToken},
        "Access Token refreshed"
      )
    )
  } catch (error) {
    throw new ApiError(401,error?.message || 
    "Invalid refresh token")
  }

})

export {registerUser,loginUser,logoutUser,refreshAccessToken}

