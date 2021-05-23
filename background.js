chrome.webNavigation.onCompleted.addListener(function(tab) {
  this.ifCrunchyRollThenRequestScoresFromMyAnimeList(tab);
});

function ifCrunchyRollThenRequestScoresFromMyAnimeList(tab) {
  if (tab.frameId==0 && tab.url.indexOf("crunchyroll.com") != -1 && tab.url.indexOf("anime") != -1) {
    console.log("Crunchyroll - Get Anime score from MyAnimeList.net - Requesting scores...");
    chrome.scripting.executeScript({
      target: { tabId: tab.tabId },
      function: getAnimeTitlesPendingToGetScore
      },
      (animeTitlesToId) => {
        this.requestScoresFromMyAnimeList(animeTitlesToId, tab.tabId);
      }
    );
  }
}

function requestScoresFromMyAnimeList(animeTitlesToId, tabId) {
  if (animeTitlesToId && animeTitlesToId.length > 0 && animeTitlesToId[0].result) {
    for (const [animeTitle, animeId] of Object.entries(animeTitlesToId[0].result)) {
      fetch("https://myanimelist.net/search/all?cat=all&q=" + encodeURIComponent(animeTitle.trim()))
      .then(response => response.text())
      .then(result => {
        if (result) {
          var score = /Scored (\d\.\d+)/g.exec(result)[1];
          console.log(animeTitle + ' ' + score);
          chrome.storage.local.set({ [animeTitle]: { animeId, score } });
        } else {
          chrome.storage.local.set({ [animeTitle]: { animeId, score: '?' } });
        }
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: setAnimeScore
        });
      });
    };
  }
}


// Functions called from executeScript:

function getAnimeTitlesPendingToGetScore() {
  var animeTitlesToId = {};
  var animeEntries = document.getElementById("main_content").getElementsByClassName("series-title");
  for (var i = 0; i < animeEntries.length; i++) {
    if (animeEntries[i].parentElement.children[2].textContent.indexOf('| Score: ') === -1) {
      animeTitlesToId[animeEntries[i].textContent] = animeEntries[i].parentElement.parentElement.parentElement.id;
    }
  }
  return animeTitlesToId;
}

function setAnimeScore() {
  var animeEntries = document.getElementById("main_content").getElementsByClassName("series-title");
  for (var i = 0; i < animeEntries.length; i++) {
    chrome.storage.local.get([animeEntries[i].textContent], function(animeScoreAndId) {
      var id = Object.entries(animeScoreAndId)[0][1].animeId;
      var score = Object.entries(animeScoreAndId)[0][1].score;
      if (document.getElementById(id).children[0].children[0].children[2].textContent.indexOf('| Score: ') === -1) {
        document.getElementById(id).children[0].children[0].children[2].textContent = document.getElementById(id).children[0].children[0].children[2].textContent + "| Score: " + score;
      }
    });
  }
}
