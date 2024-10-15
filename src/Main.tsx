import React, { useEffect, useRef } from "react";
import {
  Engine,
  FreeCamera,
  HemisphericLight,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  VideoTexture,
} from "@babylonjs/core";
import BabylonScene from "./BabylonScene";

export default function Main() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const scene = new BabylonScene(canvasRef.current);
  }, []);

  return <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh" }} />;
}
