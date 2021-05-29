chrome.webNavigation.onCompleted.addListener(function(tab) {
  this.ifCrunchyRollThenRequestScoresFromMyAnimeList(tab);
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  chrome.storage.local.get(["tabId"], function(data) {
    this.checkNewAnimeTitlesPendingToGetStoreAndRequestScore(data.tabId);
  });
});

function ifCrunchyRollThenRequestScoresFromMyAnimeList(tab) {
  if (tab && tab.frameId==0 && tab.url.indexOf("crunchyroll.com") != -1 && tab.url.indexOf("anime") != -1) {
    console.log("Crunchyroll - Get Anime score from MyAnimeList.net - Requesting scores...");
    this.checkNewAnimeTitlesPendingToGetStoreAndRequestScore(tab.tabId);
    chrome.storage.local.set({ ["tabId"]: tab.tabId });
    chrome.alarms.create("checkCrunchyrollNewAnime", {delayInMinutes: 0.1, periodInMinutes: 0.1});
  }
}

function checkNewAnimeTitlesPendingToGetStoreAndRequestScore(tabId) {
  chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: getAnimeTitlesPendingToGetScore
    },
    (animeTitlesToId) => {
      if (chrome.runtime.lastError) {
        chrome.alarms.clearAll();
      } else {
        this.requestScoresToMyAnimeListIfNotCachedAndShow(animeTitlesToId, tabId);
      }
    }
  );
}

function requestScoresToMyAnimeListIfNotCachedAndShow(animeTitlesToId, tabId) {
  if (animeTitlesToId && animeTitlesToId.length > 0 && animeTitlesToId[0].result) {
    for (const [animeTitle, animeId] of Object.entries(animeTitlesToId[0].result)) {
      getDataFromLocalStorage(['animeTitle']).then(function(animeScoreAndId) {
        var cachedScore = Object.entries(animeScoreAndId)[0][1].score;
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: showAnimeScore
        });
      }).catch(this.requestScoreToMyAnimeListAndShowAnimeScore(animeTitle, animeId, tabId));
    };
  }
}

function requestScoreToMyAnimeListAndShowAnimeScore(animeTitle, animeId, tabId) {
  fetch("https://myanimelist.net/search/all?cat=all&q=" + encodeURIComponent(animeTitle.trim()))
  .then(response => response.text())
  .then(result => {
    if (result) {
      var score = /Scored (\d\.\d+)/g.exec(result)[1];
      console.log("[new] "  + animeTitle + " " + score);
      chrome.storage.local.set({ [animeTitle]: { animeId, score } });
    } else {
      chrome.storage.local.set({ [animeTitle]: { animeId, score: "?" } });
    }
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: showAnimeScore
    });
  });
}


// Functions called from activeTab:

function getAnimeTitlesPendingToGetScore() {
  var animeTitlesToId = {};
  var animeEntries = document.getElementById("main_content").getElementsByClassName("series-title");
  for (var i = 0; i < animeEntries.length; i++) {
    if (animeEntries[i].parentElement.children[2].textContent.indexOf("| Score: ") === -1) {
      var id = animeEntries[i].parentElement.parentElement.parentElement.id;
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
  var animeEntries = document.getElementById("main_content").getElementsByClassName("series-title");
  for (var i = 0; i < animeEntries.length; i++) {
    chrome.storage.local.get([animeEntries[i].textContent], function(animeScoreAndId) {
      var id = Object.entries(animeScoreAndId)[0][1].animeId;
      var score = Object.entries(animeScoreAndId)[0][1].score;
      if (document.getElementById(id).children[0].children[0].children[2].textContent.indexOf("| Score: ") === -1) {
        var textBelowTitle = document.getElementById(id).children[0].children[0].children[2].textContent;
        textBelowTitle = textBelowTitle.replace(/Ep (\d+).*/, "Ep $1 "); // in the "/anime/updated" endpoint replace the hours ago text in order to show the score
        document.getElementById(id).children[0].children[0].children[2].textContent = textBelowTitle + "| Score: " + score;
      }
    });
  }
}

function getDataFromLocalStorage(sKey) {
  return new Promise(function(resolve, reject) {
    chrome.storage.local.get(sKey, function(items) {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError.message);
      } else {
        resolve(items[sKey]);
      }
    });
  });
}
