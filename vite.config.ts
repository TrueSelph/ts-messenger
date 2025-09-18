import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
	server: {
		allowedHosts: [
			"https://tsmessenger.gimel.dev",
			"https://ts-platform.gimel.dev",
			"ts-platform.gimel.dev",
		],
	},
	plugins: [preact(), tsconfigPaths()],
	build: {
		rollupOptions: {
			output: {
				entryFileNames: "index.js",
			},
		},
	},
	resolve: {
		alias: {
			react: "preact/compat",
			"react-dom/test-utils": "preact/compat/test-utils",
			"react-dom": "preact/compat",
			// Not necessary for new projects, but might be needed for older ones
			// 'react/jsx-runtime': 'preact/jsx-runtime'
		},
	},
});
