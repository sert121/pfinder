import jQuery from 'jquery';

window.$ = jQuery; // workaround for https://github.com/parcel-bundler/parcel/issues/333

import 'popper.js';
import 'bootstrap';

import instantsearch from 'instantsearch.js/es';
import {
  searchBox,
  infiniteHits,
  configure,
  stats,
  analytics,
  refinementList,
  menu,
  sortBy,
  currentRefinements,
  rangeInput,
  toggleRefinement,
} from 'instantsearch.js/es/widgets';
import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';
import { SearchClient as TypesenseSearchClient } from 'typesense'; // To get the total number of docs
import images from '../images/*.*';
import STOP_WORDS from './utils/stop_words.json';
import copyToClipboard from 'copy-to-clipboard';
import { connectSortBy } from 'instantsearch.js/es/connectors';

// let selectedOptions = [];

let TYPESENSE_SERVER_CONFIG = {
  apiKey: process.env.TYPESENSE_SEARCH_ONLY_API_KEY, // Be sure to use an API key that only allows searches, in production
  nodes: [
    {
      host: process.env.TYPESENSE_HOST,
      port: process.env.TYPESENSE_PORT,
      protocol: process.env.TYPESENSE_PROTOCOL,
    },
  ],
  numRetries: 8,
  useServerSideSearchCache: true,
};

// [2, 3].forEach(i => {
//   if (process.env[`TYPESENSE_HOST_${i}`]) {
//     TYPESENSE_SERVER_CONFIG.nodes.push({
//       host: process.env[`TYPESENSE_HOST_${i}`],
//       port: process.env.TYPESENSE_PORT,
//       protocol: process.env.TYPESENSE_PROTOCOL,
//     });
//   }
// });

// Unfortunately, dynamic process.env keys don't work with parcel.js
// So need to enumerate each key one by one

if (process.env[`TYPESENSE_HOST_2`]) {
  TYPESENSE_SERVER_CONFIG.nodes.push({
    host: process.env[`TYPESENSE_HOST_2`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  });
}

if (process.env[`TYPESENSE_HOST_3`]) {
  TYPESENSE_SERVER_CONFIG.nodes.push({
    host: process.env[`TYPESENSE_HOST_3`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  });
}

if (process.env[`TYPESENSE_HOST_NEAREST`]) {
  TYPESENSE_SERVER_CONFIG['nearestNode'] = {
    host: process.env[`TYPESENSE_HOST_NEAREST`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  };
}

const INDEX_NAME = process.env.TYPESENSE_COLLECTION_NAME;
console.log("the index name is", INDEX_NAME)
async function getIndexSize() {
  let typesenseSearchClient = new TypesenseSearchClient(
    TYPESENSE_SERVER_CONFIG
  );
  let results = await typesenseSearchClient
    .collections(INDEX_NAME)
    .documents()
    .search({ q: '*' });

  console.log("results")
  console.log(results)
  return results['found'];
}

let indexSize;

(async () => {
  indexSize = await getIndexSize();
})();

function queryWithoutStopWords(query) {
  const words = query.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '').split(' ');
  return words
    .map((word) => {
      if (STOP_WORDS.includes(word.toLowerCase())) {
        return null;
      } else {
        return word;
      }
    })
    .filter((w) => w)
    .join(' ')
    .trim();
}

let typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
  server: TYPESENSE_SERVER_CONFIG,
  additionalSearchParameters: {
    q: '*', // Match all documents
    query_by: 'title,abstract,authors', // Default search mode fields
    num_typos: 1,
    max_facet_values: 100,
    exclude_fields: 'embedding',
  },
});


let searchClient = typesenseInstantsearchAdapter.searchClient;

let search = instantsearch({
  searchClient,
  indexName: INDEX_NAME,
  routing: true,
});


search.addWidgets([
  searchBox({
    container: '#searchbox',
    showSubmit: false,
    showReset: false,
    placeholder: 'type in a search term... ',
    autofocus: true,
    cssClasses: {
      input: 'form-control',
      loadingIcon: 'stroke-primary',
    },
    queryHook(query, search) {
      const modifiedQuery = query;
      search(modifiedQuery);
    },
  }),




  analytics({
    pushFunction(formattedParameters, state, results) {
      window.ga(
        'set',
        'page',
        (window.location.pathname + window.location.search).toLowerCase()
      );
      window.ga('send', 'pageView');
    },
  }),

  stats({
    container: '#stats',
    templates: {
      text: ({ nbHits, hasNoResults, hasOneResult, processingTimeMS }) => {
        let statsText = '';
        if (hasNoResults) {
          statsText = 'no papers found';
        } else if (hasOneResult) {
          statsText = '1 paper';
        } else {
          statsText = `${nbHits.toLocaleString()} papers`;
        }
        return `found ${statsText} ${
          indexSize ? ` from ${indexSize.toLocaleString()}` : ''
        } in ${processingTimeMS}ms.`;
      },
    },
    cssClasses: {
      text: 'text-muted',
    },
  }),
  infiniteHits({
    container: '#hits',
    cssClasses: {
      list: 'list-unstyled',
      item: 'd-flex flex-column search-result-card mb-5',
      loadMore: 'btn btn-secondary d-block mt-4',
      disabledLoadMore: 'btn btn-light mx-auto d-block mt-4',
    },
    templates: {

      
      item: (data) => {
        const abstractWithLatex = data.abstract.replace(/\$(.*?)\$/g, (match, p1) => {
          return katex.renderToString(p1, { throwOnError: false });
        });

        return `
            <div class="row">
              <div class="col-12">
               <a href="${
                    data.url
                  }"  target="_blank" class="text-decoration-none"> <h4 style="overflow-wrap: break-word;" class="text-secondary mb-1">
                  ${data.title}
                </h4> </a>
                          <span style="font-weight: 500; font-size: 0.9rem; color: #596185;">
            ${data.authors.join(', ')}
          </span>
                <div class="text-muted">
                  <span style="font-size: 0.8rem">${
          data.year
        }</span>
                  • <a class="btn-copy-to-clipboard text-decoration-none"  style="font-size: 0.8rem" href="#" data-link="${
                    data.url
                  }">Copy to Clipboard</a>
                  • <a class="text-decoration-none" style="font-size: 0.8rem" target="_blank" href="${
                    data.pdf_url
                  }">PDF</a>
                </div>
              </div>
            </div>

            <div class="abstract-container mt-2 overflow-auto">
               ${abstractWithLatex} <a href ="${
                    data.url
                  }"  target="_blank">[Read More]</a>
            </div>
            <div>

          </div>
            <div class="text-muted small mt-1">
            </div>
        `;
      },
      empty: 'No papers found for <q>{{ query }}</q>. Try another search term.',
      showMoreText: 'Show more papers',
    },

  }),
  menu({
    container: '#comic-publication-year',
    attribute: 'year', // Attribute from your Typesense schema
    sortBy: ['year:desc'], // Sort years in descending order
    limit: 50, // Limit the number of years displayed
    cssClasses: {
      list: 'list-unstyled',
      label: 'text-dark',
      link: 'text-decoration-none',
      count: 'badge text-dark-2 ml-2',
      selectedItem: 'bg-light pl-2',
    },
  }),
]);

search.start();


function updateSearchParameters(queryByFields, ) {
  // Create a new TypesenseInstantSearchAdapter with the updated parameters

  typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
    server: TYPESENSE_SERVER_CONFIG,
    additionalSearchParameters: {
      query_by: queryByFields,
      num_typos: 2,
       // Exclude embedding for keyword searches queryByFields === 'embedding' ? '' : 'embedding'
    }  ,
  });

  // Create a new search client
  let searchClient = typesenseInstantsearchAdapter.searchClient;

  // Reinitialize the InstantSearch instance with the new client
  search = instantsearch({
    searchClient,
    indexName: INDEX_NAME,
    routing: true,
  });

  // Add widgets and start the search again
  // (Make sure to re-add all necessary widgets)

  search.addWidgets([
    searchBox({
      container: '#searchbox',
      showSubmit: false,
      showReset: false,
      placeholder: 'type in a search term... ',
      autofocus: true,
      cssClasses: {
        input: 'form-control',
        loadingIcon: 'stroke-primary',
      },
      queryHook(query, search) {
        const modifiedQuery = query;
        search(modifiedQuery);
      },
    }),
  
    analytics({
      pushFunction(formattedParameters, state, results) {
        window.ga(
          'set',
          'page',
          (window.location.pathname + window.location.search).toLowerCase()
        );
        window.ga('send', 'pageView');
      },
    }),
  
    stats({
      container: '#stats',
      templates: {
        text: ({ nbHits, hasNoResults, hasOneResult, processingTimeMS }) => {
          let statsText = '';
          if (hasNoResults) {
            statsText = 'no papers';
          } else if (hasOneResult) {
            statsText = '1 paper';
          } else {
            statsText = `${nbHits.toLocaleString()} papers`;
          }
          return `found ${statsText} ${
            indexSize ? ` from ${indexSize.toLocaleString()}` : ''
          } in ${processingTimeMS}ms.`;
        },
      },
      cssClasses: {
        text: 'text-muted',
      },
    }),
    infiniteHits({
      container: '#hits',
      cssClasses: {
        list: 'list-unstyled',
        item: 'd-flex flex-column search-result-card mb-5',
        loadMore: 'btn btn-secondary d-block mt-4',
        disabledLoadMore: 'btn btn-light mx-auto d-block mt-4',
      },
      templates: {
        item: (data) => {
          const abstractWithLatex = data.abstract.replace(/\$(.*?)\$/g, (match, p1) => {
            return katex.renderToString(p1, { throwOnError: false });
          });
          return `
              <div class="row">
                <div class="col-12">

               <a href="${
                    data.url
                  }"  target="_blank" class="text-decoration-none"> <h4 style="overflow-wrap: break-word;" class="text-secondary mb-1">
                  ${data.title}
                </h4> </a>
              <span style="font-weight: 500; font-size: 0.9rem; color: #596185;">
            ${data.authors.join(', ')}
          </span>
                  <div class="text-muted small">
                    ${
            data.year
          }
                 • <a class="btn-copy-to-clipboard text-decoration-none"  style="font-size: 0.8rem" href="#" data-link="${
                    data.url
                  }">Copy to Clipboard
                  </a>
                    • <a class="text-decoration-none" target="_blank" href="${
                      data.pdf_url
                    }">PDF</a>
                  </div>
                </div>
              </div>

              <div class="mt-2 overflow-auto">
                ${abstractWithLatex}
              </div>
              <div class="text-muted small mt-1">
  
              </div>
          `;
        },
        empty: 'No papers found for <q>{{ query }}</q>. Try another search term.',
        showMoreText: 'Show more papers',
      },
    }),
    menu({
      container: '#comic-publication-year',
      attribute: 'year',
      sortBy: ['year:desc'],
      limit: 50, 
      cssClasses: {
        list: 'list-unstyled',
        label: 'text-dark',
        link: 'text-decoration-none',
        count: 'badge text-dark-2 ml-2',
        selectedItem: 'bg-light pl-2',
        
      },
    }),
    configure({
      hitsPerPage: 10,
    }),
  ]);
  
  search.start();
  
}



document.addEventListener('DOMContentLoaded', function () {
  // Listen for changes in the radio buttons
  document.querySelectorAll('input[name="searchMode"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      // Get the selected search mode
      const selectedMode = document.querySelector('input[name="searchMode"]:checked').value;

      // Determine fields based on the selected mode
      let queryByFields;
      if (selectedMode === 'default') {
        // Default search: use title, abstract, and authors
        queryByFields = 'title, abstract, authors';
      } else if (selectedMode === 'title') {
        queryByFields = 'title';
      }
      else  if (selectedMode === 'abstract') {
        queryByFields = 'abstract';
      }
      else if (selectedMode === 'authors') {
        queryByFields = 'authors';
      }
      else if (selectedMode === 'content') {
        queryByFields = 'content';
      }


      // Update search parameters dynamically
      updateSearchParameters(queryByFields);
    });
  });
});




search.on('render', function () {
  // Copy-to-Clipboard event handler

    // Delegated event handler for Copy-to-Clipboard
  $('#hits').on('click', '.btn-copy-to-clipboard', handleCopyToClipboard);


  $('.btn-copy-to-clipboard').on('click', handleCopyToClipboard);
  
  $('.topic').on('click', handleTopicClick);
});

function handleSearchTermClick(event) {
  const $searchBox = $('#searchbox input[type=search]');
  search.helper.clearRefinements();
  $searchBox.val(event.currentTarget.textContent);
  $searchBox.trigger('change');
  search.helper.setQuery($searchBox.val()).search();
  return false;
}

function handleTopicClick(event) {
  search.helper.clearRefinements();
  search.renderState[INDEX_NAME].refinementList.topics.refine(
    event.currentTarget.textContent
  );
  setTimeout(() => {
    $('html, body').animate(
      {
        scrollTop: $('#searchbox-container').offset().top,
      },
      200
    );
  }, 200);
  return false;
}


function handleCopyToClipboard() {
  copyToClipboard($(this).data('link'), {
    debug: true,
    message: 'Press #{key} to copy',
  });

  $(this).text('Done');

  setTimeout(() => {
    $(this).text('Copy to clipboard');
  }, 2000);

  return false;
}

$(async function () {
  const $searchBox = $('#searchbox input[type=search]');

  // Handle example search terms
  $('.clickable-search-term').on('click', handleSearchTermClick);
});


