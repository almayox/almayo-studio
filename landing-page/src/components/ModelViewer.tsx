"use client";

import { useEffect, useRef, useState } from "react";

type Status = "loading" | "ready" | "error";

/**
 * Draws a 3D model (a .glb file) that the visitor can turn around by dragging
 * with a finger or the mouse. It turns slowly by itself until it is touched.
 * `zoom` also lets them move closer: used in the full-screen view, where the
 * scroll wheel has nothing else to do.
 */
function ModelCanvas({ src, zoom, onUsed }: { src: string; zoom: boolean; onUsed: () => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const used = useRef(onUsed);
  useEffect(() => {
    used.current = onUsed;
  }, [onUsed]);

  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    let stopped = false;
    let cleanup = () => {};

    void (async () => {
      const [THREE, { GLTFLoader }, { OrbitControls }, { RoomEnvironment }] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/controls/OrbitControls.js"),
        import("three/examples/jsm/environments/RoomEnvironment.js"),
      ]);
      if (stopped) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      element.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      // Soft studio lighting from every side, so materials look as they do in Blender's preview.
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

      const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.enableZoom = zoom;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.2;
      controls.addEventListener("start", () => {
        controls.autoRotate = false;
        used.current();
      });

      const resize = () => {
        const width = element.clientWidth || 1;
        const height = element.clientHeight || 1;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();

      let frame = 0;
      const draw = () => {
        frame = requestAnimationFrame(draw);
        controls.update();
        renderer.render(scene, camera);
      };

      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        pmrem.dispose();
        scene.traverse((object) => {
          const mesh = object as { geometry?: { dispose(): void } };
          mesh.geometry?.dispose();
        });
        renderer.dispose();
        renderer.domElement.remove();
      };

      new GLTFLoader().load(
        src,
        (gltf) => {
          if (stopped) return;
          const model = gltf.scene;
          // Centre the model and step back far enough to see all of it.
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const centre = box.getCenter(new THREE.Vector3());
          model.position.sub(centre);
          scene.add(model);
          // The sphere around the model, so no corner is cut off at any angle.
          const radius = Math.max(size.length(), 0.001) / 2;
          const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.15;
          camera.position.set(distance * 0.6, distance * 0.35, distance * 0.75);
          camera.near = distance / 100;
          camera.far = distance * 100;
          camera.updateProjectionMatrix();
          controls.minDistance = distance * 0.35;
          controls.maxDistance = distance * 2.5;
          controls.update();
          setStatus("ready");
          draw();
        },
        undefined,
        () => {
          if (!stopped) setStatus("error");
        },
      );
    })();

    return () => {
      stopped = true;
      cleanup();
    };
  }, [src, zoom]);

  return (
    <div ref={holder} className="h-full w-full cursor-grab touch-none active:cursor-grabbing [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full">
      {status === "ready" ? null : (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-navy/55">
          {status === "loading"
            ? "Loading 3D model…"
            : "This 3D model could not be shown."}
        </p>
      )}
    </div>
  );
}

/** A 3D model in the project gallery, with a full-screen view to look closer. */
export function ModelViewer({ src, title }: { src: string; title: string }) {
  const [used, setUsed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <div
        role="img"
        aria-label={`3D model: ${title}. Drag to turn it around.`}
        className="relative aspect-[4/3] w-[min(100%,calc(var(--media-row)*4/3))] overflow-hidden rounded-2xl bg-gradient-to-b from-white to-mist/60 ring-1 ring-mist"
      >
        {/* Only one copy is drawn at a time: the full-screen view takes over while it is open. */}
        {open ? null : <ModelCanvas src={src} zoom={false} onUsed={() => setUsed(true)} />}
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-navy px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white">
          3D
        </span>
        {used ? null : (
          <span className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <span className="flex items-center gap-2 rounded-full bg-navy/85 px-4 py-2 text-xs font-medium text-white shadow-lg">
              <span className="model-drag-hint inline-flex" aria-hidden>
                ↔
              </span>
              Drag to look around
            </span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-navy shadow-sm ring-1 ring-mist transition hover:bg-navy hover:text-white"
        >
          Full screen
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-[100] flex flex-col bg-white"
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <p className="truncate font-[family-name:var(--font-display)] text-lg text-navy">
              {title}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              autoFocus
              className="shrink-0 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/85"
            >
              Close
            </button>
          </div>
          <div className="relative min-h-0 flex-1 bg-gradient-to-b from-white to-mist/60">
            <ModelCanvas src={src} zoom onUsed={() => setUsed(true)} />
            <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-xs text-navy/50">
              Drag to turn · pinch or scroll to zoom
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
