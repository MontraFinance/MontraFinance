import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ThreeBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xffffff, 0.002);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xffffff, 1);
    container.appendChild(renderer.domElement);

    // Torus Knot
    const geometry = new THREE.TorusKnotGeometry(9, 2.5, 120, 16);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x0000ff,
      emissive: 0x000000,
      metalness: 0.5,
      roughness: 0.1,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const torusKnot = new THREE.Mesh(geometry, material);
    scene.add(torusKnot);

    // Particles
    const sparkCount = 100;
    const sparkGeo = new THREE.CircleGeometry(0.15, 3);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0x0000ff,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });
    const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, sparkCount);
    torusKnot.add(sparks);

    const dummy = new THREE.Object3D();
    const radialSegments = 16;
    const tubularSegments = 120;
    const sparkData = Array.from({ length: sparkCount }, () => ({
      speed: 0.001 + Math.random() * 0.002,
      progress: Math.random(),
      pathIndex: Math.floor(Math.random() * radialSegments),
    }));

    const posAttribute = geometry.attributes.position;
    const stride = radialSegments + 1;
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();

    function updateSparks() {
      sparkData.forEach((spark, i) => {
        spark.progress += spark.speed;
        if (spark.progress >= 1) spark.progress = 0;
        const exactInd = spark.progress * tubularSegments;
        const u = Math.floor(exactInd);
        const nextU = (u + 1) % tubularSegments;
        const v = spark.pathIndex;
        const idx1 = (u * stride + v) * 3;
        const idx2 = (nextU * stride + v) * 3;
        v1.fromArray(posAttribute.array as unknown as number[], idx1);
        v2.fromArray(posAttribute.array as unknown as number[], idx2);
        v1.lerp(v2, exactInd - u);
        dummy.position.copy(v1);
        dummy.lookAt(v2);
        dummy.updateMatrix();
        sparks.setMatrixAt(i, dummy.matrix);
      });
      sparks.instanceMatrix.needsUpdate = true;
    }

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const pLight = new THREE.PointLight(0x0000ff, 1, 50);
    pLight.position.set(10, 10, 10);
    scene.add(pLight);

    // Mouse interaction
    let mouseX = 0, mouseY = 0;
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX - halfW) * 0.0005;
      mouseY = (e.clientY - halfH) * 0.0005;
    };
    document.addEventListener('mousemove', onMouseMove);

    // Animate
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      torusKnot.rotation.y += 0.05 * (mouseX * 0.5 - torusKnot.rotation.y) + 0.002;
      torusKnot.rotation.x += 0.05 * (mouseY * 0.5 - torusKnot.rotation.x) + 0.001;
      updateSparks();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationId);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
};

export default ThreeBackground;
