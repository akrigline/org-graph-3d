import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGraphStore } from '../../store/useGraphStore.js';

const vertexShader = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3 cloudColor;
  uniform float opacity;
  uniform float hovered;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    float rimStrength = mix(0.08, 0.45, hovered);
    gl_FragColor = vec4(cloudColor, fresnel * rimStrength * opacity);
  }
`;

const CLOUD_COLOR = new THREE.Color('#e8a030');
const _box = new THREE.Box3();
const _center = new THREE.Vector3();
const _size = new THREE.Vector3();
const _v = new THREE.Vector3();

const PAD = 20;

export function NebulaMesh({ themeNode, memberIds, simNodesRef, graphNodes }) {
  const meshRef = useRef();
  const uniforms = useMemo(() => ({
    cloudColor: { value: CLOUD_COLOR },
    opacity: { value: 1.0 },
    hovered: { value: 0.0 },
  }), []);

  const memberIndices = useMemo(() => {
    const indices = [];
    graphNodes.forEach((n, i) => {
      if (memberIds.has(n.id)) indices.push(i);
    });
    return indices;
  }, [graphNodes, memberIds]);

  useEffect(() => {
    return () => useGraphStore.getState().setHoveredNodeId(null);
  }, []);

  // Back-face-only raycasting: the sphere's front face is closer to the camera
  // than nodes inside it, so without this override the cloud always intercepts
  // events before nodes do. The back face sits at camDist+R — always further
  // than any enclosed node — so nodes win the hit-test naturally.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const original = mesh.raycast.bind(mesh);
    mesh.raycast = function(raycaster, intersects) {
      const prev = this.material.side;
      this.material.side = THREE.BackSide;
      original(raycaster, intersects);
      this.material.side = prev;
    };
  }, []);

  useFrame(() => {
    if (!meshRef.current || memberIndices.length === 0) return;

    const simNodes = simNodesRef.current;

    const points = memberIndices
      .map(i => simNodes[i])
      .filter(Boolean)
      .map(n => _v.set(n.x ?? 0, n.y ?? 0, n.z ?? 0).clone());

    if (points.length === 0) return;

    _box.setFromPoints(points);
    _box.getCenter(_center);
    _box.getSize(_size);

    meshRef.current.position.copy(_center);
    meshRef.current.scale.set(
      Math.max(_size.x / 2 + PAD, PAD),
      Math.max(_size.y / 2 + PAD, PAD),
      Math.max(_size.z / 2 + PAD, PAD)
    );

    const { focusNodeId, focusSet, hoveredNodeId } = useGraphStore.getState();
    const inFocus = !focusNodeId || focusSet.has(themeNode.id);
    uniforms.opacity.value = inFocus ? 1.0 : 0.04;

    const isHovered = hoveredNodeId === themeNode.id;
    uniforms.hovered.value = THREE.MathUtils.lerp(uniforms.hovered.value, isHovered ? 1.0 : 0.0, 0.15);
  });

  return (
    <mesh
      ref={meshRef}
      onPointerOver={e => { e.stopPropagation(); useGraphStore.getState().setHoveredNodeId(themeNode.id); }}
      onPointerOut={() => useGraphStore.getState().setHoveredNodeId(null)}
      onClick={e => {
        e.stopPropagation();
        const { selectedNodeId, setSelectedNodeId, setFocusNodeId } = useGraphStore.getState();
        if (selectedNodeId === themeNode.id) {
          setSelectedNodeId(null);
          setFocusNodeId(null);
        } else {
          setSelectedNodeId(themeNode.id);
          setFocusNodeId(themeNode.id);
        }
      }}
    >
      <sphereGeometry args={[1, 32, 24]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
