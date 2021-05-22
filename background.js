function getAnimeTitles() {
  var animeTitles = []
  var animeEntries = document.getElementsByClassName("series-title");
  for (var i = 0; i < animeEntries.length; i++) {
    animeTitles.push(animeEntries[i].textContent);
  }
  return animeTitles;
}

chrome.webNavigation.onCompleted.addListener(function(tab) {
  if (tab.frameId==0 && tab.url.indexOf("crunchyroll.com") != -1 && tab.url.indexOf("anime") != -1) {
      console.log("Crunchyroll load complete");
      chrome.scripting.executeScript({
        target: { tabId: tab.tabId },
        function: getAnimeTitles
    },
    (animeTitles) => {
      animeTitles[0].result.forEach(function(animeTitle) {
        console.log(encodeURIComponent(animeTitle.trim()));
        fetch('https://myanimelist.net/search/all?cat=all&q=' + encodeURIComponent(animeTitle.trim()))
        .then(response => response.text())
        .then(result => {
          console.log(result);
          //parse score
          //save score associated in a map which key its the title
          //invoke another function passing the map as argument
          //https://stackoverflow.com/questions/17567624/pass-a-parameter-to-a-content-script-injected-using-chrome-tabs-executescript
        });
      });

    });
  }
});
