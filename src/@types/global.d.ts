//
// [IMPORTANT] Importing from the top of the file and not from inside a `declare module xxx`
// will make the module extended. So here it's to replace full definition of a module, aside files with imports
// are to enhance some modules while keeping other inner types accessible
//

declare module '*.txt' {
  const content: string;
  export default content;
}
