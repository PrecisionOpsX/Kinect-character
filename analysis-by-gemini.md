Analysis of Blog Posts
The three blog posts describe a clear, step-by-step process for applying Kinect v2 motion capture data to a 3D model.

Part 1 (20160701): Get the Right Data

The primary goal is to get rotation data, not just joint positions.

The Kinect SDK provides this directly through the jointOrientations property.

This data is a list of 25 quaternions, which represent the orientation of each joint.

The key takeaway is to use the orientation quaternion data for each joint, as this is what defines the pose.

Part 2 (20160708): Understand the Data

Absolute vs. Local: The Kinect provides absolute (world-space) rotations for each joint. This means you get the final, accumulated orientation of (for example) the forearm, not its rotation relative to the upper arm.

Coordinate Mismatch (The Core Problem): The Kinect assumes all bones in a person's rest pose point along the Y-axis (0, 1, 0).

Your 3D model (e.g., a Mixamo rig) has its own rest pose (or "bind pose") where bones point in different directions (e.g., arms along the X-axis, legs along the -Y axis).

You must apply a correction quaternion to "remap" the Kinect's Y-up coordinate system to your model's native bone orientations. The blog gives an example of needing a -90 degree X-rotation for their specific model.

Part 3 (20160715): Refine the Data

Floor Correction: You can use the FloorClipPlane data from the Kinect to calculate a quaternion that corrects for the sensor's physical tilt, ensuring your model stands upright.

Root Position: The SpineBase joint's positional data (which your code also receives as cameraX, Y, Z) can be used to move the entire model up and down to capture actions like jumping or ducking.

Analysis of Your ElfWithKinect Component
Based on the principles from the blog posts, here is an analysis of your component and where the logic went wrong.

Your component is split into two different animation methods: a simple one for the legs/spine (rotateBone) and a complex one for the arms (applyDelta). Both share the same fundamental flaws.

Where You Went Wrong: The Core Issues
You are Ignoring the Most Important Data

Your example skeleton data provides orientationX, orientationY, orientationZ, and orientationW for each joint. This is the exact absolute orientation quaternion the blog posts (Parts 1 and 2) insist you should use.

Your code completely throws this data away. Instead, you only use the cameraX, Y, Z positions.

You are Incorrectly Inferring Rotations from Positions

Both rotateBone and applyDelta try to calculate a bone's orientation by drawing a vector between two joints (e.g., dir = end.clone().sub(start)).

This method is fragile and incomplete. It cannot capture any "roll" or "twist" along the bone's axis (e.g., a person rotating their forearm while keeping their arm straight, as mentioned in the blog's "arm roll" example). The quaternion data you are ignoring does contain this twist information.

The rotateBone Function (Legs/Spine) is Flawed

This function assumes that all bones in your model's rest pose point straight up along the Y-axis (defaultDir = new THREE.Vector3(0, 1, 0)).

As the blog (Part 2) explains, this is the Kinect's assumption, not your model's. Your mixamorig6LeftUpLeg bone almost certainly points down in its rest pose, not up.

Because this defaultDir assumption is wrong, the setFromUnitVectors calculation will be completely incorrect for every bone that doesn't happen to point straight up.

The applyDelta Function (Arms) is a Complicated Workaround for the Same Flaw

This function is a much more complex version of the same error. It still infers rotation from a vector (desiredWorldDir = to.clone().sub(from)).

The entire armRest and armCalibration system is a massive effort to try and find the correction quaternion that the blog (Part 2) says you need.

However, you are trying to find this correction by comparing vectors, which is unreliable. The correct way is to compose the quaternions directly.

What You Did Right
getVector(landmark): Your new THREE.Vector3(landmark.cameraX, landmark.cameraY, -landmark.cameraZ) function correctly maps the Kinect's camera space (Right-Handed, +Z forward) to the THREE.js world space (Right-Handed, +Z toward camera).

Hierarchical Logic: You are correctly calculating local rotations by inverting the parent's world quaternion (parentInv.multiply(targetWorldQuat)). The logic is sound, but the targetWorldQuat you are feeding it is wrong.

How to Fix It (The "Correct" Method from the Blogs)
You need to refactor your code to stop inferring rotations and start using the orientation quaternions you already have.

Get the Kinect's Absolute Orientation: For each joint j in your landmarks array, create a THREE.js quaternion from its orientation data.

JavaScript

const kinectWorldQuat = new THREE.Quaternion(
  j.orientationX,
  j.orientationY,
  j.orientationZ,
  j.orientationW
);
Get the Parent's Inverted World Rotation: This part of your code is already correct.

JavaScript

const parent = bone.parent;
const parentWorldQuat = new THREE.Quaternion();
if (parent) parent.getWorldQuaternion(parentWorldQuat);
const parentWorldQuatInv = parentWorldQuat.clone().invert();
Find and Apply the Correction Quaternions: This is the "remap" step from Blog Part 2. You must find the rotation that maps the Kinect's Y-up assumption to your model's actual bind pose. This is a one-time setup. You will need a different correction for each bone chain.

Example for the Left Arm (which points +X in a T-pose): The Kinect assumes the arm points +Y. To get from +Y to +X, you need a -90 degree rotation around the Z-axis.

JavaScript

// This correction is an EXAMPLE. You must find the correct one for your rig.
const correctionQuat = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0, 0, -Math.PI / 2) // -90 degrees on Z
);
Calculate the Final Local Rotation: The final rotation is a combination of all three parts.

Final Local = (Parent World Inverse) * (Kinect World) * (Correction)

JavaScript

// 1. Apply correction
const targetWorldQuat = kinectWorldQuat.clone().multiply(correctionQuat);

// 2. Convert to local space
const targetLocalQuat = parentWorldQuatInv.multiply(targetWorldQuat);

// 3. Apply to bone (slerp for smoothing)
bone.quaternion.slerp(targetLocalQuat, smoothFactor);
By adopting this method, you will be using the full-quality rotation data from the sensor, and your animation will be far more accurate and robust, including all the "twist" and "roll" motions that your current implementation is missing.