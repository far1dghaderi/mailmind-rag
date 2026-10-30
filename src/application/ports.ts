// The only contract the app has with any language model.
export interface Llm {
  complete(prompt: string): Promise<string>;
}
export type ReadFile = (path: string) => Promise<string>;
