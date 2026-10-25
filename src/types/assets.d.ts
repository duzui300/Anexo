declare module '*.css?inline' {
  const css: string;
  export default css;
}

declare module '*.svg?url' {
  const url: string;
  export default url;
}
