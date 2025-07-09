import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const varRoot = ":host";

const config = defineConfig({
	theme: {
		keyframes: {
			talking: {
				"0%": {
					transform: "scale(0.95)",
					boxShadow: "0 0 0 0 rgba(82, 82, 265, 0.7)",
				},
				"70%": {
					transform: "scale(1)",
					boxShadow: "0 0 0 10px rgba(255, 82, 82, 0)",
				},
				"100%": {
					transform: "scale(0.95)",
					boxShadow: "0 0 0 0 rgba(255, 82, 82, 0)",
				},
			},
			pulsez: {
				"0%": {
					transform: "scale(0.95)",
					boxShadow: "0 0 0 0 rgba(0, 0, 0, 0.7)",
				},

				"70%": {
					transform: "scale(1)",
					boxShadow: "0 0 0 10px rgba(255, 82, 82, 0)",
				},

				"100%": {
					transform: "scale(0.95)",
					boxShadow: "0 0 0 0 rgba(255, 82, 82, 0)",
				},
			},
			fadeInUp: {
				"0%": { opacity: 0, transform: "translateY(10px)" },
				"20%": { opacity: 0.2, transform: "translateY(8px)" },
				"40%": { opacity: 0.4, transform: "translateY(6px)" },
				"60%": { opacity: 0.6, transform: "translateY(4px)" },
				"80%": { opacity: 0.8, transform: "translateY(2px)" },
				"100%": { opacity: 1, transform: "translateY(0px)" },
			},
		},
	},
	cssVarsRoot: varRoot,
	conditions: {
		light: `${varRoot} &, .light &`,
	},
	preflight: { scope: varRoot },
	globalCss: {
		[varRoot]: defaultConfig.globalCss?.html ?? {},
	},
});

export const system = createSystem(defaultConfig, config);
