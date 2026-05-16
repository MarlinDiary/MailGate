"use client";

import { gsap } from "gsap";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import React, { useCallback, useEffect, useMemo, useRef } from "react";

gsap.registerPlugin(InertiaPlugin);

type Dot = {
  _inertiaApplied: boolean;
  cx: number;
  cy: number;
  xOffset: number;
  yOffset: number;
};

export type DotGridProps = {
  activeColor?: string;
  baseColor?: string;
  className?: string;
  dotSize?: number;
  gap?: number;
  maxSpeed?: number;
  proximity?: number;
  resistance?: number;
  returnDuration?: number;
  shockRadius?: number;
  shockStrength?: number;
  speedTrigger?: number;
  style?: React.CSSProperties;
};

function hexToRgb(hex: string) {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);

  if (!match) {
    return { b: 0, g: 0, r: 0 };
  }

  return {
    b: Number.parseInt(match[3], 16),
    g: Number.parseInt(match[2], 16),
    r: Number.parseInt(match[1], 16),
  };
}

function throttle<T extends unknown[]>(callback: (...args: T) => void, limit: number) {
  let lastCall = 0;

  return (...args: T) => {
    const now = performance.now();

    if (now - lastCall >= limit) {
      lastCall = now;
      callback(...args);
    }
  };
}

export function DotGrid({
  activeColor = "#8f8f99",
  baseColor = "#d9d9de",
  className = "",
  dotSize = 2.5,
  gap = 20,
  maxSpeed = 5000,
  proximity = 96,
  resistance = 750,
  returnDuration = 1.2,
  shockRadius = 140,
  shockStrength = 2,
  speedTrigger = 80,
  style,
}: DotGridProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const pointerRef = useRef({
    lastTime: 0,
    lastX: 0,
    lastY: 0,
    speed: 0,
    vx: 0,
    vy: 0,
    x: 0,
    y: 0,
  });
  const baseRgb = useMemo(() => hexToRgb(baseColor), [baseColor]);
  const activeRgb = useMemo(() => hexToRgb(activeColor), [activeColor]);
  const circlePath = useMemo(() => {
    if (typeof window === "undefined" || !window.Path2D) {
      return null;
    }

    const path = new Path2D();
    path.arc(0, 0, dotSize / 2, 0, Math.PI * 2);

    return path;
  }, [dotSize]);

  const buildGrid = useCallback(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;

    if (!wrapper || !canvas) {
      return;
    }

    const { height, width } = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");

    if (context) {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const columns = Math.floor((width + gap) / (dotSize + gap));
    const rows = Math.floor((height + gap) / (dotSize + gap));
    const cell = dotSize + gap;
    const gridWidth = cell * columns - gap;
    const gridHeight = cell * rows - gap;
    const startX = (width - gridWidth) / 2 + dotSize / 2;
    const startY = (height - gridHeight) / 2 + dotSize / 2;
    const dots: Dot[] = [];

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        dots.push({
          _inertiaApplied: false,
          cx: startX + x * cell,
          cy: startY + y * cell,
          xOffset: 0,
          yOffset: 0,
        });
      }
    }

    dotsRef.current = dots;
  }, [dotSize, gap]);

  useEffect(() => {
    buildGrid();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(buildGrid);

      if (wrapperRef.current) {
        observer.observe(wrapperRef.current);
      }

      return () => observer.disconnect();
    }

    window.addEventListener("resize", buildGrid);

    return () => window.removeEventListener("resize", buildGrid);
  }, [buildGrid]);

  useEffect(() => {
    if (!circlePath) {
      return;
    }

    const path = circlePath;
    let frame = 0;
    const proximitySquared = proximity * proximity;

    function draw() {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");

      if (!canvas || !context) {
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);

      for (const dot of dotsRef.current) {
        const distanceX = dot.cx - pointerRef.current.x;
        const distanceY = dot.cy - pointerRef.current.y;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;
        let color = baseColor;

        if (distanceSquared <= proximitySquared) {
          const distance = Math.sqrt(distanceSquared);
          const amount = 1 - distance / proximity;
          const r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * amount);
          const g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * amount);
          const b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * amount);

          color = `rgb(${r},${g},${b})`;
        }

        context.save();
        context.translate(dot.cx + dot.xOffset, dot.cy + dot.yOffset);
        context.fillStyle = color;
        context.fill(path);
        context.restore();
      }

      frame = requestAnimationFrame(draw);
    }

    draw();

    return () => cancelAnimationFrame(frame);
  }, [activeRgb, baseColor, baseRgb, circlePath, proximity]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const now = performance.now();
      const pointer = pointerRef.current;
      const elapsed = pointer.lastTime ? now - pointer.lastTime : 16;
      const dx = event.clientX - pointer.lastX;
      const dy = event.clientY - pointer.lastY;
      let vx = (dx / elapsed) * 1000;
      let vy = (dy / elapsed) * 1000;
      let speed = Math.hypot(vx, vy);

      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;

        vx *= scale;
        vy *= scale;
        speed = maxSpeed;
      }

      const rect = canvas.getBoundingClientRect();

      pointer.lastTime = now;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      pointer.speed = speed;
      pointer.vx = vx;
      pointer.vy = vy;
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;

      if (speed <= speedTrigger) {
        return;
      }

      for (const dot of dotsRef.current) {
        const distance = Math.hypot(dot.cx - pointer.x, dot.cy - pointer.y);

        if (distance < proximity && !dot._inertiaApplied) {
          dot._inertiaApplied = true;
          gsap.killTweensOf(dot);
          gsap.to(dot, {
            inertia: {
              xOffset: dot.cx - pointer.x + vx * 0.005,
              yOffset: dot.cy - pointer.y + vy * 0.005,
              resistance,
            },
            onComplete: () => {
              gsap.to(dot, {
                duration: returnDuration,
                ease: "elastic.out(1,0.75)",
                xOffset: 0,
                yOffset: 0,
              });
              dot._inertiaApplied = false;
            },
          });
        }
      }
    };

    const handleClick = (event: MouseEvent) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;

      for (const dot of dotsRef.current) {
        const distance = Math.hypot(dot.cx - clickX, dot.cy - clickY);

        if (distance < shockRadius && !dot._inertiaApplied) {
          dot._inertiaApplied = true;
          gsap.killTweensOf(dot);
          const falloff = Math.max(0, 1 - distance / shockRadius);
          const pushX = (dot.cx - clickX) * shockStrength * falloff;
          const pushY = (dot.cy - clickY) * shockStrength * falloff;

          gsap.to(dot, {
            inertia: { xOffset: pushX, yOffset: pushY, resistance },
            onComplete: () => {
              gsap.to(dot, {
                duration: returnDuration,
                ease: "elastic.out(1,0.75)",
                xOffset: 0,
                yOffset: 0,
              });
              dot._inertiaApplied = false;
            },
          });
        }
      }
    };

    const throttledMove = throttle(handleMove, 50);

    window.addEventListener("mousemove", throttledMove, { passive: true });
    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("mousemove", throttledMove);
      window.removeEventListener("click", handleClick);
    };
  }, [
    maxSpeed,
    proximity,
    resistance,
    returnDuration,
    shockRadius,
    shockStrength,
    speedTrigger,
  ]);

  return (
    <section
      className={`relative flex h-full w-full items-center justify-center p-4 ${className}`}
      style={style}
    >
      <div ref={wrapperRef} className="relative h-full w-full">
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
    </section>
  );
}
