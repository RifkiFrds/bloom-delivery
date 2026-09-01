'use client';

/** Day-0 E2 probe. Delete with its parent route at the start of Phase 6. */

import { Canvas } from '@react-three/fiber';

export default function R3FProbe(): React.ReactElement {
  return (
    <Canvas
      camera={{ fov: 45, position: [2, 2, 3] }}
      gl={{ antialias: false, alpha: true }}
      flat
    >
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 4, 2]} intensity={1.4} />
      <mesh rotation={[0.4, 0.6, 0]}>
        <boxGeometry args={[1.4, 1.4, 1.4]} />
        <meshBasicMaterial color="#FF8FAB" />
      </mesh>
    </Canvas>
  );
}
