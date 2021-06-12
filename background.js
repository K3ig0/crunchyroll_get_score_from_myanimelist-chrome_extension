chrome.webNavigation.onCompleted.addListener(function(tab) {
  this.ifCrunchyRollThenRequestScoresFromMyAnimeList(tab);
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  this.checkNewAnimeTitlesPendingToGetStoreAndRequestScore(sender.tab.id);
});

function ifCrunchyRollThenRequestScoresFromMyAnimeList(tab) {
  if (tab && tab.frameId==0 && tab.url.indexOf("crunchyroll.com") != -1 && tab.url.indexOf("anime") != -1) {
    this.createObserverOnDOM(tab.tabId);
    this.checkNewAnimeTitlesPendingToGetStoreAndRequestScore(tab.tabId);
  }
}

function createObserverOnDOM(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    function: _createObserverOnDOM
  });
}

function checkNewAnimeTitlesPendingToGetStoreAndRequestScore(tabId) {
  chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: getAnimeTitlesPendingToGetScore
    },
    (animeTitlesToId) => {
      if (!chrome.runtime.lastError) {
        this.requestScoresToMyAnimeListIfNotCachedAndShow(animeTitlesToId, tabId);
      }
    }
  );
}

function requestScoresToMyAnimeListIfNotCachedAndShow(animeTitlesToId, tabId) {
  if (animeTitlesToId && animeTitlesToId.length > 0 && animeTitlesToId[0].result) {
    for (const [animeTitle, animeId] of Object.entries(animeTitlesToId[0].result)) {
      chrome.storage.local.get([animeTitle], function(animeScoreAndId) {
        if (animeScoreAndId && Object.entries(animeScoreAndId)[0] && Object.entries(animeScoreAndId)[0][1] && Object.entries(animeScoreAndId)[0][1].score !== "?") {
          const cachedScore = Object.entries(animeScoreAndId)[0][1].score;
          console.debug("[cached] " + animeTitle + " " + cachedScore);
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: showAnimeScore
          });
        } else {
          this.requestScoreToMyAnimeListAndShowAnimeScore(animeTitle, animeId, tabId);
        }
      });
    };
  }
}

function requestScoreToMyAnimeListAndShowAnimeScore(animeTitle, animeId, tabId) {
  fetch("https://myanimelist.net/search/all?cat=all&q=" + encodeURIComponent(animeTitle.trim()), {
    mode: "no-cors"
  }).then(response => {
    if (response.status === 403) {
      console.error("MyAnimeList.net access is temporarily disabled. Go to the site to enable it");
      return;
    }
    response.text().then(result => {
      try {
        const animeEntriesIndex = result.indexOf('<h2 id="anime">Anime</h2>');
        const animeEntries = result.substring(animeEntriesIndex);
        const scores = /Scored (\d\.\d+)/g.exec(animeEntries);
        if (scores.length > 1) {
          const score = scores[1];
          console.debug("[new] "  + animeTitle + " " + score);
          chrome.storage.local.set({ [animeTitle]: { animeId, score } });
        }
      } catch(ex) {
        console.error(ex);
        chrome.storage.local.set({ [animeTitle]: { animeId, score: "?" } });
      }
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: showAnimeScore
      });
    });
  });
}



// Functions called from activeTab:

function _createObserverOnDOM() {
    const targetNode = document.querySelector("#main_content");
    const config = { childList: true, subtree: true, attributes: false};
    const callback = function(mutationsList, observer) {
      if (mutationsList.length > 1) {
          chrome.runtime.sendMessage({newAnimeEntries: mutationsList.length});
      }
    }
    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
}

function getAnimeTitlesPendingToGetScore() {
  const animeTitlesToId = {};
  const animeEntries = document.getElementById("main_content").getElementsByClassName("series-title");
  for (var i = 0; i < animeEntries.length; i++) {
    if (animeEntries[i].parentElement.children[2].textContent.indexOf("| Score: ") === -1) {
      const id = animeEntries[i].parentElement.parentElement.parentElement.id;
      if (document.getElementById(id).children[0].children[0].children[2].textContent.indexOf("| Score: ") === -1) {
        animeTitlesToId[animeEntries[i].textContent] = animeEntries[i].parentElement.parentElement.parentElement.id;
      } else { // bug Crunchyroll: sometimes duplicates the anime entry, in this case then copy the score from the duplicated one
        animeEntries[i].parentElement.children[2].textContent = document.getElementById(id).children[0].children[0].children[2].textContent;
      }
    }
  }
  return animeTitlesToId;
}

function showAnimeScore() {
  const animeEntries = document.getElementById("main_content").getElementsByClassName("series-title");
  for (var i = 0; i < animeEntries.length; i++) {
    chrome.storage.local.get([animeEntries[i].textContent], function(animeScoreAndId) {
      const id = Object.entries(animeScoreAndId)[0][1].animeId;
      const score = Object.entries(animeScoreAndId)[0][1].score;
      if (document.getElementById(id).children[0].children[0].children[2].textContent.indexOf("| Score: ") === -1) {
        var textBelowTitle = document.getElementById(id).children[0].children[0].children[2].textContent;
        textBelowTitle = textBelowTitle.replace(/Ep (\d+).*/, "Ep $1 "); // in the "/anime/updated" endpoint replace the hours ago text in order to show the score
        document.getElementById(id).children[0].children[0].children[2].textContent = textBelowTitle + "| Score: " + score;
      }
    });
  }
}
