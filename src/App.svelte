<script>
  import "@logseq/libs";
  import SearchModal from "./SearchModal.svelte";

  let searchRef;

  function main() {
    logseq.Editor.registerSlashCommand(logseq.settings.betterZotCmd, () => {
      logseq.showMainUI();
      setTimeout(() => searchRef.select(), 0);
    });
    logseq.useSettingsSchema([
      {
        key: "betterZotCmd",
        title: "Slash-Command",
        description:
          "The Slash-Command you can type to open the Zotero-Search-Bar (need to reload the app)",
        type: "string",
        default: "better Zotero",
      },
      {
        key: "betterZotPath",
        title: "Path",
        description: "The full Path to your BetterBibTeX-JSON-File from Zotero",
        type: "string",
        default: "",
      },
      {
        key: "betterZotTitleTemp",
        title: "Title-Template",
        description: "Nunjucks-Templating-Syntax for your Page-Title",
        type: "string",
        default: "@{{citationKey}}",
      },
      {
        key: "betterZotPageTemp",
        title: "Page-Template Parentblock-ID",
        description:
          "Copied block-ID with children with the Nunjucks-Templating-Syntax for your Literaturnote",
        type: "string",
        default: "",
      },
    ]);
  }

  logseq.ready(main).catch(console.error);
</script>

<SearchModal bind:ref={searchRef} />
