import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

/*
 MediaPipe Pose Landmarker Tracker
 - Loads the model from CDN
 - Performs real-time landmark detection
 - Draws landmarks + connections on overlay canvas
 - Emits landmark data through onLandmarks callback

 Landmarks indices reference:
 0-32: body landmarks (including feet, hands)
 Key ones we will use initially:
 11: leftShoulder, 12: rightShoulder
 13: leftElbow,    14: rightElbow
 15: leftWrist,    16: rightWrist
 23: leftHip,      24: rightHip
 25: leftKnee,     26: rightKnee
 27: leftAnkle,    28: rightAnkle
 0: nose
 7: leftEye,       8: rightEye (approx)
*/

const CONNECTIONS = [
  [11, 13],
  [13, 15], // Left arm
  [12, 14],
  [14, 16], // Right arm
  [11, 12], // Shoulders
  [23, 24], // Hips
  [11, 23],
  [12, 24], // Torso sides
  [23, 25],
  [25, 27], // Left leg
  [24, 26],
  [26, 28], // Right leg
];

export default function PoseLandmarkerTracker({ onLandmarks, running = true }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const [initError, setInitError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        landmarkerRef.current = await PoseLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          }
        );
        if (!cancelled) setIsReady(true);
      } catch (err) {
        if (!cancelled) setInitError(err.message);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let rafId;
    const processFrame = () => {
      if (!running || !isReady) {
        rafId = requestAnimationFrame(processFrame);
        return;
      }
      const video = webcamRef.current?.video;
      if (video && video.readyState === 4 && landmarkerRef.current) {
        const ts = performance.now();
        const result = landmarkerRef.current.detectForVideo(video, ts);
        const landmarks = result?.landmarks?.[0];
        if (landmarks && onLandmarks) {
          onLandmarks(landmarks);
        }
        draw(landmarks);
      }
      rafId = requestAnimationFrame(processFrame);
    };
    const draw = (landmarks) => {
      const canvas = canvasRef.current;
      const video = webcamRef.current?.video;
      if (!canvas || !video) return;
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!landmarks) return;
      // Draw connections
      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 2;
      CONNECTIONS.forEach(([a, b]) => {
        const pa = landmarks[a];
        const pb = landmarks[b];
        if (pa && pb) {
          ctx.beginPath();
          ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
          ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
          ctx.stroke();
        }
      });
      // Draw points
      landmarks.forEach((lm, i) => {
        const x = lm.x * canvas.width;
        const y = lm.y * canvas.height;
        ctx.fillStyle = "#00FF00";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      // Status badge
      ctx.fillStyle = "#00FF00";
      ctx.font = "14px monospace";
      ctx.fillText("Pose", 10, 20);
    };
    rafId = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(rafId);
  }, [running, isReady, onLandmarks]);

  return (
    <div style={{ position: "relative", width: "320px" }}>
      <Webcam ref={webcamRef} mirrored style={{ width: "320px" }} />
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", left: 0, top: 0 }}
      />
      {!isReady && !initError && (
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            color: "#0f0",
            fontFamily: "monospace",
          }}
        >
          Loading model...
        </div>
      )}
      {initError && <div style={{ color: "red" }}>Error: {initError}</div>}
    </div>
  );
}
