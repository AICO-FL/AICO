import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import copy from 'rollup-plugin-copy'
import { comlink } from 'vite-plugin-comlink'
//import obfuscatorPlugin from "vite-plugin-javascript-obfuscator";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      react(),
      comlink(),
      //obfuscatorPlugin({
      //  //include: ["src/path/to/file.js", "path/anyjs/**/*.js", /foo.js$/],
      //  //exclude: [/node_modules/],
      //  apply: "build",
      //  //debugger: true,
      //  options: {
      //    // your javascript-obfuscator options
      //    debugProtection: true,
      //    // ...  [See more options](https://github.com/javascript-obfuscator/javascript-obfuscator)
      //  },
      //}),
      copy({
        targets: [
          {
            src: 'node_modules/onnxruntime-web/dist/*.wasm',
            dest: 'src/renderer/assets/onnxruntime-web'
          }
        ],
        hook: 'buildStart'
      })
    ],
    worker: {
      plugins: () => [comlink()]
    }
  }
})
