// import { render } from "preact";
import "./index.css";
import { App } from "./app.tsx";
import register from "preact-custom-element";

register(App, "ts-messenger", ["sessionId"]);

// render(<App />, document.getElementById("app")!);
