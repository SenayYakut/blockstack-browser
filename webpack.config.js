const HtmlWebPackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')
const path = require('path')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const history = require('connect-history-api-fallback')
const convert = require('koa-connect')
const isProd = process.env.NODE_ENV === 'production'
const WebpackBar = require('webpackbar')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const ImageminPlugin = require('imagemin-webpack-plugin').default
const workboxPlugin = require('workbox-webpack-plugin')
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin')

const cssUseList = ['style-loader', 'css-loader']
module.exports = {
  mode: isProd ? 'production' : 'development',
  devtool: isProd ? false : 'cheap-module-source-map',
  entry: {
    main: ['./app/js/index.js']
  },
  node: {
    fs: 'empty'
  },
  output: {
    filename: 'js/[name].[chunkhash:8].js',
    chunkFilename: 'js/[name].[chunkhash:8].chunk.js',
    path: path.resolve(__dirname, 'build/static'),
    publicPath: '/static'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            compact: true,
            babelrc: true,
            cacheDirectory: true
          }
        }
      },
      {
        test: /\.(png|woff|woff2|eot|ttf|svg)$/,
        loader: 'url-loader?limit=100000'
      },

      {
        test: /\.css$/,
        use: cssUseList
      },
      {
        test: /\.html$/,
        use: [
          {
            loader: 'html-loader',
            options: { minimize: true }
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.json', '.jsx'],
    alias: {
      '@components': './app/js/components',
      '@common': './app/js/common',
      '@styled': './app/js/components/styled',
      '@utils': './app/js/utils',
      '@blockstack/ui': './app/js/components/ui',
      '@ui/components': './app/js/components/ui/components',
      '@ui/containers': './app/js/components/ui/containers',
      '@ui/common': './app/js/components/ui/common',
      log4js: './app/js/logger.js'
    }
  },
  optimization: {
    minimize: isProd,
    nodeEnv: isProd ? 'production' : 'development',
    minimizer: [
      new UglifyJsPlugin({
        uglifyOptions: {
          parse: {
            // we want uglify-js to parse ecma 8 code. However, we don't want it
            // to apply any minfication steps that turns valid ecma 5 code
            // into invalid ecma 5 code. This is why the 'compress' and 'output'
            // sections only apply transformations that are ecma 5 safe
            // https://github.com/facebook/create-react-app/pull/4234
            ecma: 8
          },
          compress: {
            ecma: 5,
            warnings: false,
            // Disabled because of an issue with Uglify breaking seemingly valid code:
            // https://github.com/facebook/create-react-app/issues/2376
            // Pending further investigation:
            // https://github.com/mishoo/UglifyJS2/issues/2011
            comparisons: false
          },
          mangle: {
            safari10: true,
            reserved: ['BigInteger', 'ECPair', 'Point']
          },
          output: {
            ecma: 5,
            comments: false,
            // Turned on because emoji and regex is not minified properly using default
            // https://github.com/facebook/create-react-app/issues/2488
            ascii_only: true
          }
        },
        parallel: true,
        cache: true,
        sourceMap: true
      })
    ],
    splitChunks: {
      chunks: 'all',
      minSize: 0,
      maxAsyncRequests: Infinity,
      maxInitialRequests: Infinity,
      name: false,
      cacheGroups: {
        commons: {
          chunks: 'initial',
          minChunks: 2,
          reuseExistingChunk: true
        },
        vendors: {
          name: 'vendors',
          enforce: true,
          test: /[\\/]node_modules[\\/]/,
          reuseExistingChunk: true
        }
      }
    }
  },
  plugins: [
    new CleanWebpackPlugin(['build']),
    new WebpackBar({
      color: '#9E5FC1'
    }),
    new webpack.DefinePlugin(JSON.stringify(process.env.NODE_ENV)),
    new LodashModuleReplacementPlugin(),
    new CopyWebpackPlugin([
      { from: 'app/images', to: 'images' },
      { from: 'app/fonts', to: 'fonts' },
      { from: 'app/public', to: '../' }
    ]),
    new ImageminPlugin({
      disable: !isProd, // Disable during development
      test: /\.(jpe?g|png|gif|svg)$/i
    }),
    new HtmlWebPackPlugin({
      inject: true,
      template: path.resolve(__dirname, 'app/public', 'index.html'),
      filename: path.resolve(__dirname, 'build', 'index.html'),
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true
      }
    }),
    new workboxPlugin.GenerateSW({
      swDest: '../sw.js',
      clientsClaim: true,
      skipWaiting: true,
      include: [/\.html$/, /\.js$/, /\.webp/]
    })
  ]
}

module.exports.serve = {
  content: ['app', 'build'],
  add: (app, middleware, options) => {
    const historyOptions = {
      // ... see: https://github.com/bripkens/connect-history-api-fallback#options
    }
    app.use(convert(history(historyOptions)))

    middleware.webpack()
    middleware.content()
  }
}
