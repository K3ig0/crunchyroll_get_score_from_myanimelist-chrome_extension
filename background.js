chrome.webNavigation.onCompleted.addListener(function(tab) {
  this.ifCrunchyRollThenRequestScoresFromMyAnimeList(tab);
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  this.checkNewAnimeTitlesPendingToGetStoreAndRequestScore(sender.tab.id);
});

function ifCrunchyRollThenRequestScoresFromMyAnimeList(tab) {
  if (tab && tab.frameId==0) {
    if (tab.url.indexOf("beta.crunchyroll.com") != -1) {
      this.createObserverOnBetaDOM(tab.tabId);
      this.checkNewAnimeTitlesPendingToGetStoreAndRequestScore(tab.tabId);
    } else if (tab.url.indexOf("crunchyroll.com") != -1 && tab.url.indexOf("anime") != -1) {
      this.createObserverOnDOM(tab.tabId);
      this.checkNewAnimeTitlesPendingToGetStoreAndRequestScore(tab.tabId);
    }
  }
}

function createObserverOnBetaDOM(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    function: _createObserverOnBetaDOM
  });
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
      this.requestScoresToMyAnimeListIfNotCachedAndShow(animeTitlesToId, tabId);
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
      console.warn("MyAnimeList.net access is temporarily blocked. Go to the site to enable it");
      chrome.notifications.create("MyAnimeList.net block", {
          // chrome.i18n.getMessage is not working from service workers due to a bug
          title: navigator.language.startsWith("es") ? "La puntuación del Anime no se puede mostrar" : "Anime score cannot be displayed",
          message: navigator.language.startsWith("es") ? "1) Accede a MyAnimeList.net para desbloquear el sitio \n2) Refresca la página web de Crunchyroll para continuar viendo la puntuación de Anime" : "1) Visit MyAnimeList.net to unblock \n2) Refresh the Crunchyroll website to continue viewing the anime score",
          iconUrl: '/logo/logo.png',
          type: "basic"
      });
      chrome.action.setBadgeBackgroundColor({color: "#FF0000"});
      chrome.action.setBadgeText({text: "⚿", tabId});
      chrome.action.setPopup({popup: "popup/myanimelist_block.html", tabId});
      return;
    } else {
      chrome.notifications.clear("MyAnimeList.net block");
      chrome.action.setBadgeText({text: "", tabId});
      chrome.action.setPopup({popup: "popup/popup.html", tabId});
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

function _createObserverOnBetaDOM() {
  const targetNode = document.querySelector("#content");
  const config = { childList: true, subtree: true, attributes: false};
  const callback = function(mutationsList, observer) {
    if (mutationsList.length > 1) {
        chrome.runtime.sendMessage({newAnimeEntries: mutationsList.length});
    }
  }
  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
}

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
  const oldCrunchyRollMainContent = document.getElementById("main_content");
  if (oldCrunchyRollMainContent) {
    const animeEntries = oldCrunchyRollMainContent.getElementsByClassName("series-title");
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
} else { // beta
    const animeBetaEntries = document.getElementsByClassName("browse-card");
    for (var i = 0; i < animeBetaEntries.length; i++) {
      if (animeBetaEntries[i].innerText.indexOf("Score: ") === -1) {
          const title = animeBetaEntries[i].getElementsByClassName("c-browse-card__title")[0].innerText;
          animeTitlesToId[title] = "beta";
      }
    }
  }
  return animeTitlesToId;
}

function showAnimeScore() {
  const oldCrunchyRollMainContent = document.getElementById("main_content");
  if (oldCrunchyRollMainContent) {
    const animeEntries = oldCrunchyRollMainContent.getElementsByClassName("series-title");
    for (var i = 0; i < animeEntries.length; i++) {
      chrome.storage.local.get([animeEntries[i].textContent], function(animeScoreAndId) {
        const id = Object.entries(animeScoreAndId)[0][1].animeId;
        const score = Object.entries(animeScoreAndId)[0][1].score;
        const doc = document.getElementById(id);
        if (doc.children[0].children[0].children[2].textContent.indexOf("| Score: ") === -1) {
          var textBelowTitle = doc.children[0].children[0].children[2].textContent;
          textBelowTitle = textBelowTitle.replace(/Ep (\d+).*/, "Ep $1 "); // in the "/anime/updated" endpoint replace the hours ago text in order to show the score
          doc.children[0].children[0].children[2].textContent = textBelowTitle + "| Score: " + score;

          // fade low score shows:
          chrome.storage.sync.get({
            fadeScore: 7.00, // default values
            fadeOpacity: 0.1
          }, function(items) {
            if (parseFloat(score) < parseFloat(items.fadeScore)) {
              doc.getElementsByTagName('img')[0].style.opacity = parseFloat(items.fadeOpacity);
            }
          });        
        }
      });
    }
  } else { // beta
    const animeBetaEntries = document.getElementsByClassName("browse-card");
    for (var i = 0; i < animeBetaEntries.length; i++) {
      if (animeBetaEntries[i].innerText.indexOf("Score: ") === -1) {
        const doc = animeBetaEntries[i].getElementsByClassName("c-browse-card__title")[0];
        const img = animeBetaEntries[i].getElementsByClassName("c-browse-card__poster-wrapper")[0];
        chrome.storage.local.get([doc.innerText], function(animeScoreAndId) {
          const score = Object.entries(animeScoreAndId)[0][1].score;
          var background_color = parseFloat(score) < 5.00 ? "#f00" : parseFloat(score) < 7.50 ? "#fc3" : "#6c3";
          doc.outerHTML = '<h4 style="text-align: center; background-color: ' + background_color + '"> Score: ' + score + '</h4>' + doc.outerHTML;

          // fade low score shows:
          chrome.storage.sync.get({
            fadeScore: 7.00, // default values
            fadeOpacity: 0.1
          }, function(items) {
            if (parseFloat(score) < parseFloat(items.fadeScore)) {
              img.style.opacity = parseFloat(items.fadeOpacity);
            }
          });  
        });
      }
    }
  }
}
