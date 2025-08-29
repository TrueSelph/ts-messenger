import { App } from "./app.tsx";
import register from "preact-custom-element";

register(App, "ts-messenger", ["sessionId"], { shadow: true });
