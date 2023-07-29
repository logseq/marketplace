import '@logseq/libs';
import Fuse from 'fuse.js';
import nunjucks from 'nunjucks';
import { CUSTOM_SEARCH_KEYS, CUSTOM_PAGE_TEMPLATE } from './konstanten.js';

let timeoutId;
/**
 * Eine Funktion, die eine gegebene Funktion debounced.
 * @param {Function} func Funktion, die gedebounced werden soll
 * @param {number} [millisekunden=250] Warte solange bis Function ausgeführt wird
 */
export function debounce(func, millisekunden = 250) {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(async () => {
    func();
  }, millisekunden);
}

/**
 * Gibt Datestring für ein SearchResult.
 * @param {[{firstName: string, lastName: string, creatorType: string}|{name: string, creatorType: string}]} authors Autoren-Array aus Search-Results
 * @return {string} Formated Autoren-String
 */
export function generateAuthorString(authors) {
  const count = authors.length;

  if (count === 0) {
    return '';
  } else if (count === 1) {
    return authors[0].firstName && authors[0].lastName
      ? `${authors[0].firstName} ${authors[0].lastName}`
      : authors[0].name;
  } else if (count === 2) {
    const [author1, author2] = authors;
    const name1 =
      author1.firstName && author1.lastName
        ? `${author1.firstName} ${author1.lastName}`
        : author1.name;
    const name2 =
      author2.firstName && author2.lastName
        ? `${author2.firstName} ${author2.lastName}`
        : author2.name;

    return `${name1} und ${name2}`;
  } else if (count > 2) {
    const firstAuthor = authors[0];
    const name =
      firstAuthor.firstName && firstAuthor.lastName
        ? `${firstAuthor.firstName} ${firstAuthor.lastName}`
        : firstAuthor.name;

    return `${name} et al.`;
  }

  return '';
}

/**
 * Gibt Datestring für ein SearchResult.
 * @param {{key: string, version: number, itemType: string, title: string, abstractNote: string, date: string, shortTitle: string, libraryCatalog: string, callNumber: string, url: string, accessDate: string, extra: string, place: string, publisher: string, ISBN: string, numPages: string, creators: [{firstName: string, lastName: string, creatorType: string}|{name: string, creatorType: string}], tags: [{tag: string, type: number}], relations: [], dateAdded: string, dateModified: string, uri: string, itemID: number, attachments: [{itemType: string, title: string, tags: [], relations: [], dateAdded: string, dateModified: string, uri: string, path: string, select: string}], notes: [{key: string, version: number, itemType: string, parentItem: string, note: string, tags: [], relations: {}, dateAdded: string, dateModified: string, uri: string}], citationKey: string, itemKey: string, libraryKey: number, select: string}} result Item von Literatur aus dem BetterBibTeX JSON Export aus Zotero
 * @return {string} Formated Date-String mit Klammern
 */
export function generateDateString(result) {
  if (result.date && !isNaN(new Date(result.date).getFullYear()))
    return `(${new Date(result.date).getFullYear()})`;
  if (result.accessDate && !isNaN(new Date(result.accessDate).getFullYear()))
    return `(${new Date(result.accessDate).getFullYear()})`;
  return '';
}

/**
 * Fetcht Items aus dem BetterBibTeX-JSON-File von Zotero.
 * @return {Promise<[{key: string, version: number, itemType: string, title: string, abstractNote: string, date: string, shortTitle: string, libraryCatalog: string, callNumber: string, url: string, accessDate: string, extra: string, place: string, publisher: string, ISBN: string, numPages: string, creators: [{firstName: string, lastName: string, creatorType: string}|{name: string, creatorType: string}], tags: [{tag: string, type: number}], relations: [], dateAdded: string, dateModified: string, uri: string, itemID: number, attachments: [{itemType: string, title: string, tags: [], relations: [], dateAdded: string, dateModified: string, uri: string, path: string, select: string}], notes: [{key: string, version: number, itemType: string, parentItem: string, note: string, tags: [], relations: {}, dateAdded: string, dateModified: string, uri: string}], citationKey: string, itemKey: string, libraryKey: number, select: string}]>} zoteroItems Ein Items von Literatur aus dem BetterBibTeX JSON Export aus Zotero
 */
const getItemsFromJSON = async () => {
  try {
    const file = await fetch(logseq.settings.betterZotPath);
    const { items } = await file.json();
    return items;
  } catch (error) {
    throw error;
  }
};
/**
 * Gibt für Daten Suchergebnisse (Fuzzy-Search) zurück.
 * @param {string} searchString Suchbegriff(e)
 * @param {[{key: string, version: number, itemType: string, title: string, abstractNote: string, date: string, shortTitle: string, libraryCatalog: string, callNumber: string, url: string, accessDate: string, extra: string, place: string, publisher: string, ISBN: string, numPages: string, creators: [{firstName: string, lastName: string, creatorType: string}|{name: string, creatorType: string}], tags: [{tag: string, type: number}], relations: [], dateAdded: string, dateModified: string, uri: string, itemID: number, attachments: [{itemType: string, title: string, tags: [], relations: [], dateAdded: string, dateModified: string, uri: string, path: string, select: string}], notes: [{key: string, version: number, itemType: string, parentItem: string, note: string, tags: [], relations: {}, dateAdded: string, dateModified: string, uri: string}], citationKey: string, itemKey: string, libraryKey: number, select: string}]} zoteroItems Items von Literatur aus dem BetterBibTeX JSON Export aus Zotero
 * @return {[{key: string, version: number, itemType: string, title: string, abstractNote: string, date: string, shortTitle: string, libraryCatalog: string, callNumber: string, url: string, accessDate: string, extra: string, place: string, publisher: string, ISBN: string, numPages: string, creators: [{firstName: string, lastName: string, creatorType: string}|{name: string, creatorType: string}], tags: [{tag: string, type: number}], relations: [], dateAdded: string, dateModified: string, uri: string, itemID: number, attachments: [{itemType: string, title: string, tags: [], relations: [], dateAdded: string, dateModified: string, uri: string, path: string, select: string}], notes: [{key: string, version: number, itemType: string, parentItem: string, note: string, tags: [], relations: {}, dateAdded: string, dateModified: string, uri: string}], citationKey: string, itemKey: string, libraryKey: number, select: string}]} zoteroItems max. 10 Items von Literatur aus dem BetterBibTeX JSON Export aus Zotero
 */
const search = (searchString, data) => {
  const fuse = new Fuse(data, {
    includeScore: true,
    keys: CUSTOM_SEARCH_KEYS,
  });
  return fuse.search(searchString, { limit: 10 });
};
/**
 * Sucht nach Items in Zotero.
 * @param {string} searchString Suchbegriff(e)
 * @return {Promise<[{key: string, version: number, itemType: string, title: string, abstractNote: string, date: string, shortTitle: string, libraryCatalog: string, callNumber: string, url: string, accessDate: string, extra: string, place: string, publisher: string, ISBN: string, numPages: string, creators: [{firstName: string, lastName: string, creatorType: string}|{name: string, creatorType: string}], tags: [{tag: string, type: number}], relations: [], dateAdded: string, dateModified: string, uri: string, itemID: number, attachments: [{itemType: string, title: string, tags: [], relations: [], dateAdded: string, dateModified: string, uri: string, path: string, select: string}], notes: [{key: string, version: number, itemType: string, parentItem: string, note: string, tags: [], relations: {}, dateAdded: string, dateModified: string, uri: string}], citationKey: string, itemKey: string, libraryKey: number, select: string}]>} zoteroItems Items von Literatur aus dem BetterBibTeX JSON Export aus Zotero
 */
export async function query(searchString) {
  try {
    const items = await getItemsFromJSON();
    const queryRes = search(searchString, items);
    return queryRes.map((r) => r.item);
  } catch (error) {
    logseq.UI.showMsg("Can't fetch data from provided Path", 'warning', {
      timeout: 3000,
    });
    console.error('Svelte Plugin Error: fetching Zotero JSON', error);
    throw error;
  }
}

/**
 * Erstellt einen Link zur Literaturseite mit dem bereitgestellten pageName als Link in Logseq.
 * @param {string} pageName Der Name der Seite.
 */
const insertLitPageName = async (pageName) => {
  await logseq.Editor.insertAtEditingCursor(`[[${pageName}]] `);
};
/**
 * Verkleinert die children-Array.
 * @param {Array} childrenArr Children-Array von logseq.Editor.getBlock().
 * @return {Array} Verkleinerte children-Array
 */
const transformPageTemp = (childrenArr) => {
  return childrenArr.map((block) => {
    return {
      content: block.content,
      children:
        block.children.length > 0 ? transformPageTemp(block.children) : [],
    };
  });
};
/**
 * Fügt Werte aus Zotero in Template ein.
 * @param {Array} pageTemp von transformPageTemp().
 * @param {{key: string, version: number, itemType: string, title: string, abstractNote: string, date: string, shortTitle: string, libraryCatalog: string, callNumber: string, url: string, accessDate: string, extra: string, place: string, publisher: string, ISBN: string, numPages: string, creators: [{firstName: string, lastName: string, creatorType: string}|{name: string, creatorType: string}], tags: [{tag: string, type: number}], relations: [], dateAdded: string, dateModified: string, uri: string, itemID: number, attachments: [{itemType: string, title: string, tags: [], relations: [], dateAdded: string, dateModified: string, uri: string, path: string, select: string}], notes: [{key: string, version: number, itemType: string, parentItem: string, note: string, tags: [], relations: {}, dateAdded: string, dateModified: string, uri: string}], citationKey: string, itemKey: string, libraryKey: number, select: string}} zoteroItem Ein Item einer Literatur aus dem BetterBibTeX JSON Export aus Zotero
 * @return {Array} Array von Objekten mit fertigem content zum inserten in Logseq
 */
const insertValuesInTemp = (pageTemp, zoteroItem) => {
  return pageTemp
    .map((block) => {
      const content = nunjucks
        .renderString(block.content, zoteroItem)
        .replace(/^\s*[\r\n]/gm, '');
      if (!content) return;
      return {
        content: content,
        children:
          block.children.length > 0
            ? insertValuesInTemp(block.children, zoteroItem)
            : [],
      };
    })
    .filter((value) => value !== undefined);
};
/**
 * Erstellt Literaturseite & einen Link zur Literaturseite in Logseq.
 * @param {{key: string, version: number, itemType: string, title: string, abstractNote: string, date: string, shortTitle: string, libraryCatalog: string, callNumber: string, url: string, accessDate: string, extra: string, place: string, publisher: string, ISBN: string, numPages: string, creators: [{firstName: string, lastName: string, creatorType: string}|{name: string, creatorType: string}], tags: [{tag: string, type: number}], relations: [], dateAdded: string, dateModified: string, uri: string, itemID: number, attachments: [{itemType: string, title: string, tags: [], relations: [], dateAdded: string, dateModified: string, uri: string, path: string, select: string}], notes: [{key: string, version: number, itemType: string, parentItem: string, note: string, tags: [], relations: {}, dateAdded: string, dateModified: string, uri: string}], citationKey: string, itemKey: string, libraryKey: number, select: string}} zoteroItem Ein Item einer Literatur aus dem BetterBibTeX JSON Export aus Zotero
 */
export async function createLiteraturNote(zoteroItem) {
  const pageNameTemp = logseq.settings.betterZotTitleTemp;
  if (!pageNameTemp) {
    console.error('Es gibt kein Title-Template');
    logseq.UI.showMsg('No Title-Template is defined', 'warning', {
      timeout: 3000,
    });
    return;
  }
  const pageName = nunjucks.renderString(pageNameTemp, zoteroItem);
  const pageExsits = await logseq.Editor.getPage(pageName);
  if (pageExsits) {
    console.log('Literaturnote existiert schon');
    await insertLitPageName(pageName);
    return;
  }
  const { uuid } = await logseq.Editor.createPage(
    pageName,
    {},
    {
      redirect: false,
    }
  );
  if (!uuid) {
    console.error('Literaturnote konnte nicht erstellt werden');
    logseq.UI.showMsg("Couldn't create Literaturnote", 'warning', {
      timeout: 3000,
    });
    return;
  }
  const pageTempUUIDSettingStr = logseq.settings.betterZotPageTemp;
  const pageTempUUIDStrs = pageTempUUIDSettingStr
    .split(',')
    .map((val) => val.trim());

  const pageTempUUIDs = pageTempUUIDStrs.map((val) =>
    val.replaceAll(/\(\(|\)\)/g, '')
  );
  let pageTempTransformed;
  if (pageTempUUIDs.length > 0) {
    for (const potID of pageTempUUIDs) {
      try {
        if (pageTempTransformed) break;
        const pageTemp = await logseq.Editor.getBlock(potID, {
          includeChildren: true,
        });
        pageTempTransformed = transformPageTemp(pageTemp.children);
      } catch (error) {}
    }
    if (!pageTempTransformed) pageTempTransformed = CUSTOM_PAGE_TEMPLATE;
  } else {
    pageTempTransformed = CUSTOM_PAGE_TEMPLATE;
  }
  const pageContent = insertValuesInTemp(pageTempTransformed, zoteroItem);
  const pageBlockTree = await logseq.Editor.getPageBlocksTree(uuid);
  const pagePropBlockID = pageBlockTree[0].uuid;
  await logseq.Editor.insertBatchBlock(pagePropBlockID, pageContent);
  await insertLitPageName(pageName);
  return;
}
