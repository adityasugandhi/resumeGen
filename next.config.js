/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.logo.dev',
      },
    ],
  },
  // Mark native modules as external - they should not be bundled
  serverExternalPackages: [
    '@lancedb/lancedb',
    'onnxruntime-node',
    '@xenova/transformers',
  ],
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;

    // Exclude native .node files from bundling
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        '@lancedb/lancedb': 'commonjs @lancedb/lancedb',
        'onnxruntime-node': 'commonjs onnxruntime-node',
      });
    }

    // Completely exclude onnxruntime-node and .node binaries from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'onnxruntime-node': false,
        '@lancedb/lancedb': false,
      };

      // Ignore all .node files and native modules
      config.plugins.push(
        new (require('webpack')).IgnorePlugin({
          resourceRegExp: /^onnxruntime-node$/,
        }),
        new (require('webpack')).IgnorePlugin({
          resourceRegExp: /^@lancedb\/lancedb$/,
        }),
        new (require('webpack')).IgnorePlugin({
          resourceRegExp: /\.node$/,
          contextRegExp: /node_modules/,
        })
      );
    }

    return config;
  },
}

module.exports = nextConfig
