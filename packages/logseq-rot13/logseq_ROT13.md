- Ebg13 vf na boshfgvpngvba zrgubq gung ebgngrf rnpu punenpgre va n fgevat ol 13 cynprf va gur nycunorg.
- Rot13 is an obfustication method that rotates each character in a string by 13 places in the alphabet.
- Ercrngvat n EBG13 tvirf onpx gur bevtvany grkg.
- Repeating a ROT13 gives back the original text.
- ROT13 is a logseq plugin I wrote to obfuscate a list of passwords I keep in logseq.
- There is an excellent guiide to setting up your development environment for writing logseq plugins at: https://gist.github.com/xyhp915/bb9f67f5b430ac0da2629d586a3e4d69
- Logseq plugins are written in Javascript.
- They live in their own folder and consist of 3 files:
	1. index.html
	2. index.js
	3. package.json

- It is best to start with skeletons of these files and fill in your own code where needed.
- index.html is as basic as it gets. Copy and use it as is:
-
  ```html
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Logseq Hello World</title>
    </head>
    <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@logseq/libs"></script>
    <script src="./index.js"></script>
  
    </body>
  </html>
  ```
- Notice there is a <div> with an id of app. This is where your plugin displays stuff when needed. Same as in React.
- The first <script> makes sure the logseq library is available to your javascript.
- The second <script> tag runs your javascript.
- index.js could be as simple as:
-
  ```Javascript
  function main() {
  	// your stuff goes here
    console.log("Hello World");
  }
  
  // bootstrap
  logseq.ready(main).catch(console.error);
  ```
- But a real plugin needs a bit more code to make it useful.
  I went with:  
-
  ```javascript
  /**
   * ROT13
   * AUTHOR: David Moss
   * DESCRIPTION: performs the classic ROT13 encryption on every block on a page.
   * Performing a ROT13 again reveals the original text
   * ROT13 is often used to obfuscate text to avoid shoulder surfing.
   */
  function main() {
      logseq.Editor.registerSlashCommand('ROT13', async (e) => Rot13());
  
  }
  
  function rotate(thing) {
      let code = thing.charCodeAt(0);
  
      if (code > 64 && code < 91) {
          // uppercase letter
          if (code < 78) {
              code = code + 13;
          }
          else {
              code = code - 13;
          }
      }
  
      if (code > 96 && code < 123) {
          // lowercase letter
          if (code < 110) {
              code = code + 13;
          }
          else {
              code = code - 13;
          }
      }
      return String.fromCharCode(code);
  }
  
  async function Rot13(e) {
      var inblocks = await logseq.Editor.getCurrentPageBlocksTree();
      for (const block of inblocks) {
          let output = block.content.split("").map(rotate);
          await logseq.Editor.updateBlock(block.uuid, output.join(""));
      }
  }
  
  
  // bootstrap
  logseq.ready(main).catch(console.error);
  
  ```
- This is the javascript you write.
- In this example
-
  ```javascript
  // bootstrap
  logseq.ready(main).catch(console.error);
  ```
  runs the main() function as the plugin is loaded, or writes an error message to the console if it can't.  
-
  ```javascript
  function main() {
      logseq.Editor.registerSlashCommand('ROT13', async (e) => Rot13());
  }
  ```
- The only line in it uses the logseq library function ** logseq.Editor.registerSlashCommand ** to register a new slash command and point it to the function *Rot13()*.  After that, If you type **/ROT13**,  logseq executes the Rot(13) function.
-
  ```javascript
  async function Rot13(e) {
      var inblocks = await logseq.Editor.getCurrentPageBlocksTree();
      for (const block of inblocks) {
          let output = block.content.split("").map(rotate);
          await logseq.Editor.updateBlock(block.uuid, output.join(""));
      }
  }
  ```
- Notice the function *Rot13(e)* is asynchronous and expects an input? I didn't use the input for anything but I had to include it between the brackets anyway. Logseq sends it when it calls the function.
- It sets the variable *inblocks* to a list of every block on the current page.
- It iterates the list and sets the variable *output* to an array of characters from the content of the block mapped to new values the rotate() function.
- It sets the content of the current block to a string formed by the output.join("") function. and moves on to the next block in the list.
- (Personally I don't like Javascript because it uses cryptic constructions I find hard to understand.)
- Finally there is the *package.json* file
-
  ```json
  {
    "name": "rot13",
    "version": "1.0.0",
    "main": "index.html",
    "logseq": {
      "id": "_dcxj13wse"
    },
    "dependencies": {
      "@logseq/libs": "^0.2.1"
    }
  }
  ```
- The first part has the name of the plugin *rot13*, its version *1.0.0* , and the place to look for its main function,  *index.html*.  Oh, and a unique id in a *logseq* section. Then any dependancies and their version. In this case only the logseq libraries and a version. I just copied the file as-is and changed the *name* and *version* entries.
- While writing of the plugin using [[JetBrains]] [[WebStorm]] a *node.modules* folder appeared as well as a *package-lock.json* file. I don't think these are actually needed for the plugin to work.
-
