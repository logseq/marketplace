<script>
  import "@logseq/libs";
  import {
    createLiteraturNote,
    debounce,
    generateAuthorString,
    generateDateString,
    query,
  } from "./helperFunc.js";
  import { clickOutside } from "./handelers.js";
  import "@logseq/libs";

  let searchValue = "";
  let results = [];
  let selected = null;
  export let ref;
  let searchResultsContainer;

  $: if (!searchValue) {
    results = [];
    selected = null;
  } else {
    debounce(async () => {
      selected = null;
      try {
        results = await query(searchValue);
      } catch (error) {
        closeModal();
      }
    });
  }
  $: if (selected === null && searchResultsContainer)
    searchResultsContainer.scrollTop = 0;
  const checkKey = (e) => {
    if (e.key === "Escape") closeModal();
    if (e.key === "Enter" && selected !== null)
      handleZoteroItem(results[selected]);
  };
  const closeModal = () => {
    searchValue = "";
    results = [];
    selected = null;
    logseq.hideMainUI({ restoreEditingCursor: true });
  };
  const handleSearchResNavigation = (event) => {
    const { key } = event;
    if (key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      if (selected === null) {
        selected = results.length - 1;
        scrollSelectedIntoView();
      } else {
        selected = (selected - 1 + results.length) % results.length;
        scrollSelectedIntoView();
      }
    } else if (key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      if (selected === null) {
        selected = 0;
        scrollSelectedIntoView();
      } else {
        selected = (selected + 1) % results.length;
        scrollSelectedIntoView();
      }
    }
  };
  function scrollSelectedIntoView() {
    if (selected !== null) {
      const selectedElement = searchResultsContainer.querySelector(
        `#result-${selected}`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }
  const handleZoteroItem = async (zoteroItem) => {
    await createLiteraturNote(zoteroItem);
    closeModal();
  };
</script>

<svelte:window on:keydown={checkKey} />

<div use:clickOutside on:clickOutside={closeModal} class="wrapper">
  <div id="search-bar-container">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="icon icon-tabler icon-tabler-letter-z"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="#CC2936"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M7 4h10l-10 16h10" />
    </svg>

    <input
      bind:this={ref}
      bind:value={searchValue}
      id="search-bar"
      type="text"
      placeholder="Search for literature"
      on:keydown={handleSearchResNavigation}
    />
  </div>

  {#if results.length > 0}
    <ul id="search-results" bind:this={searchResultsContainer}>
      {#each results as result, index}
        <button
          class="search-result"
          title={result.title}
          class:selected={index === selected}
          id={`result-${index}`}
          on:click={() => handleZoteroItem(result)}
        >
          <div class="title">{result.title}</div>
          <div class="info">
            {generateAuthorString(result.creators) +
              " " +
              generateDateString(result)}
          </div>
        </button>
      {/each}
    </ul>
  {/if}
</div>

<style>
  * {
    box-sizing: border-box;
    --bg-color: #ffffff;
    --text-color: #191919;
    --li-hover-background: #f2f2f2;
    /* TODO Darkmode Farben ändern
		--bg-color: #323232;
    --text-color: #f5f5f5;
    --li-hover-background: #4b4b4b;
		*/
  }
  .wrapper {
    margin: 2em auto;
    margin-bottom: 0;
    width: min-content;
  }
  #search-bar-container {
    display: flex;
    align-items: center;
    overflow: auto;
    width: 40em;
    max-height: 50em;
    padding: 0.5em;
    border-radius: 0.35em;
    box-shadow: rgba(0, 0, 0, 0.35) 0px 3px 10px;
    background-color: var(--bg-color);
  }
  #search-bar,
  #search-bar:focus {
    background: var(--bg-color);
    color: var(--text-color);
    width: 100%;
    height: 2em;
    border: 0;
    outline: 0;
    border-radius: 4px;
    font-size: 1em;
    padding: 0.25em 0.25em 0.25em 0.5em;
    margin: 0;
  }
  ul {
    padding: 0;
    background: var(--bg-color);
    width: 40em;
    margin: 2px 0;
    border-radius: 0.35em;
    max-height: 30em;
    box-shadow: rgba(0, 0, 0, 0.35) 0px 2px 5px;
    overflow-y: auto;
  }
  ul > button:last-child {
    padding-bottom: 0.75em;
  }
  button {
    padding: 0.25em 0.5em;
    cursor: pointer;
    border: none;
    background: var(--bg-color);
    margin: 0;
    text-align: left;
    width: 100%;
  }
  button.search-result:hover,
  button.selected {
    background: var(--li-hover-background);
  }
  button > div:first-child {
    padding-bottom: 0.25em;
  }
  button > .title {
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
