const Course = require("../models/Course");
const CourseProgress = require("../models/CourseProgress");
const Profile = require("../models/Profile");
const User = require("../models/User");
const {uploadImageToCloudinary} = require("../utils/imageUploader");
const { convertSecondsToDuration } = require("../utils/secToDuration");
require("dotenv").config();

exports.updateProfile = async(req, res) => {
    try {   
        // get data
        const {dateOfBirth="", about="", contactNumber, gender} = req.body;
        // user ID
        const id = req.user.id;
        // validations
        if(!contactNumber || !gender || !id) {
            return res.status(400).json( {
                success:false,
                message:"All fields are required",
            });

        }   
        // find the profile
        const userDetails = await User.findById(id);
        const profileId = userDetails.additionalDetails;
        const profileDetails = await Profile.findById(profileId);

        // update the profile
        profileDetails.dateOfBirth = dateOfBirth;
        profileDetails.about = about;
        profileDetails.gender = gender;
        profileDetails.contactNumber = contactNumber;
        await profileDetails.save();
        // return response
        return res.status(200).json( {
            success:true,
            message:"Profile Updated Successfully",
            profileDetails,
        })


    } catch (error) {
        return res.status(500).josn( {
            success:false,
            message:"Error while updating the profile of user",
            error:error.message,
        })
    }
};

exports.updateDisplayPicture = async (req, res) => {
    try {
      const displayPicture = req.files.displayPicture
      const userId = req.user.id
      const image = await uploadImageToCloudinary(
        displayPicture,
        process.env.FOLDER_NAME,
        1000,
        1000
      )
      console.log(image)
      const updatedProfile = await User.findByIdAndUpdate(
        { _id: userId },
        { image: image.secure_url },
        { new: true }
      )
      res.send({
        success: true,
        message: `Image Updated successfully`,
        data: updatedProfile,
      })
    } catch (error) {
      console.log(error.message);
      return res.status(500).json({
        success: false,
        message: error.message,
      })
    }
};

// delete account
// explore how can we scheduled this delete handler
exports.deleteAccount = async (req, res) => {
    try{
        // get id
        const id = req.user.id;
        // validation
        const user = await User.findById({_id:id});
        if(!user) {
            return res.status(404).json( {
                success:false,
                message:'User not found',

            });
        }

        
        // delete profile
        await Profile.findByIdAndDelete({_id:user.additionalDetails});
        // delete user
        // todo :HW: unenroll user from all enrolled course

        console.log("yha tak toh aagye ");
        await User.findByIdAndDelete({_id:id});
        
        // return res
        return res.status(200).json( {
            success:true,
            message:'User details delete successfully',
        })
    } catch(error) {
        return res.status(500).json( {
            success:false,
            message:"Error while deleting the User Profile",
            error:error.message,
        })
    }
};

exports.getAllUserDetails = async(req, res) => {
    try {
        // get id
        const id = req.user.id; 
        // validations
        const userDetails = await User.findById(id).populate("additionalDetails").exec();
        // return response
        return res.status(200).json( {
            success:true,
            userDetails,
        })
    } catch(error) {
        return res.status(404).json( {
            success:false,
            error:error.message,
        })
    }
};

exports.getEnrolledCourses = async (req, res) => {
	try {
	  const userId = req.user.id
	  let userDetails = await User.findOne({
		_id: userId,
	  })
		.populate({
		  path: "courses",
		  populate: {
			path: "courseContent",
			populate: {
			  path: "subSection",
			},
		  },
		})
		.exec()

	  userDetails = userDetails.toObject()
	  var SubsectionLength = 0
	  for (var i = 0; i < userDetails.courses.length; i++) {
		let totalDurationInSeconds = 0
		SubsectionLength = 0
		for (var j = 0; j < userDetails.courses[i].courseContent.length; j++) {
		  totalDurationInSeconds += userDetails.courses[i].courseContent[
			j
		  ].subSection.reduce((acc, curr) => acc + parseInt(curr.timeDuration), 0)
		  userDetails.courses[i].totalDuration = convertSecondsToDuration(
			totalDurationInSeconds
		  )
		  SubsectionLength +=
			userDetails.courses[i].courseContent[j].subSection.length
		}
		let courseProgressCount = await CourseProgress.findOne({
		  courseID: userDetails.courses[i]._id,
		  userId: userId,
		})
		courseProgressCount = courseProgressCount?.completedVideos.length
		if (SubsectionLength === 0) {
		  userDetails.courses[i].progressPercentage = 100
		} else {
		  // To make it up to 2 decimal point
		  const multiplier = Math.pow(10, 2)
		  userDetails.courses[i].progressPercentage =
			Math.round(
			  (courseProgressCount / SubsectionLength) * 100 * multiplier
			) / multiplier
		}
	  }
  
	  if (!userDetails) {
		return res.status(400).json({
		  success: false,
		  message: `Could not find user with id: ${userDetails}`,
		})
	  }
	  return res.status(200).json({
		success: true,
		data: userDetails.courses,
	  })
	} catch (error) {
	  return res.status(500).json({
		success: false,
		message: error.message,
	  })
	}
}

exports.instructorDashboard = async(req, res) => {
  try {
    const courseDetails = await Course.find({instructor: req.user.id});
    const courseData = courseDetails.map((course) => {
      const totalStudentsEnrolled = course.studentsEnrolled.length;
      const totalAmountGenerated = totalStudentsEnrolled * course.price;
      // create an new object with the additional fields
      const courseDataWithStats = {
        _id:course._id,
        courseName:course.courseName,
        courseDescription:course.courseDescription,
        totalStudentsEnrolled,
        totalAmountGenerated,
      } 
      
      return courseDataWithStats;
    })
    return res.status(200).json({
      courses:courseData,
    })

  } catch (error) {
    console.log("Error in instructor dashboard ", error);
    res.json(500).json({
      message:"Internal server error",
    })
  }
}