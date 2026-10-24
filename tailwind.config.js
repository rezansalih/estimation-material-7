/** Production Tailwind build: scans index.html and the root scripts, emitting only the classes used. */
module.exports = {
  content: ['./index.html', './*.js'],
  theme: { extend: {} },
  plugins: [],
  corePlugins: { preflight: true },
};
