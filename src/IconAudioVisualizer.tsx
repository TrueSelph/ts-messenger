import { chakra } from "@chakra-ui/react";
import { memo } from "preact/compat";
import { useRef, useEffect, useCallback } from "preact/hooks";

interface IconAudioVisualizerProps {
	audioData: Uint8Array<ArrayBufferLike> | null;
	isPlaying: boolean;
}

export const IconAudioVisualizer = memo(
	({ audioData, isPlaying }: IconAudioVisualizerProps) => {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const animationRef = useRef<number | null>(null);
		const lastFrameTime = useRef<number>(0);

		// Optimized refs for water droplet effect
		// const audioHistory = useRef<number[]>(new Array(8).fill(0));
		const lastCanvasSize = useRef({ width: 0, height: 0 });
		const rippleHistory = useRef<number[][]>([
			new Array(12).fill(0), // Droplet 1 ripple history
			new Array(12).fill(0), // Droplet 2 ripple history
			new Array(12).fill(0), // Droplet 3 ripple history
		]);

		const processAudioData = useCallback(
			(audioData: Uint8Array<ArrayBufferLike> | null) => {
				if (!audioData || audioData.length === 0) {
					return {
						bassLevel: 0,
						midLevel: 0,
						highLevel: 0,
						overallIntensity: 0,
					};
				}

				// Enhanced sensitivity for audio input
				let sum = 0;
				let peak = 0;
				const sampleSize = Math.min(audioData.length, 512);

				// Calculate RMS and peak for overall intensity
				for (let i = 0; i < sampleSize; i += 2) {
					const normalizedValue = (audioData[i] - 128) / 128;
					const squared = normalizedValue * normalizedValue;
					sum += squared;
					peak = Math.max(peak, Math.abs(normalizedValue));
				}

				const rms = Math.sqrt(sum / (sampleSize / 2));
				const overallIntensity = Math.min(1, (rms * 0.8 + peak * 0.2) * 4);

				// Simulate frequency bands using different parts of the audio data
				// This mimics what we'd get from FFT analysis
				let bassSum = 0,
					midSum = 0,
					highSum = 0;
				const segmentSize = Math.floor(sampleSize / 3);

				// Bass simulation (low frequencies) - use first third of data
				for (let i = 0; i < segmentSize; i++) {
					bassSum += Math.abs((audioData[i] - 128) / 128);
				}

				// Mid simulation - use middle third
				for (let i = segmentSize; i < segmentSize * 2; i++) {
					midSum += Math.abs((audioData[i] - 128) / 128);
				}

				// High simulation - use last third
				for (let i = segmentSize * 2; i < segmentSize * 3; i++) {
					highSum += Math.abs((audioData[i] - 128) / 128);
				}

				const bassLevel = Math.min(1, (bassSum / segmentSize) * 2.5);
				const midLevel = Math.min(1, (midSum / segmentSize) * 2.5);
				const highLevel = Math.min(1, (highSum / segmentSize) * 2.5);

				return {
					bassLevel,
					midLevel,
					highLevel,
					overallIntensity,
				};
			},
			[],
		);

		const drawVisualization = useCallback(
			(currentTime: number) => {
				const canvas = canvasRef.current;

				if (!canvas) return;

				// Throttle to 30fps for performance
				if (currentTime - lastFrameTime.current < 33) {
					if (isPlaying) {
						animationRef.current = requestAnimationFrame(drawVisualization);
					}
					return;
				}
				lastFrameTime.current = currentTime;

				const ctx = canvas.getContext("2d");
				if (!ctx) return;

				// Optimize canvas sizing
				const rect = canvas.getBoundingClientRect();
				const dpr = window.devicePixelRatio || 1;
				const scaledWidth = rect.width * dpr;
				const scaledHeight = rect.height * dpr;

				if (
					lastCanvasSize.current.width !== scaledWidth ||
					lastCanvasSize.current.height !== scaledHeight
				) {
					canvas.width = scaledWidth;
					canvas.height = scaledHeight;
					canvas.style.width = rect.width + "px";
					canvas.style.height = rect.height + "px";
					ctx.scale(dpr, dpr);
					lastCanvasSize.current = { width: scaledWidth, height: scaledHeight };
				}

				ctx.clearRect(0, 0, rect.width, rect.height);

				const centerX = rect.width * 0.5;
				const centerY = rect.height * 0.5;

				// Process audio data
				const processedAudio = processAudioData(audioData);

				// Update ripple histories for each droplet
				rippleHistory.current[0].shift();
				rippleHistory.current[0].push(processedAudio.bassLevel);
				rippleHistory.current[1].shift();
				rippleHistory.current[1].push(processedAudio.midLevel);
				rippleHistory.current[2].shift();
				rippleHistory.current[2].push(processedAudio.highLevel);

				const time = currentTime * 0.001;

				// Draw 3 overlapping water droplets with different properties
				drawWaterDroplet(
					ctx,
					centerX,
					centerY,
					28,
					processedAudio.bassLevel,
					rippleHistory.current[0],
					time,
					0,
					"rgba(139, 92, 246, 0.4)",
					0.8,
				);
				drawWaterDroplet(
					ctx,
					centerX,
					centerY,
					35,
					processedAudio.midLevel,
					rippleHistory.current[1],
					time * 1.2,
					Math.PI * 0.4,
					"rgba(99, 102, 241, 0.35)",
					0.9,
				);
				drawWaterDroplet(
					ctx,
					centerX,
					centerY,
					42,
					processedAudio.highLevel,
					rippleHistory.current[2],
					time * 0.7,
					Math.PI * 0.8,
					"rgba(75, 85, 235, 0.3)",
					1.0,
				);

				if (isPlaying) {
					animationRef.current = requestAnimationFrame(drawVisualization);
				}
			},
			[audioData, isPlaying, processAudioData],
		);

		const drawWaterDroplet = useCallback(
			(
				ctx: CanvasRenderingContext2D,
				centerX: number,
				centerY: number,
				baseRadius: number,
				currentIntensity: number,
				rippleHistory: number[],
				time: number,
				phaseOffset: number,
				fillColor: string,
				distortionScale: number,
			) => {
				const points: { x: number; y: number }[] = [];
				const numPoints = 48; // High resolution for smooth water effect

				// Calculate ripple intensity from history
				const rippleIntensity =
					rippleHistory.reduce((sum, val) => sum + val, 0) /
					rippleHistory.length;
				const enhancedIntensity =
					Math.pow(currentIntensity * 2.5, 0.7) * distortionScale;

				for (let i = 0; i < numPoints; i++) {
					const angle = (i / numPoints) * Math.PI * 2 + phaseOffset;

					// Create multiple wave layers for water-like distortion
					const primaryWave =
						Math.sin(angle * 3 + time * 2) * enhancedIntensity * 8;
					const secondaryWave =
						Math.sin(angle * 6 + time * 3.5) * enhancedIntensity * 4;
					const tertiaryWave =
						Math.sin(angle * 12 + time * 5) * enhancedIntensity * 2;

					// Ripple effect that propagates outward from impact points
					const rippleEffect =
						Math.sin(angle * 8 + time * 8) * rippleIntensity * 6;

					// Surface tension simulation - creates the "droplet" shape
					const surfaceTension =
						Math.sin(angle * 2 + time * 1.5) * (1 + enhancedIntensity) * 3;

					// Combine all distortions
					const totalDistortion =
						primaryWave +
						secondaryWave +
						tertiaryWave +
						rippleEffect +
						surfaceTension;

					// Add subtle breathing motion
					const breathingMotion =
						Math.sin(time * 2 + angle * 0.5) * (0.5 + enhancedIntensity) * 2;

					const finalRadius = baseRadius + totalDistortion + breathingMotion;

					// Calculate position with slight wobble for liquid effect
					const wobbleX =
						Math.sin(time * 3 + angle * 2) * enhancedIntensity * 1.5;
					const wobbleY =
						Math.cos(time * 3.2 + angle * 2.2) * enhancedIntensity * 1.5;

					const x = centerX + Math.cos(angle) * finalRadius + wobbleX;
					const y = centerY + Math.sin(angle) * finalRadius + wobbleY;

					points.push({ x, y });
				}

				// Draw smooth water droplet using bezier curves
				ctx.beginPath();
				ctx.moveTo(points[0].x, points[0].y);

				for (let i = 0; i < points.length; i++) {
					const current = points[i];
					const next = points[(i + 1) % points.length];

					// Create smooth curves using quadratic bezier
					const cpX = (current.x + next.x) * 0.5;
					const cpY = (current.y + next.y) * 0.5;

					ctx.quadraticCurveTo(current.x, current.y, cpX, cpY);
				}

				ctx.closePath();

				// Create water-like gradient
				const gradient = ctx.createRadialGradient(
					centerX,
					centerY,
					baseRadius * 0.3,
					centerX,
					centerY,
					baseRadius * 1.2,
				);

				// Dynamic gradient based on audio intensity
				const opacity = Math.min(0.8, 0.3 + enhancedIntensity * 0.5);
				const centerOpacity = Math.min(0.9, 0.5 + enhancedIntensity * 0.4);

				gradient.addColorStop(
					0,
					fillColor.replace(/[\d\.]+\)$/, `${centerOpacity})`),
				);
				gradient.addColorStop(
					0.7,
					fillColor.replace(/[\d\.]+\)$/, `${opacity * 0.7})`),
				);
				gradient.addColorStop(1, fillColor.replace(/[\d\.]+\)$/, "0.05)"));

				ctx.fillStyle = gradient;
				ctx.fill();

				// Add subtle inner highlight for water effect
				if (enhancedIntensity > 0.3) {
					const highlightGradient = ctx.createRadialGradient(
						centerX - baseRadius * 0.2,
						centerY - baseRadius * 0.2,
						0,
						centerX,
						centerY,
						baseRadius * 0.6,
					);

					const highlightOpacity = (enhancedIntensity - 0.3) * 0.4;
					highlightGradient.addColorStop(
						0,
						`rgba(255, 255, 255, ${highlightOpacity})`,
					);
					highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

					ctx.fillStyle = highlightGradient;
					ctx.fill();
				}

				// Add outer glow for high intensity
				if (enhancedIntensity > 0.4) {
					ctx.shadowBlur = 8 + enhancedIntensity * 12;
					ctx.shadowColor = fillColor.replace(
						/[\d\.]+\)$/,
						`${enhancedIntensity * 0.6})`,
					);
					ctx.fill();
					ctx.shadowBlur = 0;
				}

				// Add surface ripples for very high intensity
				if (enhancedIntensity > 0.6) {
					drawSurfaceRipples(
						ctx,
						centerX,
						centerY,
						baseRadius,
						enhancedIntensity,
						time,
						fillColor,
					);
				}
			},
			[],
		);

		const drawSurfaceRipples = useCallback(
			(
				ctx: CanvasRenderingContext2D,
				centerX: number,
				centerY: number,
				baseRadius: number,
				intensity: number,
				time: number,
				color: string,
			) => {
				// Draw concentric ripples on the water surface
				const numRipples = 3;

				for (let i = 0; i < numRipples; i++) {
					const rippleRadius =
						baseRadius + intensity * 15 + Math.sin(time * 6 + i * 2) * 8;
					const rippleOpacity = (intensity - 0.6) * 0.3 * (1 - i * 0.3);

					if (rippleOpacity > 0) {
						ctx.beginPath();
						ctx.arc(centerX, centerY, rippleRadius, 0, Math.PI * 2);
						ctx.strokeStyle = color.replace(/[\d\.]+\)$/, `${rippleOpacity})`);
						ctx.lineWidth = 1 + intensity * 2;
						ctx.stroke();
					}
				}
			},
			[],
		);

		useEffect(() => {
			if (!isPlaying) {
				if (animationRef.current) {
					cancelAnimationFrame(animationRef.current);
					animationRef.current = null;
				}
				const canvas = canvasRef.current;
				if (canvas) {
					const ctx = canvas.getContext("2d");
					if (ctx) {
						const rect = canvas.getBoundingClientRect();
						ctx.clearRect(0, 0, rect.width, rect.height);
					}
				}
				return;
			}

			animationRef.current = requestAnimationFrame(drawVisualization);

			return () => {
				if (animationRef.current) {
					cancelAnimationFrame(animationRef.current);
				}
			};
		}, [audioData, isPlaying, drawVisualization]);

		useEffect(() => {
			return () => {
				if (animationRef.current) {
					cancelAnimationFrame(animationRef.current);
				}
			};
		}, []);

		return (
			<chakra.canvas
				ref={canvasRef}
				position="absolute"
				top="50%"
				left="50%"
				width="180px"
				height="180px"
				transform="translate(-50%, -50%)"
				zIndex={0}
				pointerEvents="none"
				style={{
					maxWidth: "180px",
					maxHeight: "180px",
				}}
			/>
		);
	},
);
