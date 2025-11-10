import React, { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const KINECT_JOINTS = {
  SPINE_BASE: 0,
  SPINE_MID: 1,
  NECK: 2,
  HEAD: 3,
  SHOULDER_LEFT: 4,
  ELBOW_LEFT: 5,
  WRIST_LEFT: 6,
  HAND_LEFT: 7,
  SHOULDER_RIGHT: 8,
  ELBOW_RIGHT: 9,
  WRIST_RIGHT: 10,
  HAND_RIGHT: 11,
  HIP_LEFT: 12,
  KNEE_LEFT: 13,
  ANKLE_LEFT: 14,
  FOOT_LEFT: 15,
  HIP_RIGHT: 16,
  KNEE_RIGHT: 17,
  ANKLE_RIGHT: 18,
  FOOT_RIGHT: 19,
  SPINE_SHOULDER: 20,
};

const BONE_CONFIG = {
  [KINECT_JOINTS.SPINE_BASE]: {
    bone: "mixamorig6Hips",
    correction: new THREE.Euler(0, 0, 0),
  },
  [KINECT_JOINTS.SPINE_MID]: {
    bone: "mixamorig6Spine",
    correction: new THREE.Euler(0, 0, 0),
  },
  [KINECT_JOINTS.SPINE_SHOULDER]: {
    bone: "mixamorig6Spine1",
    correction: new THREE.Euler(0, 0, 0),
  },
  [KINECT_JOINTS.NECK]: {
    bone: "mixamorig6Neck",
    correction: new THREE.Euler(0, 0, 0),
  },
  [KINECT_JOINTS.HEAD]: {
    bone: "mixamorig6Head",
    correction: new THREE.Euler(0, 0, 0),
  },
  [KINECT_JOINTS.SHOULDER_LEFT]: {
    bone: "mixamorig6LeftArm",
    correction: new THREE.Euler(0, 0, Math.PI / 2),
  },
  [KINECT_JOINTS.ELBOW_LEFT]: {
    bone: "mixamorig6LeftForeArm",
    correction: new THREE.Euler(0, 0, Math.PI / 2),
  },
  [KINECT_JOINTS.WRIST_LEFT]: {
    bone: "mixamorig6LeftHand",
    correction: new THREE.Euler(0, 0, Math.PI / 2),
  },
  [KINECT_JOINTS.SHOULDER_RIGHT]: {
    bone: "mixamorig6RightArm",
    correction: new THREE.Euler(0, 0, -Math.PI / 2),
  },
  [KINECT_JOINTS.ELBOW_RIGHT]: {
    bone: "mixamorig6RightForeArm",
    correction: new THREE.Euler(0, 0, -Math.PI / 2),
  },
  [KINECT_JOINTS.WRIST_RIGHT]: {
    bone: "mixamorig6RightHand",
    correction: new THREE.Euler(0, 0, -Math.PI / 2),
  },
  [KINECT_JOINTS.HIP_LEFT]: {
    bone: "mixamorig6LeftUpLeg",
    correction: new THREE.Euler(0, 0, Math.PI),
  },
  [KINECT_JOINTS.KNEE_LEFT]: {
    bone: "mixamorig6LeftLeg",
    correction: new THREE.Euler(0, 0, Math.PI),
  },
  [KINECT_JOINTS.ANKLE_LEFT]: {
    bone: "mixamorig6LeftFoot",
    correction: new THREE.Euler(0, 0, Math.PI),
  },
  [KINECT_JOINTS.HIP_RIGHT]: {
    bone: "mixamorig6RightUpLeg",
    correction: new THREE.Euler(0, 0, Math.PI),
  },
  [KINECT_JOINTS.KNEE_RIGHT]: {
    bone: "mixamorig6RightLeg",
    correction: new THREE.Euler(0, 0, Math.PI),
  },
  [KINECT_JOINTS.ANKLE_RIGHT]: {
    bone: "mixamorig6RightFoot",
    correction: new THREE.Euler(0, 0, Math.PI),
  },
};

const LEAF_JOINT_FALLBACK = {
  [KINECT_JOINTS.HAND_LEFT]: KINECT_JOINTS.WRIST_LEFT,
  [KINECT_JOINTS.HAND_RIGHT]: KINECT_JOINTS.WRIST_RIGHT,
  [KINECT_JOINTS.FOOT_LEFT]: KINECT_JOINTS.ANKLE_LEFT,
  [KINECT_JOINTS.FOOT_RIGHT]: KINECT_JOINTS.ANKLE_RIGHT,
};

export function ElfWithKinect({ landmarks, isPlaying }) {
  const { scene } = useGLTF("/elf-restpose.glb");
  const bonesRef = useRef({});
  const correctionQuatsRef = useRef({});
  const tempQuatParent = useRef(new THREE.Quaternion());
  const tempQuatWorld = useRef(new THREE.Quaternion());
  const tempQuatLocal = useRef(new THREE.Quaternion());
  const tempQuatCorrection = useRef(new THREE.Quaternion());

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isBone) bonesRef.current[o.name] = o;
    });

    Object.keys(BONE_CONFIG).forEach((jointIndex) => {
      const config = BONE_CONFIG[jointIndex];
      correctionQuatsRef.current[jointIndex] = new THREE.Quaternion().setFromEuler(
        config.correction
      );
    });
  }, [scene]);

  const getKinectQuat = (jointIndex) => {
    const j = landmarks?.[jointIndex];
    if (!j) return null;

    const isZero =
      j.orientationX === 0 &&
      j.orientationY === 0 &&
      j.orientationZ === 0 &&
      j.orientationW === 0;

    if (isZero && LEAF_JOINT_FALLBACK[jointIndex]) {
      const parentIdx = LEAF_JOINT_FALLBACK[jointIndex];
      const parentJoint = landmarks?.[parentIdx];
      if (!parentJoint) return null;
      return new THREE.Quaternion(
        parentJoint.orientationX,
        parentJoint.orientationY,
        parentJoint.orientationZ,
        parentJoint.orientationW
      );
    }

    return new THREE.Quaternion(
      j.orientationX,
      j.orientationY,
      j.orientationZ,
      j.orientationW
    );
  };

  useFrame(() => {
    if (!isPlaying || !landmarks || Object.keys(bonesRef.current).length === 0) return;

    Object.keys(BONE_CONFIG).forEach((jointIndexStr) => {
      const jointIndex = parseInt(jointIndexStr, 10);
      const config = BONE_CONFIG[jointIndex];
      const bone = bonesRef.current[config.bone];
      if (!bone) return;

      const kinectQuat = getKinectQuat(jointIndex);
      if (!kinectQuat) return;

      const correction = correctionQuatsRef.current[jointIndex];
      tempQuatWorld.current.copy(kinectQuat).multiply(correction);

      if (bone.parent) {
        bone.parent.getWorldQuaternion(tempQuatParent.current);
        tempQuatLocal.current
          .copy(tempQuatParent.current)
          .invert()
          .multiply(tempQuatWorld.current);
      } else {
        tempQuatLocal.current.copy(tempQuatWorld.current);
      }

      bone.quaternion.slerp(tempQuatLocal.current, 0.3);
    });
  });

  return <primitive object={scene} />;
}

useGLTF.preload("/elf-restpose.glb");
