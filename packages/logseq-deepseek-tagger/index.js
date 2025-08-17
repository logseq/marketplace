// index.js

const DEEPSEEK_API_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions'; // Verify the exact endpoint

/**
 * Function to call the DeepSeek API and get tag suggestions.
 * @param {string} textContent The block content for which to generate tags.
 * @param {string} apiKey The DeepSeek API key.
 * @returns {Promise<string[] | null>} An array of tags suggested by DeepSeek, or null in case of error.
 */
async function fetchTagsFromDeepSeek(textContent, apiKey) {
  if (!apiKey || apiKey.trim() === "") {
    console.error("DeepSeek API key not configured.");
    logseq.App.showMsg("Please configure your DeepSeek API key in the plugin settings.", "error");
    return null;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const currentDateString = `${year}-${month}-${day}`;

  let promptTemplate = `Analyze the following text and suggest 3 to 10 relevant keywords or concepts (one or two words) that could serve as tags. Return them as a comma-separated list, without any introduction or explanation, each tag should be in uppercase. For example: "TECHNOLOGY, ARTIFICIAL INTELLIGENCE, FUTURE".
YOU MUST ABSOLUTELY ADD to the proposed tags: the year (four digits), the month (in French and uppercase), the month (in French and uppercase) with the year (e.g. FEBRUARY 2025), the quarter with the year (e.g. Q1 2025), the quadrimester with the year (e.g. Q1 2025), the semester with the year (e.g. S1 2025). Temporal tags must also be in uppercase.
Text: "{BLOCK_TEXT}"
Date for temporal reference: "${currentDateString}"
Suggested tags:`;

  const escapedTextContent = textContent.replace(/"/g, '\\"');
  const finalPrompt = promptTemplate.replace("{BLOCK_TEXT}", escapedTextContent);

  try {
    const response = await fetch(DEEPSEEK_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "user", content: finalPrompt }
        ],
        max_tokens: 150,
        temperature: 0.2,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error("DeepSeek API error:", response.status, errorData, "Sent prompt:", finalPrompt);
      logseq.App.showMsg(`DeepSeek API error: ${errorData.error?.message || response.statusText}`, "error");
      return null;
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      let suggestedTagsString = data.choices[0].message.content.trim();
      suggestedTagsString = suggestedTagsString.replace(/^["']|["']$/g, "");
      return suggestedTagsString.split(',')
                                .map(tag => tag.trim().toUpperCase())
                                .filter(tag => tag.length > 0);
    } else {
      console.error("Unexpected response from DeepSeek:", data, "Sent prompt:", finalPrompt);
      logseq.App.showMsg("Unexpected response format from DeepSeek.", "warning");
      return null;
    }
  } catch (error) {
    console.error("Error calling DeepSeek:", error, "Sent prompt:", finalPrompt);
    logseq.App.showMsg(`Connection error to DeepSeek: ${error.message}`, "error");
    return null;
  }
}

/**
 * Main plugin entry point.
 */
function main() {
  console.log("DeepSeek Tagger (Complete) plugin loaded!");

  const settingsSchema = [
    {
      key: "deepseekApiKey",
      type: "string",
      title: "DeepSeek API Key",
      description: "Enter your DeepSeek API key. It will be stored locally.",
      default: "",
    }
  ];
  logseq.useSettingsSchema(settingsSchema);

  // --- Helper: Function to insert or update the tags CHILD block ---
  async function insertOrUpdateTagsChildBlock(parentBlockUUID, tagsArray) {
    if (!tagsArray || tagsArray.length === 0) {
      logseq.App.showMsg("No tags to insert.", "info");
      return;
    }
    // Ensure uniqueness and uppercase formatting before joining
    const uniqueTags = [...new Set(tagsArray.map(tag => tag.trim().toUpperCase()))].filter(tag => tag.length > 0);
    if (uniqueTags.length === 0) {
        logseq.App.showMsg("No valid tags to insert after cleanup.", "info");
        return;
    }
    const tagsStringForBlock = uniqueTags.join(", ");

    const parentBlockWithChildren = await logseq.Editor.getBlock(parentBlockUUID, { includeChildren: true });
    let tagsChildBlock = null;

    if (parentBlockWithChildren && parentBlockWithChildren.children && parentBlockWithChildren.children.length > 0) {
      tagsChildBlock = parentBlockWithChildren.children.find(child =>
        child.content && child.content.toUpperCase().startsWith("TAGS::") // Case-insensitive search
      );
    }

    if (tagsChildBlock) {
      await logseq.Editor.updateBlock(tagsChildBlock.uuid, `tags:: ${tagsStringForBlock}`);
      logseq.App.showMsg("Tags updated in child block!", "success");
    } else {
      await logseq.Editor.insertBlock(parentBlockUUID, `tags:: ${tagsStringForBlock}`, { sibling: false, before: false });
      logseq.App.showMsg("Tags added in a new child block!", "success");
    }
  }

  // --- /tags command (for current block, uses a child) ---
  logseq.Editor.registerSlashCommand(
    'tags',
    async (e) => {
      logseq.App.showMsg("Generating tags for the block...", "info", { timeout: 25000 });
      const apiKey = logseq.settings.deepseekApiKey;
      if (!apiKey || apiKey.trim() === "") {
        logseq.App.showMsg("DeepSeek API key not configured.", "error"); return;
      }
      const currentBlock = await logseq.Editor.getBlock(e.uuid);
      if (!currentBlock) {
        logseq.App.showMsg("Unable to get current block.", "warning"); return;
      }
      let contentForAI = currentBlock.content.split('\n').filter(line => !line.trim().match(/^.+::/)).join('\n').trim();
      if (!contentForAI) {
        logseq.App.showMsg("The block is empty (or only contains properties).", "warning"); return;
      }
      const allTags = await fetchTagsFromDeepSeek(contentForAI, apiKey);
      if (allTags) {
        await insertOrUpdateTagsChildBlock(currentBlock.uuid, allTags);
      } else {
        // Specific error message already displayed by fetchTagsFromDeepSeek
        // logseq.App.showMsg("No tags could be generated for the block.", "warning");
      }
    }
  );
  console.log("/tags (block) command registered.");

  // --- /tagpage command (for current page, new block at bottom) ---
  logseq.Editor.registerSlashCommand(
    'tagpage',
    async () => {
      logseq.App.showMsg("Generating tags for the page...", "info", { timeout: 45000 });
      const apiKey = logseq.settings.deepseekApiKey;
      if (!apiKey || apiKey.trim() === "") {
        logseq.App.showMsg("DeepSeek API key not configured.", "error"); return;
      }

      const currentPage = await logseq.Editor.getCurrentPage();
      if (!currentPage || !currentPage.name) {
        logseq.App.showMsg("Unable to determine current page.", "warning"); return;
      }

      const pageBlocks = await logseq.Editor.getPageBlocksTree(currentPage.name);
      if (!pageBlocks || pageBlocks.length === 0) {
        logseq.App.showMsg("The page is empty or has no blocks.", "info"); return;
      }

      let pageContent = "";
      function extractContent(blocks) {
        for (const block of blocks) {
          if (block.content && block.content.trim()) { // Take all non-empty content
            pageContent += block.content.trim() + "\n\n"; // Add all block content
            console.log("Block content added:", block.content.trim()); // For debugging
          }
          // Uncomment this if you want to test with children too:
          if (block.children && block.children.length > 0) {
            console.log("Extracting children of block:", block.uuid);
            extractContent(block.children); // Test with recursion
          }
        }
      }
      extractContent(pageBlocks);
      pageContent = pageContent.trim();

      if (!pageContent) {
        logseq.App.showMsg("No relevant textual content found on the page.", "info"); return;
      }

      const MAX_CONTENT_LENGTH = 15000;
      if (pageContent.length > MAX_CONTENT_LENGTH) {
        pageContent = pageContent.substring(0, MAX_CONTENT_LENGTH) + "\n[... truncated content ...]";
        logseq.App.showMsg("Page content truncated for tag analysis.", "info", {timeout: 5000});
      }

      const allTagsArray = await fetchTagsFromDeepSeek(pageContent, apiKey);

      if (allTagsArray && allTagsArray.length > 0) {
        const uniqueTags = [...new Set(allTagsArray.map(tag => tag.trim().toUpperCase()))].filter(tag => tag.length > 0);
        if (uniqueTags.length === 0) {
            logseq.App.showMsg("No valid tags to insert after cleanup.", "info"); return;
        }
        const tagsStringForBlock = uniqueTags.join(", ");
        const newBlockContent = `tags:: ${tagsStringForBlock}`; // Prefix for clarity

        const lastRootBlock = pageBlocks[pageBlocks.length - 1];
        if (lastRootBlock && lastRootBlock.uuid) {
            await logseq.Editor.insertBlock(lastRootBlock.uuid, newBlockContent, { sibling: true, before: false });
            logseq.App.showMsg("Page tags added in a new block at the bottom of the page!", "success");
        } else {
            // Fallback if lastRootBlock not found (e.g. page with only properties, empty page after filtering)
            try {
                 await logseq.Editor.insertBatchBlock([{
                    pageName: currentPage.name,
                    content: newBlockContent
                }], { sibling: false }); // sibling: false relative to page means direct child of page
                 logseq.App.showMsg("Page tags added in a new block (fallback method)!", "success");
            } catch (batchError) {
                console.error("Error during batch insert for tagpage:", batchError);
                logseq.App.showMsg("Error adding page tags.", "error");
            }
        }
      } else {
        // Error message already handled by fetchTagsFromDeepSeek or if allTagsArray is empty
      }
    }
  );
  console.log("/tagpage command registered.");
}

// Start the plugin
logseq.ready(main).catch(console.error);