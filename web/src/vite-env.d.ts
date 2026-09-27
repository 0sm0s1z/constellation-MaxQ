/// <reference types="vite/client" />

declare module "*.mdx?html" {
  const html: string;
  export default html;
}
