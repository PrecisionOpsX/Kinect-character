import React, { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import * as THREE from "three";

/**
 * Applies a quaternion rotation to a bone, with an optional inversion for one axis.
 * @param {THREE.Bone} bone The bone to rotate.
 * @param {THREE.Quaternion} quaternion The quaternion to apply.
 * @param {boolean} invertY Whether to invert the Y-axis rotation.
 */
function applyQuaternion(bone, quaternion, invertY = false) {
  if (invertY) {
    const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
    euler.y = -euler.y; // Invert Y-axis rotation
    bone.quaternion.setFromEuler(euler);
  } else {
    bone.quaternion.copy(quaternion);
  }
}

/**
 * Corrects the orientation of the left wrist by applying an inverted rotation.
 * This function creates a new quaternion from the landmark data and applies it to the bone,
 * ensuring the left wrist is oriented correctly.
 * @param {THREE.Bone} leftWristBone The bone for the left wrist.
 * @param {object} landmark The landmark data for the left wrist.
 */
export function correctLeftWristOrientation(leftWristBone, landmark) {
  if (leftWristBone && landmark) {
    const quaternion = new THREE.Quaternion(
      landmark.x + 171.11,
      landmark.y + 4.98,
      landmark.z + 4.44,
      landmark.w
    );
    applyQuaternion(leftWristBone, quaternion, true);
  }
}

export function correctLeftUpLegOrientation(leftUpLegBone, landmark) {
  if (leftUpLegBone && landmark) {
    const quaternion = new THREE.Quaternion(
      landmark.x,
      landmark.y,
      landmark.z + 177.02,
      landmark.w
    );
    applyQuaternion(leftUpLegBone, quaternion, true);
  }
}

export function correctRightUpLegOrientation(rightUpLegBone, landmark) {
  if (rightUpLegBone && landmark) {
    const quaternion = new THREE.Quaternion(
      landmark.x,
      landmark.y,
      landmark.z + 177.01,
      landmark.w
    );
    applyQuaternion(rightUpLegBone, quaternion, true);
  }
}

// Kinect joint index -> name mapping (v2 0-24). Only indices used below.
const KINECT_JOINT_NAMES = {
  0: "SpineBase",
  1: "SpineMid",
  2: "Neck",
  3: "Head",
  4: "ShoulderLeft",
  5: "ElbowLeft",
  6: "WristLeft",
  7: "HandLeft",
  8: "ShoulderRight",
  9: "ElbowRight",
  10: "WristRight",
  11: "HandRight",
  12: "HipLeft",
  13: "KneeLeft",
  14: "AnkleLeft",
  15: "FootLeft",
  16: "HipRight",
  17: "KneeRight",
  18: "AnkleRight",
  19: "FootRight",
  20: "SpineShoulder",
  21: "HandTipLeft",
  22: "ThumbLeft",
  23: "HandTipRight",
  24: "ThumbRight",
};

// Map Kinect joints to Mixamo bones (approximate). Adjust as needed for your /elf.glb rig.
const JOINT_TO_BONE = {
  0: "mixamorig6Hips", // SpineBase
  1: "mixamorig6Spine", // SpineMid
  20: "mixamorig6Spine1", // SpineShoulder
  2: "mixamorig6Neck", // Neck
  3: "mixamorig6Head", // Head
  4: "mixamorig6LeftShoulder",
  5: "mixamorig6LeftArm",
  6: "mixamorig6LeftForeArm",
  7: "mixamorig6LeftHand",
  8: "mixamorig6RightShoulder",
  9: "mixamorig6RightArm",
  10: "mixamorig6RightForeArm",
  11: "mixamorig6RightHand",
  12: "mixamorig6LeftUpLeg", // HipLeft
  13: "mixamorig6LeftLeg",
  14: "mixamorig6LeftFoot",
  16: "mixamorig6RightUpLeg", // HipRight
  17: "mixamorig6RightLeg",
  18: "mixamorig6RightFoot",
};

// Bones with no direct Kinect orientation (leaf joints) -> fallback parent joint index
const LEAF_JOINT_FALLBACK = {
  7: 6, // HandLeft -> WristLeft
  11: 10, // HandRight -> WristRight
  21: 6, // HandTipLeft -> WristLeft
  22: 6, // ThumbLeft -> WristLeft
  23: 10, // HandTipRight -> WristRight
  24: 10, // ThumbRight -> WristRight
  15: 14, // FootLeft -> AnkleLeft
  19: 18, // FootRight -> AnkleRight
};

// Optional per-bone corrective roll (degrees) if needed (empirical). Keep small adjustments.
const BONE_ROLL_DEGREES = {
  mixamorig6LeftArm: 0,
  mixamorig6RightArm: 0,
};

// Axis remap: previously -90° about X; appears to tilt model (feet showing).
// Use identity by default; enable rotation only if rig axis mismatch is confirmed.
const USE_AXIS_REMAP = false;
const AXIS_REMAP = USE_AXIS_REMAP
  ? new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    )
  : new THREE.Quaternion();

// Mirror correction (if model facing forward conflicts with Kinect mirror). Toggle if needed.
const MIRROR = false;

export function ElfWithKinect({ landmarks, floorClipPlane, isPlaying }) {
  const { scene } = useGLTF("/elf-restpose.glb");
  const bonesRef = useRef({});
  const initialSpineBaseDistanceRef = useRef(null);
  const floorQuatRef = useRef(new THREE.Quaternion());
  const tempQuatParent = useRef(new THREE.Quaternion());
  const tempQuatWorld = useRef(new THREE.Quaternion());
  const tempQuatLocal = useRef(new THREE.Quaternion());
  const lastWorldQuats = useRef({});

  // Build bone map once
  useEffect(() => {
    scene.traverse((o) => {
      if (o.isBone) bonesRef.current[o.name] = o;
    });
  }, [scene]);

  // Helper: convert Kinect joint orientation quaternion to THREE.Quaternion
  const getKinectWorldQuat = (jointIndex) => {
    const j = landmarks?.[jointIndex];
    if (!j) return null;
    // Leaf joint fallback if orientation is all zeros or index in fallback map
    const isZero =
      j.orientationX === 0 &&
      j.orientationY === 0 &&
      j.orientationZ === 0 &&
      j.orientationW === 0;
    let source = j;
    if (isZero || LEAF_JOINT_FALLBACK[jointIndex] !== undefined) {
      const parentIdx = LEAF_JOINT_FALLBACK[jointIndex] ?? jointIndex;
      source = landmarks?.[parentIdx] || j;
    }
    const q = new THREE.Quaternion(
      source.orientationX,
      source.orientationY,
      source.orientationZ,
      source.orientationW
    );
    return q;
  };

  // Main frame update
  useFrame(() => {
    if (!isPlaying) return;
    if (!landmarks || Object.keys(bonesRef.current).length === 0) return;

    // Iterate joints with defined bone mapping
    for (const jointIndexStr of Object.keys(JOINT_TO_BONE)) {
      const jointIndex = parseInt(jointIndexStr, 10);
      const boneName = JOINT_TO_BONE[jointIndex];
      const bone = bonesRef.current[boneName];
      if (!bone) continue;
      const kinectQuat = getKinectWorldQuat(jointIndex);
      if (!kinectQuat) continue;

      // World quaternion assembly: floor tilt -> axis remap -> optional roll -> raw Kinect
      tempQuatWorld.current
        .copy(floorQuatRef.current)
        .multiply(AXIS_REMAP)
        .multiply(kinectQuat);
      const rollDeg = BONE_ROLL_DEGREES[boneName];
      if (rollDeg) {
        const rollQuat = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          THREE.MathUtils.degToRad(rollDeg)
        );
        tempQuatWorld.current.multiply(rollQuat);
      }
      if (MIRROR) {
        // Simple mirror: flip Z axis by multiplying a 180° Y rotation (adjust if needed)
        const mirrorQuat = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          Math.PI
        );
        tempQuatWorld.current.multiply(mirrorQuat);
      }

      // Convert absolute world to local relative to parent
      if (bone.parent) {
        bone.parent.getWorldQuaternion(tempQuatParent.current);
        tempQuatLocal.current
          .copy(tempQuatParent.current.invert())
          .multiply(tempQuatWorld.current);
      } else {
        tempQuatLocal.current.copy(tempQuatWorld.current);
      }

      // Simple filtering: avoid sudden 180 flips (compare with last stored world)
      const last = lastWorldQuats.current[boneName];
      if (last) {
        const angle =
          2 *
          Math.acos(
            Math.min(1, Math.max(-1, Math.abs(last.dot(tempQuatWorld.current))))
          );
        if (angle > Math.PI * 0.9) {
          // Heavy flip; damp by slerping world target toward last before localizing
          tempQuatWorld.current.slerp(last, 0.5);
          if (bone.parent) {
            bone.parent.getWorldQuaternion(tempQuatParent.current);
            tempQuatLocal.current
              .copy(tempQuatParent.current.invert())
              .multiply(tempQuatWorld.current);
          } else {
            tempQuatLocal.current.copy(tempQuatWorld.current);
          }
        }
      }
      lastWorldQuats.current[boneName] = tempQuatWorld.current.clone();

      // Slerp to target local orientation
      if (boneName === "mixamorig6LeftHand") {
        const landmark = getKinectWorldQuat(jointIndex);
        if (landmark) {
          correctLeftWristOrientation(bone, landmark);
        }
      } else if (boneName === "mixamorig6LeftUpLeg") {
        const landmark = getKinectWorldQuat(jointIndex);
        if (landmark) {
          correctLeftUpLegOrientation(bone, landmark);
        }
      } else if (boneName === "mixamorig6RightUpLeg") {
        const landmark = getKinectWorldQuat(jointIndex);
        if (landmark) {
          correctRightUpLegOrientation(bone, landmark);
        }
      } else {
        bone.quaternion.slerp(tempQuatLocal.current, 0.4);
      }
    }
  });

  return <primitive object={scene} />;
}

useGLTF.preload("/elf-restpose.glb");
