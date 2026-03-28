// Polyfills necesarios para Jest + jsdom con react-router v6
const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
