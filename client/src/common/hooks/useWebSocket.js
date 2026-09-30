import socketModule from "react-use-websocket";
// react-use-websocket is CommonJS and Vite 8 default-imports its namespace
export const useWebSocket = socketModule.default || socketModule;
export { ReadyState } from "react-use-websocket";
