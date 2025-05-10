const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");

module.exports = {
    mode: "development",
//   mode: "production",
  devtool: "source-map",
  entry: {
    background: "./src/background/index.ts",
    content: "./src/content/index.ts",
    popup: "./src/popup/index.ts",
    options: "./src/options/index.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  plugins: [
    new WasmPackPlugin({
      crateDirectory: path.resolve(__dirname, "rust"),
      outDir: path.resolve(__dirname, "src/wasm"),
      extraArgs: "--target web",
    }),
    new CopyPlugin({
      patterns: [
        { from: "./manifest.json", to: "./" },
        { from: "./icons", to: "./icons" },
        {
          from: "./src/wasm",
          to: "./wasm",
          globOptions: { ignore: ["**/*.ts", "**/.gitignore", "**/package.json"] },
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: "./src/popup/index.html",
      filename: "popup.html",
      chunks: ["popup"],
    }),
    new HtmlWebpackPlugin({
      template: "./src/options/index.html",
      filename: "options.html",
      chunks: ["options"],
    }),
  ],
  experiments: {
    asyncWebAssembly: true,
  },
};
