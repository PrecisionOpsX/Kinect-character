import React, { useRef, useEffect, useState, use } from "react";
import Webcam from "react-webcam";
import * as posenet from "@tensorflow-models/posenet";
import "./PoseNetTracker.css";

const PoseNetTracker = ({ onPoseDetected, mockData }) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);

  // Keypoint names for reference
  const keypointNames = [
    "nose",
    "leftEye",
    "rightEye",
    "leftEar",
    "rightEar",
    "leftShoulder",
    "rightShoulder",
    "leftElbow",
    "rightElbow",
    "leftWrist",
    "rightWrist",
    "leftHip",
    "rightHip",
    "leftKnee",
    "rightKnee",
    "leftAnkle",
    "rightAnkle",
  ];

  useEffect(() => {
    if (mockData) {
      // Draw mock data on canvas
      drawCanvas(mockData, undefined, 640, 480, canvasRef);
    }
  }, [mockData]);

  // Draw keypoints on canvas
  const drawKeypoints = (keypoints, minConfidence, ctx) => {
    keypoints.forEach((keypoint) => {
      if (keypoint.score > minConfidence) {
        const { y, x } = keypoint.position;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "#00FF00";
        ctx.fill();
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  };

  // Draw skeleton connections
  const drawSkeleton = (keypoints, minConfidence, ctx) => {
    const adjacentKeyPoints = [
      [5, 6], // shoulders
      [5, 7], // left shoulder to elbow
      [7, 9], // left elbow to wrist
      [6, 8], // right shoulder to elbow
      [8, 10], // right elbow to wrist
      [5, 11], // left shoulder to hip
      [6, 12], // right shoulder to hip
      [11, 12], // hips
      [11, 13], // left hip to knee
      [13, 15], // left knee to ankle
      [12, 14], // right hip to knee
      [14, 16], // right knee to ankle
      [0, 1], // nose to left eye
      [0, 2], // nose to right eye
      [1, 3], // left eye to left ear
      [2, 4], // right eye to right ear
    ];

    adjacentKeyPoints.forEach(([from, to]) => {
      if (
        keypoints[from].score > minConfidence &&
        keypoints[to].score > minConfidence
      ) {
        const fromPos = keypoints[from].position;
        const toPos = keypoints[to].position;

        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(toPos.x, toPos.y);
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  };

  // Draw pose on canvas
  const drawCanvas = (pose, video, videoWidth, videoHeight, canvas) => {
    if (!canvas.current) return;
    const ctx = canvas.current.getContext("2d");
    canvas.current.width = videoWidth;
    canvas.current.height = videoHeight;

    // Draw video frame
    video ? ctx.drawImage(video, 0, 0, videoWidth, videoHeight) : null;

    // Draw keypoints and skeleton
    drawKeypoints(pose.keypoints, 0.5, ctx);
    drawSkeleton(pose.keypoints, 0.5, ctx);
  };

  // Detect pose
  const detect = async (net) => {
    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null &&
      webcamRef.current.video.readyState === 4
    ) {
      const video = webcamRef.current.video;
      const videoWidth = webcamRef.current.video.videoWidth;
      const videoHeight = webcamRef.current.video.videoHeight;

      webcamRef.current.video.width = videoWidth;
      webcamRef.current.video.height = videoHeight;

      const pose = await net.estimateSinglePose(video, {
        flipHorizontal: false,
      });

      drawCanvas(pose, video, videoWidth, videoHeight, canvasRef);

      // Convert pose to usable format and send to parent component
      const poseData = {
        score: pose.score,
        keypoints: pose.keypoints.map((kp, idx) => ({
          name: keypointNames[idx],
          position: kp.position,
          score: kp.score,
        })),
      };

      if (onPoseDetected) {
        onPoseDetected(poseData);
      }

      return pose;
    }
  };

  // Run PoseNet
  const runPosenet = async (net) => {
    const intervalId = setInterval(() => {
      detect(net);
    }, 100); // Run detection every 100ms

    return intervalId;
  };

  // Initialize PoseNet
  useEffect(() => {
    const loadPosenet = async () => {
      try {
        setLoading(true);
        const net = await posenet.load({
          architecture: "MobileNetV1",
          outputStride: 16,
          inputResolution: { width: 640, height: 480 },
          multiplier: 0.75,
          quantBytes: 2,
        });

        const intervalId = await runPosenet(net);
        setIsTracking(true);
        setLoading(false);

        return () => clearInterval(intervalId);
      } catch (error) {
        console.error("Error loading PoseNet:", error);
        setLoading(false);
      }
    };

    loadPosenet();
  }, []);

  return (
    <div className="posenet-tracker">
      <div className="posenet-container">
        {loading && <div className="loading">Loading PoseNet...</div>}
        {!mockData && (
          <Webcam
            ref={webcamRef}
            className="webcam"
            style={{
              position: "absolute",
              visibility: "hidden",
            }}
          />
        )}
        <canvas
          ref={canvasRef}
          className="canvas"
          style={{
            display: isTracking ? "block" : "none",
          }}
        />
        {isTracking && <div className="tracking-status">✓ Tracking</div>}
      </div>
    </div>
  );
};

export default PoseNetTracker;
