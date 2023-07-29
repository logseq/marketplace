export const CUSTOM_SEARCH_KEYS = [
  "title", // will be assigned a `weight` of 1
  {
    name: "creators.lastName",
    weight: 1.2,
  },
  {
    name: "creators.firstName",
    weight: 0.8,
  },
  {
    name: "creators.name",
    weight: 1.2,
  },
  {
    name: "citationKey",
    weight: 1.8,
  },
];
export const CUSTOM_PAGE_TEMPLATE = [
  {
    content:
      '{% if tags.length > 0 %}zotero-tags:: {{tags | join(", ", "tag")}}{% endif %}\n{% if date %}date:: {{date}}{% endif %}\n{% if ISSN %}issn:: {{ISSN}}{% endif %}\n{% if issue %}issue:: {{issue}}{% endif %}\n{% if DOI %}doi:: {{DOI}}{% endif %}\n{% if pages %}pages:: {{pages}}{% endif %}\n{% if volume %}volume:: {{volume}}{% endif %}\n{% if itemType %}item-type:: {{itemType}}{% endif %}\n{% if accessDate %}access-date:: {{accessDate}}{% endif %}\n{% if title %}original-title:: {{title}}{% endif %}\n{% if language %}language:: {{language}}{% endif %}\n{% if url %}url:: {{url}}{% endif %}\n{% if runningTime %}running-time:: {{runningTime}}{% endif %}\n{% if shortTitle %}short-title:: {{shortTitle}}{% endif %}\n{% if publicationTitle %}publication-title:: {{publicationTitle}}{% endif %}\n{% if series %}series:: {{series}}{% endif %}\n{% if seriesNumber %}series-number:: {{seriesNumber}}{% endif %}\n{% if seriesTitle %}series-title:: {{seriesTitle}}{% endif %}\n{% if blogTitle %}blog-title:: {{blogTitle}}{% endif %}\n{% if creators %}authors:: {% for author in creators %}{% if author.firstName and author.lastName %}{{author.firstName}} {{author.lastName}}{% elif author.name %}{{author.name}}{% endif %} ({{author.creatorType}}){% if not loop.last %}, {% endif %}{% endfor %}{% endif %}\n{% if libraryCatalog %}library-catalog:: {{libraryCatalog}}{% endif %}\n{% if select %}links:: [Local library]({{select}}){% endif %}',
    children: [],
  },
  {
    content: "{% if abstractNote %}Abstract{% endif %}",
    children: [
      {
        content: "{% if abstractNote %}{{abstractNote | safe}}{% endif %}",
        children: [],
      },
    ],
  },
  {
    content: "{% if attachments.length > 0 %}Attachments{% endif %}",
    children: [
      {
        content:
          "{% if attachments.length > 0 %}\n{% for att in attachments %}  \n[{{att.title}}]({{att.uri}}) {{'{{'}}zotero-imported-file {{att.select.split('/') | last}}, \"{{att.path.split('\\\\') | last}}\"{{'}}'}}\n{% endfor %}\n{% endif %}",
        children: [],
      },
    ],
  },
];
