import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";

// Map Kinect joint indices to MediaPipe-like landmarks format
// This creates compatibility with the existing Elf component
const KINECT_TO_LANDMARK_MAP = {
  0: 2, // SpineBase -> 32 (closest available)
  1: 1, // SpineMid
  2: 0, // Neck
  3: 0, // Head -> same as Neck
  4: 11, // ShoulderLeft
  5: 13, // ElbowLeft
  6: 15, // WristLeft
  7: 15, // HandLeft (same as wrist)
  8: 12, // ShoulderRight
  9: 14, // ElbowRight
  10: 16, // WristRight
  11: 16, // HandRight (same as wrist)
  12: 23, // HipLeft
  13: 24, // HipRight
  14: 25, // KneeLeft
  15: 27, // AnkleLeft
  16: 27, // FootLeft
  17: 26, // KneeRight
  18: 28, // AnkleRight
  19: 28, // FootRight
  20: 8, // Spine Shoulder -> approximate
};

// Kinect joint names by index for debug display
const KINECT_JOINT_NAMES = [
  "SPINEBASE",
  "SPINEMID",
  "NECK",
  "HEAD",
  "SHOULDERLEFT",
  "ELBOWLEFT",
  "WRISTLEFT",
  "HANDLEFT",
  "SHOULDERRIGHT",
  "ELBOWRIGHT",
  "WRISTRIGHT",
  "HANDRIGHT",
  "HIPLEFT",
  "KNEELEFT",
  "ANKLELEFT",
  "FOOTLEFT",
  "HIPRIGHT",
  "KNEERIGHT",
  "ANKLERIGHT",
  "FOOTRIGHT",
  "SPINESHOULDER",
  "HANDTIPLEFT",
  "THUMBLEFT",
  "HANDTIPRIGHT",
  "THUMBRIGHT",
];

const JOINT_COLORS = [
  "#FF0000", // SPINEBASE
  "#FF7F00", // SPINEMID
  "#FFFF00", // NECK
  "#BFFF00", // HEAD
  "#00FF00", // SHOULDERLEFT
  "#00FF7F", // ELBOWLEFT
  "#00FFFF", // WRISTLEFT
  "#007FFF", // HANDLEFT
  "#0000FF", // SHOULDERRIGHT
  "#4B0082", // ELBOWRIGHT
  "#8B00FF", // WRISTRIGHT
  "#FF00FF", // HANDRIGHT
  "#FF1493", // HIPLEFT
  "#C71585", // KNEELEFT
  "#800080", // ANKLELEFT
  "#A0522D", // FOOTLEFT
  "#FFD700", // HIPRIGHT
  "#DAA520", // KNEERIGHT
  "#B8860B", // ANKLERIGHT
  "#CD853F", // FOOTRIGHT
  "#00CED1", // SPINESHOULDER
  "#4682B4", // HANDTIPLEFT
  "#6A5ACD", // THUMBLEFT
  "#20B2AA", // HANDTIPRIGHT
  "#228B22", // THUMBRIGHT
];

export default function KinectTracker({
  onLandmarks,
  isPlaying,
  onPlayingChange,
}) {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const [status, setStatus] = useState("Connecting...");
  const [canvasSize, setCanvasSize] = useState({ width: 512, height: 424 });
  const [currentLandmarks, setCurrentLandmarks] = useState(null);
  const isPlayingRef = useRef(isPlaying);

  // Keep ref in sync with prop
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    // Connect to Kinect socket server
    socketRef.current = io("http://localhost:3002/");

    socketRef.current.on("connect", () => {
      console.log("Connected to Kinect server");
      setStatus("Connected");
      socketRef.current.emit("stream-files");
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from Kinect server");
      setStatus("Disconnected");
    });

    socketRef.current.on("file-data", (bodyFrame) => {
      handleBodyFrame(bodyFrame.data.bodies[0]);
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setStatus("Connection Error");
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleBodyFrame = (bodyFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    // If paused, do not clear or redraw; keep previous frame & do not update landmarks
    if (!isPlayingRef.current) {
      return;
    }

    // Active (playing): clear and redraw
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (bodyFrame) {
      const body = bodyFrame;
      if (body.tracked && body.joints && body.joints.length > 0) {
        // Always update status
        setStatus("Tracking");

        // Draw skeleton (only when playing)
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 2;

        // Draw joints
        body.joints.forEach((joint, index) => {
          if (joint) {
            ctx.fillStyle = JOINT_COLORS[index] || "#00FF00";
            ctx.beginPath();
            ctx.arc(
              joint.depthX * canvas.width,
              joint.depthY * canvas.height,
              5,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        });

        // Draw hand states (dim overlay if paused by adjusting alpha inside helper via wrapper)
        drawHandState(
          body.leftHandState,
          body.joints[7],
          ctx,
          canvas,
          "#FF0000"
        );
        drawHandState(
          body.rightHandState,
          body.joints[11],
          ctx,
          canvas,
          "#0000FF"
        );

        const landmarks = body.joints;
        setCurrentLandmarks(landmarks);
        if (onLandmarks) onLandmarks(landmarks);
      } else {
        setStatus("Not tracked");
      }
    }
  };

  const drawHandState = (handState, joint, ctx, canvas, color) => {
    if (!joint) return;

    const HANDSIZE = 20;
    let handColor = color;

    switch (handState) {
      case 3: // Closed
        handColor = "#FF0000";
        break;
      case 2: // Open
        handColor = "#00FF00";
        break;
      case 4: // Lasso
        handColor = "#0000FF";
        break;
      default:
        return;
    }

    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.fillStyle = handColor;
    ctx.arc(
      joint.depthX * canvas.width,
      joint.depthY * canvas.height,
      HANDSIZE,
      0,
      Math.PI * 2,
      true
    );
    ctx.fill();
    ctx.closePath();
    ctx.globalAlpha = 1;
  };

  return (
    <div
      style={{
        position: "relative",
        width: "350px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      {/* Pause/Play Button - At Top */}
      <button
        onClick={() => onPlayingChange(!isPlaying)}
        style={{
          padding: "8px 16px",
          backgroundColor: isPlaying ? "#ff6b6b" : "#51cf66",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontFamily: "monospace",
          fontSize: "12px",
          fontWeight: "bold",
          cursor: "pointer",
          transition: "background-color 0.2s",
        }}
      >
        {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
      </button>

      {/* Canvas */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{
            border: "1px solid #00FF00",
            backgroundColor: "#000000",
            display: "block",
            width: "100%",
            height: "auto",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            color: "#00FF00",
            fontFamily: "monospace",
            fontSize: "12px",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: "4px 8px",
            borderRadius: "2px",
          }}
        >
          {isPlaying ? status : "Paused"}
        </div>
      </div>

      {/* Landmark Data Display - Moved higher with gap */}
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          fontFamily: "monospace",
          fontSize: "16px",
          padding: "8px",
          borderRadius: "4px",
          border: "1px solid #00FF00",
          overflowY: "auto",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
          Landmarks:
        </div>
        {currentLandmarks ? (
          <div>
            {currentLandmarks.map((landmark, idx) => {
              if (!landmark) return null;
              const name = KINECT_JOINT_NAMES[idx] || `Joint ${idx}`;
              return (
                <details
                  key={idx}
                  style={{
                    fontSize: "12px",
                    lineHeight: "1.3",
                    marginBottom: "4px",
                    color: JOINT_COLORS[idx] || "#FFFFFF",
                  }}
                >
                  <summary>{name}</summary>
                  <div style={{ paddingLeft: "12px" }}>
                    {Object.entries(landmark).map(([prop, value]) => (
                      <div key={prop}>
                        {prop}:{" "}
                        {typeof value === "number"
                          ? value.toFixed(3)
                          : String(value)}
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <div style={{ color: "#888" }}>Waiting for data...</div>
        )}
      </div>
    </div>
  );
}
