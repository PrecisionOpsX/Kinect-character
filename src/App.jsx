import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Plane } from "@react-three/drei";
import { useEffect, useState } from "react";
import { Elf } from "./components/Elf";
import KinectTracker from "./components/KinectTracker";
import "./App.css";
import { ElfWithKinect } from "./components/ElfWithKinect";
function App() {
  const [landmarks, setLandmarks] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);

  return (
    <>
      <Canvas
        camera={{
          position: [0, 1.4, -4.5], // pulled back & behind (assuming model faces +Z); adjust sign if reversed
          fov: 45,
          near: 0.1,
        }}
      >
        <ambientLight intensity={0.5} castShadow />
        <directionalLight position={[0, 10, 5]} intensity={1} castShadow />
        <Environment files={"christmas_photo_studio_01_4k.hdr"} />

        <Plane
          args={[1000, 1000]}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow
        >
          <meshStandardMaterial color="white" />
        </Plane>

        <ElfWithKinect landmarks={landmarks} isPlaying={isPlaying} />

        <OrbitControls target={[0, 1, 0]} minDistance={2.5} />
      </Canvas>
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 300,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <KinectTracker
          onLandmarks={setLandmarks}
          isPlaying={isPlaying}
          onPlayingChange={setIsPlaying}
        />
      </div>
    </>
  );
}

export default App;
