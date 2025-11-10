import React, { useRef, useEffect, use } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import * as dat from "dat.gui";

/*
 spineBase       : 0,
  spineMid        : 1,
  neck            : 2,
  head            : 3,
  shoulderLeft    : 4,
  elbowLeft       : 5,
  wristLeft       : 6,
  handLeft        : 7,
  shoulderRight   : 8,
  elbowRight      : 9,
  wristRight      : 10,
  handRight       : 11,
  hipLeft         : 12,
  kneeLeft        : 13,
  ankleLeft       : 14,
  footLeft        : 15,
  hipRight        : 16,
  kneeRight       : 17,
  ankleRight      : 18,
  footRight       : 19,
  spineShoulder   : 20,
  handTipLeft     : 21,
  thumbLeft       : 22,
  handTipRight    : 23,
  thumbRight      : 24
*/

const bodyParts = {
  0: "SPINEBASE",
  1: "SPINEMID",
  2: "NECK",
  3: "HEAD",
  4: "SHOULDERLEFT",
  5: "ELBOWLEFT",
  6: "WRISTLEFT",
  7: "HANDLEFT",
  8: "SHOULDERRIGHT",
  9: "ELBOWRIGHT",
  10: "WRISTRIGHT",
  11: "HANDRIGHT",
  12: "HIPLEFT",
  13: "KNEELEFT",
  14: "ANKLELEFT",
  15: "FOOTLEFT",
  16: "HIPRIGHT",
  17: "KNEERIGHT",
  18: "ANKLERIGHT",
  19: "FOOTRIGHT",
  20: "SPINESHOULDER",
  21: "HANDTIPLEFT",
  22: "THUMBLEFT",
  23: "HANDTIPRIGHT",
  24: "THUMBRIGHT",
};

const bones = {
  0: "mixamorig6Hips",
  1: "mixamorig6Spine",
  2: "mixamorig6Spine1",
  3: "mixamorig6Spine2",
  4: "mixamorig6Neck",
  5: "mixamorig6Head",
  6: "mixamorig6HeadTop_End",
  7: "mixamorig6LeftShoulder",
  8: "mixamorig6LeftArm",
  9: "mixamorig6LeftForeArm",
  10: "mixamorig6LeftHand",
  11: "mixamorig6LeftHandThumb1",
  12: "LeftHandThumb2",
  13: "LeftHandThumb3",
  14: "LeftHandThumb4",
  15: "mixamorig6LeftHandIndex1",
  16: "mixamorig6LeftHandIndex2",
  17: "mixamorig6LeftHandIndex3",
  18: "mixamorig6LeftHandIndex4",
  19: "mixamorig6LeftHandMiddle1",
  20: "mixamorig6LeftHandMiddle2",
  21: "mixamorig6LeftHandMiddle3",
  22: "mixamorig6LeftHandMiddle4",
  23: "mixamorig6LeftHandRing1",
  24: "mixamorig6LeftHandRing2",
  25: "mixamorig6LeftHandRing3",
  26: "mixamorig6LeftHandRing4",
  27: "mixamorig6LeftHandPinky1",
  28: "mixamorig6LeftHandPinky2",
  29: "mixamorig6LeftHandPinky3",
  30: "mixamorig6LeftHandPinky4",
  31: "mixamorig6RightShoulder",
  32: "mixamorig6RightArm",
  33: "mixamorig6RightForeArm",
  34: "mixamorig6RightHand",
  35: "mixamorig6RightHandThumb1",
  36: "RightHandThumb2",
  37: "RightHandThumb3",
  38: "RightHandThumb4",
  39: "mixamorig6RightHandIndex1",
  40: "mixamorig6RightHandIndex2",
  41: "mixamorig6RightHandIndex3",
  42: "mixamorig6RightHandIndex4",
  43: "mixamorig6RightHandMiddle1",
  44: "mixamorig6RightHandMiddle2",
  45: "mixamorig6RightHandMiddle3",
  46: "mixamorig6RightHandMiddle4",
  47: "mixamorig6RightHandRing1",
  48: "mixamorig6RightHandRing2",
  49: "mixamorig6RightHandRing3",
  50: "mixamorig6RightHandRing4",
  51: "mixamorig6RightHandPinky1",
  52: "mixamorig6RightHandPinky2",
  53: "mixamorig6RightHandPinky3",
  54: "mixamorig6RightHandPinky4",
  55: "mixamorig6LeftUpLeg",
  56: "mixamorig6LeftLeg",
  57: "mixamorig6LeftFoot",
  58: "mixamorig6LeftToeBase",
  59: "mixamorig6LeftToe_End",
  60: "mixamorig6RightUpLeg",
  61: "mixamorig6RightLeg",
  62: "mixamorig6RightFoot",
  63: "mixamorig6RightToeBase",
  64: "mixamorig6RightToe_End",
};

export function Elf({ landmarks, isPlaying }) {
  const { scene } = useGLTF("/elf.glb");
  const skeletonRef = useRef(null);
  const bonesRef = useRef(null);
  const initialPositions = useRef({});

  // Initialize skeleton
  useEffect(() => {
    if (scene && !skeletonRef.current) {
      let skeleton = null;
      scene.traverse((child) => {
        if (child.isSkinnedMesh && child.skeleton && !skeleton) {
          skeleton = child.skeleton;
        }
      });
      if (skeleton) {
        skeletonRef.current = skeleton;
        skeleton.bones.forEach((b) => {
          const name = b.name;
          initialPositions.current[name] = b.position.clone();
          if (!bonesRef.current) bonesRef.current = {};
          return (bonesRef.current[name] = b);
        });
      }
    }
  }, [scene]);

  useEffect(() => {
    if (landmarks && isPlaying && bonesRef.current) {
      if (landmarks[20]) {
        bonesRef.current["mixamorig6Spine"].rotation.set(
          initialPositions.current["mixamorig6Spine"].x,
          initialPositions.current["mixamorig6Spine"].y,
          initialPositions.current["mixamorig6Spine"].z +
            (landmarks[20].cameraZ - 1) * 10
        );
      }
    }
  }, [landmarks, isPlaying, bonesRef.current]);

  useEffect(() => {
    // Initialize dat.GUI once skeleton is ready
    if (bonesRef.current) {
      const gui = new dat.GUI();
      // spine torso rotations
      gui
        .add(bonesRef.current["mixamorig6Spine"].rotation, "x", -0.5, 1.5)
        .name("Spine R X");
      gui
        .add(bonesRef.current["mixamorig6Spine"].rotation, "y", -1, 1)
        .name("Spine R Y");
      gui
        .add(bonesRef.current["mixamorig6Spine"].rotation, "z", -1, 1)
        .name("Spine R Z");

      // Head rotations
      gui
        .add(bonesRef.current["mixamorig6Head"].rotation, "x", -1.5, 1)
        .name("Head R X / Forward/backward");
      gui
        .add(bonesRef.current["mixamorig6Head"].rotation, "y", -1, 1)
        .name("Head R Y / Left/right");
      gui
        .add(bonesRef.current["mixamorig6Head"].rotation, "z", -1, 1)
        .name("Head R Z / Tilting");

      // right arm rotations

      gui
        .add(bonesRef.current["mixamorig6RightArm"].rotation, "x", -1.5, 0.8)
        .name("Right Arm R X / up/down");
      gui
        .add(bonesRef.current["mixamorig6RightArm"].rotation, "y", -1, 1)
        .name("Right Arm R Y / palm facing front/back");
      gui
        .add(bonesRef.current["mixamorig6RightArm"].rotation, "z", -1.5, 1)
        .name("Right Arm R Z / forward/backward");

      gui
        .add(
          bonesRef.current["mixamorig6RightForeArm"].rotation,
          "x",
          -0.18,
          1.5
        )
        .name("Right Fore Arm R X / up/down");
      gui
        .add(bonesRef.current["mixamorig6RightForeArm"].rotation, "y", -1, 1.5)
        .name("Right Fore Arm R Y / palm facing front/back");
      gui
        .add(bonesRef.current["mixamorig6RightForeArm"].rotation, "z", -1.5, 1)
        .name("Right Fore Arm R Z / forward/backward");

      gui
        .add(bonesRef.current["mixamorig6RightHand"].rotation, "x", -1.5, 0.8)
        .name("Right Wrist R X / up/down");
      gui
        .add(bonesRef.current["mixamorig6RightHand"].rotation, "y", -1, 1)
        .name("Right Wrist R Y / palm facing front/back");
      gui
        .add(bonesRef.current["mixamorig6RightHand"].rotation, "z", -1.5, 1)
        .name("Right Wrist R Z / forward/backward");

      // left arm rotations
      gui
        .add(bonesRef.current["mixamorig6LeftArm"].rotation, "x", -1.5, 0.8)
        .name("Left Arm R X / up/down");
      gui
        .add(bonesRef.current["mixamorig6LeftArm"].rotation, "y", -1, 1.5)
        .name("Left Arm R Y / palm facing front/back");
      gui
        .add(bonesRef.current["mixamorig6LeftArm"].rotation, "z", -1, 1.5)
        .name("Left Arm R Z / forward/backward");

      gui
        .add(
          bonesRef.current["mixamorig6LeftForeArm"].rotation,
          "x",
          -0.18,
          1.5
        )
        .name("Left Fore Arm R X / up/down");
      gui
        .add(bonesRef.current["mixamorig6LeftForeArm"].rotation, "y", -1, 1)
        .name("Left Fore Arm R Y / palm facing front/back");
      gui
        .add(bonesRef.current["mixamorig6LeftForeArm"].rotation, "z", -1.5, 1)
        .name("Left Fore Arm R Z / forward/backward");

      gui
        .add(bonesRef.current["mixamorig6LeftHand"].rotation, "x", -1.5, 0.8)
        .name("Left Wrist R X / up/down");
      gui
        .add(bonesRef.current["mixamorig6LeftHand"].rotation, "y", -1, 1)
        .name("Left Wrist R Y / palm facing front/back");
      gui
        .add(bonesRef.current["mixamorig6LeftHand"].rotation, "z", -1.5, 1)
        .name("Left Wrist R Z / forward/backward");

      // right leg rotations
      gui
        .add(bonesRef.current["mixamorig6RightUpLeg"].rotation, "x", -1.5, 1.5)
        .name("Right Upper Leg R X / up/down");
      gui
        .add(bonesRef.current["mixamorig6RightUpLeg"].rotation, "y", -1, 1)
        .name("Right Upper Leg R Y / palm facing front/back");
      gui
        .add(bonesRef.current["mixamorig6RightUpLeg"].rotation, "z", 1.5, 3.1)
        .name("Right Upper Leg R Z / forward/backward");

      gui
        .add(bonesRef.current["mixamorig6RightLeg"].rotation, "x", -1.5, 0)
        .name("Right Leg R X / up/down");
      gui
        .add(bonesRef.current["mixamorig6RightLeg"].rotation, "y", -1, 1)
        .name("Right Leg R Y / palm facing front/back");
      gui
        .add(bonesRef.current["mixamorig6RightLeg"].rotation, "z", 1.5, 3.1)
        .name("Right Leg R Z / forward/backward");

      // left leg rotations
      gui
        .add(bonesRef.current["mixamorig6LeftUpLeg"].rotation, "x", -1.5, 1.5)
        .name("Left Upper Leg R X / up/down");
      gui
        .add(bonesRef.current["mixamorig6LeftUpLeg"].rotation, "y", -1, 1)
        .name("Left Upper Leg R Y / palm facing front/back");
      gui
        .add(bonesRef.current["mixamorig6LeftUpLeg"].rotation, "z", -3.1, -1.5)
        .name("Left Upper Leg R Z / forward/backward");

      gui
        .add(bonesRef.current["mixamorig6LeftLeg"].rotation, "x", -1.5, 0)
        .name("Left Leg R X / up/down");
      gui
        .add(bonesRef.current["mixamorig6LeftLeg"].rotation, "y", -1, 1)
        .name("Left Leg R Y / palm facing front/back");
      gui
        .add(bonesRef.current["mixamorig6LeftLeg"].rotation, "z", -3.1, -1.5)
        .name("Left Leg R Z / forward/backward");

      return () => {
        if (gui) {
          gui.destroy();
        }
      };
    }
  }, []);

  return <primitive object={scene} />;
}

useGLTF.preload("/elf.glb");
