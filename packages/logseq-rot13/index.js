
/**
 * ROT13
 * AUTHOR: David Moss
 * DESCRIPTION: performs the classic ROT13 encryption on every block on a page.
 * Performing it again reveals the original text
 * ROT13 is often used to obfuscate text to avoid shoulder surfing.
 */
function main() {
    logseq.Editor.registerSlashCommand('ROT13', async (e) => Rot13());

}

function rotate(thing) {
    let code = thing.charCodeAt(0);
//console.log(code + ".." + String.fromCharCode(code));
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
