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
