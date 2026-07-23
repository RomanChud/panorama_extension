const { defineConfig } = require("@vue/cli-service");

const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const CopyPlugin = require("copy-webpack-plugin");

const isProduction = process.env.NODE_ENV === "production";

module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: "auto",
  outputDir: isProduction ? "./dist" : undefined,
  parallel: false,
  configureWebpack: () => {
    return {
      resolve: {
      extensions: ['.ts', '.js', '.vue', '.json']
    },
      module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          options: {
            appendTsSuffixTo: [/\.vue$/],
          },
          exclude: /node_modules/
        }
      ]
     },
      entry: "./src/main.ts",
      output: {
        uniqueName: "panorama_extension",
        scriptType: "text/javascript",
        filename: "[name].js",
        clean: true,
      },
      optimization: {
        // fix a temporary bug
        runtimeChunk: false,
        splitChunks: isProduction ? undefined : false,
      },
      plugins: [
        new ModuleFederationPlugin({
          name: "panorama_extension",
          library: {
            type: "var",
            name: "panorama_extension",
          },
          filename: "[name].js",
          exposes: [
            {
              IPageNavigation: "./src/extension/navigation.ts",
            },
            {
              "IOpenspaceView<PageContext>":
                "./src/extension/panoramaView.ts",
            },
          ],
          shared: {
            "@pilotdev/pilot-web-sdk": {
              singleton: true,
            },
          },
        }),
        new CopyPlugin({
          patterns: [
            {
              from: "./src/extension/extensions.config.json",
              to: `extensions.config.json`,
            },
          ],
        }),
      ],
      devServer: isProduction
        ? undefined
        : {  
            port: 4300,
            allowedHosts: "auto",
            headers: { 
              'Access-Control-Allow-Origin': '*', 
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
              'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization' 
            },
          },
    };
  },
});

